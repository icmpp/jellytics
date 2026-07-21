package repository

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"jellytics/backend/internal/database"
	"jellytics/backend/internal/errors"
	"jellytics/backend/internal/models"
)

// ShowListFilter holds filter parameters for listing shows.
type ShowListFilter struct {
	Status      string
	Search      string
	Genre       string
	YearFrom    string
	YearTo      string
	WatchedFrom string
	WatchedTo   string
	TagIDs      []int
	// Archived filters on deleted_from_jellyfin: "" = all, "only" = archived
	// only, "active" = hide archived.
	Archived string
	Sort     string
	Limit    int
	Offset   int
}

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

// buildShowWhere builds the WHERE fragment (without leading "WHERE") and args.
// includeStatus controls whether the status filter is applied (status-counts omit it).
func buildShowWhere(f ShowListFilter, userID int, includeStatus bool) (string, []interface{}) {
	var sb strings.Builder
	sb.WriteString("user_id = ? AND deleted_at IS NULL AND duplicate_of IS NULL")
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

	sb.WriteString(archivedClause(f.Archived))

	return sb.String(), args
}

// ShowStore defines data access for shows and their episodes.
type ShowStore interface {
	// List returns filtered shows (with UpNext populated for "watching" shows)
	// plus the total count ignoring pagination.
	List(ctx context.Context, userID int, filter ShowListFilter) ([]models.Show, int, error)
	// StatusCounts returns per-status counts honoring all filters except status.
	StatusCounts(ctx context.Context, userID int, filter ShowListFilter) (StatusCounts, error)
	// GetWithEpisodes returns a show and its episodes, or (nil, nil, nil) if not found.
	GetWithEpisodes(ctx context.Context, id, userID int) (*models.Show, []models.Episode, error)
	// SoftDelete archives a show and removes it from the watchlist atomically,
	// returning whether the show existed (and was not already archived).
	SoftDelete(ctx context.Context, id, userID int) (bool, error)
	// Restore un-archives a show, returning whether a row was restored.
	Restore(ctx context.Context, id, userID int) (bool, error)
}

// SQLShowStore implements ShowStore with SQLite.
type SQLShowStore struct {
	db *sql.DB
}

// NewSQLShowStore returns a new SQL-backed ShowStore.
func NewSQLShowStore(db *sql.DB) *SQLShowStore {
	return &SQLShowStore{db: db}
}

func (s *SQLShowStore) List(ctx context.Context, userID int, filter ShowListFilter) ([]models.Show, int, error) {
	where, whereArgs := buildShowWhere(filter, userID, true)

	var total int
	if err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM shows WHERE `+where, whereArgs...).Scan(&total); err != nil {
		return nil, 0, errors.Wrap(err, errors.CodeDatabaseError, "Failed to count shows")
	}

	listArgs := append(append([]interface{}{}, whereArgs...), filter.Limit, filter.Offset)
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, jellyfin_id, title, overview, poster_url, genre, year, status,
		       total_episodes, watched_episodes, total_watch_time_minutes,
		       first_watched_at, last_watched_at, created_at,
		       COALESCE(deleted_from_jellyfin, 0), archived_at
		FROM shows
		WHERE `+where+`
		ORDER BY `+showOrderBy(filter.Sort)+`
		LIMIT ? OFFSET ?`, listArgs...)
	if err != nil {
		return nil, 0, errors.Wrap(err, errors.CodeDatabaseError, "Failed to query shows")
	}
	defer rows.Close()

	shows := []models.Show{}
	for rows.Next() {
		show, err := scanShowListRow(rows)
		if err != nil {
			return nil, 0, errors.Wrap(err, errors.CodeDatabaseError, "Failed to scan show row")
		}
		shows = append(shows, show)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, errors.Wrap(err, errors.CodeDatabaseError, "Failed to iterate shows")
	}

	if err := s.attachUpNext(ctx, shows); err != nil {
		return nil, 0, errors.Wrap(err, errors.CodeDatabaseError, "Failed to attach up next")
	}
	return shows, total, nil
}

func scanShowListRow(rows *sql.Rows) (models.Show, error) {
	var show models.Show
	var genre sql.NullString
	var year, totalEpisodes sql.NullInt64
	var firstWatchedAt, lastWatchedAt, archivedAt sql.NullTime

	if err := rows.Scan(
		&show.ID, &show.JellyfinID, &show.Title, &show.Overview, &show.PosterURL,
		&genre, &year, &show.Status, &totalEpisodes, &show.WatchedEpisodes,
		&show.TotalWatchTimeMinutes, &firstWatchedAt, &lastWatchedAt, &show.CreatedAt,
		&show.DeletedFromJellyfin, &archivedAt,
	); err != nil {
		return models.Show{}, err
	}
	show.Genre = genre.String
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
	if archivedAt.Valid {
		show.ArchivedAt = &archivedAt.Time
	}
	return show, nil
}

// attachUpNext populates UpNext for each "watching" show with the earliest
// unwatched episode, using a single batched query.
func (s *SQLShowStore) attachUpNext(ctx context.Context, shows []models.Show) error {
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

	rows, err := s.db.QueryContext(ctx, fmt.Sprintf(`
		SELECT e.show_id, e.id, e.season_number, e.episode_number, e.title
		FROM episodes e
		INNER JOIN (
			SELECT show_id, MIN((season_number * 10000) + episode_number) AS ord
			FROM episodes
			WHERE watched = 0 AND show_id IN (%s)
			GROUP BY show_id
		) n ON n.show_id = e.show_id
		   AND ((e.season_number * 10000) + e.episode_number) = n.ord`,
		strings.Join(placeholders, ",")), ids...)
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
		if sh, ok := targetByID[showID]; ok {
			sh.UpNext = &models.UpNext{
				EpisodeID:     epID,
				SeasonNumber:  season,
				EpisodeNumber: episode,
				Title:         title.String,
			}
		}
	}
	return rows.Err()
}

