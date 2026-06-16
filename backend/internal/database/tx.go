package database

import (
	"context"
	"database/sql"
	"fmt"
)

// WithTx runs fn inside a database transaction. The transaction is committed if
// fn returns nil, and rolled back if fn returns an error or panics. All database
// operations inside fn MUST use the provided *sql.Tx so they share the same
// atomic unit of work.
//
// Use this for any operation that performs more than one dependent write, or a
// read-then-write that must observe a consistent snapshot (e.g. upserts and
// ownership-checked inserts). SQLite serialises writers, so a read-then-write
// inside a single tx cannot interleave with another transaction's write.
func WithTx(ctx context.Context, db *sql.DB, fn func(*sql.Tx) error) (err error) {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}

	defer func() {
		if p := recover(); p != nil {
			_ = tx.Rollback()
			panic(p)
		}
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	if err = fn(tx); err != nil {
		return err
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}
	return nil
}
