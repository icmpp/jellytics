package jellyfin

import "context"

// API defines the Jellyfin API operations used by auth and sync.
// The concrete *Client implements this interface for dependency injection and testing.
type API interface {
	BaseURL() string
	Authenticate(ctx context.Context, username, password string) (*AuthResponse, error)
	GetUserItems(ctx context.Context, accessToken, userID string, itemType string) (*ItemsResponse, error)
	GetUserItemsWithFields(ctx context.Context, accessToken, userID string, itemType string, fields string) (*ItemsResponse, error)
	GetEpisodesForSeries(ctx context.Context, accessToken, seriesID string) (*ItemsResponse, error)
	GetSessions(ctx context.Context, accessToken string) (*SessionsResponse, error)
}

// Ensure *Client implements API.
var _ API = (*Client)(nil)

// ClientProvider returns a Jellyfin client for a given server URL.
// Use PooledClientProvider as the default; inject a mock for tests.
type ClientProvider interface {
	Get(serverURL string) API
}

// PooledClientProvider wraps GetClient for use as an injectable ClientProvider.
type PooledClientProvider struct{}

func (p PooledClientProvider) Get(serverURL string) API {
	return GetClient(serverURL)
}
