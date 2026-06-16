package repository

import (
	"context"
	"database/sql"
	"path/filepath"
	"testing"

	"jellytics/backend/internal/database"
)

// These tests assert the multi-user isolation invariant: no store read or
// mutation may observe or affect another user's data. They use a real
// (temp-file) SQLite database created through the goose migrations.

func setupIsolationDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := database.Initialize(filepath.Join(t.TempDir(), "iso.db"))
	if err != nil {
		t.Fatalf("Initialize: %v", err)
	}
	t.Cleanup(func() { database.Close(db) })
	return db
}

func insertUser(t *testing.T, db *sql.DB, username, jellyfinID string) int {
	t.Helper()
	res, err := db.Exec(
		`INSERT INTO users (username, jellyfin_user_id, jellyfin_server_url) VALUES (?, ?, 'http://jf')`,
		username, jellyfinID)
	if err != nil {
		t.Fatalf("insert user %s: %v", username, err)
	}
	id, _ := res.LastInsertId()
	return int(id)
}

func insertMovie(t *testing.T, db *sql.DB, userID int, jellyfinID, title string) int {
	t.Helper()
	res, err := db.Exec(
		`INSERT INTO movies (jellyfin_id, title, overview, poster_url, genre, user_id, status)
		 VALUES (?, ?, '', '', '[]', ?, 'pending')`,
		jellyfinID, title, userID)
	if err != nil {
		t.Fatalf("insert movie: %v", err)
	}
	id, _ := res.LastInsertId()
	return int(id)
}

func insertShow(t *testing.T, db *sql.DB, userID int, jellyfinID, title string) int {
	t.Helper()
	res, err := db.Exec(
		`INSERT INTO shows (jellyfin_id, title, overview, poster_url, genre, user_id, status)
		 VALUES (?, ?, '', '', '[]', ?, 'watching')`,
		jellyfinID, title, userID)
	if err != nil {
		t.Fatalf("insert show: %v", err)
	}
	id, _ := res.LastInsertId()
	return int(id)
}

// twoUsers seeds users A and B, each owning one movie and one show.
type fixture struct {
	db             *sql.DB
	userA, userB   int
	movieA, movieB int
	showA, showB   int
}

func newFixture(t *testing.T) fixture {
	db := setupIsolationDB(t)
	a := insertUser(t, db, "alice", "jf-a")
	b := insertUser(t, db, "bob", "jf-b")
	return fixture{
		db:     db,
		userA:  a,
		userB:  b,
		movieA: insertMovie(t, db, a, "m-a", "A Movie"),
		movieB: insertMovie(t, db, b, "m-b", "B Movie"),
		showA:  insertShow(t, db, a, "s-a", "A Show"),
		showB:  insertShow(t, db, b, "s-b", "B Show"),
	}
}

func TestRatingIsolation(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()
	store := NewSQLRatingStore(f.db)

	if _, _, err := store.Upsert(ctx, f.userA, "movie", f.movieA, 9); err != nil {
		t.Fatalf("A upsert: %v", err)
	}

	// B cannot read A's rating.
	if got, err := store.Get(ctx, f.userB, "movie", f.movieA); err != nil || got != nil {
		t.Errorf("B should not see A's rating: got=%v err=%v", got, err)
	}
	// B's list is empty.
	if list, err := store.List(ctx, f.userB); err != nil || len(list) != 0 {
		t.Errorf("B list should be empty: got %d err=%v", len(list), err)
	}
	// B cannot delete A's rating.
	if found, err := store.Delete(ctx, f.userB, "movie", f.movieA); err != nil || found {
		t.Errorf("B delete of A's rating should be no-op: found=%v err=%v", found, err)
	}
	// A's rating survived B's attempts.
	if got, err := store.Get(ctx, f.userA, "movie", f.movieA); err != nil || got == nil {
		t.Errorf("A's rating should still exist: got=%v err=%v", got, err)
	}
}

