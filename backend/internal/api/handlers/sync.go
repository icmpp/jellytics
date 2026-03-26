package handlers

import (
	"context"
	"database/sql"
	"net/http"
	"sync"
	"time"

	"jellytics/backend/internal/api/middleware"
	"jellytics/backend/internal/errors"
	"jellytics/backend/internal/services"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog/log"
)

type SyncHandler struct {
	db          *sql.DB
	syncService *services.SyncService
}

func NewSyncHandlerWithDataPath(db *sql.DB, dataPath string, syncConfig services.SyncConfig) *SyncHandler {
	return &SyncHandler{
		db:          db,
		syncService: services.NewSyncServiceWithDataPath(db, syncConfig, dataPath),
	}
}

func (h *SyncHandler) TriggerSync(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	syncCtx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)

	go func() {
		defer cancel()
		if err := h.syncService.SyncUser(syncCtx, userID); err != nil {
			log.Warn().Err(err).Int("user_id", userID).Msg("Manual sync failed")
		} else {
			log.Info().Int("user_id", userID).Msg("Manual sync complete")
		}
	}()

	writeJSON(w, r, map[string]string{
		"message": "Sync started",
		"status":  "in_progress",
	})
}

func (h *SyncHandler) GetSyncStatus(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	status, err := h.syncService.GetLastSyncStatus(r.Context(), userID)
	if err != nil {
		handleError(w, r, err)
		return
	}

	writeJSON(w, r, status)
}

func (h *SyncHandler) GetSyncHealth(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	ctx := r.Context()
	health := make(map[string]interface{})

	var status interface{}
	var syncHistory []map[string]interface{}
	var dataCounts map[string]int
	var syncState map[string]interface{}
	var statusErr error
	var wg sync.WaitGroup

	wg.Add(1)
	go func() {
		defer wg.Done()
		status, statusErr = h.syncService.GetLastSyncStatus(ctx, userID)
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		syncHistory = h.getSyncHistory(ctx, userID, 10)
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		dataCounts = h.getDataCounts(ctx, userID)
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		syncState = h.getSyncStateInfo(ctx, userID)
	}()

	wg.Wait()

	if statusErr != nil {
		log.Warn().Err(statusErr).Msg("Failed to get last sync status")
		health["last_sync"] = map[string]string{"status": "unknown"}
	} else {
		health["last_sync"] = status
	}
	health["history"] = syncHistory
	health["health_score"] = h.calculateHealthScore(syncHistory)
	health["data_counts"] = dataCounts
	health["sync_state"] = syncState

	writeJSON(w, r, health)
}

func (h *SyncHandler) getSyncHistory(ctx context.Context, userID int, limit int) []map[string]interface{} {
	rows, err := h.db.QueryContext(ctx,
		`SELECT sync_started_at, sync_completed_at, status, items_synced, items_failed, duration_seconds, error_message
		 FROM sync_logs
		 WHERE user_id = ?
		 ORDER BY sync_started_at DESC
		 LIMIT ?`,
		userID, limit)
	if err != nil {
		log.Warn().Err(err).Msg("Failed to get sync history")
		return nil
	}
	defer rows.Close()

	var history []map[string]interface{}
	for rows.Next() {
		var startedAt, completedAt sql.NullTime
		var status sql.NullString
		var itemsSynced, itemsFailed sql.NullInt64
		var durationSeconds sql.NullFloat64
		var errorMessage sql.NullString

		if err := rows.Scan(&startedAt, &completedAt, &status, &itemsSynced, &itemsFailed, &durationSeconds, &errorMessage); err != nil {
			continue
		}

		entry := map[string]interface{}{}
		if startedAt.Valid {
			entry["started_at"] = startedAt.Time.Format(time.RFC3339)
		}
		if completedAt.Valid {
			entry["completed_at"] = completedAt.Time.Format(time.RFC3339)
		}
		if status.Valid {
			entry["status"] = status.String
		}
		if itemsSynced.Valid {
			entry["items_synced"] = itemsSynced.Int64
		}
		if itemsFailed.Valid {
			entry["items_failed"] = itemsFailed.Int64
		}
		if durationSeconds.Valid {
			entry["duration_seconds"] = durationSeconds.Float64
		}
		if errorMessage.Valid && errorMessage.String != "" {
			entry["error"] = errorMessage.String
		}

		history = append(history, entry)
	}

	return history
}

