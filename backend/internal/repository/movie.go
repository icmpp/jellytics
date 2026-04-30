// Package repository provides data access interfaces and SQL implementations.
package repository

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"jellytics/backend/internal/errors"
	"jellytics/backend/internal/models"
)

// MovieListFilter holds filter parameters for listing movies.
type MovieListFilter struct {
	Status      string
	Search      string
	Genre       string
	YearFrom    string
	YearTo      string
	WatchedFrom string
	WatchedTo   string
	TagIDs      []int
	UserID      int // used for tag filter subquery
	Sort        string
	Limit       int
	Offset      int
}

// movieSortClauses maps whitelisted sort keys to ORDER BY fragments.
// Any unknown/empty key falls back to the default (recently watched first).
var movieSortClauses = map[string]string{
	"title_asc":          "title COLLATE NOCASE ASC, id ASC",
	"title_desc":         "title COLLATE NOCASE DESC, id DESC",
	"year_asc":           "year IS NULL, year ASC, title COLLATE NOCASE ASC",
	"year_desc":          "year IS NULL, year DESC, title COLLATE NOCASE ASC",
	"added_asc":          "created_at ASC, id ASC",
	"added_desc":         "created_at DESC, id DESC",
	"last_watched_asc":   "last_watched_at IS NULL, last_watched_at ASC, created_at ASC",
	"last_watched_desc":  "last_watched_at IS NULL, last_watched_at DESC, created_at DESC",
	"runtime_asc":        "runtime_minutes IS NULL, runtime_minutes ASC, title COLLATE NOCASE ASC",
	"runtime_desc":       "runtime_minutes IS NULL, runtime_minutes DESC, title COLLATE NOCASE ASC",
	"progress_desc":      "completion_percentage DESC, last_watched_at DESC",
	"progress_asc":       "completion_percentage ASC, last_watched_at DESC",
}

const defaultMovieSort = "last_watched_at IS NULL, last_watched_at DESC, created_at DESC"

func movieOrderBy(sort string) string {
	if clause, ok := movieSortClauses[sort]; ok {
		return clause
	}
	return defaultMovieSort
}

// StatusCounts summarises how many items fall in each watch status bucket.
type StatusCounts struct {
	All      int `json:"all"`
	Watched  int `json:"watched"`
	Watching int `json:"watching"`
	Pending  int `json:"pending"`
}

// MovieStore defines data access for movies.
type MovieStore interface {
	List(ctx context.Context, userID int, filter MovieListFilter) ([]*models.Movie, int, error)
	GetByID(ctx context.Context, id, userID int) (*models.Movie, error)
	Exists(ctx context.Context, id, userID int) (bool, error)
	SoftDelete(ctx context.Context, id, userID int) error
	Restore(ctx context.Context, id, userID int) error
	RemoveFromWatchlist(ctx context.Context, userID, itemID int) error
	StatusCounts(ctx context.Context, userID int, filter MovieListFilter) (StatusCounts, error)
}

// SQLMovieStore implements MovieStore with SQLite.
type SQLMovieStore struct {
	db *sql.DB
}

// NewSQLMovieStore returns a new SQL-backed MovieStore.
func NewSQLMovieStore(db *sql.DB) *SQLMovieStore {
	return &SQLMovieStore{db: db}
}

func (s *SQLMovieStore) List(ctx context.Context, userID int, filter MovieListFilter) ([]*models.Movie, int, error) {
	baseWhere := "WHERE user_id = ? AND deleted_at IS NULL"
	args := []interface{}{userID}
	countArgs := []interface{}{userID}
	buildFilters(&args, &countArgs, filter, false)

	countQuery := "SELECT COUNT(*) FROM movies " + baseWhere + buildFilterClause(filter, false)
	var total int
	if err := s.db.QueryRowContext(ctx, countQuery, countArgs...).Scan(&total); err != nil {
		return nil, 0, errors.Wrap(err, errors.CodeDatabaseError, "Failed to count movies")
	}

	query := `
		SELECT id, jellyfin_id, title, overview, poster_url, backdrop_url, genre, year,
		       imdb_id, tmdb_id, runtime_minutes, status, watched, watch_count,
		       total_watch_time_minutes, completion_percentage,
		       first_watched_at, last_watched_at, created_at
		FROM movies ` + baseWhere + buildFilterClause(filter, false) + `
		ORDER BY ` + movieOrderBy(filter.Sort) + ` LIMIT ? OFFSET ?`
	args = append(args, filter.Limit, filter.Offset)

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, errors.Wrap(err, errors.CodeDatabaseError, "Failed to query movies")
	}
	defer rows.Close()

	var movies []*models.Movie
	for rows.Next() {
		movie, err := scanMovie(rows)
		if err != nil {
			return nil, 0, err
		}
		movies = append(movies, movie)
	}
	return movies, total, rows.Err()
}

