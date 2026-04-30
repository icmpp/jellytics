package handlers

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"jellytics/backend/internal/api/middleware"
	"jellytics/backend/internal/errors"
	"jellytics/backend/internal/models"
	"jellytics/backend/internal/repository"
	"jellytics/backend/internal/services"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog/log"
)

// showListFilter holds the parsed filter values shared by list + status counts.
type showListFilter struct {
	Status      string
	Search      string
	Genre       string
	YearFrom    string
	YearTo      string
	WatchedFrom string
	WatchedTo   string
	TagIDs      []int
	Sort        string
}

func parseShowFilter(r *http.Request) showListFilter {
	return showListFilter{
		Status:      r.URL.Query().Get("status"),
		Search:      r.URL.Query().Get("search"),
		Genre:       r.URL.Query().Get("genre"),
		YearFrom:    r.URL.Query().Get("year_from"),
		YearTo:      r.URL.Query().Get("year_to"),
		WatchedFrom: r.URL.Query().Get("watched_from"),
		WatchedTo:   r.URL.Query().Get("watched_to"),
		TagIDs:      parseTagIDs(r.URL.Query().Get("tags")),
		Sort:        r.URL.Query().Get("sort"),
	}
}

// buildShowWhere builds the WHERE fragment (without leading "WHERE") and args
// for a filtered shows query. The includeStatus flag controls whether the
// status filter is applied (status-counts aggregation omits it).
func buildShowWhere(f showListFilter, userID int, includeStatus bool) (string, []interface{}) {
	var sb strings.Builder
	sb.WriteString("user_id = ? AND deleted_at IS NULL")
	args := []interface{}{userID}

	if includeStatus && f.Status != "" {
		sb.WriteString(" AND status = ?")
		args = append(args, f.Status)
	}
	if f.Search != "" {
		s := f.Search
		if len(s) > 200 {
			s = s[:200]
		}
		sb.WriteString(" AND (title LIKE ? OR overview LIKE ?)")
		pat := "%" + s + "%"
		args = append(args, pat, pat)
	}
	if f.Genre != "" {
		sb.WriteString(" AND genre LIKE ?")
		args = append(args, "%\""+f.Genre+"\"%")
	}
	if f.YearFrom != "" {
		sb.WriteString(" AND year >= ?")
		args = append(args, f.YearFrom)
	}
	if f.YearTo != "" {
		sb.WriteString(" AND year <= ?")
		args = append(args, f.YearTo)
	}
	if f.WatchedFrom != "" {
		sb.WriteString(" AND DATE(last_watched_at) >= DATE(?)")
		args = append(args, f.WatchedFrom)
	}
	if f.WatchedTo != "" {
		sb.WriteString(" AND DATE(last_watched_at) <= DATE(?)")
		args = append(args, f.WatchedTo)
	}
	if len(f.TagIDs) > 0 {
		sb.WriteString(" AND id IN (SELECT item_id FROM media_tags WHERE item_type = 'show' AND tag_id IN (")
		for i, tid := range f.TagIDs {
			if i > 0 {
				sb.WriteString(",")
			}
			sb.WriteString("?")
			args = append(args, tid)
		}
		sb.WriteString(") AND tag_id IN (SELECT id FROM tags WHERE user_id = ?))")
		args = append(args, userID)
	}

	return sb.String(), args
}

// showSortClauses maps whitelisted sort keys to ORDER BY fragments.
var showSortClauses = map[string]string{
	"title_asc":         "title COLLATE NOCASE ASC, id ASC",
	"title_desc":        "title COLLATE NOCASE DESC, id DESC",
	"year_asc":          "year IS NULL, year ASC, title COLLATE NOCASE ASC",
	"year_desc":         "year IS NULL, year DESC, title COLLATE NOCASE ASC",
	"added_asc":         "created_at ASC, id ASC",
	"added_desc":        "created_at DESC, id DESC",
	"last_watched_asc":  "last_watched_at IS NULL, last_watched_at ASC, created_at ASC",
	"last_watched_desc": "last_watched_at IS NULL, last_watched_at DESC, created_at DESC",
	"progress_desc":     "CASE WHEN total_episodes > 0 THEN CAST(watched_episodes AS REAL) / total_episodes ELSE 0 END DESC, last_watched_at DESC",
	"progress_asc":      "CASE WHEN total_episodes > 0 THEN CAST(watched_episodes AS REAL) / total_episodes ELSE 0 END ASC, last_watched_at DESC",
}