func TestReviewIsolation(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()
	store := NewSQLReviewStore(f.db)

	if _, _, err := store.Upsert(ctx, f.userA, "movie", f.movieA, "great", ""); err != nil {
		t.Fatalf("A upsert: %v", err)
	}
	if got, err := store.Get(ctx, f.userB, "movie", f.movieA); err != nil || got != nil {
		t.Errorf("B should not see A's review: got=%v err=%v", got, err)
	}
	if found, err := store.Delete(ctx, f.userB, "movie", f.movieA); err != nil || found {
		t.Errorf("B delete of A's review should be no-op: found=%v err=%v", found, err)
	}
	if list, err := store.List(ctx, f.userB); err != nil || len(list) != 0 {
		t.Errorf("B review list should be empty: got %d err=%v", len(list), err)
	}
}

func TestWatchlistIsolation(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()
	store := NewSQLWatchlistStore(f.db)

	item, _, err := store.Add(ctx, f.userA, "movie", f.movieA)
	if err != nil {
		t.Fatalf("A add: %v", err)
	}

	// B cannot add A's movie to B's watchlist (it isn't B's item).
	if _, _, err := store.Add(ctx, f.userB, "movie", f.movieA); err == nil {
		t.Error("B adding A's movie should fail with not found")
	}
	// B's list does not include A's entry.
	if list, err := store.List(ctx, f.userB, "", 50, 0); err != nil || len(list) != 0 {
		t.Errorf("B watchlist should be empty: got %d err=%v", len(list), err)
	}
	// B cannot remove A's watchlist row by id.
	if found, err := store.Remove(ctx, f.userB, item.ID); err != nil || found {
		t.Errorf("B remove of A's watchlist row should be no-op: found=%v err=%v", found, err)
	}
	if list, err := store.List(ctx, f.userA, "", 50, 0); err != nil || len(list) != 1 {
		t.Errorf("A watchlist should still have 1 item: got %d err=%v", len(list), err)
	}
}

func TestCollectionIsolation(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()
	store := NewSQLCollectionStore(f.db)

	col, err := store.Create(ctx, f.userA, "A's collection", "")
	if err != nil {
		t.Fatalf("A create: %v", err)
	}

	if got, err := store.Get(ctx, f.userB, col.ID); err != nil || got != nil {
		t.Errorf("B should not get A's collection: got=%v err=%v", got, err)
	}
	if owns, err := store.Owns(ctx, f.userB, col.ID); err != nil || owns {
		t.Errorf("B should not own A's collection: owns=%v err=%v", owns, err)
	}
	if found, err := store.Delete(ctx, f.userB, col.ID); err != nil || found {
		t.Errorf("B delete of A's collection should be no-op: found=%v err=%v", found, err)
	}
	name := "hacked"
	if found, err := store.Update(ctx, f.userB, col.ID, &name, nil); err != nil || found {
		t.Errorf("B update of A's collection should be no-op: found=%v err=%v", found, err)
	}
	// B's guarded AddItem must not insert into A's collection.
	if err := store.AddItem(ctx, f.userB, col.ID, "movie", f.movieB); err != nil {
		t.Fatalf("B addItem err: %v", err)
	}
	got, err := store.Get(ctx, f.userA, col.ID)
	if err != nil || got == nil {
		t.Fatalf("A get own collection: got=%v err=%v", got, err)
	}
	if len(got.Items) != 0 {
		t.Errorf("B must not have added an item to A's collection: got %d items", len(got.Items))
	}
	if list, err := store.List(ctx, f.userB, "", 0); err != nil || len(list) != 0 {
		t.Errorf("B collection list should be empty: got %d err=%v", len(list), err)
	}
}

