package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"

	"jellytics/backend/internal/errors"
	"jellytics/backend/internal/services"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog/log"
)

type SystemSettingsHandler struct {
	service       *services.SystemSettingsService
	syncScheduler *services.SyncScheduler
}

func NewSystemSettingsHandler(service *services.SystemSettingsService, syncScheduler *services.SyncScheduler) *SystemSettingsHandler {
	return &SystemSettingsHandler{
		service:       service,
		syncScheduler: syncScheduler,
	}
}

type SystemSettingsResponse struct {
	Settings map[string][]services.SystemSetting `json:"settings"`
}

type UpdateSystemSettingsRequest struct {
	Settings map[string]string `json:"settings"`
}

type SyncConfigResponse struct {
	SyncIntervalSeconds     int  `json:"sync_interval_seconds"`
	SessionsIntervalSeconds int  `json:"sessions_interval_seconds"`
	WorkerPoolSize          int  `json:"worker_pool_size"`
	SyncEnabled             bool `json:"sync_enabled"`
}

func (h *SystemSettingsHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	settings, err := h.service.GetAll(r.Context())
	if err != nil {
		handleError(w, r, err)
		return
	}

	typedSettings := make(map[string][]map[string]interface{})
	for category, categorySettings := range settings {
		for _, setting := range categorySettings {
			typedSetting := map[string]interface{}{
				"key":         setting.Key,
				"value":       h.service.GetTypedValue(setting),
				"description": setting.Description,
				"category":    setting.Category,
				"data_type":   setting.DataType,
				"updated_at":  setting.UpdatedAt,
			}
			typedSettings[category] = append(typedSettings[category], typedSetting)
		}
	}

	writeJSON(w, r, map[string]interface{}{
		"settings": typedSettings,
	})
}

func (h *SystemSettingsHandler) GetByCategory(w http.ResponseWriter, r *http.Request) {
	category := chi.URLParam(r, "category")
	if category == "" {
		handleError(w, r, errors.New(errors.CodeValidationError, "Category is required"))
		return
	}

	settings, err := h.service.GetByCategory(r.Context(), category)
	if err != nil {
		handleError(w, r, err)
		return
	}

	typedSettings := make([]map[string]interface{}, 0, len(settings))
	for _, setting := range settings {
		typedSetting := map[string]interface{}{
			"key":         setting.Key,
			"value":       h.service.GetTypedValue(setting),
			"description": setting.Description,
			"category":    setting.Category,
			"data_type":   setting.DataType,
			"updated_at":  setting.UpdatedAt,
		}
		typedSettings = append(typedSettings, typedSetting)
	}

	writeJSON(w, r, map[string]interface{}{
		"settings": typedSettings,
	})
}

func (h *SystemSettingsHandler) GetSyncConfig(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	response := SyncConfigResponse{
		SyncIntervalSeconds:     h.service.GetInt(ctx, "sync_interval_seconds", 300),
		SessionsIntervalSeconds: h.service.GetInt(ctx, "sessions_sync_interval_seconds", 90),
		WorkerPoolSize:          h.service.GetInt(ctx, "sync_worker_pool_size", 5),
		SyncEnabled:             h.service.GetBool(ctx, "sync_enabled", true),
	}

	writeJSON(w, r, response)
}

func (h *SystemSettingsHandler) Update(w http.ResponseWriter, r *http.Request) {
	var req UpdateSystemSettingsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid request body"))
		return
	}

	if len(req.Settings) == 0 {
		handleError(w, r, errors.New(errors.CodeValidationError, "No settings provided"))
		return
	}

	for key, value := range req.Settings {
		if err := h.validateSetting(key, value); err != nil {
			handleError(w, r, err)
			return
		}
	}

	if err := h.service.SetMultiple(r.Context(), req.Settings); err != nil {
		handleError(w, r, err)
		return
	}

	if h.syncSettingsChanged(req.Settings) {
		h.restartSyncScheduler(r.Context())
	}

	writeJSON(w, r, map[string]interface{}{
		"success": true,
		"message": "Settings updated successfully",
	})
}

