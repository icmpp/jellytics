package services

import (
	"context"
	"database/sql"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"jellytics/backend/internal/jellyfin"

	"github.com/rs/zerolog/log"
)

type ImageService struct {
	db       *sql.DB
	basePath string
	client   *http.Client
}

func NewImageService(db *sql.DB, dataPath string) *ImageService {
	return &ImageService{
		db:       db,
		basePath: filepath.Join(dataPath, "images"),
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (s *ImageService) GetBasePath() string {
	return s.basePath
}

func (s *ImageService) EnsureDirectories() error {
	dirs := []string{
		filepath.Join(s.basePath, "movies"),
		filepath.Join(s.basePath, "shows"),
	}

	for _, dir := range dirs {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("failed to create directory %s: %w", dir, err)
		}
	}

	return nil
}

// isValidPathComponent returns true if s is safe to use as a single path segment.
// It rejects empty strings, path separators, and ".." sequences.
func isValidPathComponent(s string) bool {
	return s != "" && !strings.ContainsAny(s, "/\\") && !strings.Contains(s, "..")
}

func (s *ImageService) GetImagePath(itemType, jellyfinID, imageType string) string {
	return filepath.Join(s.basePath, itemType, jellyfinID, imageType+".jpg")
}

func (s *ImageService) GetRelativeImagePath(itemType, jellyfinID, imageType string) string {
	return filepath.Join("images", itemType, jellyfinID, imageType+".jpg")
}

func (s *ImageService) ImageExists(itemType, jellyfinID, imageType string) bool {
	path := s.GetImagePath(itemType, jellyfinID, imageType)
	_, err := os.Stat(path)
	return err == nil
}

func (s *ImageService) DownloadAndSaveImage(imageURL, itemType, jellyfinID, imageType string) (string, error) {
	return s.DownloadAndSaveImageWithContext(context.Background(), imageURL, itemType, jellyfinID, imageType)
}

func (s *ImageService) DownloadAndSaveImageWithContext(ctx context.Context, imageURL, itemType, jellyfinID, imageType string) (string, error) {
	if !isValidPathComponent(itemType) || !isValidPathComponent(jellyfinID) || !isValidPathComponent(imageType) {
		return "", fmt.Errorf("invalid path component in image request")
	}

	itemDir := filepath.Join(s.basePath, itemType, jellyfinID)
	if err := os.MkdirAll(itemDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create directory: %w", err)
	}

	const maxRetries = 3
	var resp *http.Response
	var err error
	for attempt := 0; attempt < maxRetries; attempt++ {
		if err = jellyfin.WaitForImageRequest(ctx); err != nil {
			return "", fmt.Errorf("rate limit wait: %w", err)
		}
		resp, err = s.client.Get(imageURL)
		if err != nil {
			return "", fmt.Errorf("failed to download image: %w", err)
		}
		if resp.StatusCode == http.StatusOK {
			break
		}
		if resp.StatusCode == 429 && attempt < maxRetries-1 {
			backoff := time.Duration(1<<uint(attempt+1)) * time.Second
			if after := strings.TrimSpace(resp.Header.Get("Retry-After")); after != "" {
				if sec, parseErr := strconv.Atoi(after); parseErr == nil && sec > 0 {
					backoff = time.Duration(sec) * time.Second
				}
			}
			resp.Body.Close()
			log.Debug().
				Str("jellyfin_id", jellyfinID).
				Int("attempt", attempt+1).
				Dur("backoff", backoff).
				Msg("Jellyfin 429, retrying image download")
			select {
			case <-ctx.Done():
				return "", ctx.Err()
			case <-time.After(backoff):
				continue
			}
		}
		resp.Body.Close()
		return "", fmt.Errorf("failed to download image: status %d", resp.StatusCode)
	}
	defer resp.Body.Close()

	ext := ".jpg"
	contentType := resp.Header.Get("Content-Type")
	if strings.Contains(contentType, "png") {
		ext = ".png"
	} else if strings.Contains(contentType, "webp") {
		ext = ".webp"
	} else if strings.Contains(contentType, "gif") {
		ext = ".gif"
	}

	filePath := filepath.Join(itemDir, imageType+ext)
	file, err := os.Create(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to create file: %w", err)
	}
	defer file.Close()

	_, err = io.Copy(file, resp.Body)
	if err != nil {
		os.Remove(filePath)
		return "", fmt.Errorf("failed to write image: %w", err)
	}

	relativePath := filepath.Join("images", itemType, jellyfinID, imageType+ext)
	log.Debug().
		Str("item_type", itemType).
		Str("jellyfin_id", jellyfinID).
		Str("image_type", imageType).
		Str("path", relativePath).
		Msg("Successfully saved image locally")

	return relativePath, nil
}

func (s *ImageService) DeleteItemImages(itemType, jellyfinID string) error {
	if !isValidPathComponent(itemType) || !isValidPathComponent(jellyfinID) {
		return fmt.Errorf("invalid path component in image request")
	}

	itemDir := filepath.Join(s.basePath, itemType, jellyfinID)
	if err := os.RemoveAll(itemDir); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to delete images: %w", err)
	}
	return nil
}

func (s *ImageService) GetLocalImageFile(itemType, jellyfinID, imageType string) (string, error) {
	if !isValidPathComponent(itemType) || !isValidPathComponent(jellyfinID) || !isValidPathComponent(imageType) {
		return "", fmt.Errorf("invalid path component in image request")
	}

	itemDir := filepath.Join(s.basePath, itemType, jellyfinID)

	extensions := []string{".jpg", ".jpeg", ".png", ".webp", ".gif"}
	for _, ext := range extensions {
		path := filepath.Join(itemDir, imageType+ext)
		if _, err := os.Stat(path); err == nil {
			return path, nil
		}
	}

	return "", fmt.Errorf("image not found: %s/%s/%s", itemType, jellyfinID, imageType)
}

func (s *ImageService) CacheImageForWatchedMovie(ctx context.Context, jellyfinID, posterURL string) (posterPath string) {
	if err := s.EnsureDirectories(); err != nil {
		log.Warn().Err(err).Msg("Failed to ensure image directories")
		return ""
	}

	if posterURL != "" && !s.ImageExists("movies", jellyfinID, "poster") {
		path, err := s.DownloadAndSaveImageWithContext(ctx, posterURL, "movies", jellyfinID, "poster")
		if err != nil {
			log.Warn().Err(err).Str("jellyfin_id", jellyfinID).Msg("Failed to cache movie poster")
		} else {
			posterPath = path
		}
	} else if s.ImageExists("movies", jellyfinID, "poster") {
		posterPath = s.GetRelativeImagePath("movies", jellyfinID, "poster")
	}

	return posterPath
}

func (s *ImageService) CacheImageForWatchedShow(ctx context.Context, jellyfinID, posterURL string) (posterPath string) {
	if err := s.EnsureDirectories(); err != nil {
		log.Warn().Err(err).Msg("Failed to ensure image directories")
		return ""
	}

	if posterURL != "" && !s.ImageExists("shows", jellyfinID, "poster") {
		path, err := s.DownloadAndSaveImageWithContext(ctx, posterURL, "shows", jellyfinID, "poster")
		if err != nil {
			log.Warn().Err(err).Str("jellyfin_id", jellyfinID).Msg("Failed to cache show poster")
		} else {
			posterPath = path
		}
	} else if s.ImageExists("shows", jellyfinID, "poster") {
		posterPath = s.GetRelativeImagePath("shows", jellyfinID, "poster")
	}

	return posterPath
}
