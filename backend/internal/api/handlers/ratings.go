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

type RatingsHandler struct {
	ratingStore repository.RatingStore
	mediaStore  repository.MediaStore
}

func NewRatingsHandler(db *sql.DB) *RatingsHandler {
	return &RatingsHandler{
		ratingStore: repository.NewSQLRatingStore(db),
		mediaStore:  repository.NewSQLMediaStore(db),
	}
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

	rating, err := h.ratingStore.Get(r.Context(), userID, itemType, itemID)
	if err != nil {
		handleError(w, r, err)
		return
	}
	if rating == nil {
		writeJSON(w, r, nil)
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

	rating, created, err := h.ratingStore.Upsert(r.Context(), userID, req.ItemType, req.ItemID, req.Rating)
	if err != nil {
		handleError(w, r, err)
		return
	}

	if created {
		w.WriteHeader(http.StatusCreated)
	} else {
		w.WriteHeader(http.StatusOK)
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
	itemID, err := strconv.Atoi(chi.URLParam(r, "itemId"))
	if err != nil {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid item ID"))
		return
	}
	if itemType != "show" && itemType != "movie" {
		handleError(w, r, errors.New(errors.CodeValidationError, "item_type must be 'show' or 'movie'"))
		return
	}

	found, err := h.ratingStore.Delete(r.Context(), userID, itemType, itemID)
	if err != nil {
		handleError(w, r, err)
		return
	}
	if !found {
		handleError(w, r, errors.New(errors.CodeNotFound, "Rating not found"))
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

	ratings, err := h.ratingStore.List(r.Context(), userID)
	if err != nil {
		handleError(w, r, err)
		return
	}
	writeJSON(w, r, ratings)
}

func (h *RatingsHandler) RegisterRoutes(r chi.Router) {
	r.Get("/", h.ListRatings)
	r.Get("/{itemType}/{itemId}", h.GetRating)
	r.Post("/", h.SetRating)
	r.Delete("/{itemType}/{itemId}", h.DeleteRating)
}
