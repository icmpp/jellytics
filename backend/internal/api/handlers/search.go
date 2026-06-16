package handlers

import (
	"database/sql"
	"net/http"
	"sync"

	"jellytics/backend/internal/api/middleware"
	"jellytics/backend/internal/errors"
	"jellytics/backend/internal/models"
	"jellytics/backend/internal/repository"

	"github.com/go-chi/chi/v5"
)

type SearchHandler struct {
	store repository.SearchStore
}

func NewSearchHandler(db *sql.DB) *SearchHandler {
	return &SearchHandler{store: repository.NewSQLSearchStore(db)}
}

type SearchResult struct {
	Shows    []models.SearchShow    `json:"shows"`
	Movies   []models.SearchMovie   `json:"movies"`
	Episodes []models.SearchEpisode `json:"episodes"`
}

func (h *SearchHandler) Search(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	result := SearchResult{
		Shows:    []models.SearchShow{},
		Movies:   []models.SearchMovie{},
		Episodes: []models.SearchEpisode{},
	}

	q := r.URL.Query().Get("q")
	if len(q) < 2 {
		writeJSON(w, r, result)
		return
	}
	if len(q) > 200 {
		q = q[:200]
	}
	pattern := "%" + q + "%"

	// Fan out the three independent lookups concurrently.
	ctx := r.Context()
	var wg sync.WaitGroup
	wg.Add(3)
	go func() {
		defer wg.Done()
		if shows, err := h.store.Shows(ctx, userID, pattern); err == nil {
			result.Shows = shows
		}
	}()
	go func() {
		defer wg.Done()
		if movies, err := h.store.Movies(ctx, userID, pattern); err == nil {
			result.Movies = movies
		}
	}()
	go func() {
		defer wg.Done()
		if episodes, err := h.store.Episodes(ctx, userID, pattern); err == nil {
			result.Episodes = episodes
		}
	}()
	wg.Wait()

	writeJSON(w, r, result)
}

func (h *SearchHandler) RegisterRoutes(r chi.Router) {
	r.Get("/", h.Search)
}
