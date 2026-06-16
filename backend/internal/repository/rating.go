package repository

import (
	"context"
	"database/sql"

	"jellytics/backend/internal/database"
	"jellytics/backend/internal/errors"
	"jellytics/backend/internal/models"
)

// RatingStore defines data access for user item ratings.
type RatingStore interface {
	// Get returns the user's rating for an item, or nil if none exists.
	Get(ctx context.Context, userID int, itemType string, itemID int) (*models.Rating, error)
	// List returns all of the user's ratings, most recently rated first.
	List(ctx context.Context, userID int) ([]models.Rating, error)
	// Upsert sets the rating for an item, returning the stored row and whether
	// it was newly created (vs. updated). Atomic.
	Upsert(ctx context.Context, userID int, itemType string, itemID, rating int) (models.Rating, bool, error)
	// Delete removes the user's rating for an item, returning whether a row existed.
	Delete(ctx context.Context, userID int, itemType string, itemID int) (bool, error)
}

// SQLRatingStore implements RatingStore with SQLite.
type SQLRatingStore struct {
	db *sql.DB
}

// NewSQLRatingStore returns a new SQL-backed RatingStore.
func NewSQLRatingStore(db *sql.DB) *SQLRatingStore {
	return &SQLRatingStore{db: db}
}

const ratingColumns = `id, user_id, item_type, item_id, rating, rated_at, created_at, updated_at`

func scanRating(s interface{ Scan(...any) error }, r *models.Rating) error {
	return s.Scan(&r.ID, &r.UserID, &r.ItemType, &r.ItemID, &r.Rating, &r.RatedAt, &r.CreatedAt, &r.UpdatedAt)
}

func (s *SQLRatingStore) Get(ctx context.Context, userID int, itemType string, itemID int) (*models.Rating, error) {
	var r models.Rating
	err := scanRating(s.db.QueryRowContext(ctx,
		`SELECT `+ratingColumns+` FROM ratings WHERE user_id = ? AND item_type = ? AND item_id = ?`,
		userID, itemType, itemID), &r)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to get rating")
	}
	return &r, nil
}

func (s *SQLRatingStore) List(ctx context.Context, userID int) ([]models.Rating, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT `+ratingColumns+` FROM ratings WHERE user_id = ? ORDER BY rated_at DESC`, userID)
	if err != nil {
		return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to list ratings")
	}
	defer rows.Close()

	ratings := []models.Rating{}
	for rows.Next() {
		var r models.Rating
		if err := scanRating(rows, &r); err != nil {
			return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to scan rating row")
		}
		ratings = append(ratings, r)
	}
	if err := rows.Err(); err != nil {
		return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to iterate ratings")
	}
	return ratings, nil
}

func (s *SQLRatingStore) Upsert(ctx context.Context, userID int, itemType string, itemID, rating int) (models.Rating, bool, error) {
	var out models.Rating
	var created bool
	err := database.WithTx(ctx, s.db, func(tx *sql.Tx) error {
		res, err := tx.ExecContext(ctx,
			`UPDATE ratings SET rating = ?, rated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
			 WHERE user_id = ? AND item_type = ? AND item_id = ?`,
			rating, userID, itemType, itemID)
		if err != nil {
			return errors.Wrap(err, errors.CodeDatabaseError, "Failed to update rating")
		}
		if n, _ := res.RowsAffected(); n == 0 {
			if _, err := tx.ExecContext(ctx,
				`INSERT INTO ratings (user_id, item_type, item_id, rating, rated_at, created_at, updated_at)
				 VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
				userID, itemType, itemID, rating); err != nil {
				return errors.Wrap(err, errors.CodeDatabaseError, "Failed to save rating")
			}
			created = true
		}
		return scanRating(tx.QueryRowContext(ctx,
			`SELECT `+ratingColumns+` FROM ratings WHERE user_id = ? AND item_type = ? AND item_id = ?`,
			userID, itemType, itemID), &out)
	})
	if err != nil {
		return models.Rating{}, false, err
	}
	return out, created, nil
}

func (s *SQLRatingStore) Delete(ctx context.Context, userID int, itemType string, itemID int) (bool, error) {
	res, err := s.db.ExecContext(ctx,
		`DELETE FROM ratings WHERE user_id = ? AND item_type = ? AND item_id = ?`,
		userID, itemType, itemID)
	if err != nil {
		return false, errors.Wrap(err, errors.CodeDatabaseError, "Failed to delete rating")
	}
	n, _ := res.RowsAffected()
	return n > 0, nil
}
