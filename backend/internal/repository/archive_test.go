package repository

import (
	"context"
	"testing"
	"time"
)

// archiveMovie flags a movie as deleted-from-Jellyfin with the given archive time.
func archiveMovie(t *testing.T, f fixture, movieID int, at time.Time) {
	t.Helper()
	if _, err := f.db.Exec(
		`UPDATE movies SET deleted_from_jellyfin = 1, archived_at = ? WHERE id = ?`, at, movieID); err != nil {
		t.Fatalf("archive movie: %v", err)
	}
}

// TestArchiveListsJellyfinDeletions verifies the archive view is driven by
// deleted_from_jellyfin (not the user's deleted_at soft delete) and sorts by
// archive time.
func TestArchiveListsJellyfinDeletions(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()
	store := NewSQLArchiveStore(f.db)

	// A second, more-recently archived movie for A to check ordering.
	older := insertMovie(t, f.db, f.userA, "m-a2", "Older Removal")
	archiveMovie(t, f, older, time.Now().Add(-48*time.Hour))
	archiveMovie(t, f, f.movieA, time.Now())

	// A show A that A removed from their own library (deleted_at) must NOT be
	// treated as archived.
	if _, err := f.db.Exec(`UPDATE shows SET deleted_at = ? WHERE id = ?`, time.Now(), f.showA); err != nil {
		t.Fatalf("soft delete show: %v", err)
	}

	movies, err := store.RemovedMovies(ctx, f.userA)
	if err != nil {
		t.Fatalf("RemovedMovies: %v", err)
	}
	if len(movies) != 2 {
		t.Fatalf("expected 2 archived movies, got %d", len(movies))
	}
	// Most recently archived first.
	if movies[0].ID != f.movieA || movies[1].ID != older {
		t.Errorf("archive order wrong: got [%d, %d], want [%d, %d]", movies[0].ID, movies[1].ID, f.movieA, older)
	}
	if movies[0].RemovedAt == nil {
		t.Error("archived movie missing RemovedAt")
	}

	// The user-soft-deleted show is not archived (deleted_from_jellyfin = 0).
	shows, err := store.RemovedShows(ctx, f.userA)
	if err != nil {
		t.Fatalf("RemovedShows: %v", err)
	}
	if len(shows) != 0 {
		t.Errorf("user soft-deleted show must not appear in archive, got %d", len(shows))
	}

	// Isolation: B sees none of A's archived movies.
	if bMovies, err := store.RemovedMovies(ctx, f.userB); err != nil || len(bMovies) != 0 {
		t.Errorf("B should see no archived movies: got %d err=%v", len(bMovies), err)
	}
}

// TestArchivedItemsStayVisibleInLists is the core requirement: items removed
// from Jellyfin remain listable on the movies/series pages, flagged as archived.
func TestArchivedItemsStayVisibleInLists(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()
	when := time.Now()
	archiveMovie(t, f, f.movieA, when)
	if _, err := f.db.Exec(
		`UPDATE shows SET deleted_from_jellyfin = 1, archived_at = ? WHERE id = ?`, when, f.showA); err != nil {
		t.Fatalf("archive show: %v", err)
	}

	movies, total, err := NewSQLMovieStore(f.db).List(ctx, f.userA, MovieListFilter{Limit: 50})
	if err != nil {
		t.Fatalf("movie List: %v", err)
	}
	if total != 1 || len(movies) != 1 {
		t.Fatalf("archived movie should still be listed: total=%d len=%d", total, len(movies))
	}
	if !movies[0].DeletedFromJellyfin {
		t.Error("listed movie should be flagged DeletedFromJellyfin")
	}
	if movies[0].ArchivedAt == nil {
		t.Error("listed movie should expose ArchivedAt")
	}

	shows, total, err := NewSQLShowStore(f.db).List(ctx, f.userA, ShowListFilter{Limit: 50})
	if err != nil {
		t.Fatalf("show List: %v", err)
	}
	if total != 1 || len(shows) != 1 {
		t.Fatalf("archived show should still be listed: total=%d len=%d", total, len(shows))
	}
	if !shows[0].DeletedFromJellyfin || shows[0].ArchivedAt == nil {
		t.Errorf("listed show should expose archive fields: flag=%v at=%v", shows[0].DeletedFromJellyfin, shows[0].ArchivedAt)
	}
}