func TestTagIsolation(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()
	store := NewSQLTagStore(f.db)

	tag, err := store.Create(ctx, f.userA, "fav", "#fff")
	if err != nil {
		t.Fatalf("A create tag: %v", err)
	}

	if owns, err := store.Owns(ctx, f.userB, tag.ID); err != nil || owns {
		t.Errorf("B should not own A's tag: owns=%v err=%v", owns, err)
	}
	if found, err := store.Delete(ctx, f.userB, tag.ID); err != nil || found {
		t.Errorf("B delete of A's tag should be no-op: found=%v err=%v", found, err)
	}
	// B's guarded AddItem must not attach A's tag to anything.
	if err := store.AddItem(ctx, f.userB, tag.ID, "movie", f.movieB); err != nil {
		t.Fatalf("B addItem err: %v", err)
	}
	if items, err := store.Items(ctx, f.userA, tag.ID); err != nil || len(items) != 0 {
		t.Errorf("B must not attach A's tag: A sees %d items err=%v", len(items), err)
	}
	if list, err := store.List(ctx, f.userB); err != nil || len(list) != 0 {
		t.Errorf("B tag list should be empty: got %d err=%v", len(list), err)
	}
}

func TestShowIsolation(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()
	store := NewSQLShowStore(f.db)

	if show, _, err := store.GetWithEpisodes(ctx, f.showA, f.userB); err != nil || show != nil {
		t.Errorf("B should not get A's show: show=%v err=%v", show, err)
	}
	if found, err := store.SoftDelete(ctx, f.showA, f.userB); err != nil || found {
		t.Errorf("B soft-delete of A's show should be no-op: found=%v err=%v", found, err)
	}
	if found, err := store.Restore(ctx, f.showA, f.userB); err != nil || found {
		t.Errorf("B restore of A's show should be no-op: found=%v err=%v", found, err)
	}
	// A's show must still be present and not archived.
	show, _, err := store.GetWithEpisodes(ctx, f.showA, f.userA)
	if err != nil || show == nil {
		t.Fatalf("A's show should exist: show=%v err=%v", show, err)
	}
	if show.RemovedFromLibrary {
		t.Error("A's show must not have been archived by B")
	}
	// B's list contains only B's show.
	list, _, err := store.List(ctx, f.userB, ShowListFilter{Limit: 50})
	if err != nil {
		t.Fatalf("B list: %v", err)
	}
	for _, s := range list {
		if s.ID == f.showA {
			t.Error("B's show list leaked A's show")
		}
	}
}

func TestMovieIsolation(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()
	store := NewSQLMovieStore(f.db)

	if got, err := store.GetByID(ctx, f.movieA, f.userB); err != nil || got != nil {
		t.Errorf("B should not get A's movie: got=%v err=%v", got, err)
	}
	if exists, err := store.Exists(ctx, f.movieA, f.userB); err != nil || exists {
		t.Errorf("B should not see A's movie as existing: exists=%v err=%v", exists, err)
	}
	if err := store.SoftDelete(ctx, f.movieA, f.userB); err == nil {
		t.Error("B soft-delete of A's movie should report not found")
	}
	if exists, err := store.Exists(ctx, f.movieA, f.userA); err != nil || !exists {
		t.Errorf("A's movie should still exist after B's delete attempt: exists=%v err=%v", exists, err)
	}
}

func TestNotificationIsolation(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()
	store := NewSQLNotificationStore(f.db)

	var nid int64
	res, err := f.db.Exec(
		`INSERT INTO notifications (user_id, type, title) VALUES (?, 'test', 'hi')`, f.userA)
	if err != nil {
		t.Fatalf("insert notification: %v", err)
	}
	nid, _ = res.LastInsertId()

	if list, err := store.List(ctx, f.userB, false); err != nil || len(list) != 0 {
		t.Errorf("B notification list should be empty: got %d err=%v", len(list), err)
	}
	if count, err := store.UnreadCount(ctx, f.userB); err != nil || count != 0 {
		t.Errorf("B unread count should be 0: got %d err=%v", count, err)
	}
	if found, err := store.MarkRead(ctx, f.userB, int(nid)); err != nil || found {
		t.Errorf("B mark-read of A's notification should be no-op: found=%v err=%v", found, err)
	}
	if count, err := store.UnreadCount(ctx, f.userA); err != nil || count != 1 {
		t.Errorf("A should still have 1 unread: got %d err=%v", count, err)
	}
}
