package services

import (
	"context"
	"testing"

	"jellytics/backend/internal/jellyfin"
)

// fakeJF is a minimal jellyfin.API for exercising the sync upsert paths without
// a network. syncMovie/syncShow only need BaseURL(); GetEpisodesForSeries is hit
// by syncShow when no episodes are pre-fetched and returns an empty set.
type fakeJF struct{ base string }

func (f fakeJF) BaseURL() string { return f.base }
func (f fakeJF) Authenticate(context.Context, string, string) (*jellyfin.AuthResponse, error) {
	return nil, nil
}
func (f fakeJF) GetUserItems(context.Context, string, string, string) (*jellyfin.ItemsResponse, error) {
	return &jellyfin.ItemsResponse{}, nil
}
func (f fakeJF) GetUserItemsWithFields(context.Context, string, string, string, string) (*jellyfin.ItemsResponse, error) {
	return &jellyfin.ItemsResponse{}, nil
}
func (f fakeJF) GetEpisodesForSeries(context.Context, string, string) (*jellyfin.ItemsResponse, error) {
	return &jellyfin.ItemsResponse{}, nil
}
func (f fakeJF) GetSessions(context.Context, string) (*jellyfin.SessionsResponse, error) {
	return &jellyfin.SessionsResponse{}, nil
}

func seedSyncUser(t *testing.T, svc *SyncService) {
	t.Helper()
	if _, err := svc.db.Exec(
		`INSERT INTO users (id, username, jellyfin_user_id, jellyfin_server_url) VALUES (1,'a','jf','http://jf')`); err != nil {
		t.Fatalf("seed user: %v", err)
	}
}

// TestSyncMovieUpsertIdempotent runs the real movie upsert twice for the same
// Jellyfin id and asserts exactly one row exists, updated in place.
func TestSyncMovieUpsertIdempotent(t *testing.T) {
	db := syncTestDB(t)
	svc := NewSyncService(db)
	seedSyncUser(t, svc)
	ctx := context.Background()
	jf := fakeJF{base: "http://jf"}

	item := jellyfin.Item{Id: "mv1", Name: "Movie One"}
	if err := svc.syncMovie(ctx, 1, item, jf, "hash1"); err != nil {
		t.Fatalf("first syncMovie: %v", err)
	}
	item.Name = "Movie One (updated)"
	if err := svc.syncMovie(ctx, 1, item, jf, "hash2"); err != nil {
		t.Fatalf("second syncMovie: %v", err)
	}

	var count int
	var title, hash string
	if err := db.QueryRow(
		`SELECT COUNT(*), MAX(title), MAX(sync_hash) FROM movies WHERE jellyfin_id='mv1' AND user_id=1`).
		Scan(&count, &title, &hash); err != nil {
		t.Fatalf("query: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected exactly 1 movie row, got %d", count)
	}
	if title != "Movie One (updated)" || hash != "hash2" {
		t.Errorf("upsert should update in place: title=%q hash=%q", title, hash)
	}
}

// TestSyncShowUpsertIdempotent runs the real show upsert twice and asserts one
// row exists, updated in place.
func TestSyncShowUpsertIdempotent(t *testing.T) {
	db := syncTestDB(t)
	svc := NewSyncService(db)
	seedSyncUser(t, svc)
	ctx := context.Background()
	jf := fakeJF{base: "http://jf"}
	noEpisodes := map[string][]jellyfin.Item{}

	item := jellyfin.Item{Id: "sh1", Name: "Show One"}
	if err := svc.syncShow(ctx, 1, "jf", item, jf, "tok", "h1", noEpisodes); err != nil {
		t.Fatalf("first syncShow: %v", err)
	}
	item.Name = "Show One (updated)"
	if err := svc.syncShow(ctx, 1, "jf", item, jf, "tok", "h2", noEpisodes); err != nil {
		t.Fatalf("second syncShow: %v", err)
	}

	var count int
	var title, hash string
	if err := db.QueryRow(
		`SELECT COUNT(*), MAX(title), MAX(sync_hash) FROM shows WHERE jellyfin_id='sh1' AND user_id=1`).
		Scan(&count, &title, &hash); err != nil {
		t.Fatalf("query: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected exactly 1 show row, got %d", count)
	}
	if title != "Show One (updated)" || hash != "h2" {
		t.Errorf("upsert should update in place: title=%q hash=%q", title, hash)
	}
}
