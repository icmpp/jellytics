// Package jellyfin provides the HTTP client for the Jellyfin API, including auth, rate limiting, and circuit breaking.
package jellyfin

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"jellytics/backend/internal/errors"

	"github.com/hashicorp/go-retryablehttp"
	"github.com/rs/zerolog/log"
)

func envInt(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			return n
		}
	}
	return def
}

// clientPool caches Jellyfin clients per server URL so rate limiting is shared across sync, sessions, and handlers.
var clientPool struct {
	mu      sync.RWMutex
	clients map[string]*Client
}

const authHeaderValue = `MediaBrowser Client="Jellytics", Device="Server", DeviceId="jellytics-server", Version="1.0.0"`

type ErrorType int

const (
	ErrorTypeUnknown     ErrorType = iota
	ErrorTypeNetwork               // Network connectivity issues
	ErrorTypeTimeout               // Request timeout
	ErrorTypeAuth                  // Authentication/authorization errors
	ErrorTypeRateLimit             // Rate limiting from Jellyfin
	ErrorTypeServerError           // Server-side errors (5xx)
	ErrorTypeClientError           // Client-side errors (4xx)
	ErrorTypeValidation            // Data validation errors
)

func (e ErrorType) String() string {
	switch e {
	case ErrorTypeNetwork:
		return "network"
	case ErrorTypeTimeout:
		return "timeout"
	case ErrorTypeAuth:
		return "authentication"
	case ErrorTypeRateLimit:
		return "rate_limit"
	case ErrorTypeServerError:
		return "server_error"
	case ErrorTypeClientError:
		return "client_error"
	case ErrorTypeValidation:
		return "validation"
	default:
		return "unknown"
	}
}

func (e ErrorType) IsRetryable() bool {
	switch e {
	case ErrorTypeNetwork, ErrorTypeTimeout, ErrorTypeServerError, ErrorTypeRateLimit:
		return true
	default:
		return false
	}
}

type ClientError struct {
	Type       ErrorType
	Message    string
	StatusCode int
	Err        error
}

func (e *ClientError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("%s: %s (caused by: %v)", e.Type.String(), e.Message, e.Err)
	}
	return fmt.Sprintf("%s: %s", e.Type.String(), e.Message)
}

func (e *ClientError) Unwrap() error {
	return e.Err
}

type Client struct {
	baseURL        string
	httpClient     *retryablehttp.Client
	rateLimiter    *RateLimiter
	circuitBreaker *CircuitBreaker
}

type AuthResponse struct {
	User struct {
		Id   string `json:"Id"`
		Name string `json:"Name"`
	} `json:"User"`
	AccessToken string `json:"AccessToken"`
}

type Item struct {
	Id                string `json:"Id"`
	Name              string `json:"Name"`
	Overview          string `json:"Overview"`
	Type              string `json:"Type"`
	SeriesId          string `json:"SeriesId,omitempty"`
	SeasonId          string `json:"SeasonId,omitempty"`
	IndexNumber       int    `json:"IndexNumber,omitempty"`
	ParentIndexNumber int    `json:"ParentIndexNumber,omitempty"`
	RunTimeTicks      int64  `json:"RunTimeTicks,omitempty"`
	UserData          struct {
		Played           bool      `json:"Played"`
		PlayedPercentage float64   `json:"PlayedPercentage"`
		LastPlayedDate   time.Time `json:"LastPlayedDate"`
	} `json:"UserData"`
	ImageTags struct {
		Primary string `json:"Primary"`
	} `json:"ImageTags"`
	Genres         []string `json:"Genres"`
	ProductionYear int      `json:"ProductionYear,omitempty"`
	ProviderIds    struct {
		Imdb string `json:"Imdb,omitempty"`
		Tmdb string `json:"Tmdb,omitempty"`
	} `json:"ProviderIds"`
}

type ItemsResponse struct {
	Items            []Item `json:"Items"`
	TotalRecordCount int    `json:"TotalRecordCount"`
}

type ClientConfig struct {
	RetryMax       int
	Timeout        time.Duration
	RateLimit      int // Requests per minute
	RateLimitBurst int
	CircuitBreaker CircuitBreakerConfig
}

