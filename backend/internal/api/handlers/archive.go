package handlers

import (
	"context"
	"database/sql"
	"net/http"

	"jellytics/backend/internal/api/middleware"
	"jellytics/backend/internal/errors"

	"github.com/go-chi/chi/v5"
)

type ArchiveHandler struct {
	db *sql.DB
}

func NewArchiveHandler(db *sql.DB) *ArchiveHandler {
	return &ArchiveHandler{db: db}
}

type ArchiveItem struct {
	ID                 int      `json:"id"`
	Type               string   `json:"type"` // "movie" | "show"
	JellyfinID         string   `json:"jellyfin_id"`
	Title              string   `json:"title"`
	PosterURL          *string  `json:"posterUrl,omitempty"`
	Year               *int     `json:"year,omitempty"`
	Status             string   `json:"status,omitempty"`
	TotalWatchTimeMins int      `json:"totalWatchTimeMinutes,omitempty"`
	WatchCount         int      `json:"watchCount,omitempty"`
	RemovedAt          *string  `json:"removedAt,omitempty"` // ISO8601 for Date Removed sorting
}

type ArchiveResponse struct {
	Movies []ArchiveItem `json:"movies"`
	Shows  []ArchiveItem `json:"shows"`
}

func (h *ArchiveHandler) ListRemoved(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	movies, err := h.getRemovedMovies(r.Context(), userID)
	if err != nil {
		handleError(w, r, err)
		return
	}
	shows, err := h.getRemovedShows(r.Context(), userID)
	if err != nil {
		handleError(w, r, err)
		return
	}

	writeJSON(w, r, ArchiveResponse{
		Movies: movies,
		Shows:  shows,
	})
}

func (h *ArchiveHandler) getRemovedMovies(ctx context.Context, userID int) ([]ArchiveItem, error) {
	rows, err := h.db.QueryContext(ctx,
		`SELECT id, jellyfin_id, title, year, status, total_watch_time_minutes, watch_count, deleted_at
		 FROM movies
		 WHERE user_id = ? AND deleted_at IS NOT NULL
		 ORDER BY deleted_at DESC`,
		userID)
	if err != nil {
		return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to query removed movies")
	}
	defer rows.Close()

	var items []ArchiveItem
	for rows.Next() {
		var it ArchiveItem
		var year sql.NullInt64
		var deletedAt sql.NullTime
		it.Type = "movie"
		if err := rows.Scan(&it.ID, &it.JellyfinID, &it.Title, &year, &it.Status,
			&it.TotalWatchTimeMins, &it.WatchCount, &deletedAt); err != nil {
			continue
		}
		if deletedAt.Valid {
			s := deletedAt.Time.Format("2006-01-02T15:04:05Z07:00")
			it.RemovedAt = &s
		}
		if year.Valid {
			y := int(year.Int64)
			it.Year = &y
		}
		poster := "/api/v1/images/movies/" + it.JellyfinID + "/poster"
		it.PosterURL = &poster
		items = append(items, it)
	}
	return items, nil
}

func (h *ArchiveHandler) getRemovedShows(ctx context.Context, userID int) ([]ArchiveItem, error) {
	rows, err := h.db.QueryContext(ctx,
		`SELECT id, jellyfin_id, title, year, status, total_watch_time_minutes, watched_episodes, deleted_at
		 FROM shows
		 WHERE user_id = ? AND deleted_at IS NOT NULL
		 ORDER BY deleted_at DESC`,
		userID)
	if err != nil {
		return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to query removed shows")
	}
	defer rows.Close()

	var items []ArchiveItem
	for rows.Next() {
		var it ArchiveItem
		var year sql.NullInt64
		var deletedAt sql.NullTime
		it.Type = "show"
		if err := rows.Scan(&it.ID, &it.JellyfinID, &it.Title, &year, &it.Status,
			&it.TotalWatchTimeMins, &it.WatchCount, &deletedAt); err != nil {
			continue
		}
		if deletedAt.Valid {
			s := deletedAt.Time.Format("2006-01-02T15:04:05Z07:00")
			it.RemovedAt = &s
		}
		if year.Valid {
			y := int(year.Int64)
			it.Year = &y
		}
		poster := "/api/v1/images/shows/" + it.JellyfinID + "/poster"
		it.PosterURL = &poster
		items = append(items, it)
	}
	return items, nil
}

func (h *ArchiveHandler) RegisterRoutes(r chi.Router) {
	r.Get("/", h.ListRemoved)
}
