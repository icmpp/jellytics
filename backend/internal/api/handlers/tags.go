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
	db         *sql.DB
	mediaStore repository.MediaStore
}

func NewTagsHandler(db *sql.DB) *TagsHandler {
	return &TagsHandler{db: db, mediaStore: repository.NewSQLMediaStore(db)}
}

type Tag struct {
	ID        int    `json:"id"`
	Name      string `json:"name"`
	Color     string `json:"color"`
	CreatedAt string `json:"createdAt"`
}

func (h *TagsHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	rows, err := h.db.QueryContext(r.Context(),
		"SELECT id, name, color, created_at FROM tags WHERE user_id = ? ORDER BY name ASC",
		userID)
	if err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to list tags"))
		return
	}
	defer rows.Close()

	var tags []Tag
	for rows.Next() {
		var t Tag
		if rows.Scan(&t.ID, &t.Name, &t.Color, &t.CreatedAt) == nil {
			if t.Color == "" {
				t.Color = "#6366f1"
			}
			tags = append(tags, t)
		}
	}
	if tags == nil {
		tags = []Tag{}
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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		handleError(w, r, errors.New(errors.CodeValidationError, "name is required"))
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		handleError(w, r, errors.New(errors.CodeValidationError, "name is required"))
		return
	}
	color := req.Color
	if color == "" {
		color = "#6366f1"
	}

	res, err := h.db.ExecContext(r.Context(),
		"INSERT INTO tags (user_id, name, color) VALUES (?, ?, ?)",
		userID, name, color)
	if err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to create tag"))
		return
	}
	id, err := res.LastInsertId()
	if err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to get new tag ID"))
		return
	}

	var t Tag
	if err := h.db.QueryRowContext(r.Context(),
		"SELECT id, name, color, created_at FROM tags WHERE id = ?", id).
		Scan(&t.ID, &t.Name, &t.Color, &t.CreatedAt); err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to fetch created tag"))
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

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
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

	var sets []string
	var args []interface{}
	if req.Name != nil {
		sets = append(sets, "name = ?")
		args = append(args, strings.TrimSpace(*req.Name))
	}
	if req.Color != nil {
		sets = append(sets, "color = ?")
		args = append(args, *req.Color)
	}
	if len(sets) == 0 {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	args = append(args, id, userID)
	query := "UPDATE tags SET " + strings.Join(sets, ", ") + " WHERE id = ? AND user_id = ?"

	res, err := h.db.ExecContext(r.Context(), query, args...)
	if err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to update tag"))
		return
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
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

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid tag ID"))
		return
	}

	res, err := h.db.ExecContext(r.Context(), "DELETE FROM tags WHERE id = ? AND user_id = ?", id, userID)
	if err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to delete tag"))
		return
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
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

	idStr := chi.URLParam(r, "id")
	tagID, err := strconv.Atoi(idStr)
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

	var exists int
	_ = h.db.QueryRowContext(r.Context(), "SELECT 1 FROM tags WHERE id = ? AND user_id = ?", tagID, userID).Scan(&exists)
	if exists == 0 {
		handleError(w, r, errors.New(errors.CodeNotFound, "Tag not found"))
		return
	}

	if !verifyItemExists(r.Context(), h.mediaStore, w, r, req.ItemType, req.ItemID, userID) {
		return
	}

	_, err = h.db.ExecContext(r.Context(),
		"INSERT OR IGNORE INTO media_tags (tag_id, item_type, item_id) VALUES (?, ?, ?)",
		tagID, req.ItemType, req.ItemID)
	if err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to add tag to item"))
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

	idStr := chi.URLParam(r, "id")
	tagID, err := strconv.Atoi(idStr)
	if err != nil || tagID <= 0 {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid tag ID"))
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
		`DELETE FROM media_tags WHERE tag_id = ? AND item_type = ? AND item_id = ?
		 AND tag_id IN (SELECT id FROM tags WHERE user_id = ?)`,
		tagID, itemType, itemID, userID)
	if err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to remove tag from item"))
		return
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
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

	idStr := chi.URLParam(r, "id")
	tagID, err := strconv.Atoi(idStr)
	if err != nil || tagID <= 0 {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid tag ID"))
		return
	}

	var tagName string
	err = h.db.QueryRowContext(r.Context(), "SELECT name FROM tags WHERE id = ? AND user_id = ?", tagID, userID).Scan(&tagName)
	if err == sql.ErrNoRows {
		handleError(w, r, errors.New(errors.CodeNotFound, "Tag not found"))
		return
	}
	if err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to get tag"))
		return
	}

	type Item struct {
		ItemType  string `json:"itemType"`
		ItemID    int    `json:"itemId"`
		Title     string `json:"title"`
		PosterURL string `json:"posterUrl,omitempty"`
	}

	rows, err := h.db.QueryContext(r.Context(), `
		SELECT mt.item_type, mt.item_id, COALESCE(m.title, s.title),
		       COALESCE(m.jellyfin_id, s.jellyfin_id)
		FROM media_tags mt
		LEFT JOIN movies m ON mt.item_type = 'movie' AND mt.item_id = m.id AND m.user_id = ?
		LEFT JOIN shows s ON mt.item_type = 'show' AND mt.item_id = s.id AND s.user_id = ?
		WHERE mt.tag_id = ? AND (m.id IS NOT NULL OR s.id IS NOT NULL)
		ORDER BY COALESCE(m.title, s.title) ASC`, userID, userID, tagID)
	if err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to list tag items"))
		return
	}
	defer rows.Close()

	var items []Item
	for rows.Next() {
		var it Item
		var jellyfinID sql.NullString
		if rows.Scan(&it.ItemType, &it.ItemID, &it.Title, &jellyfinID) == nil {
			if jellyfinID.Valid && jellyfinID.String != "" {
				it.PosterURL = "/api/v1/images/" + it.ItemType + "s/" + jellyfinID.String + "/poster"
			}
			items = append(items, it)
		}
	}
	if items == nil {
		items = []Item{}
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
	itemIDStr := r.URL.Query().Get("item_id")
	itemID, err := strconv.Atoi(itemIDStr)
	if err != nil || itemID <= 0 || (itemType != "movie" && itemType != "show") {
		handleError(w, r, errors.New(errors.CodeValidationError, "item_type and item_id required"))
		return
	}

	rows, err := h.db.QueryContext(r.Context(), `
		SELECT t.id, t.name, t.color
		FROM tags t
		JOIN media_tags mt ON mt.tag_id = t.id
		WHERE t.user_id = ? AND mt.item_type = ? AND mt.item_id = ?`, userID, itemType, itemID)
	if err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to get tags"))
		return
	}
	defer rows.Close()

	var tags []Tag
	for rows.Next() {
		var t Tag
		if rows.Scan(&t.ID, &t.Name, &t.Color) == nil {
			if t.Color == "" {
				t.Color = "#6366f1"
			}
			tags = append(tags, t)
		}
	}
	if tags == nil {
		tags = []Tag{}
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
