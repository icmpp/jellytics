package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"

	"jellytics/backend/internal/api/middleware"
	"jellytics/backend/internal/errors"
	"jellytics/backend/internal/repository"

	"github.com/go-chi/chi/v5"
)

type ReviewsHandler struct {
	reviewStore repository.ReviewStore
	mediaStore  repository.MediaStore
}

func NewReviewsHandler(db *sql.DB) *ReviewsHandler {
	return &ReviewsHandler{
		reviewStore: repository.NewSQLReviewStore(db),
		mediaStore:  repository.NewSQLMediaStore(db),
	}
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
	itemID, err := strconv.Atoi(chi.URLParam(r, "itemId"))
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

	review, err := h.reviewStore.Get(r.Context(), userID, itemType, itemID)
	if err != nil {
		handleError(w, r, err)
		return
	}
	if review == nil {
		writeJSON(w, r, nil)
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

	review, created, err := h.reviewStore.Upsert(r.Context(), userID, req.ItemType, req.ItemID, req.ReviewText, req.Notes)
	if err != nil {
		handleError(w, r, err)
		return
	}

	if created {
		w.WriteHeader(http.StatusCreated)
	} else {
		w.WriteHeader(http.StatusOK)
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
	itemID, err := strconv.Atoi(chi.URLParam(r, "itemId"))
	if err != nil {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid item ID"))
		return
	}
	if itemType != "show" && itemType != "movie" {
		handleError(w, r, errors.New(errors.CodeValidationError, "item_type must be 'show' or 'movie'"))
		return
	}

	found, err := h.reviewStore.Delete(r.Context(), userID, itemType, itemID)
	if err != nil {
		handleError(w, r, err)
		return
	}
	if !found {
		handleError(w, r, errors.New(errors.CodeNotFound, "Review not found"))
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

	reviews, err := h.reviewStore.List(r.Context(), userID)
	if err != nil {
		handleError(w, r, err)
		return
	}
	writeJSON(w, r, reviews)
}

func (h *ReviewsHandler) RegisterRoutes(r chi.Router) {
	r.Get("/", h.ListReviews)
	r.Get("/{itemType}/{itemId}", h.GetReview)
	r.Post("/", h.SetReview)
	r.Delete("/{itemType}/{itemId}", h.DeleteReview)
}
