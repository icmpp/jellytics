package repository

import (
	"context"
	"database/sql"

	"jellytics/backend/internal/database"
	"jellytics/backend/internal/errors"
	"jellytics/backend/internal/models"
)

// WatchlistStore defines data access for the user watchlist.
type WatchlistStore interface {
	// List returns the user's watchlist, newest first. itemType ("show"/"movie")
	// is an optional filter; pass "" for all.
	List(ctx context.Context, userID int, itemType string, limit, offset int) ([]models.WatchlistItem, error)
	// Add inserts (or refreshes the cached metadata of) a watchlist entry for an
	// item that belongs to the user. Returns the stored row and whether it was
	// newly created. Returns CodeNotFound if the media item does not exist.
	Add(ctx context.Context, userID int, itemType string, itemID int) (models.WatchlistItem, bool, error)
	// Remove deletes a watchlist entry by id, scoped to the user. Returns whether
	// a row was removed.
	Remove(ctx context.Context, userID, id int) (bool, error)
}

// SQLWatchlistStore implements WatchlistStore with SQLite.
type SQLWatchlistStore struct {
	db *sql.DB
}

// NewSQLWatchlistStore returns a new SQL-backed WatchlistStore.
func NewSQLWatchlistStore(db *sql.DB) *SQLWatchlistStore {
	return &SQLWatchlistStore{db: db}
}

func (s *SQLWatchlistStore) List(ctx context.Context, userID int, itemType string, limit, offset int) ([]models.WatchlistItem, error) {
	query := `
		SELECT w.id, w.user_id, w.item_type, w.item_id, w.title, w.poster_url, w.added_at, w.created_at, w.updated_at,
			CASE
				WHEN w.item_type = 'show'  THEN (SELECT jellyfin_id FROM shows  WHERE id = w.item_id)
				WHEN w.item_type = 'movie' THEN (SELECT jellyfin_id FROM movies WHERE id = w.item_id)
			END as jellyfin_id
		FROM watchlist w
		WHERE w.user_id = ?`
	args := []interface{}{userID}
	if itemType != "" {
		query += " AND w.item_type = ?"
		args = append(args, itemType)
	}
	query += " ORDER BY w.added_at DESC LIMIT ? OFFSET ?"
	args = append(args, limit, offset)

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to query watchlist")
	}
	defer rows.Close()

	items := []models.WatchlistItem{}
	for rows.Next() {
		var item models.WatchlistItem
		var posterURL, jellyfinID sql.NullString
		if err := rows.Scan(
			&item.ID, &item.UserID, &item.ItemType, &item.ItemID, &item.Title,
			&posterURL, &item.AddedAt, &item.CreatedAt, &item.UpdatedAt, &jellyfinID,
		); err != nil {
			return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to scan watchlist row")
		}
		item.PosterURL = posterURL.String
		item.JellyfinID = jellyfinID.String
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to iterate watchlist")
	}
	return items, nil
}

func (s *SQLWatchlistStore) Add(ctx context.Context, userID int, itemType string, itemID int) (models.WatchlistItem, bool, error) {
	// Resolve the item's cached metadata (and confirm it belongs to the user and
	// is not archived).
	mediaTable := "movies"
	if itemType == "show" {
		mediaTable = "shows"
	}
	var title, jellyfinID string
	var posterURL sql.NullString
	err := s.db.QueryRowContext(ctx,
		`SELECT title, poster_url, jellyfin_id FROM `+mediaTable+`
		 WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
		itemID, userID).Scan(&title, &posterURL, &jellyfinID)
	if err == sql.ErrNoRows {
		return models.WatchlistItem{}, false, errors.New(errors.CodeNotFound, "Item not found")
	}
	if err != nil {
		return models.WatchlistItem{}, false, errors.Wrap(err, errors.CodeDatabaseError, "Failed to verify item")
	}

	var item models.WatchlistItem
	var posterResult sql.NullString
	var created bool
	err = database.WithTx(ctx, s.db, func(tx *sql.Tx) error {
		res, err := tx.ExecContext(ctx,
			`UPDATE watchlist SET title = ?, poster_url = ?, updated_at = CURRENT_TIMESTAMP
			 WHERE user_id = ? AND item_type = ? AND item_id = ?`,
			title, posterURL.String, userID, itemType, itemID)
		if err != nil {
			return errors.Wrap(err, errors.CodeDatabaseError, "Failed to update watchlist")
		}
		if n, _ := res.RowsAffected(); n == 0 {
			if _, err := tx.ExecContext(ctx,
				`INSERT INTO watchlist (user_id, item_type, item_id, title, poster_url, added_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
				userID, itemType, itemID, title, posterURL.String); err != nil {
				return errors.Wrap(err, errors.CodeDatabaseError, "Failed to add to watchlist")
			}
			created = true
		}
		return tx.QueryRowContext(ctx,
			`SELECT id, user_id, item_type, item_id, title, poster_url, added_at, created_at, updated_at
			 FROM watchlist WHERE user_id = ? AND item_type = ? AND item_id = ?`,
			userID, itemType, itemID).Scan(
			&item.ID, &item.UserID, &item.ItemType, &item.ItemID, &item.Title,
			&posterResult, &item.AddedAt, &item.CreatedAt, &item.UpdatedAt)
	})
	if err != nil {
		return models.WatchlistItem{}, false, err
	}

	item.PosterURL = posterResult.String
	item.JellyfinID = jellyfinID
	return item, created, nil
}

func (s *SQLWatchlistStore) Remove(ctx context.Context, userID, id int) (bool, error) {
	res, err := s.db.ExecContext(ctx,
		`DELETE FROM watchlist WHERE id = ? AND user_id = ?`, id, userID)
	if err != nil {
		return false, errors.Wrap(err, errors.CodeDatabaseError, "Failed to remove from watchlist")
	}
	n, _ := res.RowsAffected()
	return n > 0, nil
}
