package services

import (
	"context"
	"database/sql"
	"time"

	"jellytics/backend/internal/errors"

	"github.com/rs/zerolog/log"
)

type TokenRefreshService struct {
	db *sql.DB
}

func NewTokenRefreshService(db *sql.DB) *TokenRefreshService {
	return &TokenRefreshService{db: db}
}

func (s *TokenRefreshService) GetValidToken(ctx context.Context, userID int) (string, error) {
	var serverURL, accessToken sql.NullString
	var tokenValid int

	err := s.db.QueryRowContext(ctx,
		`SELECT jellyfin_server_url, jellyfin_access_token, COALESCE(jellyfin_token_valid, 1)
		 FROM users WHERE id = ? AND deleted_at IS NULL`,
		userID).Scan(&serverURL, &accessToken, &tokenValid)

	if err != nil {
		return "", errors.Wrap(err, errors.CodeUserNotFound, "User not found")
	}

	if !serverURL.Valid || serverURL.String == "" {
		return "", errors.New(errors.CodeSyncFailed, "Jellyfin server URL is not configured")
	}

	if tokenValid == 0 {
		return "", errors.New(errors.CodeInvalidCredentials, "Jellyfin token is invalid. Please log in again to refresh your credentials.")
	}

	if accessToken.Valid && accessToken.String != "" {
		return accessToken.String, nil
	}

	return "", errors.New(errors.CodeInvalidCredentials, "No valid Jellyfin credentials available. Please log in again or configure an API key.")
}

// InvalidateToken marks the user's Jellyfin token as invalid so the sync stops
// making requests to Jellyfin until the user logs in again and gets a fresh token.
func (s *TokenRefreshService) InvalidateToken(ctx context.Context, userID int) error {
	_, err := s.db.ExecContext(ctx,
		"UPDATE users SET jellyfin_token_valid = 0, updated_at = ? WHERE id = ?",
		time.Now(), userID)
	if err != nil {
		return errors.Wrap(err, errors.CodeDatabaseError, "Failed to invalidate token")
	}
	log.Warn().Int("user_id", userID).Msg("Jellyfin token marked as invalid - user must log in again to resume sync")
	return nil
}
