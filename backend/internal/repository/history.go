package repository

import (
	"context"
	"database/sql"
	"sort"
	"strconv"

	"jellytics/backend/internal/errors"
	"jellytics/backend/internal/models"
)

// HistoryStore reads watch-history entries for the History page.
type HistoryStore interface {
	// EpisodeHistory returns episode watch-history rows (plus a fallback for
	// shows with watch activity but no watch_history rows), newest first.
	EpisodeHistory(ctx context.Context, userID, limit, offset int) ([]models.HistoryItem, error)
	// MovieHistory returns movie watch-history rows, newest first.
	MovieHistory(ctx context.Context, userID, limit, offset int) ([]models.HistoryItem, error)
}

// SQLHistoryStore implements HistoryStore with SQLite.
type SQLHistoryStore struct {
	db *sql.DB
}

// NewSQLHistoryStore returns a new SQL-backed HistoryStore.
func NewSQLHistoryStore(db *sql.DB) *SQLHistoryStore {
	return &SQLHistoryStore{db: db}
}

func (s *SQLHistoryStore) EpisodeHistory(ctx context.Context, userID, limit, offset int) ([]models.HistoryItem, error) {
	rows, err := s.db.QueryContext(ctx,
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

	var items []models.HistoryItem
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

		item := models.HistoryItem{
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
			v := int(seasonNum.Int64)
			item.SeasonNumber = &v
		}
		if episodeNum.Valid {
			v := int(episodeNum.Int64)
			item.EpisodeNumber = &v
		}
		if showFirstWatched.Valid {
			t := showFirstWatched.Time.Format(isoLayout)
			item.FirstWatchedAt = &t
		}
		if durationWatched.Valid {
			v := int(durationWatched.Int64)
			item.TotalWatchTime = &v
		}
		if completionPct.Valid {
			item.CompletionPercentage = &completionPct.Float64
		}
		if showStatus.Valid {
			item.Status = &showStatus.String
		}
		if durationMins.Valid {
			v := int(durationMins.Int64)
			item.Duration = &v
		}
		item.WatchCount = &watchedEps
		if showJellyfinID.Valid && showJellyfinID.String != "" {
			url := "/api/v1/images/shows/" + showJellyfinID.String + "/poster"
			item.PosterURL = &url
		}
		item.RemovedFromLibrary = showDeletedAt.Valid

		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to iterate episode history")
	}

	// Fallback: shows with watch activity but no watch_history rows (legacy data).
	fallbackRows, err := s.db.QueryContext(ctx,
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
		return items, nil // non-fatal; we already have watch_history data
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

		item := models.HistoryItem{
			ID:             "show-" + strconv.Itoa(showID),
			Type:           "episode",
			Title:          title.String,
			WatchedAt:      lastWatched.String,
			ShowID:         &showID,
			TotalWatchTime: &totalWatchMins,
			WatchCount:     &watchedEps,
		}
		if firstWatched.Valid {
			t := firstWatched.Time.Format(isoLayout)
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

func (s *SQLHistoryStore) MovieHistory(ctx context.Context, userID, limit, offset int) ([]models.HistoryItem, error) {
	rows, err := s.db.QueryContext(ctx,
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

	var items []models.HistoryItem
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

		item := models.HistoryItem{
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
			t := firstWatched.Time.Format(isoLayout)
			item.FirstWatchedAt = &t
		}
		if status.Valid {
			item.Status = &status.String
		}
		if runtimeMins.Valid {
			v := int(runtimeMins.Int64)
			item.Duration = &v
		}
		if jellyfinID.Valid && jellyfinID.String != "" {
			url := "/api/v1/images/movies/" + jellyfinID.String + "/poster"
			item.PosterURL = &url
		}
		item.RemovedFromLibrary = movieDeletedAt.Valid

		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to iterate movie history")
	}

	return items, nil
}
