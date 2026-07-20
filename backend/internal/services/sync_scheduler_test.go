package services

import (
	"context"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"

	"jellytics/backend/internal/database"
)

// TestSchedulerReloadsSystemSettings confirms the scheduler picks up the
// System-card sync settings (interval, sessions interval, worker pool, and the
// enable toggle) when reloaded — the "consolidate on system settings" contract.
func TestSchedulerReloadsSystemSettings(t *testing.T) {
	db, err := database.Initialize(filepath.Join(t.TempDir(), "sched.db"))
	if err != nil {
		t.Fatalf("Initialize: %v", err)
	}
	t.Cleanup(func() { database.Close(db) })

	updates := map[string]string{
		"sync_interval_seconds":          "1234",
		"sessions_sync_interval_seconds": "77",
		"sync_worker_pool_size":          "9",
		"sync_enabled":                   "false",
	}
	for k, v := range updates {
		if _, err := db.Exec(`UPDATE system_settings SET value = ? WHERE key = ?`, v, k); err != nil {
			t.Fatalf("set %s: %v", k, err)
		}
	}

	sch := NewSyncScheduler(db, 5*time.Minute, 5)
	sch.UpdateIntervalsWithSignal(context.Background(), false)

	sch.mu.RLock()
	defer sch.mu.RUnlock()
	if sch.interval != 1234*time.Second {
		t.Errorf("interval = %v, want 1234s", sch.interval)
	}
	if sch.sessionsInterval != 77*time.Second {
		t.Errorf("sessionsInterval = %v, want 77s", sch.sessionsInterval)
	}
	if sch.workerPoolSize != 9 {
		t.Errorf("workerPoolSize = %d, want 9 (must live-reload from system settings)", sch.workerPoolSize)
	}
	if sch.fullSyncEnabled {
		t.Error("fullSyncEnabled should be false after disabling sync_enabled")
	}
}

// TestSyncAllUsersRespectsDisabled proves the full sync cycle is skipped when
// background sync is disabled. The user has a valid token pointing at a live
// test server, so an *ungated* scheduler would make Jellyfin requests; a gated
// one must make none. (Before the fix, syncAllUsers ignored the enable flag.)
func TestSyncAllUsersRespectsDisabled(t *testing.T) {
	db, err := database.Initialize(filepath.Join(t.TempDir(), "sched2.db"))
	if err != nil {
		t.Fatalf("Initialize: %v", err)
	}
	t.Cleanup(func() { database.Close(db) })

	var hits int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		atomic.AddInt32(&hits, 1)
		_, _ = w.Write([]byte(`{"Items":[]}`))
	}))
	defer srv.Close()

	if _, err := db.Exec(
		`INSERT INTO users (id, username, jellyfin_user_id, jellyfin_server_url, jellyfin_access_token, jellyfin_token_valid)
		 VALUES (1,'a','jf',?, 'tok', 1)`, srv.URL); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	if _, err := db.Exec(`UPDATE system_settings SET value = 'false' WHERE key = 'sync_enabled'`); err != nil {
		t.Fatalf("disable sync: %v", err)
	}

	sch := NewSyncScheduler(db, 5*time.Minute, 5)
	sch.UpdateIntervalsWithSignal(context.Background(), false)
	sch.syncAllUsers(context.Background())

	if n := atomic.LoadInt32(&hits); n != 0 {
		t.Errorf("disabled scheduler made %d Jellyfin request(s); should make none", n)
	}
}
