package database

import (
	"path/filepath"
	"testing"
)

// TestInitializeRunsMigrations verifies that Initialize applies the goose
// migrations against a fresh database, creating the expected schema and
// recording the migration version.
func TestInitializeRunsMigrations(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "test.db")

	db, err := Initialize(dbPath)
	if err != nil {
		t.Fatalf("Initialize failed: %v", err)
	}
	defer Close(db)

	// goose must have recorded at least the baseline migration.
	var version int64
	if err := db.QueryRow("SELECT MAX(version_id) FROM goose_db_version").Scan(&version); err != nil {
		t.Fatalf("failed to read goose_db_version: %v", err)
	}
	if version < 1 {
		t.Fatalf("expected migration version >= 1, got %d", version)
	}

	// Spot-check that core tables exist.
	for _, table := range []string{"users", "shows", "movies", "watch_history", "watchlist", "system_settings"} {
		var name string
		err := db.QueryRow(
			"SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", table,
		).Scan(&name)
		if err != nil {
			t.Errorf("expected table %q to exist: %v", table, err)
		}
	}

	// Default system settings should be seeded by the baseline migration.
	var count int
	if err := db.QueryRow("SELECT COUNT(*) FROM system_settings").Scan(&count); err != nil {
		t.Fatalf("failed to count system_settings: %v", err)
	}
	if count == 0 {
		t.Error("expected default system_settings to be seeded")
	}
}

// TestInitializeIsIdempotent verifies that running Initialize twice against the
// same database (simulating a restart) succeeds without error.
func TestInitializeIsIdempotent(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "test.db")

	db, err := Initialize(dbPath)
	if err != nil {
		t.Fatalf("first Initialize failed: %v", err)
	}
	Close(db)

	db, err = Initialize(dbPath)
	if err != nil {
		t.Fatalf("second Initialize failed: %v", err)
	}
	Close(db)
}
