package handlers

import (
	"database/sql"
	"net/http"
	"strconv"

	"jellytics/backend/internal/api/middleware"
	"jellytics/backend/internal/errors"
	"jellytics/backend/internal/models"
	"jellytics/backend/internal/repository"

	"github.com/go-chi/chi/v5"
)

type ShowsHandler struct {
	store repository.ShowStore
}

func NewShowsHandler(db *sql.DB) *ShowsHandler {
	return &ShowsHandler{store: repository.NewSQLShowStore(db)}
}

// parseShowFilter parses the shared list/status-count filter from the request.
func parseShowFilter(r *http.Request) repository.ShowListFilter {
	return repository.ShowListFilter{
		Status:      r.URL.Query().Get("status"),
		Search:      r.URL.Query().Get("search"),
		Genre:       r.URL.Query().Get("genre"),
		YearFrom:    r.URL.Query().Get("year_from"),
		YearTo:      r.URL.Query().Get("year_to"),
		WatchedFrom: r.URL.Query().Get("watched_from"),
		WatchedTo:   r.URL.Query().Get("watched_to"),
		TagIDs:      parseTagIDs(r.URL.Query().Get("tags")),
		Archived:    r.URL.Query().Get("archived"),
		Sort:        r.URL.Query().Get("sort"),
	}
}

func (h *ShowsHandler) ListShows(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	filter := parseShowFilter(r)
	filter.Limit, filter.Offset = parsePagination(r)

	shows, total, err := h.store.List(r.Context(), userID, filter)
	if err != nil {
		handleError(w, r, err)
		return
	}

	writeJSON(w, r, map[string]interface{}{
		"shows": shows,
		"total": total,
	})
}

// GetShowsStatusCounts returns per-status counts for the current user,
// respecting all query filters except `status`.
func (h *ShowsHandler) GetShowsStatusCounts(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	counts, err := h.store.StatusCounts(r.Context(), userID, parseShowFilter(r))
	if err != nil {
		handleError(w, r, err)
		return
	}
	writeJSON(w, r, counts)
}

func (h *ShowsHandler) GetShow(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid show ID"))
		return
	}

	show, episodes, err := h.store.GetWithEpisodes(r.Context(), id, userID)
	if err != nil {
		handleError(w, r, err)
		return
	}
	if show == nil {
		handleError(w, r, errors.New(errors.CodeShowNotFound, "Show not found"))
		return
	}

	if episodes == nil {
		episodes = []models.Episode{}
	}
	writeJSON(w, r, map[string]interface{}{
		"show":     show,
		"episodes": episodes,
	})
}

func (h *ShowsHandler) DeleteShow(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid show ID"))
		return
	}

	found, err := h.store.SoftDelete(r.Context(), id, userID)
	if err != nil {
		handleError(w, r, err)
		return
	}
	if !found {
		handleError(w, r, errors.New(errors.CodeShowNotFound, "Show not found"))
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *ShowsHandler) RestoreShow(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid show ID"))
		return
	}

	found, err := h.store.Restore(r.Context(), id, userID)
	if err != nil {
		handleError(w, r, err)
		return
	}
	if !found {
		handleError(w, r, errors.New(errors.CodeShowNotFound, "Show not found or not in archive"))
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *ShowsHandler) RegisterRoutes(r chi.Router) {
	r.Get("/", h.ListShows)
	r.Get("/status-counts", h.GetShowsStatusCounts)
	r.Get("/{id}", h.GetShow)
	r.Delete("/{id}", h.DeleteShow)
	r.Post("/{id}/restore", h.RestoreShow)
}
