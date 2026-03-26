package database

import (
	"database/sql"
	"fmt"
)

// Close closes the database connection if non-nil, returning any error with context.
func Close(db *sql.DB) error {
	if db == nil {
		return nil
	}
	if err := db.Close(); err != nil {
		return fmt.Errorf("close database: %w", err)
	}
	return nil
}
