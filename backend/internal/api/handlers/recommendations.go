package handlers

import (
	"database/sql"
	"net/http"
	"strconv"

	"jellytics/backend/internal/api/middleware"
	"jellytics/backend/internal/errors"
	"jellytics/backend/internal/models"
	"jellytics/backend/internal/repository"
	"jellytics/backend/internal/services"

	"github.com/go-chi/chi/v5"
)

type RecommendationsHandler struct {
	service *services.RecommendationService
}

func NewRecommendationsHandler(db *sql.DB) *RecommendationsHandler {
	return &RecommendationsHandler{
		service: services.NewRecommendationService(repository.NewSQLRecommendationStore(db)),
	}
}

func (h *RecommendationsHandler) GetRecommendations(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	limit := 12
	if l, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && l > 0 && l <= 50 {
		limit = l
	}

	items, err := h.service.Recommend(r.Context(), userID, limit)
	if err != nil {
		handleError(w, r, err)
		return
	}
	if items == nil {
		items = []models.RecommendationItem{}
	}

	writeJSON(w, r, map[string]interface{}{"items": items})
}

func (h *RecommendationsHandler) RegisterRoutes(r chi.Router) {
	r.Get("/", h.GetRecommendations)
}
