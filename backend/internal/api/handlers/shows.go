package handlers

import (
	"database/sql"
	"net/http"
	"strconv"
	"sync"
	"time"

	"jellytics/backend/internal/api/middleware"
	"jellytics/backend/internal/errors"
	"jellytics/backend/internal/models"
	"jellytics/backend/internal/services"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog/log"
)

type ShowsHandler struct {
	db           *sql.DB
	imageService *services.ImageService
}

func NewShowsHandler(db *sql.DB, dataPath string) *ShowsHandler {
	return &ShowsHandler{
		db:           db,
		imageService: services.NewImageService(db, dataPath),
	}
}

func (h *ShowsHandler) ListShows(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	status := r.URL.Query().Get("status")
	search := r.URL.Query().Get("search")
	genre := r.URL.Query().Get("genre")
	yearFrom := r.URL.Query().Get("year_from")
	yearTo := r.URL.Query().Get("year_to")
	watchedFrom := r.URL.Query().Get("watched_from")
	watchedTo := r.URL.Query().Get("watched_to")
	tagIDs := parseTagIDs(r.URL.Query().Get("tags"))
	limit, offset := parsePagination(r)

	query := `
		SELECT id, jellyfin_id, title, overview, poster_url, genre, year, status,
		       total_episodes, watched_episodes, total_watch_time_minutes,
		       first_watched_at, last_watched_at, created_at
		FROM shows
		WHERE user_id = ? AND deleted_at IS NULL
	`

	args := []interface{}{userID}

	if status != "" {
		query += " AND status = ?"
		args = append(args, status)
	}

	if search != "" {
		if len(search) > 200 {
			search = search[:200]
		}
		query += " AND (title LIKE ? OR overview LIKE ?)"
		searchPattern := "%" + search + "%"
		args = append(args, searchPattern, searchPattern)
	}

	if genre != "" {
		query += " AND genre LIKE ?"
		args = append(args, "%\""+genre+"\"%")
	}

	if yearFrom != "" {
		query += " AND year >= ?"
		args = append(args, yearFrom)
	}
	if yearTo != "" {
		query += " AND year <= ?"
		args = append(args, yearTo)
	}

	if watchedFrom != "" {
		query += " AND DATE(last_watched_at) >= DATE(?)"
		args = append(args, watchedFrom)
	}
	if watchedTo != "" {
		query += " AND DATE(last_watched_at) <= DATE(?)"
		args = append(args, watchedTo)
	}
	if len(tagIDs) > 0 {
		query += " AND id IN (SELECT item_id FROM media_tags WHERE item_type = 'show' AND tag_id IN ("
		for i := range tagIDs {
			if i > 0 {
				query += ","
			}
			query += "?"
		}
		query += ") AND tag_id IN (SELECT id FROM tags WHERE user_id = ?))"
		for _, tid := range tagIDs {
			args = append(args, tid)
		}
		args = append(args, userID)
	}

	countQuery := "SELECT COUNT(*) FROM shows WHERE user_id = ? AND deleted_at IS NULL"
	countArgs := []interface{}{userID}
	if status != "" {
		countQuery += " AND status = ?"
		countArgs = append(countArgs, status)
	}
	if search != "" {
		searchPattern := "%" + search + "%"
		countQuery += " AND (title LIKE ? OR overview LIKE ?)"
		countArgs = append(countArgs, searchPattern, searchPattern)
	}
	if genre != "" {
		countQuery += " AND genre LIKE ?"
		countArgs = append(countArgs, "%\""+genre+"\"%")
	}
	if yearFrom != "" {
		countQuery += " AND year >= ?"
		countArgs = append(countArgs, yearFrom)
	}
	if yearTo != "" {
		countQuery += " AND year <= ?"
		countArgs = append(countArgs, yearTo)
	}
	if watchedFrom != "" {
		countQuery += " AND DATE(last_watched_at) >= DATE(?)"
		countArgs = append(countArgs, watchedFrom)
	}
	if watchedTo != "" {
		countQuery += " AND DATE(last_watched_at) <= DATE(?)"
		countArgs = append(countArgs, watchedTo)
	}
	if len(tagIDs) > 0 {
		countQuery += " AND id IN (SELECT item_id FROM media_tags WHERE item_type = 'show' AND tag_id IN ("
		for i := range tagIDs {
			if i > 0 {
				countQuery += ","
			}
			countQuery += "?"
		}
		countQuery += ") AND tag_id IN (SELECT id FROM tags WHERE user_id = ?))"
		for _, tid := range tagIDs {
			countArgs = append(countArgs, tid)
		}
		countArgs = append(countArgs, userID)
	}

	query += " ORDER BY COALESCE(last_watched_at, created_at) DESC, created_at DESC LIMIT ? OFFSET ?"
	args = append(args, limit, offset)

	ctx := r.Context()
	var total int
	var countErr, queryErr error
	var rows *sql.Rows
	var wg sync.WaitGroup

	wg.Add(1)
	go func() {
		defer wg.Done()
		countErr = h.db.QueryRowContext(ctx, countQuery, countArgs...).Scan(&total)
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		rows, queryErr = h.db.QueryContext(ctx, query, args...)
	}()

	wg.Wait()

	if countErr != nil {
		handleError(w, r, errors.Wrap(countErr, errors.CodeDatabaseError, "Failed to count shows"))
		return
	}
	if queryErr != nil {
		handleError(w, r, errors.Wrap(queryErr, errors.CodeDatabaseError, "Failed to query shows"))
		return
	}
	defer rows.Close()

	var shows []models.Show
	for rows.Next() {
		var show models.Show
		var genre sql.NullString
		var year sql.NullInt64
		var totalEpisodes sql.NullInt64
		var firstWatchedAt sql.NullTime
		var lastWatchedAt sql.NullTime

		err := rows.Scan(
			&show.ID, &show.JellyfinID, &show.Title, &show.Overview, &show.PosterURL,
			&genre, &year, &show.Status, &totalEpisodes, &show.WatchedEpisodes,
			&show.TotalWatchTimeMinutes, &firstWatchedAt, &lastWatchedAt, &show.CreatedAt,
		)
		if err != nil {
			log.Warn().Err(err).Msg("Failed to scan show row")
			continue
		}

		if genre.Valid {
			show.Genre = genre.String
		}
		if year.Valid {
			y := int(year.Int64)
			show.Year = &y
		}
		if totalEpisodes.Valid {
			te := int(totalEpisodes.Int64)
			show.TotalEpisodes = &te
		}
		if firstWatchedAt.Valid {
			show.FirstWatchedAt = &firstWatchedAt.Time
		}
		if lastWatchedAt.Valid {
			show.LastWatchedAt = &lastWatchedAt.Time
		}

		shows = append(shows, show)
	}

	writeJSON(w, r, map[string]interface{}{
		"shows": shows,
		"total": total,
	})
}

