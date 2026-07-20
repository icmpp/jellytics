package database

import (
	"database/sql"
	"path/filepath"
	"testing"

	"github.com/pressly/goose/v3"
)

// TestArchivedAtBackfill verifies migration 00003 backfills archived_at from
// updated_at for rows already flagged deleted_from_jellyfin before the upgrade.
func TestArchivedAtBackfill(t *testing.T) {
	db, err := sql.Open("sqlite", filepath.Join(t.TempDir(), "bf.db")+"?_pragma=foreign_keys(1)&_time_format=sqlite")
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	defer db.Close()

	goose.SetBaseFS(migrationsFS)
	goose.SetLogger(goose.NopLogger())
	if err := goose.SetDialect("sqlite3"); err != nil {
		t.Fatalf("dialect: %v", err)
	}

	// Migrate up to just before the archive migration.
	if err := goose.UpTo(db, "migrations", 2); err != nil {
		t.Fatalf("UpTo(2): %v", err)
	}

	if _, err := db.Exec(
		`INSERT INTO users (id, username, jellyfin_user_id, jellyfin_server_url) VALUES (1, 'a', 'jf', 'http://jf')`); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	// An already-archived movie (pre-migration) with a known updated_at, and a
	// live movie that must remain un-backfilled.
	if _, err := db.Exec(
		`INSERT INTO movies (jellyfin_id,title,overview,poster_url,backdrop_url,imdb_id,tmdb_id,genre,user_id,status,deleted_from_jellyfin,updated_at)
		 VALUES ('gone','Gone','','','','','','[]',1,'pending',1,'2020-01-02 03:04:05'),
		        ('live','Live','','','','','','[]',1,'pending',0,'2021-06-07 08:09:10')`); err != nil {
		t.Fatalf("seed movies: %v", err)
	}

	// Apply the archive migration (backfill runs here).
	if err := goose.UpTo(db, "migrations", 3); err != nil {
		t.Fatalf("UpTo(3): %v", err)
	}

	// Compare archived_at to updated_at as the driver returns them (it
	// normalizes DATETIME text on read), asserting the backfill copied the value.
	var goneArchivedAt, goneUpdatedAt sql.NullString
	if err := db.QueryRow(`SELECT archived_at, updated_at FROM movies WHERE jellyfin_id='gone'`).Scan(&goneArchivedAt, &goneUpdatedAt); err != nil {
		t.Fatalf("read gone row: %v", err)
	}
	if !goneArchivedAt.Valid || goneArchivedAt.String != goneUpdatedAt.String {
		t.Errorf("archived movie should backfill archived_at from updated_at: archived=%v updated=%v", goneArchivedAt, goneUpdatedAt)
	}

	var liveArchivedAt sql.NullString
	if err := db.QueryRow(`SELECT archived_at FROM movies WHERE jellyfin_id='live'`).Scan(&liveArchivedAt); err != nil {
		t.Fatalf("read live archived_at: %v", err)
	}
	if liveArchivedAt.Valid {
		t.Errorf("non-archived movie must keep archived_at NULL, got %q", liveArchivedAt.String)
	}
}
