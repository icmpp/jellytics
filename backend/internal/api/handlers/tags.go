package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"jellytics/backend/internal/api/middleware"
	"jellytics/backend/internal/errors"
	"jellytics/backend/internal/repository"

	"github.com/go-chi/chi/v5"
)

type TagsHandler struct {
	store      repository.TagStore
	mediaStore repository.MediaStore
}

func NewTagsHandler(db *sql.DB) *TagsHandler {
	return &TagsHandler{
		store:      repository.NewSQLTagStore(db),
		mediaStore: repository.NewSQLMediaStore(db),
	}
}

func (h *TagsHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	tags, err := h.store.List(r.Context(), userID)
	if err != nil {
		handleError(w, r, err)
		return
	}
	writeJSON(w, r, tags)
}

func (h *TagsHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	var req struct {
		Name  string `json:"name"`
		Color string `json:"color"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		handleError(w, r, errors.New(errors.CodeValidationError, "name is required"))
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		handleError(w, r, errors.New(errors.CodeValidationError, "name is required"))
		return
	}

	t, err := h.store.Create(r.Context(), userID, name, req.Color)
	if err != nil {
		handleError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusCreated)
	writeJSON(w, r, t)
}

func (h *TagsHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil || id <= 0 {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid tag ID"))
		return
	}

	var req struct {
		Name  *string `json:"name"`
		Color *string `json:"color"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid request body"))
		return
	}

	found, err := h.store.Update(r.Context(), userID, id, req.Name, req.Color)
	if err != nil {
		handleError(w, r, err)
		return
	}
	if !found {
		handleError(w, r, errors.New(errors.CodeNotFound, "Tag not found"))
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *TagsHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil || id <= 0 {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid tag ID"))
		return
	}

	found, err := h.store.Delete(r.Context(), userID, id)
	if err != nil {
		handleError(w, r, err)
		return
	}
	if !found {
		handleError(w, r, errors.New(errors.CodeNotFound, "Tag not found"))
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *TagsHandler) AddItem(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	tagID, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil || tagID <= 0 {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid tag ID"))
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

	owns, err := h.store.Owns(r.Context(), userID, tagID)
	if err != nil {
		handleError(w, r, err)
		return
	}
	if !owns {
		handleError(w, r, errors.New(errors.CodeNotFound, "Tag not found"))
		return
	}
	if !verifyItemExists(r.Context(), h.mediaStore, w, r, req.ItemType, req.ItemID, userID) {
		return
	}

	if err := h.store.AddItem(r.Context(), userID, tagID, req.ItemType, req.ItemID); err != nil {
		handleError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *TagsHandler) RemoveItem(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	tagID, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil || tagID <= 0 {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid tag ID"))
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

	found, err := h.store.RemoveItem(r.Context(), userID, tagID, itemType, itemID)
	if err != nil {
		handleError(w, r, err)
		return
	}
	if !found {
		handleError(w, r, errors.New(errors.CodeNotFound, "Tag not found on item"))
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *TagsHandler) GetItems(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	tagID, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil || tagID <= 0 {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid tag ID"))
		return
	}

	tagName, found, err := h.store.Name(r.Context(), userID, tagID)
	if err != nil {
		handleError(w, r, err)
		return
	}
	if !found {
		handleError(w, r, errors.New(errors.CodeNotFound, "Tag not found"))
		return
	}

	items, err := h.store.Items(r.Context(), userID, tagID)
	if err != nil {
		handleError(w, r, err)
		return
	}

	writeJSON(w, r, map[string]interface{}{
		"tag":   map[string]interface{}{"id": tagID, "name": tagName},
		"items": items,
	})
}

func (h *TagsHandler) GetForItem(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	itemType := r.URL.Query().Get("item_type")
	itemID, err := strconv.Atoi(r.URL.Query().Get("item_id"))
	if err != nil || itemID <= 0 || (itemType != "movie" && itemType != "show") {
		handleError(w, r, errors.New(errors.CodeValidationError, "item_type and item_id required"))
		return
	}

	tags, err := h.store.ForItem(r.Context(), userID, itemType, itemID)
	if err != nil {
		handleError(w, r, err)
		return
	}
	writeJSON(w, r, tags)
}

func (h *TagsHandler) RegisterRoutes(r chi.Router) {
	r.Get("/", h.List)
	r.Get("/for-item", h.GetForItem)
	r.Post("/", h.Create)
	r.Put("/{id}", h.Update)
	r.Delete("/{id}", h.Delete)
	r.Post("/{id}/items", h.AddItem)
	r.Delete("/{id}/items/{itemType}/{itemId}", h.RemoveItem)
	r.Get("/{id}/items", h.GetItems)
}
