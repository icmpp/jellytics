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

type CollectionsHandler struct {
	db         *sql.DB
	mediaStore repository.MediaStore
}

func NewCollectionsHandler(db *sql.DB) *CollectionsHandler {
	return &CollectionsHandler{db: db, mediaStore: repository.NewSQLMediaStore(db)}
}

type Collection struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	ItemCount   int    `json:"itemCount"`
	CreatedAt   string `json:"createdAt"`
}

type CollectionWithItems struct {
	Collection
	Items []CollectionItem `json:"items"`
}

type CollectionItem struct {
	ItemType  string `json:"itemType"`
	ItemID    int    `json:"itemId"`
	Title     string `json:"title,omitempty"`
	PosterURL string `json:"posterUrl,omitempty"`
}

type CollectionListItem struct {
	Collection
	HasItem bool `json:"hasItem,omitempty"`
}

func (h *CollectionsHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	itemType := r.URL.Query().Get("item_type")
	itemIDStr := r.URL.Query().Get("item_id")
	var filterItemType string
	var filterItemID int
	if itemType != "" && itemIDStr != "" {
		if id, err := strconv.Atoi(itemIDStr); err == nil && id > 0 && (itemType == "movie" || itemType == "show") {
			filterItemType = itemType
			filterItemID = id
		}
	}

	rows, err := h.db.QueryContext(r.Context(), `
		SELECT c.id, c.name, c.description, c.created_at,
		       (SELECT COUNT(*) FROM collection_items WHERE collection_id = c.id) as item_count
		FROM collections c
		WHERE c.user_id = ?
		ORDER BY c.updated_at DESC`, userID)
	if err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to list collections"))
		return
	}
	defer rows.Close()

	var collections []CollectionListItem
	for rows.Next() {
		var c Collection
		if err := rows.Scan(&c.ID, &c.Name, &c.Description, &c.CreatedAt, &c.ItemCount); err != nil {
			handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to scan collection row"))
			return
		}
		item := CollectionListItem{Collection: c}
		if filterItemType != "" && filterItemID > 0 {
			var has int
			if err := h.db.QueryRowContext(r.Context(),
				"SELECT 1 FROM collection_items WHERE collection_id = ? AND item_type = ? AND item_id = ? LIMIT 1",
				c.ID, filterItemType, filterItemID).Scan(&has); err != nil && err != sql.ErrNoRows {
				handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to check collection item"))
				return
			}
			item.HasItem = has == 1
		}
		collections = append(collections, item)
	}
	if err := rows.Err(); err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to iterate collections"))
		return
	}
	if collections == nil {
		collections = []CollectionListItem{}
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

	res, err := h.db.ExecContext(r.Context(),
		"INSERT INTO collections (user_id, name, description) VALUES (?, ?, ?)",
		userID, req.Name, req.Description)
	if err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to create collection"))
		return
	}
	id, err := res.LastInsertId()
	if err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to get new collection ID"))
		return
	}

	var c Collection
	if err := h.db.QueryRowContext(r.Context(),
		"SELECT id, name, description, created_at, 0 FROM collections WHERE id = ?", id).
		Scan(&c.ID, &c.Name, &c.Description, &c.CreatedAt, &c.ItemCount); err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to fetch created collection"))
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

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid collection ID"))
		return
	}

	var c Collection
	err = h.db.QueryRowContext(r.Context(), `
		SELECT id, name, description, created_at,
		       (SELECT COUNT(*) FROM collection_items WHERE collection_id = ?) 
		FROM collections WHERE id = ? AND user_id = ?`,
		id, id, userID).Scan(&c.ID, &c.Name, &c.Description, &c.CreatedAt, &c.ItemCount)
	if err == sql.ErrNoRows {
		handleError(w, r, errors.New(errors.CodeNotFound, "Collection not found"))
		return
	}
	if err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to get collection"))
		return
	}

	itemRows, err := h.db.QueryContext(r.Context(), `
		SELECT ci.item_type, ci.item_id, COALESCE(m.title, s.title) as title,
		       COALESCE(m.jellyfin_id, s.jellyfin_id) as jellyfin_id
		FROM collection_items ci
		LEFT JOIN movies m ON ci.item_type = 'movie' AND ci.item_id = m.id AND m.user_id = ?
		LEFT JOIN shows s ON ci.item_type = 'show' AND ci.item_id = s.id AND s.user_id = ?
		WHERE ci.collection_id = ? AND (m.id IS NOT NULL OR s.id IS NOT NULL)
		ORDER BY ci.added_at DESC`, userID, userID, id)
	if err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to get collection items"))
		return
	}
	defer itemRows.Close()
	var items []CollectionItem
	for itemRows.Next() {
		var it CollectionItem
		var jellyfinID sql.NullString
		if err := itemRows.Scan(&it.ItemType, &it.ItemID, &it.Title, &jellyfinID); err != nil {
			handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to scan collection item"))
			return
		}
		if jellyfinID.Valid && jellyfinID.String != "" {
			url := "/api/v1/images/" + it.ItemType + "s/" + jellyfinID.String + "/poster"
			it.PosterURL = url
		}
		items = append(items, it)
	}
	if err := itemRows.Err(); err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to iterate collection items"))
		return
	}
	if items == nil {
		items = []CollectionItem{}
	}

	writeJSON(w, r, CollectionWithItems{Collection: c, Items: items})
}