// TestArchivedFilter checks the list filter: default shows all, "only" narrows
// to archived, "active" hides archived. Applies to movies and shows alike.
func TestArchivedFilter(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()
	// A owns movieA (active) plus one archived movie.
	archived := insertMovie(t, f.db, f.userA, "m-arch", "Archived One")
	archiveMovie(t, f, archived, time.Now())
	mstore := NewSQLMovieStore(f.db)

	all, total, err := mstore.List(ctx, f.userA, MovieListFilter{Limit: 50})
	if err != nil || total != 2 || len(all) != 2 {
		t.Fatalf("default should list all (2): total=%d len=%d err=%v", total, len(all), err)
	}

	only, total, err := mstore.List(ctx, f.userA, MovieListFilter{Archived: "only", Limit: 50})
	if err != nil || total != 1 || len(only) != 1 || only[0].ID != archived {
		t.Fatalf("only should list the archived movie: total=%d len=%d err=%v", total, len(only), err)
	}

	active, total, err := mstore.List(ctx, f.userA, MovieListFilter{Archived: "active", Limit: 50})
	if err != nil || total != 1 || len(active) != 1 || active[0].ID != f.movieA {
		t.Fatalf("active should hide the archived movie: total=%d len=%d err=%v", total, len(active), err)
	}

	// Status counts honor the archived filter too.
	counts, err := mstore.StatusCounts(ctx, f.userA, MovieListFilter{Archived: "active"})
	if err != nil || counts.All != 1 {
		t.Fatalf("status counts should honor archived filter: all=%d err=%v", counts.All, err)
	}

	// Shows mirror the behavior.
	sarch := insertShow(t, f.db, f.userA, "s-arch", "Archived Show")
	if _, err := f.db.Exec(`UPDATE shows SET deleted_from_jellyfin = 1, archived_at = ? WHERE id = ?`, time.Now(), sarch); err != nil {
		t.Fatalf("archive show: %v", err)
	}
	sstore := NewSQLShowStore(f.db)
	sOnly, sTotal, err := sstore.List(ctx, f.userA, ShowListFilter{Archived: "only", Limit: 50})
	if err != nil || sTotal != 1 || len(sOnly) != 1 || sOnly[0].ID != sarch {
		t.Fatalf("show only-archived filter wrong: total=%d len=%d err=%v", sTotal, len(sOnly), err)
	}
}

// TestArchiveFieldsOnDetail verifies the single-item reads surface the flag too.
func TestArchiveFieldsOnDetail(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()
	when := time.Now()
	archiveMovie(t, f, f.movieA, when)
	if _, err := f.db.Exec(
		`UPDATE shows SET deleted_from_jellyfin = 1, archived_at = ? WHERE id = ?`, when, f.showA); err != nil {
		t.Fatalf("archive show: %v", err)
	}

	movie, err := NewSQLMovieStore(f.db).GetByID(ctx, f.movieA, f.userA)
	if err != nil || movie == nil {
		t.Fatalf("GetByID: %v (movie=%v)", err, movie)
	}
	if !movie.DeletedFromJellyfin || movie.ArchivedAt == nil {
		t.Errorf("movie detail missing archive fields: flag=%v at=%v", movie.DeletedFromJellyfin, movie.ArchivedAt)
	}

	show, _, err := NewSQLShowStore(f.db).GetWithEpisodes(ctx, f.showA, f.userA)
	if err != nil || show == nil {
		t.Fatalf("GetWithEpisodes: %v (show=%v)", err, show)
	}
	if !show.DeletedFromJellyfin || show.ArchivedAt == nil {
		t.Errorf("show detail missing archive fields: flag=%v at=%v", show.DeletedFromJellyfin, show.ArchivedAt)
	}
}
