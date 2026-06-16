package repository

import (
	"context"
	"database/sql"

	"jellytics/backend/internal/errors"
	"jellytics/backend/internal/models"
)

// ArchiveStore lists soft-deleted (removed from Jellyfin) media for a user.
type ArchiveStore interface {
	RemovedMovies(ctx context.Context, userID int) ([]models.ArchiveItem, error)
	RemovedShows(ctx context.Context, userID int) ([]models.ArchiveItem, error)
}

// SQLArchiveStore implements ArchiveStore with SQLite.
type SQLArchiveStore struct {
	db *sql.DB
}

// NewSQLArchiveStore returns a new SQL-backed ArchiveStore.
func NewSQLArchiveStore(db *sql.DB) *SQLArchiveStore {
	return &SQLArchiveStore{db: db}
}

const isoLayout = "2006-01-02T15:04:05Z07:00"

func (s *SQLArchiveStore) RemovedMovies(ctx context.Context, userID int) ([]models.ArchiveItem, error) {
	return s.removed(ctx, userID, "movie", "movies", "watch_count", "/api/v1/images/movies/")
}

func (s *SQLArchiveStore) RemovedShows(ctx context.Context, userID int) ([]models.ArchiveItem, error) {
	return s.removed(ctx, userID, "show", "shows", "watched_episodes", "/api/v1/images/shows/")
}

// removed lists soft-deleted rows from the movies/shows table. countCol is the
// per-type column mapped onto ArchiveItem.WatchCount; posterPrefix builds the
// poster URL from the jellyfin id.
func (s *SQLArchiveStore) removed(ctx context.Context, userID int, itemType, table, countCol, posterPrefix string) ([]models.ArchiveItem, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, jellyfin_id, title, year, status, total_watch_time_minutes, `+countCol+`, deleted_at
		 FROM `+table+`
		 WHERE user_id = ? AND deleted_at IS NOT NULL
		 ORDER BY deleted_at DESC`,
		userID)
	if err != nil {
		return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to query removed "+table)
	}
	defer rows.Close()

	items := []models.ArchiveItem{}
	for rows.Next() {
		var it models.ArchiveItem
		var year sql.NullInt64
		var deletedAt sql.NullTime
		var status sql.NullString
		it.Type = itemType
		if err := rows.Scan(&it.ID, &it.JellyfinID, &it.Title, &year, &status,
			&it.TotalWatchTimeMins, &it.WatchCount, &deletedAt); err != nil {
			return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to scan removed "+table)
		}
		it.Status = status.String
		if deletedAt.Valid {
			t := deletedAt.Time.Format(isoLayout)
			it.RemovedAt = &t
		}
		if year.Valid {
			y := int(year.Int64)
			it.Year = &y
		}
		poster := posterPrefix + it.JellyfinID + "/poster"
		it.PosterURL = &poster
		items = append(items, it)
	}
	if err := rows.Err(); err != nil {
		return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to iterate removed "+table)
	}
	return items, nil
}
