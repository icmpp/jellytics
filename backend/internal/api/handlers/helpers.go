// Package handlers implements HTTP handlers for auth, media, sync, settings, and other API endpoints.
package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	apiMiddleware "jellytics/backend/internal/api/middleware"
	"jellytics/backend/internal/errors"
	"jellytics/backend/internal/repository"
)

const (
	defaultPageLimit = 50
	maxPageLimit     = 100
)

func handleError(w http.ResponseWriter, r *http.Request, err error) {
	apiMiddleware.HandleError(w, r, err)
}

// writeJSON encodes v as JSON, sets Content-Type, and writes to w. Returns false on error (after calling handleError).
func writeJSON(w http.ResponseWriter, r *http.Request, v interface{}) bool {
	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(v); err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeInternalError, "Failed to encode response"))
		return false
	}
	w.Header().Set("Content-Type", "application/json")
	if _, err := w.Write(buf.Bytes()); err != nil {
		handleError(w, r, errors.Wrap(err, errors.CodeInternalError, "Failed to write response"))
		return false
	}
	return true
}

func parsePagination(r *http.Request) (limit, offset int) {
	limit = defaultPageLimit
	if l, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && l > 0 {
		limit = l
		if limit > maxPageLimit {
			limit = maxPageLimit
		}
	}
	if o, err := strconv.Atoi(r.URL.Query().Get("offset")); err == nil && o >= 0 {
		offset = o
	}
	return
}

// parseTagIDs parses comma-separated tag IDs from a query param.
func parseTagIDs(s string) []int {
	if s == "" {
		return nil
	}
	var ids []int
	for _, part := range strings.Split(s, ",") {
		if id, err := strconv.Atoi(strings.TrimSpace(part)); err == nil && id > 0 {
			ids = append(ids, id)
		}
	}
	return ids
}

// verifyItemExists checks that the item exists and belongs to the user via MediaStore.
func verifyItemExists(ctx context.Context, store repository.MediaStore, w http.ResponseWriter, r *http.Request, itemType string, itemID, userID int) bool {
	exists, err := store.Exists(ctx, itemType, itemID, userID)
	if err != nil {
		handleError(w, r, err)
		return false
	}
	if !exists {
		handleError(w, r, errors.New(errors.CodeNotFound, "Item not found"))
		return false
	}
	return true
}
