package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"

	"jellytics/backend/internal/api/middleware"
	"jellytics/backend/internal/errors"

	"github.com/go-chi/chi/v5"
)

type NotificationsHandler struct {
	db *sql.DB
}

func NewNotificationsHandler(db *sql.DB) *NotificationsHandler {
	return &NotificationsHandler{db: db}
}

type Notification struct {
	ID        int                    `json:"id"`
	Type      string                 `json:"type"`
	Title     string                 `json:"title"`
	Body      string                 `json:"body"`
	Data      map[string]interface{} `json:"data,omitempty"`
	ReadAt    *string                `json:"readAt,omitempty"`
	CreatedAt string                 `json:"createdAt"`
}

func (h *NotificationsHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	unreadOnly := r.URL.Query().Get("unread") == "true"

	query := `SELECT id, type, title, body, data, read_at, created_at
		FROM notifications WHERE user_id = ?`
	args := []interface{}{userID}
	if unreadOnly {
		query += " AND read_at IS NULL"
	}
	query += " ORDER BY created_at DESC LIMIT 50"

	rows, err := h.db.QueryContext(r.Context(), query, args...)
	if err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to list notifications"))
		return
	}
	defer rows.Close()

	var notifications []Notification
	for rows.Next() {
		var n Notification
		var body, dataJSON sql.NullString
		var readAt sql.NullString
		if err := rows.Scan(&n.ID, &n.Type, &n.Title, &body, &dataJSON, &readAt, &n.CreatedAt); err != nil {
			handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to scan notification row"))
			return
		}
		n.Body = body.String
		if readAt.Valid {
			n.ReadAt = &readAt.String
		}
		if dataJSON.Valid && dataJSON.String != "" {
			_ = json.Unmarshal([]byte(dataJSON.String), &n.Data)
		}
		notifications = append(notifications, n)
	}
	if err := rows.Err(); err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to iterate notifications"))
		return
	}
	if notifications == nil {
		notifications = []Notification{}
	}

	writeJSON(w, r, notifications)
}

func (h *NotificationsHandler) UnreadCount(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	var count int
	err := h.db.QueryRowContext(r.Context(),
		"SELECT COUNT(*) FROM notifications WHERE user_id = ? AND read_at IS NULL", userID).Scan(&count)
	if err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to count notifications"))
		return
	}

	writeJSON(w, r, map[string]int{"count": count})
}

func (h *NotificationsHandler) MarkRead(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid notification ID"))
		return
	}

	res, err := h.db.ExecContext(r.Context(),
		"UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?", id, userID)
	if err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to mark notification read"))
		return
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		handleError(w, r, errors.New(errors.CodeNotFound, "Notification not found"))
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *NotificationsHandler) MarkAllRead(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	_, err := h.db.ExecContext(r.Context(),
		"UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND read_at IS NULL", userID)
	if err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to mark notifications read"))
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *NotificationsHandler) RegisterRoutes(r chi.Router) {
	r.Get("/", h.List)
	r.Get("/unread-count", h.UnreadCount)
	r.Put("/{id}/read", h.MarkRead)
	r.Post("/mark-all-read", h.MarkAllRead)
}