func DefaultClientConfig() ClientConfig {
	return ClientConfig{
		RetryMax:       envInt("JELLYTICS_JELLYFIN_RETRY_MAX", 5),
		Timeout:        30 * time.Second,
		RateLimit:      envInt("JELLYTICS_JELLYFIN_RATE_LIMIT", 12),
		RateLimitBurst: envInt("JELLYTICS_JELLYFIN_RATE_BURST", 3),
		CircuitBreaker: DefaultCircuitBreakerConfig(),
	}
}

func NewClient(baseURL string) *Client {
	return NewClientWithConfig(baseURL, DefaultClientConfig())
}

func GetClient(baseURL string) *Client {
	baseURL = strings.TrimSuffix(baseURL, "/")
	clientPool.mu.RLock()
	if c, ok := clientPool.clients[baseURL]; ok {
		clientPool.mu.RUnlock()
		return c
	}
	clientPool.mu.RUnlock()
	clientPool.mu.Lock()
	defer clientPool.mu.Unlock()
	if clientPool.clients == nil {
		clientPool.clients = make(map[string]*Client)
	}
	if c, ok := clientPool.clients[baseURL]; ok {
		return c
	}
	c := NewClient(baseURL)
	clientPool.clients[baseURL] = c
	return c
}

func NewClientWithConfig(baseURL string, config ClientConfig) *Client {
	baseURL = strings.TrimSuffix(baseURL, "/")
	retryClient := retryablehttp.NewClient()
	retryClient.RetryMax = config.RetryMax
	retryClient.HTTPClient.Timeout = config.Timeout
	retryClient.Logger = nil // Disable default logging, we use zerolog

	retryClient.CheckRetry = func(ctx context.Context, resp *http.Response, err error) (bool, error) {
		if resp != nil && resp.StatusCode == 429 {
			return true, nil
		}
		return retryablehttp.DefaultRetryPolicy(ctx, resp, err)
	}
	retryClient.Backoff = func(min, max time.Duration, attemptNum int, resp *http.Response) time.Duration {
		if resp != nil && resp.StatusCode == 429 {
			if after := strings.TrimSpace(resp.Header.Get("Retry-After")); after != "" {
				if sec, err := strconv.Atoi(after); err == nil && sec > 0 {
					d := time.Duration(sec) * time.Second
					if d > max {
						return max
					}
					return d
				}
				if t, err := http.ParseTime(after); err == nil {
					d := time.Until(t)
					if d > 0 && d < 5*time.Minute {
						return d
					}
				}
			}
			backoff := time.Duration(1<<uint(attemptNum)) * time.Second
			if backoff > max {
				return max
			}
			return backoff
		}
		return retryablehttp.DefaultBackoff(min, max, attemptNum, resp)
	}

	log.Debug().Str("base_url", baseURL).Msg("Jellyfin client created")

	return &Client{
		baseURL:        baseURL,
		httpClient:     retryClient,
		rateLimiter:    NewRateLimiter(config.RateLimit, config.RateLimitBurst),
		circuitBreaker: NewCircuitBreaker(config.CircuitBreaker),
	}
}

func (c *Client) BaseURL() string {
	return c.baseURL
}

func (c *Client) CircuitBreaker() *CircuitBreaker {
	return c.circuitBreaker
}

func categorizeError(err error, statusCode int) ErrorType {
	if err != nil {
		errStr := strings.ToLower(err.Error())
		if strings.Contains(errStr, "timeout") || strings.Contains(errStr, "deadline exceeded") {
			return ErrorTypeTimeout
		}
		if strings.Contains(errStr, "connection refused") ||
			strings.Contains(errStr, "no such host") ||
			strings.Contains(errStr, "network is unreachable") ||
			strings.Contains(errStr, "dial tcp") {
			return ErrorTypeNetwork
		}
	}

	switch {
	case statusCode == 401 || statusCode == 403:
		return ErrorTypeAuth
	case statusCode == 429:
		return ErrorTypeRateLimit
	case statusCode >= 500:
		return ErrorTypeServerError
	case statusCode >= 400:
		return ErrorTypeClientError
	}

	return ErrorTypeUnknown
}

func newClientError(errType ErrorType, message string, statusCode int, cause error) *ClientError {
	return &ClientError{
		Type:       errType,
		Message:    message,
		StatusCode: statusCode,
		Err:        cause,
	}
}

