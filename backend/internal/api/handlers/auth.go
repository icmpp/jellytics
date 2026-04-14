package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"jellytics/backend/internal/config"
	"jellytics/backend/internal/errors"
	"jellytics/backend/internal/jellyfin"
	"jellytics/backend/internal/services"
	"jellytics/backend/pkg/jwt"

	"github.com/rs/zerolog/log"
)

type AuthHandler struct {
	db             *sql.DB
	config         *config.Config
	syncService    *services.SyncService
	clientProvider jellyfin.ClientProvider
}

func NewAuthHandler(db *sql.DB, cfg *config.Config, clientProvider jellyfin.ClientProvider) *AuthHandler {
	if clientProvider == nil {
		clientProvider = jellyfin.PooledClientProvider{}
	}
	return &AuthHandler{
		db:             db,
		config:         cfg,
		syncService:    services.NewSyncServiceWithDataPath(db, services.SyncConfigFromAppConfig(cfg.Sync), cfg.Database.DataDir()),
		clientProvider: clientProvider,
	}
}

type LoginRequest struct {
	ServerURL string `json:"server_url"`
	Username  string `json:"username"`
	Password  string `json:"password"`
}

type LoginResponse struct {
	User               UserResponse `json:"user"`
	AccessToken        string       `json:"access_token"`
	RefreshToken       string       `json:"refresh_token"`
	IsNewUser          bool         `json:"is_new_user"`
	InitialSyncStarted bool         `json:"initial_sync_started"`
}

type UserResponse struct {
	ID        int    `json:"id"`
	Username  string `json:"username"`
	CreatedAt string `json:"created_at"`
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid request body"))
		return
	}

	if req.Username == "" || req.Password == "" {
		handleError(w, r, errors.New(errors.CodeValidationError, "Username and password are required"))
		return
	}

	var userCount int
	err := h.db.QueryRowContext(r.Context(),
		"SELECT COUNT(*) FROM users WHERE deleted_at IS NULL").Scan(&userCount)
	if err != nil {
		log.Error().Err(err).Msg("Failed to check user count")
		handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to check user count"))
		return
	}

	var serverURL string
	isFirstTime := userCount == 0

	if isFirstTime {
		if req.ServerURL == "" {
			handleError(w, r, errors.New(errors.CodeValidationError, "Server URL is required for first-time setup"))
			return
		}
		serverURL = req.ServerURL
	} else {
		err := h.db.QueryRowContext(r.Context(),
			"SELECT jellyfin_server_url FROM users WHERE deleted_at IS NULL AND jellyfin_server_url IS NOT NULL AND jellyfin_server_url != '' LIMIT 1").Scan(&serverURL)
		if err != nil {
			log.Error().Err(err).Msg("Failed to get saved server URL")
			if req.ServerURL == "" {
				handleError(w, r, errors.New(errors.CodeValidationError, "Server URL is required. Please provide it in the request."))
				return
			}
			serverURL = req.ServerURL
		}
		if req.ServerURL != "" && req.ServerURL != serverURL {
			log.Warn().Str("requested", req.ServerURL).Str("saved", serverURL).Msg("Server URL change attempted via login - ignored")
		}
	}

	if serverURL == "" {
		handleError(w, r, errors.New(errors.CodeValidationError, "Server URL is required"))
		return
	}

	if err := jellyfin.ValidateURL(r.Context(), serverURL); err != nil {
		handleError(w, r, err)
		return
	}

	jfClient := h.clientProvider.Get(serverURL)
	authResp, err := jfClient.Authenticate(r.Context(), req.Username, req.Password)
	if err != nil {
		log.Error().Err(err).Msg("Jellyfin authentication failed")

		var appErr *errors.Error
		if errors.As(err, &appErr) {
			if appErr.Code == errors.CodeExternalAPIError {
				handleError(w, r, errors.Wrap(err, errors.CodeExternalAPIError, "Unable to connect to Jellyfin server. Please check your server URL and ensure the server is accessible."))
			} else {
				handleError(w, r, errors.Wrap(err, errors.CodeInvalidCredentials, "Invalid username or password"))
			}
		} else {
			handleError(w, r, errors.Wrap(err, errors.CodeInvalidCredentials, "Authentication failed"))
		}
		return
	}

	log.Info().
		Str("jellyfin_user_id", authResp.User.Id).
		Str("jellyfin_username", authResp.User.Name).
		Msg("Looking up user in database")

	user, isNewUser, err := h.getOrCreateUser(r.Context(), authResp, serverURL)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get or create user")
		handleError(w, r, errors.Wrap(err, errors.CodeInternalError, "Failed to process login"))
		return
	}

	log.Info().
		Int("user_id", user.ID).
		Str("username", user.Username).
		Str("jellyfin_user_id", user.JellyfinUserID).
		Bool("is_new_user", isNewUser).
		Msg("User lookup/creation successful")

	accessToken, err := jwt.GenerateToken(user.ID, user.Username, h.config.JWT.Secret, h.config.JWT.AccessExpiry)
	if err != nil {
		log.Error().Err(err).Msg("Failed to generate access token")
		handleError(w, r, errors.Wrap(err, errors.CodeInternalError, "Failed to generate token"))
		return
	}

	refreshToken, err := jwt.GenerateToken(user.ID, user.Username, h.config.JWT.Secret, h.config.JWT.RefreshExpiry)
	if err != nil {
		log.Error().Err(err).Msg("Failed to generate refresh token")
		handleError(w, r, errors.Wrap(err, errors.CodeInternalError, "Failed to generate token"))
		return
	}

	now := time.Now()
	ip := r.RemoteAddr
	_, err = h.db.ExecContext(r.Context(),
		"UPDATE users SET last_login_at = ?, last_login_ip = ?, updated_at = ? WHERE id = ?",
		now, ip, now, user.ID)
	if err != nil {
		log.Warn().Err(err).Msg("Failed to update last login")
	}

	needsInitialSync := isNewUser || h.userNeedsSync(r.Context(), user.ID)
	initialSyncStarted := false

	if needsInitialSync {
		log.Info().
			Int("user_id", user.ID).
			Bool("is_new_user", isNewUser).
			Msg("Triggering initial sync for user")

		syncCtx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
		go func() {
			defer cancel()
			if err := h.syncService.SyncUser(syncCtx, user.ID); err != nil {
				log.Error().Err(err).Int("user_id", user.ID).Msg("Initial sync failed")
			} else {
				log.Info().Int("user_id", user.ID).Msg("Initial sync completed successfully")
			}
		}()
		initialSyncStarted = true
	}

	writeJSON(w, r, LoginResponse{
		User: UserResponse{
			ID:        user.ID,
			Username:  user.Username,
			CreatedAt: user.CreatedAt.Format(time.RFC3339),
		},
		AccessToken:        accessToken,
		RefreshToken:       refreshToken,
		IsNewUser:          isNewUser,
		InitialSyncStarted: initialSyncStarted,
	})
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	writeJSON(w, r, map[string]string{"message": "Logged out successfully"})
}

