package services

import (
	"context"
	"database/sql"
	"path/filepath"
	"testing"

	"jellytics/backend/internal/database"
)

func syncTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := database.Initialize(filepath.Join(t.TempDir(), "sync.db"))
	if err != nil {
		t.Fatalf("Initialize: %v", err)
	}
	t.Cleanup(func() { database.Close(db) })
	return db
}

func seedMovie(t *testing.T, db *sql.DB, userID int, jellyfinID string) int {
	t.Helper()
	res, err := db.Exec(
		`INSERT INTO movies (jellyfin_id, title, overview, poster_url, genre, user_id, status)
		 VALUES (?, ?, '', '', '[]', ?, 'pending')`,
		jellyfinID, "Movie "+jellyfinID, userID)
	if err != nil {
		t.Fatalf("seed movie: %v", err)
	}
	id, _ := res.LastInsertId()
	return int(id)
}

// archiveState reads the archive flag and whether archived_at is set for a movie.
func archiveState(t *testing.T, db *sql.DB, id int) (flagged bool, hasTimestamp bool) {
	t.Helper()
	var flag bool
	var archivedAt sql.NullTime
	if err := db.QueryRow(
		`SELECT deleted_from_jellyfin, archived_at FROM movies WHERE id = ?`, id).Scan(&flag, &archivedAt); err != nil {
		t.Fatalf("read archive state: %v", err)
	}
	return flag, archivedAt.Valid
}

// TestReconcileArchivesAndRestores exercises the full archive lifecycle a sync
// drives: an item missing from Jellyfin gets archived with a timestamp, the
// timestamp survives further syncs while it stays gone, and a reappearance
// clears the archive state.
func TestReconcileArchivesAndRestores(t *testing.T) {
	db := syncTestDB(t)
	ctx := context.Background()
	svc := NewSyncService(db)

	const userID = 1
	if _, err := db.Exec(
		`INSERT INTO users (id, username, jellyfin_user_id, jellyfin_server_url) VALUES (?, 'alice', 'jf-a', 'http://jf')`,
		userID); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	kept := seedMovie(t, db, userID, "keep")
	gone := seedMovie(t, db, userID, "gone")

	// Sync 1: only "keep" is still in Jellyfin. "gone" should be archived.
	svc.markDeletedMovies(ctx, userID, map[string]bool{"keep": true})

	if flag, ts := archiveState(t, db, gone); !flag || !ts {
		t.Fatalf("gone movie should be archived with timestamp: flag=%v ts=%v", flag, ts)
	}
	if flag, _ := archiveState(t, db, kept); flag {
		t.Error("kept movie should not be archived")
	}

	// Capture the archive time, then run another sync with it still missing.
	var firstArchivedAt string
	if err := db.QueryRow(`SELECT archived_at FROM movies WHERE id = ?`, gone).Scan(&firstArchivedAt); err != nil {
		t.Fatalf("read archived_at: %v", err)
	}
	svc.markDeletedMovies(ctx, userID, map[string]bool{"keep": true})
	var secondArchivedAt string
	if err := db.QueryRow(`SELECT archived_at FROM movies WHERE id = ?`, gone).Scan(&secondArchivedAt); err != nil {
		t.Fatalf("read archived_at again: %v", err)
	}
	if firstArchivedAt != secondArchivedAt {
		t.Errorf("archived_at must be stable across syncs: %q -> %q", firstArchivedAt, secondArchivedAt)
	}

	// Sync 3: "gone" reappears in Jellyfin. It should be un-archived.
	svc.markDeletedMovies(ctx, userID, map[string]bool{"keep": true, "gone": true})
	if flag, ts := archiveState(t, db, gone); flag || ts {
		t.Errorf("reappeared movie should be un-archived: flag=%v ts=%v", flag, ts)
	}
}