// validateServerURL checks that serverURL is a well-formed http/https URL.
// This prevents SSRF via non-HTTP schemes (e.g. file://, ftp://).
func validateServerURL(serverURL string) error {
	u, err := url.Parse(serverURL)
	if err != nil {
		return errors.Wrap(err, errors.CodeValidationError, "Invalid server URL")
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return errors.New(errors.CodeValidationError, "Server URL must use http or https scheme")
	}
	if u.Host == "" {
		return errors.New(errors.CodeValidationError, "Server URL must include a host")
	}
	return nil
}

func ValidateURL(ctx context.Context, serverURL string) error {
	serverURL = strings.TrimSuffix(serverURL, "/")
	if err := validateServerURL(serverURL); err != nil {
		return err
	}
	testURL := fmt.Sprintf("%s/System/Info/Public", serverURL)

	client := &http.Client{
		Timeout: 5 * time.Second,
	}

	req, err := http.NewRequestWithContext(ctx, "GET", testURL, nil)
	if err != nil {
		return errors.Wrap(err, errors.CodeValidationError, "Invalid server URL")
	}

	req.Header.Set("X-Emby-Authorization", authHeaderValue)

	resp, err := client.Do(req)
	if err != nil {
		return errors.New(errors.CodeValidationError, fmt.Sprintf("Cannot reach Jellyfin server at %s. Please check the URL and ensure the server is accessible.", serverURL))
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return errors.New(errors.CodeValidationError, fmt.Sprintf("Jellyfin server returned status %d. Please verify the server URL.", resp.StatusCode))
	}

	return nil
}

type SystemInfoPublic struct {
	Id         string `json:"Id"`
	ServerName string `json:"ServerName"`
	Version    string `json:"Version"`
}

func GetServerID(ctx context.Context, serverURL string) (string, error) {
	serverURL = strings.TrimSuffix(serverURL, "/")
	if err := validateServerURL(serverURL); err != nil {
		return "", err
	}
	url := fmt.Sprintf("%s/System/Info/Public", serverURL)

	client := &http.Client{Timeout: 5 * time.Second}
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return "", errors.Wrap(err, errors.CodeValidationError, "Invalid server URL")
	}
	req.Header.Set("X-Emby-Authorization", authHeaderValue)

	resp, err := client.Do(req)
	if err != nil {
		return "", errors.Wrap(err, errors.CodeExternalAPIError, "Cannot reach Jellyfin server")
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", errors.New(errors.CodeValidationError, fmt.Sprintf("Jellyfin server returned status %d", resp.StatusCode))
	}

	var info SystemInfoPublic
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return "", errors.Wrap(err, errors.CodeInternalError, "Failed to parse Jellyfin response")
	}
	if info.Id == "" {
		return "", errors.New(errors.CodeValidationError, "Jellyfin server did not return a server ID")
	}
	return info.Id, nil
}

func TestConnection(ctx context.Context, serverURL, username, password string) error {
	serverURL = strings.TrimSuffix(serverURL, "/")
	client := NewClient(serverURL)
	_, err := client.Authenticate(ctx, username, password)
	if err != nil {
		return errors.Wrap(err, errors.CodeInvalidCredentials, "Failed to authenticate with Jellyfin server")
	}
	return nil
}

