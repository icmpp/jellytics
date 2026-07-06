package repository

import (
	"context"
	"database/sql"

	"jellytics/backend/internal/errors"
	"jellytics/backend/internal/models"
)

// SearchStore runs the global search queries (each capped at 5 results).
type SearchStore interface {
	Shows(ctx context.Context, userID int, pattern string) ([]models.SearchShow, error)
	Movies(ctx context.Context, userID int, pattern string) ([]models.SearchMovie, error)
	Episodes(ctx context.Context, userID int, pattern string) ([]models.SearchEpisode, error)
}

// SQLSearchStore implements SearchStore with SQLite.
type SQLSearchStore struct {
	db *sql.DB
}

// NewSQLSearchStore returns a new SQL-backed SearchStore.
func NewSQLSearchStore(db *sql.DB) *SQLSearchStore {
	return &SQLSearchStore{db: db}
}

func (s *SQLSearchStore) Shows(ctx context.Context, userID int, pattern string) ([]models.SearchShow, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, jellyfin_id, title, year, status
		 FROM shows
		 WHERE user_id = ? AND deleted_at IS NULL AND title LIKE ?
		 ORDER BY COALESCE(last_watched_at, created_at) DESC
		 LIMIT 5`,
		userID, pattern)
	if err != nil {
		return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to search shows")
	}
	defer rows.Close()

	results := []models.SearchShow{}
	for rows.Next() {
		var sh models.SearchShow
		var year sql.NullInt64
		if err := rows.Scan(&sh.ID, &sh.JellyfinID, &sh.Title, &year, &sh.Status); err != nil {
			return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to scan show result")
		}
		if year.Valid {
			y := int(year.Int64)
			sh.Year = &y
		}
		results = append(results, sh)
	}
	return results, rows.Err()
}

func (s *SQLSearchStore) Movies(ctx context.Context, userID int, pattern string) ([]models.SearchMovie, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, jellyfin_id, title, year, status
		 FROM movies
		 WHERE user_id = ? AND deleted_at IS NULL AND title LIKE ?
		 ORDER BY COALESCE(last_watched_at, created_at) DESC
		 LIMIT 5`,
		userID, pattern)
	if err != nil {
		return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to search movies")
	}
	defer rows.Close()

	results := []models.SearchMovie{}
	for rows.Next() {
		var m models.SearchMovie
		var year sql.NullInt64
		if err := rows.Scan(&m.ID, &m.JellyfinID, &m.Title, &year, &m.Status); err != nil {
			return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to scan movie result")
		}
		if year.Valid {
			y := int(year.Int64)
			m.Year = &y
		}
		results = append(results, m)
	}
	return results, rows.Err()
}

func (s *SQLSearchStore) Episodes(ctx context.Context, userID int, pattern string) ([]models.SearchEpisode, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT e.id, e.show_id, s.jellyfin_id, s.title, e.title, e.season_number, e.episode_number, e.watched
		 FROM episodes e
		 JOIN shows s ON e.show_id = s.id
		 WHERE s.user_id = ? AND s.deleted_at IS NULL AND e.title LIKE ?
		 ORDER BY e.watched_at DESC
		 LIMIT 5`,
		userID, pattern)
	if err != nil {
		return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to search episodes")
	}
	defer rows.Close()

	results := []models.SearchEpisode{}
	for rows.Next() {
		var ep models.SearchEpisode
		var epTitle sql.NullString
		if err := rows.Scan(&ep.ID, &ep.ShowID, &ep.ShowJellyfinID, &ep.ShowTitle, &epTitle, &ep.SeasonNumber, &ep.EpisodeNumber, &ep.Watched); err != nil {
			return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to scan episode result")
		}
		ep.Title = epTitle.String
		results = append(results, ep)
	}
	return results, rows.Err()
}