func (h *SystemSettingsHandler) UpdateSyncConfig(w http.ResponseWriter, r *http.Request) {
	var req SyncConfigResponse
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid request body"))
		return
	}

	if req.SyncIntervalSeconds < 10 {
		handleError(w, r, errors.New(errors.CodeValidationError, "Sync interval must be at least 10 seconds"))
		return
	}
	if req.SessionsIntervalSeconds < 10 {
		handleError(w, r, errors.New(errors.CodeValidationError, "Sessions interval must be at least 10 seconds"))
		return
	}
	if req.WorkerPoolSize < 1 || req.WorkerPoolSize > 20 {
		handleError(w, r, errors.New(errors.CodeValidationError, "Worker pool size must be between 1 and 20"))
		return
	}

	settings := map[string]string{
		"sync_interval_seconds":          strconv.Itoa(req.SyncIntervalSeconds),
		"sessions_sync_interval_seconds": strconv.Itoa(req.SessionsIntervalSeconds),
		"sync_worker_pool_size":          strconv.Itoa(req.WorkerPoolSize),
		"sync_enabled":                   strconv.FormatBool(req.SyncEnabled),
	}

	if err := h.service.SetMultiple(r.Context(), settings); err != nil {
		handleError(w, r, err)
		return
	}

	h.restartSyncScheduler(r.Context())

	writeJSON(w, r, map[string]interface{}{
		"success": true,
		"message": "Sync configuration updated",
	})
}

func (h *SystemSettingsHandler) validateSetting(key string, value string) error {
	switch key {
	case "sync_interval_seconds":
		val, err := strconv.Atoi(value)
		if err != nil || val < 10 {
			return errors.New(errors.CodeValidationError, "Sync interval must be at least 10 seconds")
		}
	case "sync_worker_pool_size":
		val, err := strconv.Atoi(value)
		if err != nil || val < 1 || val > 20 {
			return errors.New(errors.CodeValidationError, "Worker pool size must be between 1 and 20")
		}
	case "rate_limit_requests_per_minute":
		val, err := strconv.Atoi(value)
		if err != nil || val < 10 || val > 10000 {
			return errors.New(errors.CodeValidationError, "Rate limit must be between 10 and 10000")
		}
	case "jwt_access_expiry_minutes":
		val, err := strconv.Atoi(value)
		if err != nil || val < 1 || val > 1440 {
			return errors.New(errors.CodeValidationError, "JWT access expiry must be between 1 and 1440 minutes")
		}
	case "jwt_refresh_expiry_hours":
		val, err := strconv.Atoi(value)
		if err != nil || val < 1 || val > 8760 {
			return errors.New(errors.CodeValidationError, "JWT refresh expiry must be between 1 and 8760 hours")
		}
	case "log_level":
		validLevels := map[string]bool{"debug": true, "info": true, "warn": true, "error": true}
		if !validLevels[value] {
			return errors.New(errors.CodeValidationError, "Invalid log level. Must be: debug, info, warn, or error")
		}
	}
	return nil
}

func (h *SystemSettingsHandler) syncSettingsChanged(settings map[string]string) bool {
	syncKeys := []string{"sync_interval_seconds", "sessions_sync_interval_seconds", "sync_worker_pool_size", "sync_enabled"}
	for _, key := range syncKeys {
		if _, exists := settings[key]; exists {
			return true
		}
	}
	return false
}

func (h *SystemSettingsHandler) restartSyncScheduler(ctx context.Context) {
	if h.syncScheduler == nil {
		log.Warn().Msg("Sync scheduler not available, cannot restart")
		return
	}
	h.syncScheduler.UpdateIntervals(ctx)
}

func (h *SystemSettingsHandler) RegisterRoutes(r chi.Router) {
	r.Get("/", h.GetAll)
	r.Put("/", h.Update)
	r.Get("/sync", h.GetSyncConfig)
	r.Put("/sync", h.UpdateSyncConfig)
	r.Get("/{category}", h.GetByCategory)
}
