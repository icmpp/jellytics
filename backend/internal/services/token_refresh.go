package services

import (
	"context"
	"database/sql"

	"jellytics/backend/internal/errors"
)

type TokenRefreshService struct {
	db *sql.DB
}

func NewTokenRefreshService(db *sql.DB) *TokenRefreshService {
	return &TokenRefreshService{db: db}
}

func (s *TokenRefreshService) GetValidToken(ctx context.Context, userID int) (string, error) {
	var serverURL, accessToken sql.NullString

	err := s.db.QueryRowContext(ctx,
		`SELECT jellyfin_server_url, jellyfin_access_token
		 FROM users WHERE id = ? AND deleted_at IS NULL`,
		userID).Scan(&serverURL, &accessToken)

	if err != nil {
		return "", errors.Wrap(err, errors.CodeUserNotFound, "User not found")
	}

	if !serverURL.Valid || serverURL.String == "" {
		return "", errors.New(errors.CodeSyncFailed, "Jellyfin server URL is not configured")
	}

	if accessToken.Valid && accessToken.String != "" {
		return accessToken.String, nil
	}

	return "", errors.New(errors.CodeInvalidCredentials, "No valid Jellyfin credentials available. Please log in again or configure an API key.")
}
