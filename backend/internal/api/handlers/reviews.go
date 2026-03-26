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

type ReviewsHandler struct {
	db         *sql.DB
	mediaStore repository.MediaStore
}

func NewReviewsHandler(db *sql.DB) *ReviewsHandler {
	return &ReviewsHandler{db: db, mediaStore: repository.NewSQLMediaStore(db)}
}

type SetReviewRequest struct {
	ItemType   string `json:"item_type"`
	ItemID     int    `json:"item_id"`
	ReviewText string `json:"review_text"`
	Notes      string `json:"notes,omitempty"`
}

func (h *ReviewsHandler) GetReview(w http.ResponseWriter, r *http.Request) {
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

	var review models.Review
	err = h.db.QueryRowContext(r.Context(),
		`SELECT id, user_id, item_type, item_id, review_text, notes, created_at, updated_at
		 FROM reviews
		 WHERE user_id = ? AND item_type = ? AND item_id = ?`,
		userID, itemType, itemID).Scan(
		&review.ID, &review.UserID, &review.ItemType, &review.ItemID,
		&review.ReviewText, &review.Notes, &review.CreatedAt, &review.UpdatedAt)

	if err == sql.ErrNoRows {
		writeJSON(w, r, nil)
		return
	}
	if err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to get review"))
		return
	}

	writeJSON(w, r, review)
}

func (h *ReviewsHandler) SetReview(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	var req SetReviewRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid request body"))
		return
	}

	if req.ItemType != "show" && req.ItemType != "movie" {
		handleError(w, r, errors.New(errors.CodeValidationError, "item_type must be 'show' or 'movie'"))
		return
	}

	if req.ReviewText == "" {
		handleError(w, r, errors.New(errors.CodeValidationError, "review_text is required"))
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
		`SELECT id FROM reviews WHERE user_id = ? AND item_type = ? AND item_id = ?`,
		userID, req.ItemType, req.ItemID).Scan(&existingID)

	var review models.Review
	isUpdate := err == nil

	if isUpdate {
		_, err = h.db.ExecContext(r.Context(),
			`UPDATE reviews SET review_text = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
			 WHERE id = ?`,
			req.ReviewText, req.Notes, existingID)
		if err != nil {
			handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to update review"))
			return
		}

		err = h.db.QueryRowContext(r.Context(),
			`SELECT id, user_id, item_type, item_id, review_text, notes, created_at, updated_at
			 FROM reviews WHERE id = ?`,
			existingID).Scan(
			&review.ID, &review.UserID, &review.ItemType, &review.ItemID,
			&review.ReviewText, &review.Notes, &review.CreatedAt, &review.UpdatedAt)
	} else {
		_, err = h.db.ExecContext(r.Context(),
			`INSERT INTO reviews (user_id, item_type, item_id, review_text, notes, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
			userID, req.ItemType, req.ItemID, req.ReviewText, req.Notes)
		if err != nil {
			handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to save review"))
			return
		}

		err = h.db.QueryRowContext(r.Context(),
			`SELECT id, user_id, item_type, item_id, review_text, notes, created_at, updated_at
			 FROM reviews WHERE user_id = ? AND item_type = ? AND item_id = ?`,
			userID, req.ItemType, req.ItemID).Scan(
			&review.ID, &review.UserID, &review.ItemType, &review.ItemID,
			&review.ReviewText, &review.Notes, &review.CreatedAt, &review.UpdatedAt)
	}

	if err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to get saved review"))
		return
	}

	if isUpdate {
		w.WriteHeader(http.StatusOK)
	} else {
		w.WriteHeader(http.StatusCreated)
	}
	writeJSON(w, r, review)
}

func (h *ReviewsHandler) DeleteReview(w http.ResponseWriter, r *http.Request) {
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
		`DELETE FROM reviews WHERE user_id = ? AND item_type = ? AND item_id = ?`,
		userID, itemType, itemID)

	if err == nil {
		if rows, _ := result.RowsAffected(); rows == 0 {
			handleError(w, r, errors.New(errors.CodeNotFound, "Review not found"))
			return
		}
	}

	if err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to delete review"))
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *ReviewsHandler) ListReviews(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	rows, err := h.db.QueryContext(r.Context(),
		`SELECT id, user_id, item_type, item_id, review_text, notes, created_at, updated_at
		 FROM reviews
		 WHERE user_id = ?
		 ORDER BY updated_at DESC`,
		userID)
	if err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to list reviews"))
		return
	}
	defer rows.Close()

	var reviews []models.Review
	for rows.Next() {
		var review models.Review
		if err := rows.Scan(&review.ID, &review.UserID, &review.ItemType, &review.ItemID,
			&review.ReviewText, &review.Notes, &review.CreatedAt, &review.UpdatedAt); err != nil {
			handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to scan review row"))
			return
		}
		reviews = append(reviews, review)
	}
	if err := rows.Err(); err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to iterate reviews"))
		return
	}
	if reviews == nil {
		reviews = []models.Review{}
	}

	writeJSON(w, r, reviews)
}

func (h *ReviewsHandler) RegisterRoutes(r chi.Router) {
	r.Get("/", h.ListReviews)
	r.Get("/{itemType}/{itemId}", h.GetReview)
	r.Post("/", h.SetReview)
	r.Delete("/{itemType}/{itemId}", h.DeleteReview)
}
