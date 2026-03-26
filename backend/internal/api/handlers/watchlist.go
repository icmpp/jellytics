package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"jellytics/backend/internal/api/middleware"
	"jellytics/backend/internal/errors"
	"jellytics/backend/internal/models"

	"github.com/go-chi/chi/v5"
)

type WatchlistHandler struct {
	db *sql.DB
}

func NewWatchlistHandler(db *sql.DB) *WatchlistHandler {
	return &WatchlistHandler{db: db}
}

type AddWatchlistRequest struct {
	ItemType string `json:"item_type"`
	ItemID   int    `json:"item_id"`
}

func (h *WatchlistHandler) ListWatchlist(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	itemType := r.URL.Query().Get("item_type") // Optional filter: 'show' or 'movie'

	query := `
		SELECT w.id, w.user_id, w.item_type, w.item_id, w.title, w.poster_url, w.added_at, w.created_at, w.updated_at,
			CASE 
				WHEN w.item_type = 'show' THEN (SELECT jellyfin_id FROM shows WHERE id = w.item_id)
				WHEN w.item_type = 'movie' THEN (SELECT jellyfin_id FROM movies WHERE id = w.item_id)
			END as jellyfin_id
		FROM watchlist w
		WHERE w.user_id = ?
	`

	args := []interface{}{userID}

	if itemType != "" {
		query += " AND w.item_type = ?"
		args = append(args, itemType)
	}

	limit, offset := parsePagination(r)
	query += " ORDER BY w.added_at DESC LIMIT ? OFFSET ?"
	args = append(args, limit, offset)

	rows, err := h.db.QueryContext(r.Context(), query, args...)
	if err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to query watchlist"))
		return
	}
	defer rows.Close()

	var items []models.WatchlistItem
	for rows.Next() {
		var item models.WatchlistItem
		var posterURL sql.NullString
		var jellyfinID sql.NullString

		err := rows.Scan(
			&item.ID, &item.UserID, &item.ItemType, &item.ItemID, &item.Title,
			&posterURL, &item.AddedAt, &item.CreatedAt, &item.UpdatedAt, &jellyfinID,
		)
		if err != nil {
			continue
		}

		if posterURL.Valid {
			item.PosterURL = posterURL.String
		}
		if jellyfinID.Valid {
			item.JellyfinID = jellyfinID.String
		}

		items = append(items, item)
	}

	writeJSON(w, r, map[string]interface{}{
		"items": items,
		"total": len(items),
	})
}

func (h *WatchlistHandler) AddToWatchlist(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	var req AddWatchlistRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid request body"))
		return
	}

	if req.ItemType != "show" && req.ItemType != "movie" {
		handleError(w, r, errors.New(errors.CodeValidationError, "item_type must be 'show' or 'movie'"))
		return
	}

	if req.ItemID <= 0 {
		handleError(w, r, errors.New(errors.CodeValidationError, "item_id must be a positive integer"))
		return
	}

	var title string
	var posterURL sql.NullString
	var jellyfinID string
	var err error

	if req.ItemType == "show" {
		err = h.db.QueryRowContext(r.Context(),
			`SELECT title, poster_url, jellyfin_id FROM shows WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
			req.ItemID, userID).Scan(&title, &posterURL, &jellyfinID)
	} else {
		err = h.db.QueryRowContext(r.Context(),
			`SELECT title, poster_url, jellyfin_id FROM movies WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
			req.ItemID, userID).Scan(&title, &posterURL, &jellyfinID)
	}

	if err == sql.ErrNoRows {
		handleError(w, r, errors.New(errors.CodeNotFound, "Item not found"))
		return
	}
	if err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to verify item"))
		return
	}

	var existingItem models.WatchlistItem
	var existingPosterURL sql.NullString
	err = h.db.QueryRowContext(r.Context(),
		`SELECT id, user_id, item_type, item_id, title, poster_url, added_at, created_at, updated_at
		 FROM watchlist
		 WHERE user_id = ? AND item_type = ? AND item_id = ?`,
		userID, req.ItemType, req.ItemID).Scan(
		&existingItem.ID, &existingItem.UserID, &existingItem.ItemType, &existingItem.ItemID,
		&existingItem.Title, &existingPosterURL, &existingItem.AddedAt,
		&existingItem.CreatedAt, &existingItem.UpdatedAt)

	if err == nil {
		if existingPosterURL.Valid {
			existingItem.PosterURL = existingPosterURL.String
		}
		existingItem.JellyfinID = jellyfinID
		var posterURLStr string
		if posterURL.Valid {
			posterURLStr = posterURL.String
		}
		_, err = h.db.ExecContext(r.Context(),
			`UPDATE watchlist SET title = ?, poster_url = ?, updated_at = CURRENT_TIMESTAMP
			 WHERE id = ?`,
			title, posterURLStr, existingItem.ID)
		if err == nil {
			existingItem.Title = title
			if posterURL.Valid {
				existingItem.PosterURL = posterURLStr
			}
		}

		w.WriteHeader(http.StatusOK)
		writeJSON(w, r, existingItem)
		return
	}

	var posterURLStr string
	if posterURL.Valid {
		posterURLStr = posterURL.String
	}

	result, err := h.db.ExecContext(r.Context(),
		`INSERT INTO watchlist (user_id, item_type, item_id, title, poster_url, added_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
		userID, req.ItemType, req.ItemID, title, posterURLStr)

	if err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to add to watchlist"))
		return
	}

	var item models.WatchlistItem
	var posterURLResult sql.NullString
	itemID, _ := result.LastInsertId()
	err = h.db.QueryRowContext(r.Context(),
		`SELECT id, user_id, item_type, item_id, title, poster_url, added_at, created_at, updated_at
		 FROM watchlist
		 WHERE id = ?`,
		itemID).Scan(
		&item.ID, &item.UserID, &item.ItemType, &item.ItemID, &item.Title,
		&posterURLResult, &item.AddedAt, &item.CreatedAt, &item.UpdatedAt)

	if err != nil {
		item = models.WatchlistItem{
			ID:         int(itemID),
			UserID:     userID,
			ItemType:   req.ItemType,
			ItemID:     req.ItemID,
			JellyfinID: jellyfinID,
			Title:      title,
			AddedAt:    time.Now(),
			CreatedAt:  time.Now(),
			UpdatedAt:  time.Now(),
		}
		if posterURL.Valid {
			item.PosterURL = posterURL.String
		}
	} else {
		if posterURLResult.Valid {
			item.PosterURL = posterURLResult.String
		}
		item.JellyfinID = jellyfinID
	}

	w.WriteHeader(http.StatusCreated)
	writeJSON(w, r, item)
}

func (h *WatchlistHandler) RemoveFromWatchlist(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid watchlist item ID"))
		return
	}

	var itemUserID int
	err = h.db.QueryRowContext(r.Context(),
		`SELECT user_id FROM watchlist WHERE id = ?`,
		id).Scan(&itemUserID)

	if err == sql.ErrNoRows {
		handleError(w, r, errors.New(errors.CodeNotFound, "Watchlist item not found"))
		return
	}
	if err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to verify watchlist item"))
		return
	}

	if itemUserID != userID {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	_, err = h.db.ExecContext(r.Context(),
		`DELETE FROM watchlist WHERE id = ? AND user_id = ?`,
		id, userID)

	if err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to remove from watchlist"))
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *WatchlistHandler) RegisterRoutes(r chi.Router) {
	r.Get("/", h.ListWatchlist)
	r.Post("/", h.AddToWatchlist)
	r.Delete("/{id}", h.RemoveFromWatchlist)
}
