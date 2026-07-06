package repository

import (
	"context"
	"database/sql"
	"time"

	"jellytics/backend/internal/errors"
)

// UserStore provides access to per-user settings on the users table. (Auth-flow
// user creation/lookup lives in the auth handler.)
type UserStore interface {
	// ServerURL returns the user's configured Jellyfin server URL. found is false
	// if the user does not exist (or is soft-deleted).
	ServerURL(ctx context.Context, userID int) (url string, found bool, err error)
	// SetServerURL updates the user's Jellyfin server URL.
	SetServerURL(ctx context.Context, userID int, url string) error
	// Preferences returns the user's raw preferences JSON ("" if unset). found is
	// false if the user does not exist.
	Preferences(ctx context.Context, userID int) (prefsJSON string, found bool, err error)
	// SetPreferences stores the user's preferences as a JSON string.
	SetPreferences(ctx context.Context, userID int, prefsJSON string) error
}

// SQLUserStore implements UserStore with SQLite.
type SQLUserStore struct {
	db *sql.DB
}

// NewSQLUserStore returns a new SQL-backed UserStore.
func NewSQLUserStore(db *sql.DB) *SQLUserStore {
	return &SQLUserStore{db: db}
}

func (s *SQLUserStore) ServerURL(ctx context.Context, userID int) (string, bool, error) {
	var url string
	err := s.db.QueryRowContext(ctx,
		"SELECT jellyfin_server_url FROM users WHERE id = ? AND deleted_at IS NULL", userID).Scan(&url)
	if err == sql.ErrNoRows {
		return "", false, nil
	}
	if err != nil {
		return "", false, errors.Wrap(err, errors.CodeDatabaseError, "Failed to get settings")
	}
	return url, true, nil
}

func (s *SQLUserStore) SetServerURL(ctx context.Context, userID int, url string) error {
	if _, err := s.db.ExecContext(ctx,
		"UPDATE users SET jellyfin_server_url = ?, updated_at = ? WHERE id = ?",
		url, time.Now(), userID); err != nil {
		return errors.Wrap(err, errors.CodeDatabaseError, "Failed to update settings")
	}
	return nil
}

func (s *SQLUserStore) Preferences(ctx context.Context, userID int) (string, bool, error) {
	var prefs sql.NullString
	err := s.db.QueryRowContext(ctx,
		"SELECT preferences FROM users WHERE id = ? AND deleted_at IS NULL", userID).Scan(&prefs)
	if err == sql.ErrNoRows {
		return "", false, nil
	}
	if err != nil {
		return "", false, errors.Wrap(err, errors.CodeDatabaseError, "Failed to get preferences")
	}
	return prefs.String, true, nil
}

func (s *SQLUserStore) SetPreferences(ctx context.Context, userID int, prefsJSON string) error {
	if _, err := s.db.ExecContext(ctx,
		"UPDATE users SET preferences = ?, updated_at = ? WHERE id = ?",
		prefsJSON, time.Now(), userID); err != nil {
		return errors.Wrap(err, errors.CodeDatabaseError, "Failed to update preferences")
	}
	return nil
}