func (s *SQLShowStore) StatusCounts(ctx context.Context, userID int, filter ShowListFilter) (StatusCounts, error) {
	where, args := buildShowWhere(filter, userID, false)

	rows, err := s.db.QueryContext(ctx, `SELECT status, COUNT(*) FROM shows WHERE `+where+` GROUP BY status`, args...)
	if err != nil {
		return StatusCounts{}, errors.Wrap(err, errors.CodeDatabaseError, "Failed to count shows by status")
	}
	defer rows.Close()

	var counts StatusCounts
	for rows.Next() {
		var status sql.NullString
		var n int
		if err := rows.Scan(&status, &n); err != nil {
			return StatusCounts{}, errors.Wrap(err, errors.CodeDatabaseError, "Failed to scan status count")
		}
		switch status.String {
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

func (s *SQLShowStore) GetWithEpisodes(ctx context.Context, id, userID int) (*models.Show, []models.Episode, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT s.id, s.jellyfin_id, s.title, s.overview, s.poster_url, s.genre, s.year, s.status,
		        s.total_episodes, s.watched_episodes, s.total_watch_time_minutes,
		        s.first_watched_at, s.last_watched_at, s.created_at, s.deleted_at,
		        COALESCE(s.deleted_from_jellyfin, 0), s.archived_at,
		        e.id as ep_id, e.jellyfin_id as ep_jellyfin_id, e.title as ep_title,
		        e.episode_number, e.season_number, e.duration_minutes, e.watched, e.watched_at,
		        e.watch_count, e.completion_percentage, e.created_at as ep_created_at
		 FROM shows s
		 LEFT JOIN episodes e ON e.show_id = s.id
		 WHERE s.id = ? AND s.user_id = ?
		 ORDER BY e.season_number, e.episode_number`,
		id, userID)
	if err != nil {
		return nil, nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to get show")
	}
	defer rows.Close()

	var show models.Show
	var episodes []models.Episode
	var genre sql.NullString
	var year, totalEpisodes sql.NullInt64
	var firstWatchedAt, lastWatchedAt, showDeletedAt, showArchivedAt sql.NullTime
	var epID sql.NullInt64
	var epJellyfinID, epTitle sql.NullString
	var epEpisodeNumber, epSeasonNumber, epDurationMinutes, epWatchCount sql.NullInt64
	var epWatched sql.NullBool
	var epWatchedAt, epCreatedAt sql.NullTime
	var epCompletionPercentage sql.NullFloat64

	for rows.Next() {
		if err := rows.Scan(
			&show.ID, &show.JellyfinID, &show.Title, &show.Overview, &show.PosterURL,
			&genre, &year, &show.Status, &totalEpisodes, &show.WatchedEpisodes,
			&show.TotalWatchTimeMinutes, &firstWatchedAt, &lastWatchedAt, &show.CreatedAt,
			&showDeletedAt, &show.DeletedFromJellyfin, &showArchivedAt,
			&epID, &epJellyfinID, &epTitle, &epEpisodeNumber, &epSeasonNumber,
			&epDurationMinutes, &epWatched, &epWatchedAt, &epWatchCount,
			&epCompletionPercentage, &epCreatedAt,
		); err != nil {
			return nil, nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to scan show row")
		}
		show.Genre = genre.String
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
		return nil, nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to get show")
	}
	if show.ID == 0 {
		return nil, nil, nil
	}
	show.RemovedFromLibrary = showDeletedAt.Valid
	if showArchivedAt.Valid {
		show.ArchivedAt = &showArchivedAt.Time
	}
	return &show, episodes, nil
}

func (s *SQLShowStore) SoftDelete(ctx context.Context, id, userID int) (bool, error) {
	now := time.Now()
	var found bool
	err := database.WithTx(ctx, s.db, func(tx *sql.Tx) error {
		res, err := tx.ExecContext(ctx,
			`UPDATE shows SET deleted_at = ?, updated_at = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
			now, now, id, userID)
		if err != nil {
			return errors.Wrap(err, errors.CodeDatabaseError, "Failed to remove show")
		}
		if n, _ := res.RowsAffected(); n == 0 {
			return nil // not found / already archived; found stays false
		}
		found = true
		if _, err := tx.ExecContext(ctx,
			`DELETE FROM watchlist WHERE user_id = ? AND item_type = 'show' AND item_id = ?`,
			userID, id); err != nil {
			return errors.Wrap(err, errors.CodeDatabaseError, "Failed to remove show from watchlist")
		}
		return nil
	})
	if err != nil {
		return false, err
	}
	return found, nil
}

func (s *SQLShowStore) Restore(ctx context.Context, id, userID int) (bool, error) {
	res, err := s.db.ExecContext(ctx,
		`UPDATE shows SET deleted_at = NULL, updated_at = ? WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL`,
		time.Now(), id, userID)
	if err != nil {
		return false, errors.Wrap(err, errors.CodeDatabaseError, "Failed to restore show")
	}
	n, _ := res.RowsAffected()
	return n > 0, nil
}
