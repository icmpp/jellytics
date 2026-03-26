package handlers

import (
	"context"
	"database/sql"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"jellytics/backend/internal/errors"
	"jellytics/backend/internal/jellyfin"
	"jellytics/backend/internal/services"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog/log"
)

type ImagesHandler struct {
	db           *sql.DB
	imageService *services.ImageService
	dataPath     string
	client       *http.Client
}

func NewImagesHandler(db *sql.DB, dataPath string) *ImagesHandler {
	return &ImagesHandler{
		db:           db,
		imageService: services.NewImageService(db, dataPath),
		dataPath:     dataPath,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (h *ImagesHandler) GetImage(w http.ResponseWriter, r *http.Request) {
	itemType := chi.URLParam(r, "type")
	jellyfinID := chi.URLParam(r, "jellyfinId")
	imageType := chi.URLParam(r, "imageType")

	if itemType != "movies" && itemType != "shows" {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid item type"))
		return
	}
	if jellyfinID == "" {
		handleError(w, r, errors.New(errors.CodeValidationError, "Jellyfin ID is required"))
		return
	}
	if imageType != "poster" && imageType != "backdrop" {
		handleError(w, r, errors.New(errors.CodeValidationError, "Invalid image type"))
		return
	}

	localPath, err := h.imageService.GetLocalImageFile(itemType, jellyfinID, imageType)
	if err == nil {
		h.serveLocalImage(w, r, localPath)
		return
	}

	var jellyfinURL string
	var tableName string
	var columnName string
	var deletedFromJellyfin sql.NullInt64

	if itemType == "movies" {
		tableName = "movies"
		columnName = "poster_url"
	} else {
		tableName = "shows"
		columnName = "poster_url"
	}

	query := "SELECT " + columnName + ", deleted_from_jellyfin FROM " + tableName + " WHERE jellyfin_id = ? LIMIT 1"
	err = h.db.QueryRowContext(r.Context(), query, jellyfinID).Scan(&jellyfinURL, &deletedFromJellyfin)
	if err != nil {
		query = "SELECT " + columnName + " FROM " + tableName + " WHERE jellyfin_id = ? LIMIT 1"
		err = h.db.QueryRowContext(r.Context(), query, jellyfinID).Scan(&jellyfinURL)
		if err != nil {
			if err == sql.ErrNoRows {
				handleError(w, r, errors.New(errors.CodeNotFound, "Item not found"))
				return
			}
			handleError(w, r, errors.Wrap(err, errors.CodeDatabaseError, "Failed to get image URL"))
			return
		}
		deletedFromJellyfin = sql.NullInt64{}
	}

	var jellyfinToken string
	_ = h.db.QueryRowContext(r.Context(),
		"SELECT u.jellyfin_access_token FROM users u JOIN "+tableName+" m ON m.user_id = u.id WHERE m.jellyfin_id = ? AND u.jellyfin_access_token IS NOT NULL AND u.jellyfin_access_token != '' LIMIT 1",
		jellyfinID).Scan(&jellyfinToken)

	if jellyfinURL == "" {
		handleError(w, r, errors.New(errors.CodeNotFound, "Image URL not available"))
		return
	}

	if deletedFromJellyfin.Valid && deletedFromJellyfin.Int64 == 1 {
		log.Debug().
			Str("jellyfin_id", jellyfinID).
			Str("item_type", itemType).
			Msg("Item deleted from Jellyfin and no local cache - image unavailable")
		http.NotFound(w, r)
		return
	}

	h.proxyImage(w, r, jellyfinURL, jellyfinToken)
}

func (h *ImagesHandler) serveLocalImage(w http.ResponseWriter, r *http.Request, filePath string) {
	file, err := os.Open(filePath)
	if err != nil {
		log.Warn().Err(err).Str("path", filePath).Msg("Failed to open local image")
		http.NotFound(w, r)
		return
	}
	defer file.Close()

	fileInfo, err := file.Stat()
	if err != nil {
		log.Warn().Err(err).Str("path", filePath).Msg("Failed to stat local image")
		http.NotFound(w, r)
		return
	}

	ext := strings.ToLower(filepath.Ext(filePath))
	contentType := "image/jpeg"
	switch ext {
	case ".png":
		contentType = "image/png"
	case ".webp":
		contentType = "image/webp"
	case ".gif":
		contentType = "image/gif"
	}

	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Cache-Control", "public, max-age=86400")
	http.ServeContent(w, r, filepath.Base(filePath), fileInfo.ModTime(), file)
}

func (h *ImagesHandler) proxyImage(w http.ResponseWriter, r *http.Request, imageURL string, jellyfinToken string) {
	if err := jellyfin.WaitForImageRequest(r.Context()); err != nil {
		if err == context.Canceled {
			return
		}
		log.Warn().Err(err).Msg("Image proxy rate limit wait failed")
		http.Error(w, "Service temporarily unavailable", http.StatusServiceUnavailable)
		return
	}
	req, err := http.NewRequestWithContext(r.Context(), "GET", imageURL, nil)
	if err != nil {
		log.Warn().Err(err).Str("url", imageURL).Msg("Failed to create proxy request")
		http.Error(w, "Failed to proxy image", http.StatusInternalServerError)
		return
	}

	if jellyfinToken != "" {
		req.Header.Set("X-Emby-Token", jellyfinToken)
		req.Header.Set("X-Emby-Authorization", `MediaBrowser Client="Jellytics", Device="Server", DeviceId="jellytics-server", Version="1.0.0", Token="`+jellyfinToken+`"`)
	}
	if accept := r.Header.Get("Accept"); accept != "" {
		req.Header.Set("Accept", accept)
	}

	resp, err := h.client.Do(req)
	if err != nil {
		log.Warn().Err(err).Str("url", imageURL).Msg("Failed to fetch image from Jellyfin")
		http.Error(w, "Failed to fetch image", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Debug().
			Int("status", resp.StatusCode).
			Str("url", imageURL).
			Msg("Jellyfin returned non-200 status for image")
		http.Error(w, "Image not available", resp.StatusCode)
		return
	}

	if contentType := resp.Header.Get("Content-Type"); contentType != "" {
		w.Header().Set("Content-Type", contentType)
	}
	if contentLength := resp.Header.Get("Content-Length"); contentLength != "" {
		w.Header().Set("Content-Length", contentLength)
	}
	w.Header().Set("Cache-Control", "public, max-age=3600")

	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body)
}

func (h *ImagesHandler) RegisterRoutes(r chi.Router) {
	r.Get("/{type}/{jellyfinId}/{imageType}", h.GetImage)
}
