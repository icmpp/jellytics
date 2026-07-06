package repository

import (
	"context"
	"testing"
)

// TestRatingUpsertCreateThenUpdate locks in the create-vs-update semantics used
// for HTTP 201/200: the first Upsert creates, a second updates in place.
func TestRatingUpsertCreateThenUpdate(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()
	store := NewSQLRatingStore(f.db)

	r1, created, err := store.Upsert(ctx, f.userA, "movie", f.movieA, 7)
	if err != nil {
		t.Fatalf("first upsert: %v", err)
	}
	if !created {
		t.Error("first upsert should report created=true")
	}
	if r1.Rating != 7 {
		t.Errorf("rating = %d, want 7", r1.Rating)
	}

	r2, created, err := store.Upsert(ctx, f.userA, "movie", f.movieA, 10)
	if err != nil {
		t.Fatalf("second upsert: %v", err)
	}
	if created {
		t.Error("second upsert should report created=false (update)")
	}
	if r2.Rating != 10 {
		t.Errorf("rating = %d, want 10", r2.Rating)
	}
	if r2.ID != r1.ID {
		t.Errorf("update changed row id: %d -> %d", r1.ID, r2.ID)
	}

	// Exactly one row should exist.
	if list, err := store.List(ctx, f.userA); err != nil || len(list) != 1 {
		t.Errorf("expected exactly 1 rating, got %d (err=%v)", len(list), err)
	}
}

// TestWatchlistAddIsIdempotent verifies a repeated Add updates (200) the same
// row rather than creating a duplicate.
func TestWatchlistAddIsIdempotent(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()
	store := NewSQLWatchlistStore(f.db)

	first, created, err := store.Add(ctx, f.userA, "movie", f.movieA)
	if err != nil || !created {
		t.Fatalf("first add: created=%v err=%v", created, err)
	}

	second, created, err := store.Add(ctx, f.userA, "movie", f.movieA)
	if err != nil {
		t.Fatalf("second add: %v", err)
	}
	if created {
		t.Error("second add should report created=false")
	}
	if second.ID != first.ID {
		t.Errorf("second add created a new row: %d -> %d", first.ID, second.ID)
	}

	if list, err := store.List(ctx, f.userA, "", 50, 0); err != nil || len(list) != 1 {
		t.Errorf("expected exactly 1 watchlist item, got %d (err=%v)", len(list), err)
	}
}
