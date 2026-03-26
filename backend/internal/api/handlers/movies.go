package handlers

import (
	"database/sql"
	"net/http"
	"strconv"

	"jellytics/backend/internal/api/middleware"
	"jellytics/backend/internal/errors"
	"jellytics/backend/internal/repository"
	"jellytics/backend/internal/services"

	"github.com/go-chi/chi/v5"
)

type MoviesHandler struct {
	movieService *services.MovieService
	imageService *services.ImageService
}

// NewMoviesHandler returns a new MoviesHandler with the given services.
func NewMoviesHandler(movieService *services.MovieService, imageService *services.ImageService) *MoviesHandler {
	return &MoviesHandler{movieService: movieService, imageService: imageService}
}

// NewMoviesHandlerWithDB constructs a MoviesHandler from db and dataPath (for backward compatibility).
func NewMoviesHandlerWithDB(db *sql.DB, dataPath string) *MoviesHandler {
	movieStore := repository.NewSQLMovieStore(db)
	movieService := services.NewMovieService(movieStore)
	imageService := services.NewImageService(db, dataPath)
	return NewMoviesHandler(movieService, imageService)
}

func (h *MoviesHandler) ListMovies(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	limit, offset := parsePagination(r)
	tagIDs := parseTagIDs(r.URL.Query().Get("tags"))
	filter := repository.MovieListFilter{
		Status:      r.URL.Query().Get("status"),
		Search:      r.URL.Query().Get("search"),
		Genre:       r.URL.Query().Get("genre"),
		YearFrom:    r.URL.Query().Get("year_from"),
		YearTo:      r.URL.Query().Get("year_to"),
		WatchedFrom: r.URL.Query().Get("watched_from"),
		WatchedTo:   r.URL.Query().Get("watched_to"),
		TagIDs:      tagIDs,
		UserID:      userID,
		Limit:       limit,
		Offset:      offset,
	}

	movies, total, err := h.movieService.List(r.Context(), userID, filter)
	if err != nil {
		handleError(w, r, err)
		return
	}

	writeJSON(w, r, map[string]interface{}{
		"movies": movies,
		"total":  total,
	})
}

func (h *MoviesHandler) GetMovie(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid movie ID"))
		return
	}

	movie, err := h.movieService.Get(r.Context(), id, userID)
	if err != nil {
		handleError(w, r, err)
		return
	}

	writeJSON(w, r, movie)
}

func (h *MoviesHandler) DeleteMovie(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid movie ID"))
		return
	}

	if err := h.movieService.Delete(r.Context(), id, userID); err != nil {
		handleError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *MoviesHandler) RestoreMovie(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid movie ID"))
		return
	}

	if err := h.movieService.Restore(r.Context(), id, userID); err != nil {
		handleError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *MoviesHandler) RegisterRoutes(r chi.Router) {
	r.Get("/", h.ListMovies)
	r.Get("/{id}", h.GetMovie)
	r.Delete("/{id}", h.DeleteMovie)
	r.Post("/{id}/restore", h.RestoreMovie)
}
