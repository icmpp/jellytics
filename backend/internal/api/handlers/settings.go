package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"

	apiMiddleware "jellytics/backend/internal/api/middleware"
	"jellytics/backend/internal/errors"
	"jellytics/backend/internal/jellyfin"
	"jellytics/backend/internal/repository"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog/log"
)

type SettingsHandler struct {
	users repository.UserStore
}

func NewSettingsHandler(db *sql.DB) *SettingsHandler {
	return &SettingsHandler{users: repository.NewSQLUserStore(db)}
}

type SettingsResponse struct {
	JellyfinServerURL string `json:"jellyfin_server_url"`
	JellyfinServerID  string `json:"jellyfin_server_id,omitempty"`
}

type UpdateSettingsRequest struct {
	JellyfinServerURL string `json:"jellyfin_server_url" validate:"required,url"`
}

type TestConnectionRequest struct {
	JellyfinServerURL string `json:"jellyfin_server_url" validate:"required,url"`
	Username          string `json:"username" validate:"required"`
	Password          string `json:"password" validate:"required"`
}

type TestConnectionResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

type PreferencesResponse struct {
	Preferences map[string]interface{} `json:"preferences"`
}

type UpdatePreferencesRequest struct {
	Preferences map[string]interface{} `json:"preferences"`
}

func (h *SettingsHandler) GetSettings(w http.ResponseWriter, r *http.Request) {
	userID := apiMiddleware.GetUserID(r)

	serverURL, found, err := h.users.ServerURL(r.Context(), userID)
	if err != nil {
		log.Error().Err(err).Int("user_id", userID).Msg("Failed to get user settings")
		handleError(w, r, err)
		return
	}
	if !found {
		handleError(w, r, errors.New(errors.CodeUserNotFound, "User not found"))
		return
	}

	serverID := ""
	if serverURL != "" {
		if id, err := jellyfin.GetServerID(r.Context(), serverURL); err == nil {
			serverID = id
		} else {
			log.Debug().Err(err).Str("server_url", serverURL).Msg("Could not fetch Jellyfin server ID for settings")
		}
	}

	response := SettingsResponse{
		JellyfinServerURL: serverURL,
		JellyfinServerID:  serverID,
	}

	writeJSON(w, r, response)
}

func (h *SettingsHandler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	userID := apiMiddleware.GetUserID(r)

	var req UpdateSettingsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid request body"))
		return
	}

	if err := jellyfin.ValidateURL(r.Context(), req.JellyfinServerURL); err != nil {
		handleError(w, r, err)
		return
	}

	if err := h.users.SetServerURL(r.Context(), userID, req.JellyfinServerURL); err != nil {
		log.Error().Err(err).Int("user_id", userID).Msg("Failed to update settings")
		handleError(w, r, err)
		return
	}

	response := SettingsResponse{
		JellyfinServerURL: req.JellyfinServerURL,
	}

	writeJSON(w, r, response)
}

func (h *SettingsHandler) TestConnection(w http.ResponseWriter, r *http.Request) {
	var req TestConnectionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid request body"))
		return
	}

	if err := jellyfin.ValidateURL(r.Context(), req.JellyfinServerURL); err != nil {
		w.WriteHeader(http.StatusOK)
		writeJSON(w, r, TestConnectionResponse{
			Success: false,
			Message: err.Error(),
		})
		return
	}

	if err := jellyfin.TestConnection(r.Context(), req.JellyfinServerURL, req.Username, req.Password); err != nil {
		w.WriteHeader(http.StatusOK)
		writeJSON(w, r, TestConnectionResponse{
			Success: false,
			Message: err.Error(),
		})
		return
	}

	response := TestConnectionResponse{
		Success: true,
		Message: "Connection successful",
	}

	writeJSON(w, r, response)
}

func (h *SettingsHandler) GetPreferences(w http.ResponseWriter, r *http.Request) {
	userID := apiMiddleware.GetUserID(r)

	preferencesJSON, found, err := h.users.Preferences(r.Context(), userID)
	if err != nil {
		log.Error().Err(err).Int("user_id", userID).Msg("Failed to get user preferences")
		handleError(w, r, err)
		return
	}
	if !found {
		handleError(w, r, errors.New(errors.CodeUserNotFound, "User not found"))
		return
	}

	preferences := make(map[string]interface{})
	if preferencesJSON != "" {
		if err := json.Unmarshal([]byte(preferencesJSON), &preferences); err != nil {
			log.Warn().Err(err).Int("user_id", userID).Msg("Failed to parse preferences JSON, returning empty")
			preferences = make(map[string]interface{})
		}
	}

	response := PreferencesResponse{
		Preferences: preferences,
	}

	writeJSON(w, r, response)
}

func (h *SettingsHandler) UpdatePreferences(w http.ResponseWriter, r *http.Request) {
	userID := apiMiddleware.GetUserID(r)

	var req UpdatePreferencesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid request body"))
		return
	}

	preferencesJSON, err := json.Marshal(req.Preferences)
	if err != nil {
		log.Error().Err(err).Int("user_id", userID).Msg("Failed to marshal preferences")
		handleError(w, r, errors.Wrap(err, errors.CodeValidationError, "Invalid preferences format"))
		return
	}

	if err := h.users.SetPreferences(r.Context(), userID, string(preferencesJSON)); err != nil {
		log.Error().Err(err).Int("user_id", userID).Msg("Failed to update preferences")
		handleError(w, r, err)
		return
	}

	response := PreferencesResponse{
		Preferences: req.Preferences,
	}

	writeJSON(w, r, response)
}

func (h *SettingsHandler) RegisterRoutes(r chi.Router) {
	r.Get("/", h.GetSettings)
	r.Put("/", h.UpdateSettings)
	r.Post("/test-connection", h.TestConnection)
	r.Get("/preferences", h.GetPreferences)
	r.Put("/preferences", h.UpdatePreferences)
}
