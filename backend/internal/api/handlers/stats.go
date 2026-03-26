package handlers

import (
	"database/sql"
	"net/http"
	"strconv"
	"time"

	"jellytics/backend/internal/api/middleware"
	"jellytics/backend/internal/errors"
	"jellytics/backend/internal/services"

	"github.com/go-chi/chi/v5"
)

type StatsHandler struct {
	statsService *services.StatsService
}

func NewStatsHandler(db *sql.DB) *StatsHandler {
	return &StatsHandler{
		statsService: services.NewStatsService(db),
	}
}

func (h *StatsHandler) GetOverview(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	overview, err := h.statsService.GetOverview(r.Context(), userID)
	if err != nil {
		handleError(w, r, err)
		return
	}

	writeJSON(w, r, overview)
}

func (h *StatsHandler) GetGenreBreakdown(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	breakdown, err := h.statsService.GetGenreBreakdown(r.Context(), userID)
	if err != nil {
		handleError(w, r, err)
		return
	}

	writeJSON(w, r, breakdown)
}

func (h *StatsHandler) GetTrends(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	daysStr := r.URL.Query().Get("days")
	days := 30
	if daysStr != "" {
		if d, err := strconv.Atoi(daysStr); err == nil {
			days = d
		}
	}

	snapshotType := r.URL.Query().Get("type")
	if snapshotType == "" {
		snapshotType = "daily"
	}

	trends, err := h.statsService.GetTrends(r.Context(), userID, days, snapshotType)
	if err != nil {
		handleError(w, r, err)
		return
	}

	writeJSON(w, r, trends)
}

func (h *StatsHandler) GetMilestones(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	milestones, err := h.statsService.GetMilestones(r.Context(), userID)
	if err != nil {
		handleError(w, r, err)
		return
	}

	writeJSON(w, r, milestones)
}

func (h *StatsHandler) GetPeriodSummary(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	period := r.URL.Query().Get("period")
	if period != "year" {
		period = "month"
	}

	summary, err := h.statsService.GetPeriodSummary(r.Context(), userID, period)
	if err != nil {
		handleError(w, r, err)
		return
	}

	writeJSON(w, r, summary)
}

func (h *StatsHandler) GetYearInReview(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	yearStr := r.URL.Query().Get("year")
	year := 0
	if yearStr != "" {
		if y, err := strconv.Atoi(yearStr); err == nil && y >= 2000 && y <= 2100 {
			year = y
		}
	}
	if year == 0 {
		year = time.Now().Year()
	}

	result, err := h.statsService.GetYearInReview(r.Context(), userID, year)
	if err != nil {
		handleError(w, r, err)
		return
	}

	writeJSON(w, r, result)
}

func (h *StatsHandler) GetWatchPatterns(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	daysStr := r.URL.Query().Get("days")
	days := 90
	if daysStr != "" {
		if d, err := strconv.Atoi(daysStr); err == nil && d > 0 && d <= 365 {
			days = d
		}
	}

	result, err := h.statsService.GetWatchPatterns(r.Context(), userID, days)
	if err != nil {
		handleError(w, r, err)
		return
	}

	writeJSON(w, r, result)
}

func (h *StatsHandler) GetWeeklySummary(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	summary, err := h.statsService.GetWeeklySummary(r.Context(), userID)
	if err != nil {
		handleError(w, r, err)
		return
	}

	writeJSON(w, r, summary)
}

func (h *StatsHandler) GetGoals(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	result, err := h.statsService.GetGoals(r.Context(), userID)
	if err != nil {
		handleError(w, r, err)
		return
	}

	writeJSON(w, r, result)
}

func (h *StatsHandler) RegisterRoutes(r chi.Router) {
	r.Get("/overview", h.GetOverview)
	r.Get("/weekly-summary", h.GetWeeklySummary)
	r.Get("/genres", h.GetGenreBreakdown)
	r.Get("/trends", h.GetTrends)
	r.Get("/milestones", h.GetMilestones)
	r.Get("/period-summary", h.GetPeriodSummary)
	r.Get("/year-in-review", h.GetYearInReview)
	r.Get("/goals", h.GetGoals)
	r.Get("/watch-patterns", h.GetWatchPatterns)
}