func (s *SQLMovieStore) GetByID(ctx context.Context, id, userID int) (*models.Movie, error) {
	var movie models.Movie
	var genre sql.NullString
	var year sql.NullInt64
	var runtimeMinutes sql.NullInt64
	var firstWatchedAt sql.NullTime
	var lastWatchedAt sql.NullTime
	var deletedAt sql.NullTime

	err := s.db.QueryRowContext(ctx,
		`SELECT id, jellyfin_id, title, overview, poster_url, backdrop_url, genre, year,
		        imdb_id, tmdb_id, runtime_minutes, status, watched, watch_count,
		        total_watch_time_minutes, completion_percentage,
		        first_watched_at, last_watched_at, created_at, deleted_at
		 FROM movies WHERE id = ? AND user_id = ?`, id, userID).Scan(
		&movie.ID, &movie.JellyfinID, &movie.Title, &movie.Overview, &movie.PosterURL,
		&movie.BackdropURL, &genre, &year, &movie.IMDBID, &movie.TMDBID,
		&runtimeMinutes, &movie.Status, &movie.Watched, &movie.WatchCount,
		&movie.TotalWatchTimeMinutes, &movie.CompletionPercentage,
		&firstWatchedAt, &lastWatchedAt, &movie.CreatedAt, &deletedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to get movie")
	}
	applyMovieNulls(&movie, &genre, &year, &runtimeMinutes, &firstWatchedAt, &lastWatchedAt, &deletedAt)
	return &movie, nil
}

func (s *SQLMovieStore) Exists(ctx context.Context, id, userID int) (bool, error) {
	var exists bool
	err := s.db.QueryRowContext(ctx,
		`SELECT EXISTS(SELECT 1 FROM movies WHERE id = ? AND user_id = ? AND deleted_at IS NULL)`,
		id, userID).Scan(&exists)
	if err != nil {
		return false, errors.Wrap(err, errors.CodeDatabaseError, "Failed to verify movie")
	}
	return exists, nil
}

