package services

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"jellytics/backend/internal/repository"
)

func statusFor(watched bool, completion float64) string {
	switch {
	case watched:
		return "watched"
	case completion > 0:
		return "watching"
	default:
		return "pending"
	}
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

func insMovie(t *testing.T, db *sql.DB, userID int, jf, tmdb, imdb string, archived bool, watchCount, watchTime int, watched bool, completion float64) int {
	t.Helper()
	res, err := db.Exec(
		`INSERT INTO movies (jellyfin_id,title,overview,poster_url,backdrop_url,genre,user_id,status,tmdb_id,imdb_id,
		   deleted_from_jellyfin,watch_count,total_watch_time_minutes,watched,completion_percentage)
		 VALUES (?,?,'','','','[]',?,?,?,?,?,?,?,?,?)`,
		jf, "Movie "+jf, userID, statusFor(watched, completion), tmdb, imdb, boolToInt(archived),
		watchCount, watchTime, watched, completion)
	if err != nil {
		t.Fatalf("insMovie %s: %v", jf, err)
	}
	id, _ := res.LastInsertId()
	return int(id)
}

func insShow(t *testing.T, db *sql.DB, userID int, jf, tmdb, imdb string, archived bool, totalEps, watchedEps, watchTime int) int {
	t.Helper()
	status := "pending"
	if totalEps > 0 && watchedEps >= totalEps {
		status = "watched"
	} else if watchedEps > 0 {
		status = "watching"
	}
	res, err := db.Exec(
		`INSERT INTO shows (jellyfin_id,title,user_id,status,tmdb_id,imdb_id,deleted_from_jellyfin,
		   total_episodes,watched_episodes,total_watch_time_minutes)
		 VALUES (?,?,?,?,?,?,?,?,?,?)`,
		jf, "Show "+jf, userID, status, tmdb, imdb, boolToInt(archived), totalEps, watchedEps, watchTime)
	if err != nil {
		t.Fatalf("insShow %s: %v", jf, err)
	}
	id, _ := res.LastInsertId()
	return int(id)
}

func assertDuplicateOf(t *testing.T, db *sql.DB, table string, id, expected int) {
	t.Helper()
	var dup sql.NullInt64
	if err := db.QueryRow(`SELECT duplicate_of FROM `+table+` WHERE id=?`, id).Scan(&dup); err != nil {
		t.Fatalf("read duplicate_of: %v", err)
	}
	if expected == 0 {
		if dup.Valid {
			t.Errorf("%s id=%d should be canonical (NULL), got duplicate_of=%d", table, id, dup.Int64)
		}
	} else if !dup.Valid || int(dup.Int64) != expected {
		t.Errorf("%s id=%d: want duplicate_of=%d, got %v", table, id, expected, dup)
	}
}

// TestMergeMovieDuplicatesByTMDB covers the core movie merge: canonical selection
// (prefer active, lowest id), stat aggregation onto the canonical, and watch
// history re-pointing.
func TestMergeMovieDuplicatesByTMDB(t *testing.T) {
	db := syncTestDB(t)
	svc := NewSyncService(db)
	seedSyncUser(t, svc)
	ctx := context.Background()

	c1 := insMovie(t, db, 1, "A", "100", "", false, 1, 120, true, 100) // active, watched
	c2 := insMovie(t, db, 1, "B", "100", "", false, 1, 30, false, 25)  // active, partial
	c3 := insMovie(t, db, 1, "C", "100", "", true, 0, 0, false, 0)     // archived
	if _, err := db.Exec(`INSERT INTO watch_history (user_id,movie_id,watched_at,duration_watched_minutes) VALUES (1,?, '2026-01-01',120)`, c1); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO watch_history (user_id,movie_id,watched_at,duration_watched_minutes) VALUES (1,?, '2026-01-02',30)`, c2); err != nil {
		t.Fatal(err)
	}

	svc.MergeDuplicates(ctx, 1)

	assertDuplicateOf(t, db, "movies", c1, 0)  // canonical (active, lowest id)
	assertDuplicateOf(t, db, "movies", c2, c1) // hidden dup
	assertDuplicateOf(t, db, "movies", c3, c1) // archived copy also merged

	var wc, wt int
	var watched bool
	var comp float64
	if err := db.QueryRow(`SELECT watch_count,total_watch_time_minutes,watched,completion_percentage FROM movies WHERE id=?`, c1).
		Scan(&wc, &wt, &watched, &comp); err != nil {
		t.Fatal(err)
	}
	if wc != 2 || wt != 150 || !watched || comp != 100 {
		t.Errorf("aggregate wrong: watch_count=%d time=%d watched=%v completion=%v (want 2,150,true,100)", wc, wt, watched, comp)
	}

	var histCanon, histDup int
	db.QueryRow(`SELECT COUNT(*) FROM watch_history WHERE movie_id=?`, c1).Scan(&histCanon)
	db.QueryRow(`SELECT COUNT(*) FROM watch_history WHERE movie_id=?`, c2).Scan(&histDup)
	if histDup != 0 {
		t.Errorf("duplicate watch history should be re-pointed, %d rows remain on dup", histDup)
	}
	if histCanon != 2 {
		t.Errorf("canonical should hold both history rows (distinct days), got %d", histCanon)
	}
}

// TestMergeMovieTransitiveExternalIDs verifies union-find links A—B by tmdb and
// B—C by imdb into a single group.
func TestMergeMovieTransitiveExternalIDs(t *testing.T) {
	db := syncTestDB(t)
	svc := NewSyncService(db)
	seedSyncUser(t, svc)

	a := insMovie(t, db, 1, "A", "X", "", false, 0, 0, false, 0)
	b := insMovie(t, db, 1, "B", "X", "Y", false, 0, 0, false, 0)
	c := insMovie(t, db, 1, "C", "", "Y", false, 0, 0, false, 0)

	svc.MergeDuplicates(context.Background(), 1)

	assertDuplicateOf(t, db, "movies", a, 0)
	assertDuplicateOf(t, db, "movies", b, a)
	assertDuplicateOf(t, db, "movies", c, a)
}

// TestMergeNoFalsePositives ensures different ids (and empty ids) never merge.
func TestMergeNoFalsePositives(t *testing.T) {
	db := syncTestDB(t)
	svc := NewSyncService(db)
	seedSyncUser(t, svc)

	a := insMovie(t, db, 1, "A", "100", "", false, 0, 0, false, 0)
	b := insMovie(t, db, 1, "B", "200", "", false, 0, 0, false, 0)
	c := insMovie(t, db, 1, "C", "", "", false, 0, 0, false, 0) // no external ids
	d := insMovie(t, db, 1, "D", "", "", false, 0, 0, false, 0) // no external ids

	svc.MergeDuplicates(context.Background(), 1)

	for _, id := range []int{a, b, c, d} {
		assertDuplicateOf(t, db, "movies", id, 0)
	}
}

// TestMergeUnmergesWhenTwinRemoved verifies the marker is reset each run, so a
// former duplicate becomes standalone once its twin leaves the active set.
func TestMergeUnmergesWhenTwinRemoved(t *testing.T) {
	db := syncTestDB(t)
	svc := NewSyncService(db)
	seedSyncUser(t, svc)
	ctx := context.Background()

	a := insMovie(t, db, 1, "A", "100", "", false, 0, 0, false, 0)
	b := insMovie(t, db, 1, "B", "100", "", false, 0, 0, false, 0)
	svc.MergeDuplicates(ctx, 1)
	assertDuplicateOf(t, db, "movies", b, a)

	// User removes copy B from the library; the remaining copy is standalone again.
	if _, err := db.Exec(`UPDATE movies SET deleted_at=? WHERE id=?`, time.Now(), b); err != nil {
		t.Fatal(err)
	}
	svc.MergeDuplicates(ctx, 1)
	assertDuplicateOf(t, db, "movies", a, 0)
}

// TestMergeShowDuplicates verifies show merge takes MAX episode progress (not a
// sum) and hides the duplicate.
func TestMergeShowDuplicates(t *testing.T) {
	db := syncTestDB(t)
	svc := NewSyncService(db)
	seedSyncUser(t, svc)

	s1 := insShow(t, db, 1, "SA", "50", "", false, 10, 3, 90)
	s2 := insShow(t, db, 1, "SB", "50", "", false, 10, 7, 210)

	svc.MergeDuplicates(context.Background(), 1)

	assertDuplicateOf(t, db, "shows", s1, 0)
	assertDuplicateOf(t, db, "shows", s2, s1)

	var we, wt int
	var status string
	if err := db.QueryRow(`SELECT watched_episodes,total_watch_time_minutes,status FROM shows WHERE id=?`, s1).
		Scan(&we, &wt, &status); err != nil {
		t.Fatal(err)
	}
	if we != 7 || wt != 210 || status != "watching" {
		t.Errorf("show aggregate wrong: watched=%d time=%d status=%s (want 7,210,watching)", we, wt, status)
	}
}

// TestMergedDuplicatesExcludedFromReadsAndStats confirms hidden duplicates drop
// out of the movie list and the stats overview (no double counting).
func TestMergedDuplicatesExcludedFromReadsAndStats(t *testing.T) {
	db := syncTestDB(t)
	svc := NewSyncService(db)
	seedSyncUser(t, svc)
	ctx := context.Background()

	insMovie(t, db, 1, "A", "100", "", false, 1, 120, true, 100)
	insMovie(t, db, 1, "B", "100", "", false, 1, 120, true, 100)

	svc.MergeDuplicates(ctx, 1)

	movies, total, err := repository.NewSQLMovieStore(db).List(ctx, 1, repository.MovieListFilter{Limit: 50})
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if total != 1 || len(movies) != 1 {
		t.Fatalf("list should show only the canonical: total=%d len=%d", total, len(movies))
	}

	ov, err := NewStatsService(db).GetOverview(ctx, 1)
	if err != nil {
		t.Fatalf("GetOverview: %v", err)
	}
	if ov.TotalMovies != 1 {
		t.Errorf("overview should count 1 movie (duplicate excluded), got %d", ov.TotalMovies)
	}
	if ov.TotalWatchTimeMinutes != 240 {
		t.Errorf("combined watch time should live on the canonical: got %d, want 240", ov.TotalWatchTimeMinutes)
	}
}
