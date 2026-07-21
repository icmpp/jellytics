package database

import (
	"database/sql"
	"path/filepath"
	"strings"
	"testing"
)

// TestMediaUniquenessEnforced is the core guarantee: after migrations, the DB
// permits only one row per (jellyfin_id, user_id) movie/show and per episode key.
func TestMediaUniquenessEnforced(t *testing.T) {
	db, err := Initialize(filepath.Join(t.TempDir(), "uniq.db"))
	if err != nil {
		t.Fatalf("Initialize: %v", err)
	}
	defer Close(db)

	if _, err := db.Exec(`INSERT INTO users (id, username, jellyfin_user_id, jellyfin_server_url) VALUES (1,'a','jf','http://jf')`); err != nil {
		t.Fatalf("seed user: %v", err)
	}

	mustExec(t, db, `INSERT INTO movies (jellyfin_id,title,user_id,status) VALUES ('mv','M',1,'pending')`)
	if _, err := db.Exec(`INSERT INTO movies (jellyfin_id,title,user_id,status) VALUES ('mv','M2',1,'pending')`); err == nil {
		t.Error("duplicate movie (jellyfin_id, user_id) should be rejected")
	}

	mustExec(t, db, `INSERT INTO shows (jellyfin_id,title,user_id,status) VALUES ('sh','S',1,'watching')`)
	if _, err := db.Exec(`INSERT INTO shows (jellyfin_id,title,user_id,status) VALUES ('sh','S2',1,'watching')`); err == nil {
		t.Error("duplicate show (jellyfin_id, user_id) should be rejected")
	}

	var showID int
	if err := db.QueryRow(`SELECT id FROM shows WHERE jellyfin_id='sh'`).Scan(&showID); err != nil {
		t.Fatalf("get show id: %v", err)
	}
	mustExec(t, db, `INSERT INTO episodes (show_id,jellyfin_id,episode_number,season_number) VALUES (?,'ep',1,1)`, showID)
	if _, err := db.Exec(`INSERT INTO episodes (show_id,jellyfin_id,episode_number,season_number) VALUES (?,'ep',2,1)`, showID); err == nil {
		t.Error("duplicate episode (jellyfin_id, show_id) should be rejected")
	}
	if _, err := db.Exec(`INSERT INTO episodes (show_id,jellyfin_id,episode_number,season_number) VALUES (?,'ep2',1,1)`, showID); err == nil {
		t.Error("duplicate episode (show_id, season, episode) should be rejected")
	}

	for _, idx := range []string{
		"ux_movies_jellyfin_user", "ux_shows_jellyfin_user",
		"ux_episodes_jellyfin_show", "ux_episodes_show_season_ep",
	} {
		var n int
		if err := db.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name=?`, idx).Scan(&n); err != nil || n != 1 {
			t.Errorf("expected unique index %s to exist (n=%d err=%v)", idx, n, err)
		}
	}
}

// TestDedupeMigrationRepairsLegacyDuplicates runs migration 00004's Up SQL
// against a constraint-less schema seeded with duplicate movies — the legacy
// scenario the migration exists to repair — and asserts the survivor is kept,
// watch history is re-pointed, and the unique index becomes creatable.
func TestDedupeMigrationRepairsLegacyDuplicates(t *testing.T) {
	db, err := sql.Open("sqlite", filepath.Join(t.TempDir(), "legacy.db")+"?_pragma=foreign_keys(0)")
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	defer db.Close()

	// Constraint-less tables (as a pre-goose install would have had them).
	for _, ddl := range []string{
		`CREATE TABLE movies (id INTEGER PRIMARY KEY AUTOINCREMENT, jellyfin_id TEXT, user_id INTEGER, title TEXT)`,
		`CREATE TABLE shows (id INTEGER PRIMARY KEY AUTOINCREMENT, jellyfin_id TEXT, user_id INTEGER)`,
		`CREATE TABLE episodes (id INTEGER PRIMARY KEY AUTOINCREMENT, jellyfin_id TEXT, show_id INTEGER, season_number INTEGER, episode_number INTEGER)`,
		`CREATE TABLE watch_history (id INTEGER PRIMARY KEY AUTOINCREMENT, movie_id INTEGER, show_id INTEGER, episode_id INTEGER)`,
	} {
		mustExec(t, db, ddl)
	}

	// Two movie rows for the same Jellyfin item; watch history points at the dup.
	mustExec(t, db, `INSERT INTO movies (id, jellyfin_id, user_id, title) VALUES (1,'mv',1,'Survivor'),(2,'mv',1,'Duplicate')`)
	mustExec(t, db, `INSERT INTO watch_history (movie_id) VALUES (2),(2)`)

	for _, stmt := range migrationUpStatements(t, "migrations/00004_dedupe_media.sql") {
		if _, err := db.Exec(stmt); err != nil {
			t.Fatalf("migration stmt failed: %v\n%s", err, stmt)
		}
	}

	var count, survivorID int
	if err := db.QueryRow(`SELECT COUNT(*), MIN(id) FROM movies`).Scan(&count, &survivorID); err != nil {
		t.Fatalf("count movies: %v", err)
	}
	if count != 1 || survivorID != 1 {
		t.Fatalf("expected 1 surviving movie (id 1), got count=%d survivor=%d", count, survivorID)
	}

	var repointed int
	if err := db.QueryRow(`SELECT COUNT(*) FROM watch_history WHERE movie_id = 1`).Scan(&repointed); err != nil {
		t.Fatalf("count watch_history: %v", err)
	}
	if repointed != 2 {
		t.Errorf("watch history should be re-pointed to survivor: %d/2 rows point at id 1", repointed)
	}

	// The unique index now exists and rejects a fresh duplicate.
	if _, err := db.Exec(`INSERT INTO movies (jellyfin_id, user_id, title) VALUES ('mv',1,'New dup')`); err == nil {
		t.Error("after repair, duplicate movie insert should be rejected by the unique index")
	}
}

func mustExec(t *testing.T, db *sql.DB, query string, args ...interface{}) {
	t.Helper()
	if _, err := db.Exec(query, args...); err != nil {
		t.Fatalf("exec %q: %v", query, err)
	}
}

// migrationUpStatements reads a goose migration file and returns the Up-section
// statements (everything before "-- +goose Down"), split on ";".
func migrationUpStatements(t *testing.T, path string) []string {
	t.Helper()
	raw, err := migrationsFS.ReadFile(path)
	if err != nil {
		t.Fatalf("read migration %s: %v", path, err)
	}
	up := string(raw)
	if i := strings.Index(up, "-- +goose Down"); i >= 0 {
		up = up[:i]
	}
	// Strip comments before splitting so a ";" inside a comment can't break a
	// statement boundary (goose's own parser does the same).
	up = stripSQLComments(up)
	var out []string
	for _, chunk := range strings.Split(up, ";") {
		if strings.TrimSpace(chunk) != "" {
			out = append(out, chunk)
		}
	}
	return out
}

func stripSQLComments(s string) string {
	var b strings.Builder
	for _, line := range strings.Split(s, "\n") {
		if strings.HasPrefix(strings.TrimSpace(line), "--") {
			continue
		}
		b.WriteString(line)
		b.WriteString("\n")
	}
	return b.String()
}
