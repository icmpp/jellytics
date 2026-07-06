package handlers

import (
	"encoding/json"
	"net/http"

	"jellytics/backend/internal/errors"
	"jellytics/backend/internal/services"

	"github.com/go-chi/chi/v5"
)

// webhookIngestPath is the path Jellyfin should POST playback events to.
const webhookIngestPath = "/api/v1/webhooks/jellyfin"

type WebhookHandler struct {
	service *services.WebhookService
}

func NewWebhookHandler(service *services.WebhookService) *WebhookHandler {
	return &WebhookHandler{service: service}
}

// Ingest handles inbound Jellyfin playback webhooks. It is authenticated by the
// `?token=` query parameter (Jellyfin's webhook plugin cannot perform JWT login).
func (h *WebhookHandler) Ingest(w http.ResponseWriter, r *http.Request) {
	if !h.service.ValidateToken(r.Context(), r.URL.Query().Get("token")) {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Invalid webhook token"))
		return
	}
	if !h.service.Enabled(r.Context()) {
		// Acknowledge so Jellyfin doesn't retry, but do nothing.
		writeJSON(w, r, services.WebhookResult{Status: "skipped", Detail: "webhooks disabled"})
		return
	}

	var ev services.WebhookEvent
	if err := json.NewDecoder(r.Body).Decode(&ev); err != nil {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid webhook payload"))
		return
	}

	result, err := h.service.Process(r.Context(), ev)
	if err != nil {
		handleError(w, r, err)
		return
	}
	writeJSON(w, r, result)
}

// RegisterIngestRoutes registers the unauthenticated (token-guarded) ingest endpoint.
func (h *WebhookHandler) RegisterIngestRoutes(r chi.Router) {
	r.Post("/jellyfin", h.Ingest)
}

type webhookConfigResponse struct {
	Enabled bool   `json:"enabled"`
	Path    string `json:"path"`
	Secret  string `json:"secret"`
}

// GetConfig returns the webhook endpoint path + secret so the UI can show the
// URL to paste into Jellyfin. Requires authentication.
func (h *WebhookHandler) GetConfig(w http.ResponseWriter, r *http.Request) {
	secret, err := h.service.Secret(r.Context())
	if err != nil {
		handleError(w, r, err)
		return
	}
	writeJSON(w, r, webhookConfigResponse{
		Enabled: h.service.Enabled(r.Context()),
		Path:    webhookIngestPath,
		Secret:  secret,
	})
}

// Regenerate rotates the webhook secret. Requires authentication.
func (h *WebhookHandler) Regenerate(w http.ResponseWriter, r *http.Request) {
	secret, err := h.service.Regenerate(r.Context())
	if err != nil {
		handleError(w, r, err)
		return
	}
	writeJSON(w, r, webhookConfigResponse{
		Enabled: h.service.Enabled(r.Context()),
		Path:    webhookIngestPath,
		Secret:  secret,
	})
}

// RegisterConfigRoutes registers the authenticated config endpoints.
func (h *WebhookHandler) RegisterConfigRoutes(r chi.Router) {
	r.Get("/config", h.GetConfig)
	r.Post("/regenerate", h.Regenerate)
}
