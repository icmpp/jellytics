package database

import (
	"context"
	"database/sql"
	"errors"
	"path/filepath"
	"testing"
)

// newTestDB returns an initialised database in a temp dir.
func newTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := Initialize(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("Initialize: %v", err)
	}
	t.Cleanup(func() { Close(db) })
	return db
}

func TestWithTxCommits(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	err := WithTx(ctx, db, func(tx *sql.Tx) error {
		_, err := tx.ExecContext(ctx,
			`INSERT INTO users (username, jellyfin_user_id, jellyfin_server_url) VALUES ('a', 'jf-a', 'http://x')`)
		return err
	})
	if err != nil {
		t.Fatalf("WithTx: %v", err)
	}

	var n int
	if err := db.QueryRow("SELECT COUNT(*) FROM users").Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("expected 1 committed user, got %d", n)
	}
}

func TestWithTxRollsBackOnError(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	sentinel := errors.New("boom")
	err := WithTx(ctx, db, func(tx *sql.Tx) error {
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO users (username, jellyfin_user_id, jellyfin_server_url) VALUES ('b', 'jf-b', 'http://x')`); err != nil {
			return err
		}
		return sentinel // force rollback after a successful write
	})
	if !errors.Is(err, sentinel) {
		t.Fatalf("expected sentinel error, got %v", err)
	}

	var n int
	if err := db.QueryRow("SELECT COUNT(*) FROM users").Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatalf("expected rollback (0 users), got %d", n)
	}
}

func TestWithTxRollsBackOnPanic(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	func() {
		defer func() {
			if r := recover(); r == nil {
				t.Fatal("expected panic to propagate")
			}
		}()
		_ = WithTx(ctx, db, func(tx *sql.Tx) error {
			_, _ = tx.ExecContext(ctx,
				`INSERT INTO users (username, jellyfin_user_id, jellyfin_server_url) VALUES ('c', 'jf-c', 'http://x')`)
			panic("kaboom")
		})
	}()

	var n int
	if err := db.QueryRow("SELECT COUNT(*) FROM users").Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatalf("expected rollback after panic (0 users), got %d", n)
	}
}
