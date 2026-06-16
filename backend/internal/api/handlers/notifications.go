package handlers

import (
	"database/sql"
	"net/http"
	"strconv"

	"jellytics/backend/internal/api/middleware"
	"jellytics/backend/internal/errors"
	"jellytics/backend/internal/repository"

	"github.com/go-chi/chi/v5"
)

type NotificationsHandler struct {
	store repository.NotificationStore
}

func NewNotificationsHandler(db *sql.DB) *NotificationsHandler {
	return &NotificationsHandler{store: repository.NewSQLNotificationStore(db)}
}

func (h *NotificationsHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	notifications, err := h.store.List(r.Context(), userID, r.URL.Query().Get("unread") == "true")
	if err != nil {
		handleError(w, r, err)
		return
	}
	writeJSON(w, r, notifications)
}

func (h *NotificationsHandler) UnreadCount(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	count, err := h.store.UnreadCount(r.Context(), userID)
	if err != nil {
		handleError(w, r, err)
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

	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil || id <= 0 {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid notification ID"))
		return
	}

	found, err := h.store.MarkRead(r.Context(), userID, id)
	if err != nil {
		handleError(w, r, err)
		return
	}
	if !found {
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

	if err := h.store.MarkAllRead(r.Context(), userID); err != nil {
		handleError(w, r, err)
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
