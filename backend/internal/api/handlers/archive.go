package handlers

import (
	"database/sql"
	"net/http"

	"jellytics/backend/internal/api/middleware"
	"jellytics/backend/internal/errors"
	"jellytics/backend/internal/models"
	"jellytics/backend/internal/repository"

	"github.com/go-chi/chi/v5"
)

type ArchiveHandler struct {
	store repository.ArchiveStore
}

func NewArchiveHandler(db *sql.DB) *ArchiveHandler {
	return &ArchiveHandler{store: repository.NewSQLArchiveStore(db)}
}

type ArchiveResponse struct {
	Movies []models.ArchiveItem `json:"movies"`
	Shows  []models.ArchiveItem `json:"shows"`
}

func (h *ArchiveHandler) ListRemoved(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	movies, err := h.store.RemovedMovies(r.Context(), userID)
	if err != nil {
		handleError(w, r, err)
		return
	}
	shows, err := h.store.RemovedShows(r.Context(), userID)
	if err != nil {
		handleError(w, r, err)
		return
	}

	writeJSON(w, r, ArchiveResponse{Movies: movies, Shows: shows})
}

func (h *ArchiveHandler) RegisterRoutes(r chi.Router) {
	r.Get("/", h.ListRemoved)
}