func (h *AuthHandler) GetOnboardingStatus(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 35*time.Second)
	defer cancel()

	var userCount int
	err := h.db.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM users WHERE deleted_at IS NULL").Scan(&userCount)

	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			log.Error().Err(err).Msg("Database query timeout while checking onboarding status")
			handleError(w, r, errors.New(errors.CodeDatabaseError, "Database query timed out. Please try again."))
		} else if ctx.Err() == context.Canceled {
			log.Error().Err(err).Msg("Database query canceled while checking onboarding status")
			handleError(w, r, errors.New(errors.CodeDatabaseError, "Database query was canceled. Please try again."))
		} else {
			log.Error().Err(err).Str("error_type", fmt.Sprintf("%T", err)).Msg("Failed to check onboarding status")
			handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to check onboarding status"))
		}
		return
	}

	var savedServerURL string
	if userCount > 0 {
		err := h.db.QueryRowContext(ctx,
			"SELECT jellyfin_server_url FROM users WHERE deleted_at IS NULL LIMIT 1").Scan(&savedServerURL)
		if err != nil && err != sql.ErrNoRows {
			log.Warn().Err(err).Msg("Failed to get saved server URL")
		}
	}

	writeJSON(w, r, map[string]interface{}{
		"is_first_time":    userCount == 0,
		"saved_server_url": savedServerURL,
	})
}

