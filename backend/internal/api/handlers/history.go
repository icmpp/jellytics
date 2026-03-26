package handlers

import (
	"context"
	"database/sql"
	"net/http"
	"sort"
	"strconv"
	"sync"

	"jellytics/backend/internal/api/middleware"
	"jellytics/backend/internal/errors"

	"github.com/go-chi/chi/v5"
)

type HistoryHandler struct {
	db *sql.DB
}

func NewHistoryHandler(db *sql.DB) *HistoryHandler {
	return &HistoryHandler{db: db}
}

type HistoryItem struct {
	ID                   string   `json:"id"`
	Type                 string   `json:"type"` // "episode" | "movie"
	Title                string   `json:"title"`
	ShowTitle            *string  `json:"showTitle,omitempty"`
	SeasonNumber         *int     `json:"seasonNumber,omitempty"`
	EpisodeNumber        *int     `json:"episodeNumber,omitempty"`
	WatchedAt            string   `json:"watchedAt"`
	FirstWatchedAt       *string  `json:"firstWatchedAt,omitempty"`
	Duration             *int     `json:"duration,omitempty"`
	TotalWatchTime       *int     `json:"totalWatchTime,omitempty"`
	WatchCount           *int     `json:"watchCount,omitempty"`
	CompletionPercentage *float64 `json:"completionPercentage,omitempty"`
	Status               *string  `json:"status,omitempty"`
	PosterURL            *string  `json:"posterUrl,omitempty"`
	ShowID               *int     `json:"showId,omitempty"`
	MovieID              *int     `json:"movieId,omitempty"`
	RemovedFromLibrary   bool     `json:"removedFromLibrary,omitempty"`
}

