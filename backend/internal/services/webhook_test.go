package services

import (
	"context"
	"database/sql"
	"encoding/json"
	"path/filepath"
	"testing"

	"jellytics/backend/internal/database"
)

func webhookTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := database.Initialize(filepath.Join(t.TempDir(), "wh.db"))
	if err != nil {
		t.Fatalf("Initialize: %v", err)
	}
	t.Cleanup(func() { database.Close(db) })
	return db
}

func newWebhookService(db *sql.DB) *WebhookService {
	return NewWebhookService(db, NewSystemSettingsService(db))
}

func countWatchHistory(t *testing.T, db *sql.DB, userID int) int {
	t.Helper()
	var n int
	if err := db.QueryRow("SELECT COUNT(*) FROM watch_history WHERE user_id = ?", userID).Scan(&n); err != nil {
		t.Fatalf("count watch_history: %v", err)
	}
	return n
}

func TestWebhookSecretAndToken(t *testing.T) {
	db := webhookTestDB(t)
	svc := newWebhookService(db)
	ctx := context.Background()

	secret, err := svc.Secret(ctx)
	if err != nil || secret == "" {
		t.Fatalf("Secret: %q err=%v", secret, err)
	}
	// Stable across calls.
	if again, _ := svc.Secret(ctx); again != secret {
		t.Errorf("secret changed between calls: %s vs %s", secret, again)
	}
	if !svc.ValidateToken(ctx, secret) {
		t.Error("valid token rejected")
	}
	if svc.ValidateToken(ctx, "wrong") {
		t.Error("wrong token accepted")
	}
	if svc.ValidateToken(ctx, "") {
		t.Error("empty token accepted")
	}
	// Regenerate invalidates the old secret.
	rotated, err := svc.Regenerate(ctx)
	if err != nil || rotated == secret {
		t.Fatalf("Regenerate: %q err=%v", rotated, err)
	}
	if svc.ValidateToken(ctx, secret) {
		t.Error("old token still valid after regenerate")
	}
}

func TestWebhookProcessMovie(t *testing.T) {
	db := webhookTestDB(t)
	svc := newWebhookService(db)
	ctx := context.Background()

	db.Exec(`INSERT INTO users (id, username, jellyfin_user_id, jellyfin_server_url) VALUES (1, 'a', 'jf-user', 'http://jf')`)
	db.Exec(`INSERT INTO movies (id, jellyfin_id, title, overview, poster_url, genre, user_id, status) VALUES (1, 'mov-1', 'Movie', '', '', '[]', 1, 'pending')`)

	ev := WebhookEvent{
		NotificationType:      "PlaybackStop",
		UserID:                "jf-user",
		ItemID:                "mov-1",
		ItemType:              "Movie",
		RunTimeTicks:          600_000_000 * 100, // 100 minutes
		PlaybackPositionTicks: 600_000_000 * 100,
		PlayedToCompletion:    true,
	}

	res, err := svc.Process(ctx, ev)
	if err != nil {
		t.Fatalf("Process: %v", err)
	}
	if res.Status != "processed" {
		t.Fatalf("expected processed, got %+v", res)
	}
	if n := countWatchHistory(t, db, 1); n != 1 {
		t.Fatalf("expected 1 watch_history row, got %d", n)
	}

	// Movie marked watched, last_watched_at set. (movies.watched is BOOLEAN, which
	// the sqlite driver returns as a Go bool.)
	var watched bool
	var status string
	var last sql.NullString
	if err := db.QueryRow("SELECT watched, status, last_watched_at FROM movies WHERE id = 1").Scan(&watched, &status, &last); err != nil {
		t.Fatalf("scan movie: %v", err)
	}
	if !watched || status != "watched" || !last.Valid {
		t.Errorf("movie not updated: watched=%v status=%s last=%v", watched, status, last)
	}

	// Same-day replay must not create a duplicate row.
	if _, err := svc.Process(ctx, ev); err != nil {
		t.Fatalf("replay Process: %v", err)
	}
	if n := countWatchHistory(t, db, 1); n != 1 {
		t.Errorf("dedup failed: expected 1 row after replay, got %d", n)
	}
}

