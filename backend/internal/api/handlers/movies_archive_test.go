package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"jellytics/backend/internal/api/middleware"
	"jellytics/backend/internal/database"
)

// TestListMoviesArchivedParam drives the real HTTP handler to confirm the
// ?archived= query param flows through to the SQL filter and that archived
// items are visible by default.
func TestListMoviesArchivedParam(t *testing.T) {
	db, err := database.Initialize(filepath.Join(t.TempDir(), "h.db"))
	if err != nil {
		t.Fatalf("Initialize: %v", err)
	}
	t.Cleanup(func() { database.Close(db) })

	if _, err := db.Exec(
		`INSERT INTO users (id, username, jellyfin_user_id, jellyfin_server_url) VALUES (1,'a','jf','http://jf')`); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	if _, err := db.Exec(
		`INSERT INTO movies (jellyfin_id,title,overview,poster_url,backdrop_url,imdb_id,tmdb_id,genre,user_id,status,deleted_from_jellyfin,archived_at)
		 VALUES ('live','Live','','','','','','[]',1,'pending',0,NULL),
		        ('gone','Gone','','','','','','[]',1,'pending',1,'2025-01-01 00:00:00')`); err != nil {
		t.Fatalf("seed movies: %v", err)
	}

	h := NewMoviesHandlerWithDB(db, t.TempDir())

	titles := func(archived string) []string {
		url := "/movies?limit=50"
		if archived != "" {
			url += "&archived=" + archived
		}
		req := httptest.NewRequest(http.MethodGet, url, nil)
		req = req.WithContext(context.WithValue(req.Context(), middleware.UserIDKey, 1))
		rec := httptest.NewRecorder()
		h.ListMovies(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("archived=%q status=%d body=%s", archived, rec.Code, rec.Body.String())
		}
		var resp struct {
			Movies []struct {
				Title               string `json:"title"`
				DeletedFromJellyfin bool   `json:"deleted_from_jellyfin"`
				ArchivedAt          string `json:"archived_at"`
			} `json:"movies"`
			Total int `json:"total"`
		}
		if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
			t.Fatalf("decode: %v", err)
		}
		if resp.Total != len(resp.Movies) {
			t.Errorf("archived=%q total=%d but %d movies", archived, resp.Total, len(resp.Movies))
		}
		out := make([]string, len(resp.Movies))
		for i, m := range resp.Movies {
			out[i] = m.Title
			// The archived item must carry the flag + timestamp for badging.
			if m.Title == "Gone" && (!m.DeletedFromJellyfin || m.ArchivedAt == "") {
				t.Errorf("archived movie missing flag/timestamp: flag=%v at=%q", m.DeletedFromJellyfin, m.ArchivedAt)
			}
		}
		return out
	}

	if got := titles(""); len(got) != 2 {
		t.Errorf("default should return both movies, got %v", got)
	}
	if got := titles("only"); len(got) != 1 || got[0] != "Gone" {
		t.Errorf("archived=only should return [Gone], got %v", got)
	}
	if got := titles("active"); len(got) != 1 || got[0] != "Live" {
		t.Errorf("archived=active should return [Live], got %v", got)
	}
}
