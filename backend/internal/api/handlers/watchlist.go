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

type WatchlistHandler struct {
	store repository.WatchlistStore
}

func NewWatchlistHandler(db *sql.DB) *WatchlistHandler {
	return &WatchlistHandler{store: repository.NewSQLWatchlistStore(db)}
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

	limit, offset := parsePagination(r)
	items, err := h.store.List(r.Context(), userID, r.URL.Query().Get("item_type"), limit, offset)
	if err != nil {
		handleError(w, r, err)
		return
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

	item, created, err := h.store.Add(r.Context(), userID, req.ItemType, req.ItemID)
	if err != nil {
		handleError(w, r, err)
		return
	}

	if created {
		w.WriteHeader(http.StatusCreated)
	} else {
		w.WriteHeader(http.StatusOK)
	}
	writeJSON(w, r, item)
}

func (h *WatchlistHandler) RemoveFromWatchlist(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid watchlist item ID"))
		return
	}

	found, err := h.store.Remove(r.Context(), userID, id)
	if err != nil {
		handleError(w, r, err)
		return
	}
	if !found {
		handleError(w, r, errors.New(errors.CodeNotFound, "Watchlist item not found"))
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *WatchlistHandler) RegisterRoutes(r chi.Router) {
	r.Get("/", h.ListWatchlist)
	r.Post("/", h.AddToWatchlist)
	r.Delete("/{id}", h.RemoveFromWatchlist)
}
