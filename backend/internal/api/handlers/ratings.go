package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"

	"jellytics/backend/internal/api/middleware"
	"jellytics/backend/internal/errors"
	"jellytics/backend/internal/models"
	"jellytics/backend/internal/repository"

	"github.com/go-chi/chi/v5"
)

type RatingsHandler struct {
	db         *sql.DB
	mediaStore repository.MediaStore
}

func NewRatingsHandler(db *sql.DB) *RatingsHandler {
	return &RatingsHandler{db: db, mediaStore: repository.NewSQLMediaStore(db)}
}

type SetRatingRequest struct {
	ItemType string `json:"item_type"`
	ItemID   int    `json:"item_id"`
	Rating   int    `json:"rating"`
}

func (h *RatingsHandler) GetRating(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	itemType := chi.URLParam(r, "itemType")
	itemIDStr := chi.URLParam(r, "itemId")
	itemID, err := strconv.Atoi(itemIDStr)
	if err != nil {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid item ID"))
		return
	}

	if itemType != "show" && itemType != "movie" {
		handleError(w, r, errors.New(errors.CodeValidationError, "item_type must be 'show' or 'movie'"))
		return
	}

	if !verifyItemExists(r.Context(), h.mediaStore, w, r, itemType, itemID, userID) {
		return
	}

	var rating models.Rating
	err = h.db.QueryRowContext(r.Context(),
		`SELECT id, user_id, item_type, item_id, rating, rated_at, created_at, updated_at
		 FROM ratings
		 WHERE user_id = ? AND item_type = ? AND item_id = ?`,
		userID, itemType, itemID).Scan(
		&rating.ID, &rating.UserID, &rating.ItemType, &rating.ItemID,
		&rating.Rating, &rating.RatedAt, &rating.CreatedAt, &rating.UpdatedAt)

	if err == sql.ErrNoRows {
		writeJSON(w, r, nil)
		return
	}
	if err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to get rating"))
		return
	}

	writeJSON(w, r, rating)
}

func (h *RatingsHandler) SetRating(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	var req SetRatingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid request body"))
		return
	}

	if req.ItemType != "show" && req.ItemType != "movie" {
		handleError(w, r, errors.New(errors.CodeValidationError, "item_type must be 'show' or 'movie'"))
		return
	}

	if req.Rating < 1 || req.Rating > 10 {
		handleError(w, r, errors.New(errors.CodeValidationError, "rating must be between 1 and 10"))
		return
	}

	if req.ItemID <= 0 {
		handleError(w, r, errors.New(errors.CodeValidationError, "item_id must be a positive integer"))
		return
	}

	if !verifyItemExists(r.Context(), h.mediaStore, w, r, req.ItemType, req.ItemID, userID) {
		return
	}

	var existingID int
	var err error
	err = h.db.QueryRowContext(r.Context(),
		`SELECT id FROM ratings WHERE user_id = ? AND item_type = ? AND item_id = ?`,
		userID, req.ItemType, req.ItemID).Scan(&existingID)

	var rating models.Rating
	isUpdate := err == nil

	if isUpdate {
		_, err = h.db.ExecContext(r.Context(),
			`UPDATE ratings SET rating = ?, rated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
			 WHERE id = ?`,
			req.Rating, existingID)
		if err != nil {
			handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to update rating"))
			return
		}

		err = h.db.QueryRowContext(r.Context(),
			`SELECT id, user_id, item_type, item_id, rating, rated_at, created_at, updated_at
			 FROM ratings WHERE id = ?`,
			existingID).Scan(
			&rating.ID, &rating.UserID, &rating.ItemType, &rating.ItemID,
			&rating.Rating, &rating.RatedAt, &rating.CreatedAt, &rating.UpdatedAt)
	} else {
		_, err = h.db.ExecContext(r.Context(),
			`INSERT INTO ratings (user_id, item_type, item_id, rating, rated_at, created_at, updated_at)
			 VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
			userID, req.ItemType, req.ItemID, req.Rating)
		if err != nil {
			handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to save rating"))
			return
		}

		err = h.db.QueryRowContext(r.Context(),
			`SELECT id, user_id, item_type, item_id, rating, rated_at, created_at, updated_at
			 FROM ratings WHERE user_id = ? AND item_type = ? AND item_id = ?`,
			userID, req.ItemType, req.ItemID).Scan(
			&rating.ID, &rating.UserID, &rating.ItemType, &rating.ItemID,
			&rating.Rating, &rating.RatedAt, &rating.CreatedAt, &rating.UpdatedAt)
	}

	if err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to get saved rating"))
		return
	}

	if isUpdate {
		w.WriteHeader(http.StatusOK)
	} else {
		w.WriteHeader(http.StatusCreated)
	}
	writeJSON(w, r, rating)
}

func (h *RatingsHandler) DeleteRating(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	itemType := chi.URLParam(r, "itemType")
	itemIDStr := chi.URLParam(r, "itemId")
	itemID, err := strconv.Atoi(itemIDStr)
	if err != nil {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid item ID"))
		return
	}

	if itemType != "show" && itemType != "movie" {
		handleError(w, r, errors.New(errors.CodeValidationError, "item_type must be 'show' or 'movie'"))
		return
	}

	result, err := h.db.ExecContext(r.Context(),
		`DELETE FROM ratings WHERE user_id = ? AND item_type = ? AND item_id = ?`,
		userID, itemType, itemID)

	if err == nil {
		if rows, _ := result.RowsAffected(); rows == 0 {
			handleError(w, r, errors.New(errors.CodeNotFound, "Rating not found"))
			return
		}
	}

	if err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to delete rating"))
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *RatingsHandler) ListRatings(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	rows, err := h.db.QueryContext(r.Context(),
		`SELECT id, user_id, item_type, item_id, rating, rated_at, created_at, updated_at
		 FROM ratings
		 WHERE user_id = ?
		 ORDER BY rated_at DESC`,
		userID)
	if err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to list ratings"))
		return
	}
	defer rows.Close()

	var ratings []models.Rating
	for rows.Next() {
		var rating models.Rating
		if err := rows.Scan(&rating.ID, &rating.UserID, &rating.ItemType, &rating.ItemID,
			&rating.Rating, &rating.RatedAt, &rating.CreatedAt, &rating.UpdatedAt); err != nil {
			handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to scan rating row"))
			return
		}
		ratings = append(ratings, rating)
	}
	if err := rows.Err(); err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to iterate ratings"))
		return
	}
	if ratings == nil {
		ratings = []models.Rating{}
	}

	writeJSON(w, r, ratings)
}

func (h *RatingsHandler) RegisterRoutes(r chi.Router) {
	r.Get("/", h.ListRatings)
	r.Get("/{itemType}/{itemId}", h.GetRating)
	r.Post("/", h.SetRating)
	r.Delete("/{itemType}/{itemId}", h.DeleteRating)
}