func (c *Client) Authenticate(ctx context.Context, username, password string) (*AuthResponse, error) {
	url := fmt.Sprintf("%s/Users/authenticatebyname", c.baseURL)

	log.Info().
		Str("url", url).
		Str("username", username).
		Msg("Authenticating with Jellyfin server")

	body := map[string]string{
		"Username": username,
		"Pw":       password,
	}

	jsonBody, err := json.Marshal(body)
	if err != nil {
		log.Error().Err(err).Msg("Failed to marshal authentication request")
		return nil, errors.Wrap(err, errors.CodeInternalError, "Failed to marshal request")
	}

	req, err := retryablehttp.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonBody))
	if err != nil {
		log.Error().Err(err).Msg("Failed to create authentication request")
		return nil, errors.Wrap(err, errors.CodeInternalError, "Failed to create request")
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Emby-Authorization", authHeaderValue)

	startTime := time.Now()
	resp, err := c.httpClient.Do(req)
	duration := time.Since(startTime)
	if err != nil {
		log.Error().
			Err(err).
			Str("url", url).
			Dur("duration", duration).
			Msg("Failed to connect to Jellyfin server for authentication")
		return nil, errors.Wrap(err, errors.CodeExternalAPIError, "Failed to authenticate with Jellyfin")
	}
	defer resp.Body.Close()

	log.Info().
		Int("status_code", resp.StatusCode).
		Dur("duration", duration).
		Str("url", url).
		Msg("Received authentication response")

	if resp.StatusCode != http.StatusOK {
		bodyBytes, readErr := io.ReadAll(resp.Body)
		if readErr != nil {
			log.Warn().Err(readErr).Msg("Failed to read error response body")
		}
		log.Error().
			Int("status", resp.StatusCode).
			Bytes("body", bodyBytes).
			Str("url", url).
			Msg("Jellyfin authentication failed")
		return nil, errors.New(errors.CodeInvalidCredentials, "Invalid credentials")
	}

	var authResp AuthResponse
	if err := json.NewDecoder(resp.Body).Decode(&authResp); err != nil {
		log.Error().Err(err).Msg("Failed to decode authentication response")
		return nil, errors.Wrap(err, errors.CodeInternalError, "Failed to decode response")
	}

	log.Info().
		Str("user_id", authResp.User.Id).
		Str("username", authResp.User.Name).
		Bool("has_token", authResp.AccessToken != "").
		Msg("Successfully authenticated with Jellyfin")

	return &authResp, nil
}

const defaultItemFields = "Overview,Genres,ProviderIds,ImageTags,UserData"

const LightItemFields = "UserData"

const itemsPageSize = 100

func (c *Client) GetUserItems(ctx context.Context, accessToken, userID string, itemType string) (*ItemsResponse, error) {
	return c.GetUserItemsWithFieldsAll(ctx, accessToken, userID, itemType, defaultItemFields)
}

func (c *Client) GetUserItemsWithFieldsAll(ctx context.Context, accessToken, userID string, itemType string, fields string) (*ItemsResponse, error) {
	var allItems []Item
	startIndex := 0
	for {
		resp, err := c.getUserItemsPage(ctx, accessToken, userID, itemType, fields, startIndex, itemsPageSize)
		if err != nil {
			return nil, err
		}
		allItems = append(allItems, resp.Items...)
		if len(resp.Items) < itemsPageSize || len(allItems) >= resp.TotalRecordCount {
			break
		}
		startIndex += len(resp.Items)
	}
	return &ItemsResponse{Items: allItems, TotalRecordCount: len(allItems)}, nil
}

func (c *Client) getUserItemsPage(ctx context.Context, accessToken, userID string, itemType string, fields string, startIndex, limit int) (*ItemsResponse, error) {
	if !c.circuitBreaker.CanExecute() {
		return nil, errors.New(errors.CodeExternalAPIError, "Jellyfin server is temporarily unavailable (circuit breaker open)")
	}
	if err := c.rateLimiter.Wait(ctx); err != nil {
		return nil, errors.Wrap(err, errors.CodeRateLimitExceeded, "Rate limit exceeded")
	}

	url := fmt.Sprintf("%s/Users/%s/Items", c.baseURL, userID)
	req, err := retryablehttp.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, errors.Wrap(err, errors.CodeInternalError, "Failed to create request")
	}
	req.Header.Set("X-Emby-Token", accessToken)
	req.Header.Set("X-Emby-Authorization", fmt.Sprintf("MediaBrowser Client=\"Jellytics\", Device=\"Server\", DeviceId=\"jellytics-server\", Version=\"1.0.0\", Token=\"%s\"", accessToken))

	q := req.URL.Query()
	q.Add("Recursive", "true")
	if itemType != "" {
		q.Add("IncludeItemTypes", itemType)
	}
	q.Add("Fields", fields)
	q.Add("StartIndex", strconv.Itoa(startIndex))
	q.Add("Limit", strconv.Itoa(limit))
	req.URL.RawQuery = q.Encode()

	resp, err := c.httpClient.Do(req)
	if err != nil {
		c.circuitBreaker.RecordFailure()
		return nil, errors.Wrap(err, errors.CodeExternalAPIError, "Failed to fetch items from Jellyfin")
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		c.circuitBreaker.RecordFailure()
		if resp.StatusCode == http.StatusUnauthorized {
			return nil, errors.New(errors.CodeInvalidCredentials, "Jellyfin authentication token is invalid or expired")
		}
		return nil, errors.New(errors.CodeExternalAPIError, fmt.Sprintf("Jellyfin API error (status: %d)", resp.StatusCode))
	}

	var itemsResp ItemsResponse
	if err := json.NewDecoder(resp.Body).Decode(&itemsResp); err != nil {
		return nil, errors.Wrap(err, errors.CodeInternalError, "Failed to decode response")
	}
	c.circuitBreaker.RecordSuccess()
	return &itemsResp, nil
}