func (h *SyncHandler) calculateHealthScore(history []map[string]interface{}) map[string]interface{} {
	if len(history) == 0 {
		return map[string]interface{}{
			"score":   0,
			"status":  "unknown",
			"message": "No sync history available",
		}
	}

	successCount := 0
	totalItems := 0
	failedItems := 0

	for _, entry := range history {
		if status, ok := entry["status"].(string); ok && status == "success" {
			successCount++
		}
		if synced, ok := entry["items_synced"].(int64); ok {
			totalItems += int(synced)
		}
		if failed, ok := entry["items_failed"].(int64); ok {
			failedItems += int(failed)
		}
	}

	successRate := float64(successCount) / float64(len(history)) * 100
	failureRate := 0.0
	if totalItems > 0 {
		failureRate = float64(failedItems) / float64(totalItems+failedItems) * 100
	}

	score := successRate - failureRate
	if score < 0 {
		score = 0
	}

	status := "healthy"
	message := "Sync is operating normally"
	if score < 50 {
		status = "critical"
		message = "Sync is experiencing significant issues"
	} else if score < 80 {
		status = "degraded"
		message = "Sync is experiencing some issues"
	}

	return map[string]interface{}{
		"score":        int(score),
		"status":       status,
		"message":      message,
		"success_rate": int(successRate),
		"syncs_total":  len(history),
	}
}

func (h *SyncHandler) getDataCounts(ctx context.Context, userID int) map[string]int {
	var showCount, movieCount, episodeCount, whCount int
	var wg sync.WaitGroup

	wg.Add(1)
	go func() {
		defer wg.Done()
		h.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM shows WHERE user_id = ? AND deleted_at IS NULL", userID).Scan(&showCount)
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		h.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM movies WHERE user_id = ? AND deleted_at IS NULL", userID).Scan(&movieCount)
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		h.db.QueryRowContext(ctx,
			`SELECT COUNT(*) FROM episodes e 
			 JOIN shows s ON e.show_id = s.id 
			 WHERE s.user_id = ? AND s.deleted_at IS NULL`, userID).Scan(&episodeCount)
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		h.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM watch_history WHERE user_id = ?", userID).Scan(&whCount)
	}()

	wg.Wait()

	return map[string]int{
		"shows":         showCount,
		"movies":        movieCount,
		"episodes":      episodeCount,
		"watch_history": whCount,
	}
}

func (h *SyncHandler) getSyncStateInfo(ctx context.Context, userID int) map[string]interface{} {
	state := make(map[string]interface{})

	rows, err := h.db.QueryContext(ctx,
		`SELECT entity_type, last_sync_at, items_synced, updated_at
		 FROM sync_state
		 WHERE user_id = ?`,
		userID)
	if err != nil {
		return state
	}
	defer rows.Close()

	for rows.Next() {
		var entityType string
		var lastSyncAt sql.NullTime
		var itemsSynced sql.NullInt64
		var updatedAt sql.NullTime

		if err := rows.Scan(&entityType, &lastSyncAt, &itemsSynced, &updatedAt); err != nil {
			continue
		}

		entry := map[string]interface{}{}
		if lastSyncAt.Valid {
			entry["last_sync_at"] = lastSyncAt.Time.Format(time.RFC3339)
		}
		if itemsSynced.Valid {
			entry["items_synced"] = itemsSynced.Int64
		}
		if updatedAt.Valid {
			entry["updated_at"] = updatedAt.Time.Format(time.RFC3339)
		}

		state[entityType] = entry
	}

	return state
}

func (h *SyncHandler) RegisterRoutes(r chi.Router) {
	r.Post("/", h.TriggerSync)
	r.Get("/status", h.GetSyncStatus)
	r.Get("/health", h.GetSyncHealth)
}