func (h *ShowsHandler) GetShow(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid show ID"))
		return
	}

	rows, err := h.db.QueryContext(r.Context(),
		`SELECT s.id, s.jellyfin_id, s.title, s.overview, s.poster_url, s.genre, s.year, s.status,
		        s.total_episodes, s.watched_episodes, s.total_watch_time_minutes,
		        s.first_watched_at, s.last_watched_at, s.created_at, s.deleted_at,
		        e.id as ep_id, e.jellyfin_id as ep_jellyfin_id, e.title as ep_title,
		        e.episode_number, e.season_number, e.duration_minutes, e.watched, e.watched_at,
		        e.watch_count, e.completion_percentage, e.created_at as ep_created_at
		 FROM shows s
		 LEFT JOIN episodes e ON e.show_id = s.id
		 WHERE s.id = ? AND s.user_id = ?
		 ORDER BY e.season_number, e.episode_number`,
		id, userID)
	if err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to get show"))
		return
	}
	defer rows.Close()

	var show models.Show
	var episodes []models.Episode
	var genre sql.NullString
	var year sql.NullInt64
	var totalEpisodes sql.NullInt64
	var firstWatchedAt sql.NullTime
	var lastWatchedAt sql.NullTime
	var showDeletedAt sql.NullTime
	var epID sql.NullInt64
	var epJellyfinID sql.NullString
	var epTitle sql.NullString
	var epEpisodeNumber sql.NullInt64
	var epSeasonNumber sql.NullInt64
	var epDurationMinutes sql.NullInt64
	var epWatched sql.NullBool // SQLite may return bool or 0/1
	var epWatchedAt sql.NullTime
	var epWatchCount sql.NullInt64
	var epCompletionPercentage sql.NullFloat64
	var epCreatedAt sql.NullTime

	for rows.Next() {
		err := rows.Scan(
			&show.ID, &show.JellyfinID, &show.Title, &show.Overview, &show.PosterURL,
			&genre, &year, &show.Status, &totalEpisodes, &show.WatchedEpisodes,
			&show.TotalWatchTimeMinutes, &firstWatchedAt, &lastWatchedAt, &show.CreatedAt,
			&showDeletedAt,
			&epID, &epJellyfinID, &epTitle, &epEpisodeNumber, &epSeasonNumber,
			&epDurationMinutes, &epWatched, &epWatchedAt, &epWatchCount,
			&epCompletionPercentage, &epCreatedAt,
		)
		if err != nil {
			log.Warn().Err(err).Msg("Failed to scan show row")
			continue
		}
		if genre.Valid {
			show.Genre = genre.String
		}
		if year.Valid {
			y := int(year.Int64)
			show.Year = &y
		}
		if totalEpisodes.Valid {
			te := int(totalEpisodes.Int64)
			show.TotalEpisodes = &te
		}
		if firstWatchedAt.Valid {
			show.FirstWatchedAt = &firstWatchedAt.Time
		}
		if lastWatchedAt.Valid {
			show.LastWatchedAt = &lastWatchedAt.Time
		}
		if epID.Valid && epID.Int64 > 0 {
			ep := models.Episode{
				ID:            int(epID.Int64),
				ShowID:        show.ID,
				JellyfinID:    epJellyfinID.String,
				Title:         epTitle.String,
				EpisodeNumber: int(epEpisodeNumber.Int64),
				SeasonNumber:  int(epSeasonNumber.Int64),
				Watched:       epWatched.Valid && epWatched.Bool,
				WatchCount:    int(epWatchCount.Int64),
			}
			if epDurationMinutes.Valid {
				dm := int(epDurationMinutes.Int64)
				ep.DurationMinutes = &dm
			}
			if epWatchedAt.Valid {
				ep.WatchedAt = &epWatchedAt.Time
			}
			if epCompletionPercentage.Valid {
				ep.CompletionPercentage = &epCompletionPercentage.Float64
			}
			if epCreatedAt.Valid {
				ep.CreatedAt = epCreatedAt.Time
			}
			episodes = append(episodes, ep)
		}
	}
	if err := rows.Err(); err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to get show"))
		return
	}
	if show.ID == 0 {
		handleError(w, r, errors.New(errors.CodeShowNotFound, "Show not found"))
		return
	}
	show.RemovedFromLibrary = showDeletedAt.Valid

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

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid show ID"))
		return
	}

	err = h.db.QueryRowContext(r.Context(),
		`SELECT id FROM shows WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
		id, userID).Scan(new(int))
	if err == sql.ErrNoRows {
		handleError(w, r, errors.New(errors.CodeShowNotFound, "Show not found"))
		return
	}
	if err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to get show"))
		return
	}

	now := time.Now()
	_, _ = h.db.ExecContext(r.Context(), `DELETE FROM watchlist WHERE user_id = ? AND item_type = 'show' AND item_id = ?`, userID, id)
	result, err := h.db.ExecContext(r.Context(),
		`UPDATE shows SET deleted_at = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
		now, now, id, userID)
	if err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to remove show"))
		return
	}
	if rows, _ := result.RowsAffected(); rows == 0 {
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

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid show ID"))
		return
	}

	result, err := h.db.ExecContext(r.Context(),
		`UPDATE shows SET deleted_at = NULL, updated_at = ? WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL`,
		time.Now(), id, userID)
	if err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to restore show"))
		return
	}
	if rows, _ := result.RowsAffected(); rows == 0 {
		handleError(w, r, errors.New(errors.CodeShowNotFound, "Show not found or not in archive"))
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *ShowsHandler) RegisterRoutes(r chi.Router) {
	r.Get("/", h.ListShows)
	r.Get("/{id}", h.GetShow)
	r.Delete("/{id}", h.DeleteShow)
	r.Post("/{id}/restore", h.RestoreShow)
}