func TestWebhookProcessEpisodeUpdatesShow(t *testing.T) {
	db := webhookTestDB(t)
	svc := newWebhookService(db)
	ctx := context.Background()

	db.Exec(`INSERT INTO users (id, username, jellyfin_user_id, jellyfin_server_url) VALUES (1, 'a', 'jf-user', 'http://jf')`)
	db.Exec(`INSERT INTO shows (id, jellyfin_id, title, overview, poster_url, genre, user_id, status, total_episodes) VALUES (1, 'show-1', 'Show', '', '', '[]', 1, 'pending', 1)`)
	db.Exec(`INSERT INTO episodes (id, show_id, jellyfin_id, title, episode_number, season_number, duration_minutes, watched) VALUES (1, 1, 'ep-1', 'Ep', 1, 1, 30, 0)`)

	ev := WebhookEvent{
		NotificationType:      "PlaybackStop",
		UserID:                "jf-user",
		ItemID:                "ep-1",
		ItemType:              "Episode",
		RunTimeTicks:          600_000_000 * 30,
		PlaybackPositionTicks: 600_000_000 * 30,
		PlayedToCompletion:    true,
	}

	res, err := svc.Process(ctx, ev)
	if err != nil || res.Status != "processed" {
		t.Fatalf("Process: %+v err=%v", res, err)
	}

	var epWatched bool
	if err := db.QueryRow("SELECT watched FROM episodes WHERE id = 1").Scan(&epWatched); err != nil {
		t.Fatalf("scan episode: %v", err)
	}
	if !epWatched {
		t.Error("episode not marked watched")
	}
	// The show-stats trigger should have updated watched_episodes/status.
	var watchedEps int
	var status string
	db.QueryRow("SELECT watched_episodes, status FROM shows WHERE id = 1").Scan(&watchedEps, &status)
	if watchedEps != 1 || status != "watched" {
		t.Errorf("show stats not updated by trigger: watched_episodes=%d status=%s", watchedEps, status)
	}
	if n := countWatchHistory(t, db, 1); n != 1 {
		t.Errorf("expected 1 watch_history row, got %d", n)
	}
}

func TestWebhookSkipsUnknownUserAndItem(t *testing.T) {
	db := webhookTestDB(t)
	svc := newWebhookService(db)
	ctx := context.Background()
	db.Exec(`INSERT INTO users (id, username, jellyfin_user_id, jellyfin_server_url) VALUES (1, 'a', 'jf-user', 'http://jf')`)

	// Unknown user.
	res, err := svc.Process(ctx, WebhookEvent{NotificationType: "PlaybackStop", UserID: "nobody", ItemType: "Movie", ItemID: "x", PlayedToCompletion: true})
	if err != nil || res.Status != "skipped" {
		t.Errorf("unknown user should skip: %+v err=%v", res, err)
	}
	// Known user, unknown movie.
	res, err = svc.Process(ctx, WebhookEvent{NotificationType: "PlaybackStop", UserID: "jf-user", ItemType: "Movie", ItemID: "ghost", PlayedToCompletion: true})
	if err != nil || res.Status != "skipped" {
		t.Errorf("unknown movie should skip: %+v err=%v", res, err)
	}
	// Non-terminal progress event.
	res, err = svc.Process(ctx, WebhookEvent{NotificationType: "PlaybackProgress", UserID: "jf-user", ItemType: "Movie", ItemID: "ghost"})
	if err != nil || res.Status != "skipped" {
		t.Errorf("in-progress event should skip: %+v err=%v", res, err)
	}
}

func TestWebhookEventFlexibleJSON(t *testing.T) {
	// Jellyfin templates often render all values as quoted strings.
	raw := `{"NotificationType":"PlaybackStop","UserId":"u","ItemId":"i","ItemType":"Movie",
		"RunTimeTicks":"60000000000","PlaybackPositionTicks":"60000000000","PlayedToCompletion":"True"}`
	var ev WebhookEvent
	if err := json.Unmarshal([]byte(raw), &ev); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if ev.RunTimeTicks != 60000000000 {
		t.Errorf("RunTimeTicks = %d, want 60000000000", ev.RunTimeTicks)
	}
	if !bool(ev.PlayedToCompletion) {
		t.Error("PlayedToCompletion should parse 'True' as true")
	}
}
