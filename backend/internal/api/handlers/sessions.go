package handlers

import (
	"database/sql"
	"net/http"

	"jellytics/backend/internal/api/middleware"
	"jellytics/backend/internal/errors"
	"jellytics/backend/internal/services"

	"github.com/go-chi/chi/v5"
)

type SessionsHandler struct {
	sessionsService *services.SessionsService
}

func NewSessionsHandler(db *sql.DB) *SessionsHandler {
	return &SessionsHandler{
		sessionsService: services.NewSessionsService(db),
	}
}

func (h *SessionsHandler) GetCurrentlyWatching(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	sessions, err := h.sessionsService.GetCurrentlyWatching(r.Context(), userID)
	if err != nil {
		handleError(w, r, err)
		return
	}

	writeJSON(w, r, map[string]interface{}{
		"sessions": sessions,
		"count":    len(sessions),
	})
}

func (h *SessionsHandler) RegisterRoutes(r chi.Router) {
	r.Get("/currently-watching", h.GetCurrentlyWatching)
}