func (s *SQLMovieStore) SoftDelete(ctx context.Context, id, userID int) error {
	now := time.Now()
	result, err := s.db.ExecContext(ctx,
		`UPDATE movies SET deleted_at = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
		now, now, id, userID)
	if err != nil {
		return errors.Wrap(err, errors.CodeDatabaseError, "Failed to remove movie")
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return errors.New(errors.CodeNotFound, "Movie not found")
	}
	return nil
}

func (s *SQLMovieStore) Restore(ctx context.Context, id, userID int) error {
	result, err := s.db.ExecContext(ctx,
		`UPDATE movies SET deleted_at = NULL, updated_at = ? WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL`,
		time.Now(), id, userID)
	if err != nil {
		return errors.Wrap(err, errors.CodeDatabaseError, "Failed to restore movie")
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return errors.New(errors.CodeNotFound, "Movie not found or not in archive")
	}
	return nil
}

func (s *SQLMovieStore) RemoveFromWatchlist(ctx context.Context, userID, itemID int) error {
	_, err := s.db.ExecContext(ctx,
		`DELETE FROM watchlist WHERE user_id = ? AND item_type = 'movie' AND item_id = ?`,
		userID, itemID)
	return err // Best-effort; soft delete is the critical operation
}

// StatusCounts returns movie counts per status bucket, honoring all filters
// in `filter` *except* `Status` itself (so counts reflect what each segment
// would yield if selected).
func (s *SQLMovieStore) StatusCounts(ctx context.Context, userID int, filter MovieListFilter) (StatusCounts, error) {
	countFilter := filter
	countFilter.Status = ""
	countFilter.Limit = 0
	countFilter.Offset = 0

	args := []interface{}{userID}
	dummyCountArgs := []interface{}{userID}
	buildFilters(&args, &dummyCountArgs, countFilter, false)

	query := `SELECT status, COUNT(*) FROM movies WHERE user_id = ? AND deleted_at IS NULL` +
		buildFilterClause(countFilter, false) +
		` GROUP BY status`

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return StatusCounts{}, errors.Wrap(err, errors.CodeDatabaseError, "Failed to count movies by status")
	}
	defer rows.Close()

	var counts StatusCounts
	for rows.Next() {
		var status string
		var n int
		if err := rows.Scan(&status, &n); err != nil {
			return StatusCounts{}, errors.Wrap(err, errors.CodeDatabaseError, "Failed to scan status count")
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
		return StatusCounts{}, errors.Wrap(err, errors.CodeDatabaseError, "Failed to iterate status counts")
	}
	return counts, nil
}

func buildFilters(args, countArgs *[]interface{}, filter MovieListFilter, forShows bool) {
	if filter.Status != "" {
		*args = append(*args, filter.Status)
		*countArgs = append(*countArgs, filter.Status)
	}
	if filter.Search != "" {
		s := filter.Search
		if len(s) > 200 {
			s = s[:200]
		}
		pat := "%" + s + "%"
		*args = append(*args, pat, pat)
		*countArgs = append(*countArgs, pat, pat)
	}
	if filter.Genre != "" {
		g := "%\"" + filter.Genre + "\"%"
		*args = append(*args, g)
		*countArgs = append(*countArgs, g)
	}
	if filter.YearFrom != "" {
		*args = append(*args, filter.YearFrom)
		*countArgs = append(*countArgs, filter.YearFrom)
	}
	if filter.YearTo != "" {
		*args = append(*args, filter.YearTo)
		*countArgs = append(*countArgs, filter.YearTo)
	}
	if filter.WatchedFrom != "" {
		*args = append(*args, filter.WatchedFrom)
		*countArgs = append(*countArgs, filter.WatchedFrom)
	}
	if filter.WatchedTo != "" {
		*args = append(*args, filter.WatchedTo)
		*countArgs = append(*countArgs, filter.WatchedTo)
	}
	for _, tid := range filter.TagIDs {
		*args = append(*args, tid)
		*countArgs = append(*countArgs, tid)
	}
	if len(filter.TagIDs) > 0 && filter.UserID > 0 {
		*args = append(*args, filter.UserID)
		*countArgs = append(*countArgs, filter.UserID)
	}
}

func buildFilterClause(filter MovieListFilter, forShows bool) string {
	var c string
	if filter.Status != "" {
		c += " AND status = ?"
	}
	if filter.Search != "" {
		c += " AND (title LIKE ? OR overview LIKE ?)"
	}
	if filter.Genre != "" {
		c += " AND genre LIKE ?"
	}
	if filter.YearFrom != "" {
		c += " AND year >= ?"
	}
	if filter.YearTo != "" {
		c += " AND year <= ?"
	}
	if filter.WatchedFrom != "" {
		c += " AND DATE(last_watched_at) >= DATE(?)"
	}
	if filter.WatchedTo != "" {
		c += " AND DATE(last_watched_at) <= DATE(?)"
	}
	if len(filter.TagIDs) > 0 {
		c += " AND id IN (SELECT item_id FROM media_tags WHERE item_type = 'movie' AND tag_id IN ("
		for i := range filter.TagIDs {
			if i > 0 {
				c += ","
			}
			c += "?"
		}
		c += ") AND tag_id IN (SELECT id FROM tags WHERE user_id = ?))"
	}
	return c
}

func scanMovie(rows interface {
	Scan(dest ...interface{}) error
}) (*models.Movie, error) {
	var movie models.Movie
	var genre sql.NullString
	var year sql.NullInt64
	var runtimeMinutes sql.NullInt64
	var firstWatchedAt sql.NullTime
	var lastWatchedAt sql.NullTime
	err := rows.Scan(
		&movie.ID, &movie.JellyfinID, &movie.Title, &movie.Overview, &movie.PosterURL,
		&movie.BackdropURL, &genre, &year, &movie.IMDBID, &movie.TMDBID,
		&runtimeMinutes, &movie.Status, &movie.Watched, &movie.WatchCount,
		&movie.TotalWatchTimeMinutes, &movie.CompletionPercentage,
		&firstWatchedAt, &lastWatchedAt, &movie.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("scan movie: %w", err)
	}
	applyMovieNulls(&movie, &genre, &year, &runtimeMinutes, &firstWatchedAt, &lastWatchedAt, nil)
	return &movie, nil
}

func applyMovieNulls(m *models.Movie, genre *sql.NullString, year, runtime *sql.NullInt64, first, last *sql.NullTime, deleted *sql.NullTime) {
	if genre != nil && genre.Valid {
		m.Genre = genre.String
	}
	if year != nil && year.Valid {
		y := int(year.Int64)
		m.Year = &y
	}
	if runtime != nil && runtime.Valid {
		rm := int(runtime.Int64)
		m.RuntimeMinutes = &rm
	}
	if first != nil && first.Valid {
		m.FirstWatchedAt = &first.Time
	}
	if last != nil && last.Valid {
		m.LastWatchedAt = &last.Time
	}
	if deleted != nil && deleted.Valid {
		m.RemovedFromLibrary = true
	}
}
