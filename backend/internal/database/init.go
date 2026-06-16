// Package database provides SQLite initialization, migrations, and connection management.
package database

import (
	"database/sql"
	"embed"
	"fmt"

	_ "github.com/mattn/go-sqlite3"
	"github.com/pressly/goose/v3"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

// Initialize opens the SQLite database at path with WAL mode, foreign keys, and 30s busy timeout.
func Initialize(path string) (*sql.DB, error) {
	db, err := sql.Open("sqlite3", path+"?_foreign_keys=1&_journal_mode=WAL&_busy_timeout=30000")
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	db.SetMaxOpenConns(5)
	db.SetMaxIdleConns(2)
	db.SetConnMaxLifetime(0)

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	for _, pragma := range []string{
		"PRAGMA cache_size = -64000",   // 64MB page cache
		"PRAGMA temp_store = MEMORY",   // temp tables in RAM
		"PRAGMA mmap_size = 268435456", // 256MB memory-mapped I/O
	} {
		if _, err := db.Exec(pragma); err != nil {
			return nil, fmt.Errorf("failed to set %s: %w", pragma, err)
		}
	}

	if err := runMigrations(db); err != nil {
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	return db, nil
}

// runMigrations applies all pending goose migrations from the embedded
// migrations/ directory. It fails loud: any migration error is returned and
// aborts startup, so schema drift can never go unnoticed.
func runMigrations(db *sql.DB) error {
	goose.SetBaseFS(migrationsFS)
	goose.SetLogger(goose.NopLogger())

	if err := goose.SetDialect("sqlite3"); err != nil {
		return fmt.Errorf("failed to set goose dialect: %w", err)
	}

	if err := goose.Up(db, "migrations"); err != nil {
		return fmt.Errorf("failed to apply migrations: %w", err)
	}

	return nil
}