func (h *CollectionsHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
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

	var sets []string
	var args []interface{}
	if req.Name != nil {
		sets = append(sets, "name = ?")
		args = append(args, *req.Name)
	}
	if req.Description != nil {
		sets = append(sets, "description = ?")
		args = append(args, *req.Description)
	}
	if len(sets) == 0 {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	sets = append(sets, "updated_at = CURRENT_TIMESTAMP")
	args = append(args, id, userID)
	query := "UPDATE collections SET " + strings.Join(sets, ", ") + " WHERE id = ? AND user_id = ?"

	res, err := h.db.ExecContext(r.Context(), query, args...)
	if err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to update collection"))
		return
	}
	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
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

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid collection ID"))
		return
	}

	res, err := h.db.ExecContext(r.Context(), "DELETE FROM collections WHERE id = ? AND user_id = ?", id, userID)
	if err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to delete collection"))
		return
	}
	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
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

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
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

	var exists int
	if err := h.db.QueryRowContext(r.Context(), "SELECT 1 FROM collections WHERE id = ? AND user_id = ?", id, userID).Scan(&exists); err != nil || exists == 0 {
		handleError(w, r, errors.New(errors.CodeNotFound, "Collection not found"))
		return
	}

	if !verifyItemExists(r.Context(), h.mediaStore, w, r, req.ItemType, req.ItemID, userID) {
		return
	}

	_, err = h.db.ExecContext(r.Context(),
		"INSERT OR IGNORE INTO collection_items (collection_id, item_type, item_id) VALUES (?, ?, ?)",
		id, req.ItemType, req.ItemID)
	if err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to add item"))
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

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid collection ID"))
		return
	}

	itemType := chi.URLParam(r, "itemType")
	itemIDStr := chi.URLParam(r, "itemId")
	itemID, err := strconv.Atoi(itemIDStr)
	if err != nil || itemID <= 0 {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid item ID"))
		return
	}
	if itemType != "movie" && itemType != "show" {
		handleError(w, r, errors.New(errors.CodeValidationError, "item_type must be 'movie' or 'show'"))
		return
	}

	res, err := h.db.ExecContext(r.Context(),
		"DELETE FROM collection_items WHERE collection_id = ? AND item_type = ? AND item_id = ? AND collection_id IN (SELECT id FROM collections WHERE user_id = ?)",
		id, itemType, itemID, userID)
	if err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to remove item"))
		return
	}
	rowsAffected, _ := res.RowsAffected()
	if rowsAffected == 0 {
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
