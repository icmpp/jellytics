package repository

import (
	"context"
	"database/sql"

	"jellytics/backend/internal/database"
	"jellytics/backend/internal/errors"
	"jellytics/backend/internal/models"
)

// ReviewStore defines data access for user item reviews.
type ReviewStore interface {
	// Get returns the user's review for an item, or nil if none exists.
	Get(ctx context.Context, userID int, itemType string, itemID int) (*models.Review, error)
	// List returns all of the user's reviews, most recently updated first.
	List(ctx context.Context, userID int) ([]models.Review, error)
	// Upsert sets the review for an item, returning the stored row and whether it
	// was newly created (vs. updated). Atomic.
	Upsert(ctx context.Context, userID int, itemType string, itemID int, reviewText, notes string) (models.Review, bool, error)
	// Delete removes the user's review for an item, returning whether a row existed.
	Delete(ctx context.Context, userID int, itemType string, itemID int) (bool, error)
}

// SQLReviewStore implements ReviewStore with SQLite.
type SQLReviewStore struct {
	db *sql.DB
}

// NewSQLReviewStore returns a new SQL-backed ReviewStore.
func NewSQLReviewStore(db *sql.DB) *SQLReviewStore {
	return &SQLReviewStore{db: db}
}

const reviewColumns = `id, user_id, item_type, item_id, review_text, notes, created_at, updated_at`

func scanReview(s interface{ Scan(...any) error }, r *models.Review) error {
	return s.Scan(&r.ID, &r.UserID, &r.ItemType, &r.ItemID, &r.ReviewText, &r.Notes, &r.CreatedAt, &r.UpdatedAt)
}

func (s *SQLReviewStore) Get(ctx context.Context, userID int, itemType string, itemID int) (*models.Review, error) {
	var r models.Review
	err := scanReview(s.db.QueryRowContext(ctx,
		`SELECT `+reviewColumns+` FROM reviews WHERE user_id = ? AND item_type = ? AND item_id = ?`,
		userID, itemType, itemID), &r)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to get review")
	}
	return &r, nil
}

func (s *SQLReviewStore) List(ctx context.Context, userID int) ([]models.Review, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT `+reviewColumns+` FROM reviews WHERE user_id = ? ORDER BY updated_at DESC`, userID)
	if err != nil {
		return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to list reviews")
	}
	defer rows.Close()

	reviews := []models.Review{}
	for rows.Next() {
		var r models.Review
		if err := scanReview(rows, &r); err != nil {
			return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to scan review row")
		}
		reviews = append(reviews, r)
	}
	if err := rows.Err(); err != nil {
		return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to iterate reviews")
	}
	return reviews, nil
}

func (s *SQLReviewStore) Upsert(ctx context.Context, userID int, itemType string, itemID int, reviewText, notes string) (models.Review, bool, error) {
	var out models.Review
	var created bool
	err := database.WithTx(ctx, s.db, func(tx *sql.Tx) error {
		res, err := tx.ExecContext(ctx,
			`UPDATE reviews SET review_text = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
			 WHERE user_id = ? AND item_type = ? AND item_id = ?`,
			reviewText, notes, userID, itemType, itemID)
		if err != nil {
			return errors.Wrap(err, errors.CodeDatabaseError, "Failed to update review")
		}
		if n, _ := res.RowsAffected(); n == 0 {
			if _, err := tx.ExecContext(ctx,
				`INSERT INTO reviews (user_id, item_type, item_id, review_text, notes, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
				userID, itemType, itemID, reviewText, notes); err != nil {
				return errors.Wrap(err, errors.CodeDatabaseError, "Failed to save review")
			}
			created = true
		}
		return scanReview(tx.QueryRowContext(ctx,
			`SELECT `+reviewColumns+` FROM reviews WHERE user_id = ? AND item_type = ? AND item_id = ?`,
			userID, itemType, itemID), &out)
	})
	if err != nil {
		return models.Review{}, false, err
	}
	return out, created, nil
}

func (s *SQLReviewStore) Delete(ctx context.Context, userID int, itemType string, itemID int) (bool, error) {
	res, err := s.db.ExecContext(ctx,
		`DELETE FROM reviews WHERE user_id = ? AND item_type = ? AND item_id = ?`,
		userID, itemType, itemID)
	if err != nil {
		return false, errors.Wrap(err, errors.CodeDatabaseError, "Failed to delete review")
	}
	n, _ := res.RowsAffected()
	return n > 0, nil
}
