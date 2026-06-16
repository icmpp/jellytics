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

type CollectionsHandler struct {
	store      repository.CollectionStore
	mediaStore repository.MediaStore
}

func NewCollectionsHandler(db *sql.DB) *CollectionsHandler {
	return &CollectionsHandler{
		store:      repository.NewSQLCollectionStore(db),
		mediaStore: repository.NewSQLMediaStore(db),
	}
}

func (h *CollectionsHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	// Optional "does this collection contain item X" filter.
	var filterItemType string
	var filterItemID int
	itemType := r.URL.Query().Get("item_type")
	if id, err := strconv.Atoi(r.URL.Query().Get("item_id")); err == nil && id > 0 && (itemType == "movie" || itemType == "show") {
		filterItemType = itemType
		filterItemID = id
	}

	collections, err := h.store.List(r.Context(), userID, filterItemType, filterItemID)
	if err != nil {
		handleError(w, r, err)
		return
	}
	writeJSON(w, r, collections)
}

func (h *CollectionsHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		handleError(w, r, errors.New(errors.CodeValidationError, "name is required"))
		return
	}

	c, err := h.store.Create(r.Context(), userID, req.Name, req.Description)
	if err != nil {
		handleError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusCreated)
	writeJSON(w, r, c)
}

func (h *CollectionsHandler) Get(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil || id <= 0 {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid collection ID"))
		return
	}

	c, err := h.store.Get(r.Context(), userID, id)
	if err != nil {
		handleError(w, r, err)
		return
	}
	if c == nil {
		handleError(w, r, errors.New(errors.CodeNotFound, "Collection not found"))
		return
	}
	writeJSON(w, r, c)
}

func (h *CollectionsHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil || id <= 0 {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid collection ID"))
		return
	}

	var req struct {
		Name        *string `json:"name"`
		Description *string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid request body"))
		return
	}

	found, err := h.store.Update(r.Context(), userID, id, req.Name, req.Description)
	if err != nil {
		handleError(w, r, err)
		return
	}
	if !found {
		handleError(w, r, errors.New(errors.CodeNotFound, "Collection not found"))
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *CollectionsHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil || id <= 0 {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid collection ID"))
		return
	}

	found, err := h.store.Delete(r.Context(), userID, id)
	if err != nil {
		handleError(w, r, err)
		return
	}
	if !found {
		handleError(w, r, errors.New(errors.CodeNotFound, "Collection not found"))
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *CollectionsHandler) AddItem(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil || id <= 0 {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid collection ID"))
		return
	}

	var req struct {
		ItemType string `json:"item_type"`
		ItemID   int    `json:"item_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid request body"))
		return
	}
	if req.ItemType != "movie" && req.ItemType != "show" {
		handleError(w, r, errors.New(errors.CodeValidationError, "item_type must be 'movie' or 'show'"))
		return
	}
	if req.ItemID <= 0 {
		handleError(w, r, errors.New(errors.CodeValidationError, "item_id must be positive"))
		return
	}

	owns, err := h.store.Owns(r.Context(), userID, id)
	if err != nil {
		handleError(w, r, err)
		return
	}
	if !owns {
		handleError(w, r, errors.New(errors.CodeNotFound, "Collection not found"))
		return
	}
	if !verifyItemExists(r.Context(), h.mediaStore, w, r, req.ItemType, req.ItemID, userID) {
		return
	}

	if err := h.store.AddItem(r.Context(), id, req.ItemType, req.ItemID); err != nil {
		handleError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *CollectionsHandler) RemoveItem(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil || id <= 0 {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid collection ID"))
		return
	}

	itemType := chi.URLParam(r, "itemType")
	itemID, err := strconv.Atoi(chi.URLParam(r, "itemId"))
	if err != nil || itemID <= 0 {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid item ID"))
		return
	}
	if itemType != "movie" && itemType != "show" {
		handleError(w, r, errors.New(errors.CodeValidationError, "item_type must be 'movie' or 'show'"))
		return
	}

	found, err := h.store.RemoveItem(r.Context(), userID, id, itemType, itemID)
	if err != nil {
		handleError(w, r, err)
		return
	}
	if !found {
		handleError(w, r, errors.New(errors.CodeNotFound, "Item not found in collection"))
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *CollectionsHandler) RegisterRoutes(r chi.Router) {
	r.Get("/", h.List)
	r.Post("/", h.Create)
	r.Get("/{id}", h.Get)
	r.Put("/{id}", h.Update)
	r.Delete("/{id}", h.Delete)
	r.Post("/{id}/items", h.AddItem)
	r.Delete("/{id}/items/{itemType}/{itemId}", h.RemoveItem)
}
