package handlers

import (
	"database/sql"
	"net/http"
	"sort"

	"jellytics/backend/internal/api/middleware"
	"jellytics/backend/internal/errors"
	"jellytics/backend/internal/models"
	"jellytics/backend/internal/repository"

	"github.com/go-chi/chi/v5"
)

type HistoryHandler struct {
	store repository.HistoryStore
}

func NewHistoryHandler(db *sql.DB) *HistoryHandler {
	return &HistoryHandler{store: repository.NewSQLHistoryStore(db)}
}

type HistoryResponse struct {
	Items []models.HistoryItem `json:"items"`
	Total int                  `json:"total"`
}

func (h *HistoryHandler) ListHistory(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	itemType := r.URL.Query().Get("type") // "all" | "episode" | "movie"
	limit, offset := parsePagination(r)
	if limit > 500 {
		limit = 500
	}

	mergeTypes := itemType == "" || itemType == "all"
	// When merging or paging episodes, over-fetch then trim after the merge sort.
	fetchLimit := limit + offset
	fetchOffset := 0
	if !mergeTypes && itemType == "movie" {
		fetchLimit = limit
		fetchOffset = offset
	}

	ctx := r.Context()
	var items []models.HistoryItem

	switch {
	case mergeTypes:
		var epItems, movieItems []models.HistoryItem
		var epErr, movieErr error
		done := make(chan struct{}, 2)
		go func() {
			epItems, epErr = h.store.EpisodeHistory(ctx, userID, fetchLimit, fetchOffset)
			done <- struct{}{}
		}()
		go func() {
			movieItems, movieErr = h.store.MovieHistory(ctx, userID, fetchLimit, fetchOffset)
			done <- struct{}{}
		}()
		<-done
		<-done
		if epErr != nil {
			handleError(w, r, epErr)
			return
		}
		if movieErr != nil {
			handleError(w, r, movieErr)
			return
		}
		items = append(items, epItems...)
		items = append(items, movieItems...)
	case itemType == "episode":
		epItems, err := h.store.EpisodeHistory(ctx, userID, fetchLimit, fetchOffset)
		if err != nil {
			handleError(w, r, err)
			return
		}
		items = epItems
	case itemType == "movie":
		movieItems, err := h.store.MovieHistory(ctx, userID, fetchLimit, fetchOffset)
		if err != nil {
			handleError(w, r, err)
			return
		}
		items = movieItems
	}

	sort.Slice(items, func(i, j int) bool {
		return items[i].WatchedAt > items[j].WatchedAt
	})

	if mergeTypes || itemType == "episode" {
		if offset >= len(items) {
			items = nil
		} else {
			items = items[offset:]
			if limit > 0 && len(items) > limit {
				items = items[:limit]
			}
		}
	}

	writeJSON(w, r, HistoryResponse{Items: items, Total: len(items)})
}

func (h *HistoryHandler) RegisterRoutes(r chi.Router) {
	r.Get("/", h.ListHistory)
}