func (h *AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	var req struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid request body"))
		return
	}

	claims, err := jwt.ValidateToken(req.RefreshToken, h.config.JWT.Secret)
	if err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeTokenInvalid, "Invalid refresh token"))
		return
	}

	accessToken, err := jwt.GenerateToken(claims.UserID, claims.Email, h.config.JWT.Secret, h.config.JWT.AccessExpiry)
	if err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeInternalError, "Failed to generate token"))
		return
	}

	writeJSON(w, r, map[string]string{
		"access_token": accessToken,
	})
}

func (h *AuthHandler) getOrCreateUser(ctx context.Context, authResp *jellyfin.AuthResponse, serverURL string) (*User, bool, error) {
	var user User
	isNewUser := false

	if authResp.User.Id == "" {
		return nil, false, errors.New(errors.CodeValidationError, "Cannot create user: Jellyfin user ID is missing. This may indicate the API key doesn't have proper permissions to identify the user.")
	}

	log.Debug().
		Str("jellyfin_user_id", authResp.User.Id).
		Msg("Querying database for existing user")

	err := h.db.QueryRowContext(ctx,
		"SELECT id, username, jellyfin_user_id, jellyfin_server_url, created_at FROM users WHERE jellyfin_user_id = ? AND deleted_at IS NULL",
		authResp.User.Id).Scan(&user.ID, &user.Username, &user.JellyfinUserID, &user.JellyfinServerURL, &user.CreatedAt)

	if err == sql.ErrNoRows {
		log.Info().
			Str("jellyfin_user_id", authResp.User.Id).
			Str("username", authResp.User.Name).
			Msg("Creating new user in database")
		isNewUser = true
		now := time.Now()
		result, err := h.db.ExecContext(ctx,
			`INSERT INTO users (username, jellyfin_user_id, jellyfin_server_url, jellyfin_access_token, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?)`,
			authResp.User.Name, authResp.User.Id, serverURL, authResp.AccessToken, now, now)
		if err != nil {
			return nil, false, errors.Wrap(err, errors.CodeDatabaseError, "Failed to create user")
		}

		id, err := result.LastInsertId()
		if err != nil {
			return nil, false, errors.Wrap(err, errors.CodeDatabaseError, "Failed to get new user ID")
		}

		user.ID = int(id)
		user.Username = authResp.User.Name
		user.JellyfinUserID = authResp.User.Id
		user.JellyfinServerURL = serverURL
		user.CreatedAt = now
	} else if err != nil {
		log.Error().
			Err(err).
			Str("jellyfin_user_id", authResp.User.Id).
			Msg("Failed to query existing user")
		return nil, false, errors.Wrap(err, errors.CodeDatabaseError, "Failed to query existing user")
	} else {
		log.Info().
			Int("user_id", user.ID).
			Str("existing_username", user.Username).
			Str("jellyfin_user_id", user.JellyfinUserID).
			Msg("Found existing user, updating credentials")

		_, err = h.db.ExecContext(ctx,
			"UPDATE users SET jellyfin_access_token = ?, jellyfin_token_valid = 1, updated_at = ? WHERE id = ?",
			authResp.AccessToken, time.Now(), user.ID)
		if err != nil {
			log.Error().Err(err).Int("user_id", user.ID).Msg("Failed to update user credentials")
			return nil, false, errors.Wrap(err, errors.CodeDatabaseError, "Failed to update user credentials")
		}
	}

	return &user, isNewUser, nil
}

func (h *AuthHandler) userNeedsSync(ctx context.Context, userID int) bool {
	var showCount, movieCount int
	err := h.db.QueryRowContext(ctx,
		`SELECT (SELECT COUNT(*) FROM shows WHERE user_id = ? AND deleted_at IS NULL),
		        (SELECT COUNT(*) FROM movies WHERE user_id = ? AND deleted_at IS NULL)`,
		userID, userID).Scan(&showCount, &movieCount)
	if err != nil {
		log.Warn().Err(err).Int("user_id", userID).Msg("Failed to check show/movie count")
		return true
	}

	needsSync := showCount == 0 && movieCount == 0
	log.Debug().Int("user_id", userID).Bool("needs_sync", needsSync).Msg("User sync check")

	return needsSync
}

type User struct {
	ID                int       `db:"id"`
	Username          string    `db:"username"`
	JellyfinUserID    string    `db:"jellyfin_user_id"`
	JellyfinServerURL string    `db:"jellyfin_server_url"`
	CreatedAt         time.Time `db:"created_at"`
}
