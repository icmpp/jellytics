// Package database provides SQLite initialization, migrations, and connection management.
package database

import (
	"database/sql"
	"embed"
	"fmt"
	"io/fs"
	"strings"

	_ "github.com/mattn/go-sqlite3"
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

func runMigrations(db *sql.DB) error {
	schemaSQL, err := migrationsFS.ReadFile("migrations/schema.sql")
	if err != nil {
		return fmt.Errorf("failed to read schema: %w", err)
	}

	statements := splitStatements(string(schemaSQL))
	for _, stmt := range statements {
		if stmt == "" {
			continue
		}
		if _, err := db.Exec(stmt); err != nil {
			errStr := err.Error()
			if strings.Contains(errStr, "duplicate column name") ||
				strings.Contains(errStr, "already exists") ||
				strings.Contains(errStr, "UNIQUE constraint failed") {
				continue
			}
			fmt.Printf("Warning: schema statement had unexpected error: %v\nStatement: %.120s\n", err, stmt)
		}
	}

	return nil
}

func splitStatements(sql string) []string {
	var statements []string
	var current strings.Builder
	depth := 0

	for _, line := range strings.Split(sql, "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "--") {
			continue
		}
		current.WriteString(line)
		current.WriteByte('\n')

		if trimmed == "BEGIN" {
			depth++
		}
		if trimmed == "END" || trimmed == "END;" {
			depth--
		}

		if strings.HasSuffix(trimmed, ";") && depth == 0 {
			stmt := strings.TrimSpace(current.String())
			if stmt != "" && stmt != ";" {
				statements = append(statements, stmt)
			}
			current.Reset()
		}
	}

	if stmt := strings.TrimSpace(current.String()); stmt != "" {
		statements = append(statements, stmt)
	}

	return statements
}

func GetMigrations() ([]fs.DirEntry, error) {
	return migrationsFS.ReadDir("migrations")
}