type HistoryResponse struct {
	Items []HistoryItem `json:"items"`
	Total int           `json:"total"`
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
	fetchLimit := limit + offset
	fetchOffset := 0
	if !mergeTypes && itemType == "movie" {
		fetchLimit = limit
		fetchOffset = offset
	}

	var items []HistoryItem
	ctx := r.Context()

	if itemType == "" || itemType == "all" {
		var epItems, movieItems []HistoryItem
		var epErr, movieErr error
		var wg sync.WaitGroup

		wg.Add(2)
		go func() {
			defer wg.Done()
			epItems, epErr = h.getEpisodeHistory(ctx, userID, fetchLimit, fetchOffset)
		}()
		go func() {
			defer wg.Done()
			movieItems, movieErr = h.getMovieHistory(ctx, userID, fetchLimit, fetchOffset)
		}()
		wg.Wait()

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
	} else {
		if itemType == "episode" {
			epItems, err := h.getEpisodeHistory(ctx, userID, fetchLimit, fetchOffset)
			if err != nil {
				handleError(w, r, err)
				return
			}
			items = append(items, epItems...)
		}
		if itemType == "movie" {
			movieItems, err := h.getMovieHistory(ctx, userID, fetchLimit, fetchOffset)
			if err != nil {
				handleError(w, r, err)
				return
			}
			items = append(items, movieItems...)
		}
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

	writeJSON(w, r, HistoryResponse{
		Items: items,
		Total: len(items),
	})
}

func (h *HistoryHandler) getEpisodeHistory(ctx context.Context, userID, limit, offset int) ([]HistoryItem, error) {
	rows, err := h.db.QueryContext(ctx,
		`SELECT wh.id, wh.watched_at, wh.duration_watched_minutes, wh.completion_percentage,
		        e.title as episode_title, e.season_number, e.episode_number, e.duration_minutes,
		        s.id as show_id, s.title as show_title, s.jellyfin_id as show_jellyfin_id, s.status as show_status,
		        s.total_watch_time_minutes, s.watched_episodes, s.first_watched_at as show_first_watched,
		        s.deleted_at
		 FROM watch_history wh
		 JOIN shows s ON s.id = wh.show_id
		 LEFT JOIN episodes e ON e.id = wh.episode_id
		 WHERE wh.user_id = ? AND wh.movie_id IS NULL
		 ORDER BY wh.watched_at DESC
		 LIMIT ? OFFSET ?`,
		userID, limit, offset)
	if err != nil {
		return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to query episode history")
	}
	defer rows.Close()

	var items []HistoryItem
	for rows.Next() {
		var whID int
		var watchedAt, episodeTitle, showTitle, showJellyfinID, showStatus sql.NullString
		var durationWatched, seasonNum, episodeNum, durationMins sql.NullInt64
		var completionPct sql.NullFloat64
		var showID int
		var totalWatchMins, watchedEps int
		var showFirstWatched, showDeletedAt sql.NullTime

		if err := rows.Scan(&whID, &watchedAt, &durationWatched, &completionPct,
			&episodeTitle, &seasonNum, &episodeNum, &durationMins,
			&showID, &showTitle, &showJellyfinID, &showStatus,
			&totalWatchMins, &watchedEps, &showFirstWatched, &showDeletedAt); err != nil {
			continue
		}

		title := showTitle.String
		if episodeTitle.Valid && episodeTitle.String != "" {
			title = episodeTitle.String
		}

		item := HistoryItem{
			ID:        "wh-" + strconv.Itoa(whID),
			Type:      "episode",
			Title:     title,
			WatchedAt: watchedAt.String,
			ShowID:    &showID,
		}

		if showTitle.Valid {
			item.ShowTitle = &showTitle.String
		}
		if seasonNum.Valid {
			s := int(seasonNum.Int64)
			item.SeasonNumber = &s
		}
		if episodeNum.Valid {
			e := int(episodeNum.Int64)
			item.EpisodeNumber = &e
		}
		if showFirstWatched.Valid {
			t := showFirstWatched.Time.Format("2006-01-02T15:04:05Z07:00")
			item.FirstWatchedAt = &t
		}
		if durationWatched.Valid {
			d := int(durationWatched.Int64)
			item.TotalWatchTime = &d
		}
		if completionPct.Valid {
			item.CompletionPercentage = &completionPct.Float64
		}
		if showStatus.Valid {
			item.Status = &showStatus.String
		}
		if durationMins.Valid {
			d := int(durationMins.Int64)
			item.Duration = &d
		}
		item.WatchCount = &watchedEps
		if showJellyfinID.Valid && showJellyfinID.String != "" {
			url := "/api/v1/images/shows/" + showJellyfinID.String + "/poster"
			item.PosterURL = &url
		}
		item.RemovedFromLibrary = showDeletedAt.Valid

		items = append(items, item)
	}

	fallbackRows, err := h.db.QueryContext(ctx,
		`SELECT s.id, s.title, s.jellyfin_id, s.last_watched_at, s.first_watched_at, s.status,
		        s.total_watch_time_minutes, s.watched_episodes, s.deleted_at
		 FROM shows s
		 WHERE s.user_id = ? AND s.last_watched_at IS NOT NULL
		   AND (s.total_watch_time_minutes >= 5 OR s.watched_episodes > 0)
		   AND NOT EXISTS (SELECT 1 FROM watch_history wh WHERE wh.show_id = s.id AND wh.user_id = ?)
		 ORDER BY s.last_watched_at DESC
		 LIMIT ? OFFSET ?`,
		userID, userID, limit, 0)
	if err != nil {
		return items, nil // non-fatal, we already have wh data
	}
	defer fallbackRows.Close()

	for fallbackRows.Next() {
		var showID int
		var title, jellyfinID, lastWatched, status sql.NullString
		var firstWatched, showDeletedAt sql.NullTime
		var totalWatchMins, watchedEps int

		if err := fallbackRows.Scan(&showID, &title, &jellyfinID, &lastWatched, &firstWatched,
			&status, &totalWatchMins, &watchedEps, &showDeletedAt); err != nil {
			continue
		}

		item := HistoryItem{
			ID:             "show-" + strconv.Itoa(showID),
			Type:           "episode",
			Title:          title.String,
			WatchedAt:      lastWatched.String,
			ShowID:         &showID,
			TotalWatchTime: &totalWatchMins,
			WatchCount:     &watchedEps,
		}
		if firstWatched.Valid {
			t := firstWatched.Time.Format("2006-01-02T15:04:05Z07:00")
			item.FirstWatchedAt = &t
		}
		if status.Valid {
			item.Status = &status.String
		}
		if jellyfinID.Valid && jellyfinID.String != "" {
			url := "/api/v1/images/shows/" + jellyfinID.String + "/poster"
			item.PosterURL = &url
		}
		item.RemovedFromLibrary = showDeletedAt.Valid

		items = append(items, item)
	}

	sort.Slice(items, func(i, j int) bool {
		return items[i].WatchedAt > items[j].WatchedAt
	})

	return items, nil
}

func (h *HistoryHandler) getMovieHistory(ctx context.Context, userID, limit, offset int) ([]HistoryItem, error) {
	rows, err := h.db.QueryContext(ctx,
		`SELECT id, jellyfin_id, title, last_watched_at, first_watched_at, runtime_minutes,
		        total_watch_time_minutes, watch_count, completion_percentage, status, deleted_at
		 FROM movies
		 WHERE user_id = ? AND last_watched_at IS NOT NULL
		   AND (total_watch_time_minutes >= 5 OR status = 'watched')
		 ORDER BY last_watched_at DESC
		 LIMIT ? OFFSET ?`,
		userID, limit, offset)
	if err != nil {
		return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to query movie history")
	}
	defer rows.Close()

	var items []HistoryItem
	for rows.Next() {
		var movieID int
		var jellyfinID, title, lastWatched, status sql.NullString
		var firstWatched, movieDeletedAt sql.NullTime
		var runtimeMins sql.NullInt64
		var totalWatchMins, watchCount int
		var completionPct float64

		if err := rows.Scan(&movieID, &jellyfinID, &title, &lastWatched, &firstWatched,
			&runtimeMins, &totalWatchMins, &watchCount, &completionPct, &status, &movieDeletedAt); err != nil {
			continue
		}

		item := HistoryItem{
			ID:                   "movie-" + strconv.Itoa(movieID),
			Type:                 "movie",
			Title:                title.String,
			WatchedAt:            lastWatched.String,
			MovieID:              &movieID,
			TotalWatchTime:       &totalWatchMins,
			WatchCount:           &watchCount,
			CompletionPercentage: &completionPct,
		}
		if firstWatched.Valid {
			t := firstWatched.Time.Format("2006-01-02T15:04:05Z07:00")
			item.FirstWatchedAt = &t
		}
		if status.Valid {
			item.Status = &status.String
		}
		if runtimeMins.Valid {
			d := int(runtimeMins.Int64)
			item.Duration = &d
		}
		if jellyfinID.Valid && jellyfinID.String != "" {
			url := "/api/v1/images/movies/" + jellyfinID.String + "/poster"
			item.PosterURL = &url
		}
		item.RemovedFromLibrary = movieDeletedAt.Valid

		items = append(items, item)
	}

	return items, nil
}

func (h *HistoryHandler) RegisterRoutes(r chi.Router) {
	r.Get("/", h.ListHistory)
}
