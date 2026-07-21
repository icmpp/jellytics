package repository

import (
	"context"
	"database/sql"
	"time"

	"jellytics/backend/internal/errors"
)

// RatedGenre is a user's rating paired with the rated item's raw genre JSON.
type RatedGenre struct {
	GenreJSON string
	Rating    int
}

// RecCandidate is an unwatched, non-archived library item considered for
// recommendation, with its raw genre JSON and whether it sits on the watchlist.
type RecCandidate struct {
	ID          int
	Type        string // "movie" | "show"
	Title       string
	JellyfinID  string
	GenreJSON   string
	OnWatchlist bool
	CreatedAt   time.Time
}

// RecommendationStore supplies the raw signals the recommendation scorer needs.
// Genre parsing and scoring happen in the service layer (in Go), not in SQL.
type RecommendationStore interface {
	// RatedGenres returns the genre JSON of every movie/show the user has rated
	// (rating + genres), for building a genre-affinity profile.
	RatedGenres(ctx context.Context, userID int) ([]RatedGenre, error)
	// WatchedGenres returns the genre JSON of every movie/show the user has
	// watched (a weaker positive affinity signal than ratings).
	WatchedGenres(ctx context.Context, userID int) ([]string, error)
	// Candidates returns unwatched, non-archived movies and shows the user could
	// be recommended, each flagged with whether it is on the watchlist.
	Candidates(ctx context.Context, userID int) ([]RecCandidate, error)
}

// SQLRecommendationStore implements RecommendationStore with SQLite.
type SQLRecommendationStore struct {
	db *sql.DB
}

// NewSQLRecommendationStore returns a new SQL-backed RecommendationStore.
func NewSQLRecommendationStore(db *sql.DB) *SQLRecommendationStore {
	return &SQLRecommendationStore{db: db}
}

func (s *SQLRecommendationStore) RatedGenres(ctx context.Context, userID int) ([]RatedGenre, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT r.rating, m.genre
		FROM ratings r JOIN movies m ON r.item_type = 'movie' AND r.item_id = m.id AND m.user_id = ?
		WHERE r.user_id = ? AND m.deleted_at IS NULL AND m.duplicate_of IS NULL
		UNION ALL
		SELECT r.rating, s.genre
		FROM ratings r JOIN shows s ON r.item_type = 'show' AND r.item_id = s.id AND s.user_id = ?
		WHERE r.user_id = ? AND s.deleted_at IS NULL AND s.duplicate_of IS NULL`,
		userID, userID, userID, userID)
	if err != nil {
		return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to load rated genres")
	}
	defer rows.Close()

	var out []RatedGenre
	for rows.Next() {
		var rg RatedGenre
		var genre sql.NullString
		if err := rows.Scan(&rg.Rating, &genre); err != nil {
			return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to scan rated genre")
		}
		rg.GenreJSON = genre.String
		out = append(out, rg)
	}
	return out, rows.Err()
}

func (s *SQLRecommendationStore) WatchedGenres(ctx context.Context, userID int) ([]string, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT genre FROM movies WHERE user_id = ? AND deleted_at IS NULL AND duplicate_of IS NULL
		  AND (status = 'watched' OR first_watched_at IS NOT NULL)
		UNION ALL
		SELECT genre FROM shows WHERE user_id = ? AND deleted_at IS NULL AND duplicate_of IS NULL
		  AND (status = 'watched' OR first_watched_at IS NOT NULL)`,
		userID, userID)
	if err != nil {
		return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to load watched genres")
	}
	defer rows.Close()

	var out []string
	for rows.Next() {
		var genre sql.NullString
		if err := rows.Scan(&genre); err != nil {
			return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to scan watched genre")
		}
		out = append(out, genre.String)
	}
	return out, rows.Err()
}

func (s *SQLRecommendationStore) Candidates(ctx context.Context, userID int) ([]RecCandidate, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT 'movie', m.id, m.title, m.jellyfin_id, m.genre, m.created_at,
		       (w.id IS NOT NULL) AS on_watchlist
		FROM movies m
		LEFT JOIN watchlist w ON w.item_type = 'movie' AND w.item_id = m.id AND w.user_id = ?
		WHERE m.user_id = ? AND m.deleted_at IS NULL AND m.duplicate_of IS NULL
		  AND (m.status = 'pending' OR m.first_watched_at IS NULL)
		UNION ALL
		SELECT 'show', s.id, s.title, s.jellyfin_id, s.genre, s.created_at,
		       (w.id IS NOT NULL) AS on_watchlist
		FROM shows s
		LEFT JOIN watchlist w ON w.item_type = 'show' AND w.item_id = s.id AND w.user_id = ?
		WHERE s.user_id = ? AND s.deleted_at IS NULL AND s.duplicate_of IS NULL
		  AND (s.status = 'pending' OR s.first_watched_at IS NULL)`,
		userID, userID, userID, userID)
	if err != nil {
		return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to load recommendation candidates")
	}
	defer rows.Close()

	var out []RecCandidate
	for rows.Next() {
		var c RecCandidate
		var genre sql.NullString
		var createdAt sql.NullTime
		if err := rows.Scan(&c.Type, &c.ID, &c.Title, &c.JellyfinID, &genre, &createdAt, &c.OnWatchlist); err != nil {
			return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to scan candidate")
		}
		c.GenreJSON = genre.String
		if createdAt.Valid {
			c.CreatedAt = createdAt.Time
		}
		out = append(out, c)
	}
	return out, rows.Err()
}