const defaultShowSort = "COALESCE(last_watched_at, created_at) DESC, created_at DESC"

func showOrderBy(sort string) string {
	if clause, ok := showSortClauses[sort]; ok {
		return clause
	}
	return defaultShowSort
}

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

	filter := parseShowFilter(r)
	limit, offset := parsePagination(r)

	whereClause, whereArgs := buildShowWhere(filter, userID, true)

	listQuery := `
		SELECT id, jellyfin_id, title, overview, poster_url, genre, year, status,
		       total_episodes, watched_episodes, total_watch_time_minutes,
		       first_watched_at, last_watched_at, created_at
		FROM shows
		WHERE ` + whereClause + `
		ORDER BY ` + showOrderBy(filter.Sort) + `
		LIMIT ? OFFSET ?`
	listArgs := append([]interface{}{}, whereArgs...)
	listArgs = append(listArgs, limit, offset)

	countQuery := `SELECT COUNT(*) FROM shows WHERE ` + whereClause
	countArgs := append([]interface{}{}, whereArgs...)

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
		rows, queryErr = h.db.QueryContext(ctx, listQuery, listArgs...)
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

	if err := attachUpNext(ctx, h.db, shows); err != nil {
		log.Warn().Err(err).Msg("Failed to attach up_next")
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

	filter := parseShowFilter(r)
	whereClause, whereArgs := buildShowWhere(filter, userID, false)

	query := `SELECT status, COUNT(*) FROM shows WHERE ` + whereClause + ` GROUP BY status`
	rows, err := h.db.QueryContext(r.Context(), query, whereArgs...)
	if err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to count shows by status"))
		return
	}
	defer rows.Close()

	var counts repository.StatusCounts
	for rows.Next() {
		var status string
		var n int
		if err := rows.Scan(&status, &n); err != nil {
			handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to scan status count"))
			return
		}
		switch status {
		case "watched":
			counts.Watched = n
		case "watching":
			counts.Watching = n
		case "pending":
			counts.Pending = n
		}
		counts.All += n
	}
	if err := rows.Err(); err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to iterate status counts"))
		return
	}

	writeJSON(w, r, counts)
}

// attachUpNext populates the UpNext field for each "watching" show with the
// earliest unwatched episode using a single batched query. Fully watched and
// pending shows are left with UpNext nil.
func attachUpNext(ctx context.Context, db *sql.DB, shows []models.Show) error {
	if len(shows) == 0 {
		return nil
	}

	targetByID := make(map[int]*models.Show)
	for i := range shows {
		if shows[i].Status == "watching" {
			targetByID[shows[i].ID] = &shows[i]
		}
	}
	if len(targetByID) == 0 {
		return nil
	}

	ids := make([]interface{}, 0, len(targetByID))
	placeholders := make([]string, 0, len(targetByID))
	for id := range targetByID {
		ids = append(ids, id)
		placeholders = append(placeholders, "?")
	}

	query := fmt.Sprintf(`
		SELECT e.show_id, e.id, e.season_number, e.episode_number, e.title
		FROM episodes e
		INNER JOIN (
			SELECT show_id, MIN((season_number * 10000) + episode_number) AS ord
			FROM episodes
			WHERE watched = 0 AND show_id IN (%s)
			GROUP BY show_id
		) n ON n.show_id = e.show_id
		   AND ((e.season_number * 10000) + e.episode_number) = n.ord`,
		strings.Join(placeholders, ","))

	rows, err := db.QueryContext(ctx, query, ids...)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var showID, epID, season, episode int
		var title sql.NullString
		if err := rows.Scan(&showID, &epID, &season, &episode, &title); err != nil {
			return err
		}
		if s, ok := targetByID[showID]; ok {
			s.UpNext = &models.UpNext{
				EpisodeID:     epID,
				SeasonNumber:  season,
				EpisodeNumber: episode,
				Title:         title.String,
			}
		}
	}
	return rows.Err()
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
	r.Get("/status-counts", h.GetShowsStatusCounts)
	r.Get("/{id}", h.GetShow)
	r.Delete("/{id}", h.DeleteShow)
	r.Post("/{id}/restore", h.RestoreShow)
}