func (c *Client) GetUserItemsWithFields(ctx context.Context, accessToken, userID string, itemType string, fields string) (*ItemsResponse, error) {
	return c.GetUserItemsWithFieldsAll(ctx, accessToken, userID, itemType, fields)
}

func (c *Client) GetEpisodesForSeries(ctx context.Context, accessToken, seriesID string) (*ItemsResponse, error) {
	if !c.circuitBreaker.CanExecute() {
		return nil, errors.New(errors.CodeExternalAPIError, "Jellyfin server is temporarily unavailable (circuit breaker open)")
	}

	if err := c.rateLimiter.Wait(ctx); err != nil {
		return nil, errors.Wrap(err, errors.CodeRateLimitExceeded, "Rate limit exceeded")
	}

	url := fmt.Sprintf("%s/Shows/%s/Episodes", c.baseURL, seriesID)

	req, err := retryablehttp.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, errors.Wrap(err, errors.CodeInternalError, "Failed to create request")
	}

	req.Header.Set("X-Emby-Token", accessToken)
	req.Header.Set("X-Emby-Authorization", fmt.Sprintf("MediaBrowser Client=\"Jellytics\", Device=\"Server\", DeviceId=\"jellytics-server\", Version=\"1.0.0\", Token=\"%s\"", accessToken))

	q := req.URL.Query()
	q.Add("Fields", "Overview,Genres,ProviderIds,ImageTags,UserData")
	req.URL.RawQuery = q.Encode()

	resp, err := c.httpClient.Do(req)
	if err != nil {
		c.circuitBreaker.RecordFailure()
		return nil, errors.Wrap(err, errors.CodeExternalAPIError, "Failed to fetch episodes from Jellyfin")
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, readErr := io.ReadAll(resp.Body)
		if readErr != nil {
			log.Warn().Err(readErr).Msg("Failed to read error response body")
		}
		errType := categorizeError(nil, resp.StatusCode)
		if errType.IsRetryable() {
			c.circuitBreaker.RecordFailure()
		}

		log.Error().Int("status", resp.StatusCode).Bytes("body", bodyBytes).Msg("Jellyfin API error")

		if resp.StatusCode == http.StatusUnauthorized {
			return nil, errors.New(errors.CodeInvalidCredentials, "Jellyfin authentication token is invalid or expired. Please log in again to refresh your credentials.")
		}

		return nil, errors.New(errors.CodeExternalAPIError, fmt.Sprintf("Jellyfin API error (status: %d)", resp.StatusCode))
	}

	var itemsResp ItemsResponse
	if err := json.NewDecoder(resp.Body).Decode(&itemsResp); err != nil {
		return nil, errors.Wrap(err, errors.CodeInternalError, "Failed to decode response")
	}

	c.circuitBreaker.RecordSuccess()
	return &itemsResp, nil
}

type Session struct {
	Id                 string       `json:"Id"`
	UserId             string       `json:"UserId"`
	UserName           string       `json:"UserName"`
	Client             string       `json:"Client"`
	DeviceName         string       `json:"DeviceName"`
	DeviceType         string       `json:"DeviceType"`
	ApplicationVersion string       `json:"ApplicationVersion"`
	NowPlayingItem     *SessionItem `json:"NowPlayingItem,omitempty"`
	PlayState          *PlayState   `json:"PlayState,omitempty"`
	RemoteEndPoint     string       `json:"RemoteEndPoint"`
}

type SessionItem struct {
	Id                string `json:"Id"`
	Name              string `json:"Name"`
	Type              string `json:"Type"`
	SeriesId          string `json:"SeriesId,omitempty"`
	SeriesName        string `json:"SeriesName,omitempty"`
	SeasonId          string `json:"SeasonId,omitempty"`
	SeasonName        string `json:"SeasonName,omitempty"`
	IndexNumber       int    `json:"IndexNumber,omitempty"`
	ParentIndexNumber int    `json:"ParentIndexNumber,omitempty"`
	RunTimeTicks      int64  `json:"RunTimeTicks,omitempty"`
}

