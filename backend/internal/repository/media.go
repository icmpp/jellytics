package repository

import (
	"context"
	"database/sql"

	"jellytics/backend/internal/errors"
)

// MediaStore checks existence of movies/shows for a user.
type MediaStore interface {
	Exists(ctx context.Context, itemType string, itemID, userID int) (bool, error)
}

// SQLMediaStore implements MediaStore with SQLite.
type SQLMediaStore struct {
	db *sql.DB
}

// NewSQLMediaStore returns a new SQL-backed MediaStore.
func NewSQLMediaStore(db *sql.DB) *SQLMediaStore {
	return &SQLMediaStore{db: db}
}

// Exists returns true if the item exists and belongs to the user.
// Includes soft-deleted (archived) items so ratings and reviews remain accessible
// when viewing archived movie/show detail pages.
func (s *SQLMediaStore) Exists(ctx context.Context, itemType string, itemID, userID int) (bool, error) {
	var query string
	if itemType == "show" {
		query = `SELECT EXISTS(SELECT 1 FROM shows WHERE id = ? AND user_id = ?)`
	} else {
		query = `SELECT EXISTS(SELECT 1 FROM movies WHERE id = ? AND user_id = ?)`
	}
	var exists bool
	err := s.db.QueryRowContext(ctx, query, itemID, userID).Scan(&exists)
	if err != nil {
		return false, errors.Wrap(err, errors.CodeDatabaseError, "Failed to verify item")
	}
	return exists, nil
}