type PlayState struct {
	PositionTicks int64  `json:"PositionTicks"`
	IsPaused      bool   `json:"IsPaused"`
	IsMuted       bool   `json:"IsMuted"`
	VolumeLevel   int    `json:"VolumeLevel"`
	PlayMethod    string `json:"PlayMethod"`
	RepeatMode    string `json:"RepeatMode"`
}

type SessionsResponse struct {
	Sessions []Session `json:"-"`
}

func (r *SessionsResponse) UnmarshalJSON(data []byte) error {
	return json.Unmarshal(data, &r.Sessions)
}

func (c *Client) GetSessions(ctx context.Context, accessToken string) (*SessionsResponse, error) {
	if !c.circuitBreaker.CanExecute() {
		return nil, errors.New(errors.CodeExternalAPIError, "Jellyfin server is temporarily unavailable (circuit breaker open)")
	}

	if err := c.rateLimiter.Wait(ctx); err != nil {
		return nil, errors.Wrap(err, errors.CodeRateLimitExceeded, "Rate limit exceeded")
	}

	url := fmt.Sprintf("%s/Sessions", c.baseURL)

	log.Debug().
		Str("url", url).
		Msg("Fetching active sessions from Jellyfin")

	req, err := retryablehttp.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		log.Error().Err(err).Str("url", url).Msg("Failed to create sessions request")
		return nil, errors.Wrap(err, errors.CodeInternalError, "Failed to create request")
	}

	req.Header.Set("X-Emby-Token", accessToken)
	req.Header.Set("X-Emby-Authorization", fmt.Sprintf("MediaBrowser Client=\"Jellytics\", Device=\"Server\", DeviceId=\"jellytics-server\", Version=\"1.0.0\", Token=\"%s\"", accessToken))

	q := req.URL.Query()
	q.Add("ActiveWithinSeconds", "300") // Only get sessions active within last 5 minutes
	req.URL.RawQuery = q.Encode()

	log.Debug().
		Str("full_url", req.URL.String()).
		Msg("Sending sessions request to Jellyfin")

	startTime := time.Now()
	resp, err := c.httpClient.Do(req)
	duration := time.Since(startTime)

	if err != nil {
		errType := categorizeError(err, 0)
		c.circuitBreaker.RecordFailure()

		log.Error().
			Err(err).
			Str("url", url).
			Dur("duration", duration).
			Str("error_type", errType.String()).
			Msg("Failed to fetch sessions from Jellyfin")
		return nil, errors.Wrap(err, errors.CodeExternalAPIError, "Failed to fetch sessions from Jellyfin")
	}
	defer resp.Body.Close()

	log.Debug().
		Int("status_code", resp.StatusCode).
		Dur("duration", duration).
		Str("url", url).
		Msg("Received sessions response from Jellyfin")

	if resp.StatusCode != http.StatusOK {
		bodyBytes, readErr := io.ReadAll(resp.Body)
		if readErr != nil {
			log.Warn().Err(readErr).Msg("Failed to read error response body")
		}
		errType := categorizeError(nil, resp.StatusCode)
		if errType.IsRetryable() {
			c.circuitBreaker.RecordFailure()
		}

		log.Error().
			Int("status", resp.StatusCode).
			Bytes("body", bodyBytes).
			Str("url", url).
			Str("error_type", errType.String()).
			Msg("Jellyfin sessions API error")

		if resp.StatusCode == http.StatusUnauthorized {
			return nil, errors.New(errors.CodeInvalidCredentials, "Jellyfin authentication token is invalid or expired. Please log in again to refresh your credentials.")
		}

		return nil, errors.New(errors.CodeExternalAPIError, fmt.Sprintf("Jellyfin API error (status: %d)", resp.StatusCode))
	}

	var sessionsResp SessionsResponse
	if err := json.NewDecoder(resp.Body).Decode(&sessionsResp); err != nil {
		log.Error().Err(err).Msg("Failed to decode sessions response")
		return nil, errors.Wrap(err, errors.CodeInternalError, "Failed to decode sessions response")
	}

	c.circuitBreaker.RecordSuccess()
	log.Debug().Int("count", len(sessionsResp.Sessions)).Msg("Successfully fetched active sessions")
	return &sessionsResp, nil
}
