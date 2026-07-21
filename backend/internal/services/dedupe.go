package services

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/rs/zerolog/log"
)

// MergeDuplicates collapses movies/shows that represent the same title — matched
// by shared TMDB or IMDB id — into a single canonical row per user. The extra
// copies are pointed at the canonical via duplicate_of (hiding them from the
// library, search and stats) and their watch data is rolled onto the canonical.
//
// It is idempotent and re-run at the end of every sync: each pass first clears
// all duplicate_of markers for the user, then re-derives them, so the merge
// self-heals as copies are added to or removed from Jellyfin.
func (s *SyncService) MergeDuplicates(ctx context.Context, userID int) {
	if err := s.mergeMovieDuplicates(ctx, userID); err != nil {
		log.Warn().Err(err).Int("user_id", userID).Msg("Failed to merge duplicate movies")
	}
	if err := s.mergeShowDuplicates(ctx, userID); err != nil {
		log.Warn().Err(err).Int("user_id", userID).Msg("Failed to merge duplicate shows")
	}
}

// extIDs holds the external identifiers used to match two items as the same title.
type extIDs struct{ tmdb, imdb string }

// groupByExternalID returns the connected components (as slices of indices into
// ids) where two rows are linked if they share a non-empty TMDB or IMDB id.
// Only components with more than one member are returned. Union-find handles the
// transitive case where A shares a tmdb with B and B shares an imdb with C.
func groupByExternalID(ids []extIDs) [][]int {
	parent := make([]int, len(ids))
	for i := range parent {
		parent[i] = i
	}
	var find func(int) int
	find = func(x int) int {
		for parent[x] != x {
			parent[x] = parent[parent[x]]
			x = parent[x]
		}
		return x
	}
	union := func(a, b int) {
		if ra, rb := find(a), find(b); ra != rb {
			parent[ra] = rb
		}
	}

	tmdbSeen := map[string]int{}
	imdbSeen := map[string]int{}
	for i, e := range ids {
		if e.tmdb != "" {
			if j, ok := tmdbSeen[e.tmdb]; ok {
				union(i, j)
			} else {
				tmdbSeen[e.tmdb] = i
			}
		}
		if e.imdb != "" {
			if j, ok := imdbSeen[e.imdb]; ok {
				union(i, j)
			} else {
				imdbSeen[e.imdb] = i
			}
		}
	}

	comps := map[int][]int{}
	for i := range ids {
		r := find(i)
		comps[r] = append(comps[r], i)
	}
	var out [][]int
	for _, members := range comps {
		if len(members) > 1 {
			out = append(out, members)
		}
	}
	return out
}

func intPlaceholders(n int) string {
	return strings.TrimSuffix(strings.Repeat("?,", n), ",")
}

func intsToArgs(ids []int) []interface{} {
	args := make([]interface{}, len(ids))
	for i, id := range ids {
		args[i] = id
	}
	return args
}

type movieDupRow struct {
	id         int
	ext        extIDs
	archived   bool
	watchCount int
	watchTime  int
	watched    bool
	completion float64
	first      sql.NullTime
	last       sql.NullTime
}

func (s *SyncService) mergeMovieDuplicates(ctx context.Context, userID int) error {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, COALESCE(tmdb_id,''), COALESCE(imdb_id,''), COALESCE(deleted_from_jellyfin,0),
		        COALESCE(watch_count,0), COALESCE(total_watch_time_minutes,0), COALESCE(watched,0),
		        COALESCE(completion_percentage,0), first_watched_at, last_watched_at
		 FROM movies WHERE user_id = ? AND deleted_at IS NULL ORDER BY id`, userID)
	if err != nil {
		if strings.Contains(err.Error(), "no such column") {
			return nil // duplicate_of not yet migrated
		}
		return err
	}
	var mrows []movieDupRow
	for rows.Next() {
		var m movieDupRow
		if err := rows.Scan(&m.id, &m.ext.tmdb, &m.ext.imdb, &m.archived, &m.watchCount,
			&m.watchTime, &m.watched, &m.completion, &m.first, &m.last); err != nil {
			rows.Close()
			return err
		}
		mrows = append(mrows, m)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}

	exts := make([]extIDs, len(mrows))
	for i, m := range mrows {
		exts[i] = m.ext
	}
	groups := groupByExternalID(exts)

	tx, err := beginTxWithRetry(ctx, s.db, fmt.Sprintf("merge-movies-%d", userID))
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Clear existing markers, then re-derive so removed twins revert to standalone.
	if _, err := tx.ExecContext(ctx, `UPDATE movies SET duplicate_of = NULL WHERE user_id = ?`, userID); err != nil {
		return err
	}

	for _, g := range groups {
		ci := pickCanonical(g, func(i int) (bool, int) { return mrows[i].archived, mrows[i].id })
		canonical := mrows[ci]

		var sumCount, sumTime int
		anyWatched := false
		maxComp := 0.0
		var minFirst, maxLast sql.NullTime
		var dupIDs []int
		for _, idx := range g {
			m := mrows[idx]
			sumCount += m.watchCount
			sumTime += m.watchTime
			anyWatched = anyWatched || m.watched
			if m.completion > maxComp {
				maxComp = m.completion
			}
			if m.first.Valid && (!minFirst.Valid || m.first.Time.Before(minFirst.Time)) {
				minFirst = m.first
			}
			if m.last.Valid && (!maxLast.Valid || m.last.Time.After(maxLast.Time)) {
				maxLast = m.last
			}
			if idx != ci {
				dupIDs = append(dupIDs, m.id)
			}
		}

		status := "pending"
		if anyWatched {
			status = "watched"
		} else if maxComp > 0 {
			status = "watching"
		}

		if _, err := tx.ExecContext(ctx,
			`UPDATE movies SET watch_count = ?, total_watch_time_minutes = ?, watched = ?,
			        completion_percentage = ?, first_watched_at = ?, last_watched_at = ?,
			        status = ?, updated_at = ? WHERE id = ?`,
			sumCount, sumTime, anyWatched, maxComp, minFirst, maxLast, status, time.Now(), canonical.id); err != nil {
			return err
		}

		// Re-point the duplicates' watch history onto the canonical, then collapse
		// any now-same-day rows so the timeline shows one entry per day.
		for _, d := range dupIDs {
			if _, err := tx.ExecContext(ctx, `UPDATE watch_history SET movie_id = ? WHERE movie_id = ?`, canonical.id, d); err != nil {
				return err
			}
		}
		if _, err := tx.ExecContext(ctx,
			`DELETE FROM watch_history WHERE movie_id = ?
			 AND id NOT IN (SELECT MIN(id) FROM watch_history WHERE movie_id = ? GROUP BY date(watched_at))`,
			canonical.id, canonical.id); err != nil {
			return err
		}

		if _, err := tx.ExecContext(ctx,
			`UPDATE movies SET duplicate_of = ? WHERE id IN (`+intPlaceholders(len(dupIDs))+`)`,
			append([]interface{}{canonical.id}, intsToArgs(dupIDs)...)...); err != nil {
			return err
		}
	}

	return tx.Commit()
}

type showDupRow struct {
	id        int
	ext       extIDs
	archived  bool
	totalEps  sql.NullInt64
	watchedEp int
	watchTime int
	last      sql.NullTime
	first     sql.NullTime
}

func (s *SyncService) mergeShowDuplicates(ctx context.Context, userID int) error {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, COALESCE(tmdb_id,''), COALESCE(imdb_id,''), COALESCE(deleted_from_jellyfin,0),
		        total_episodes, COALESCE(watched_episodes,0), COALESCE(total_watch_time_minutes,0),
		        last_watched_at, first_watched_at
		 FROM shows WHERE user_id = ? AND deleted_at IS NULL ORDER BY id`, userID)
	if err != nil {
		if strings.Contains(err.Error(), "no such column") {
			return nil
		}
		return err
	}
	var srows []showDupRow
	for rows.Next() {
		var sh showDupRow
		if err := rows.Scan(&sh.id, &sh.ext.tmdb, &sh.ext.imdb, &sh.archived, &sh.totalEps,
			&sh.watchedEp, &sh.watchTime, &sh.last, &sh.first); err != nil {
			rows.Close()
			return err
		}
		srows = append(srows, sh)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}

	exts := make([]extIDs, len(srows))
	for i, sh := range srows {
		exts[i] = sh.ext
	}
	groups := groupByExternalID(exts)

	tx, err := beginTxWithRetry(ctx, s.db, fmt.Sprintf("merge-shows-%d", userID))
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, `UPDATE shows SET duplicate_of = NULL WHERE user_id = ?`, userID); err != nil {
		return err
	}

	for _, g := range groups {
		ci := pickCanonical(g, func(i int) (bool, int) { return srows[i].archived, srows[i].id })
		canonical := srows[ci]

		// Episode counts are per-content, not additive: take the best-progressed
		// copy (MAX) rather than summing, so a title imported twice isn't doubled.
		var maxTotal, maxWatched, maxTime int
		var maxLast, minFirst sql.NullTime
		var dupIDs []int
		for _, idx := range g {
			sh := srows[idx]
			if sh.totalEps.Valid && int(sh.totalEps.Int64) > maxTotal {
				maxTotal = int(sh.totalEps.Int64)
			}
			if sh.watchedEp > maxWatched {
				maxWatched = sh.watchedEp
			}
			if sh.watchTime > maxTime {
				maxTime = sh.watchTime
			}
			if sh.last.Valid && (!maxLast.Valid || sh.last.Time.After(maxLast.Time)) {
				maxLast = sh.last
			}
			if sh.first.Valid && (!minFirst.Valid || sh.first.Time.Before(minFirst.Time)) {
				minFirst = sh.first
			}
			if idx != ci {
				dupIDs = append(dupIDs, sh.id)
			}
		}

		status := "pending"
		if maxTotal > 0 && maxWatched >= maxTotal {
			status = "watched"
		} else if maxWatched > 0 {
			status = "watching"
		}

		if _, err := tx.ExecContext(ctx,
			`UPDATE shows SET watched_episodes = ?, total_watch_time_minutes = ?,
			        last_watched_at = ?, first_watched_at = ?, status = ?, updated_at = ?
			 WHERE id = ?`,
			maxWatched, maxTime, maxLast, minFirst, status, time.Now(), canonical.id); err != nil {
			return err
		}

		// Re-point duplicate shows' watch history (show- and episode-level rows all
		// carry show_id) so the timeline reads under the canonical show.
		for _, d := range dupIDs {
			if _, err := tx.ExecContext(ctx, `UPDATE watch_history SET show_id = ? WHERE show_id = ?`, canonical.id, d); err != nil {
				return err
			}
		}

		if _, err := tx.ExecContext(ctx,
			`UPDATE shows SET duplicate_of = ? WHERE id IN (`+intPlaceholders(len(dupIDs))+`)`,
			append([]interface{}{canonical.id}, intsToArgs(dupIDs)...)...); err != nil {
			return err
		}
	}

	return tx.Commit()
}

// pickCanonical chooses the surviving row index for a duplicate group: prefer a
// copy still present in Jellyfin (not archived), then the lowest id for stability.
// attr returns (archived, id) for the row at index i.
func pickCanonical(group []int, attr func(i int) (bool, int)) int {
	best := group[0]
	bestArchived, bestID := attr(best)
	for _, idx := range group[1:] {
		archived, id := attr(idx)
		if (!archived && bestArchived) || (archived == bestArchived && id < bestID) {
			best, bestArchived, bestID = idx, archived, id
		}
	}
	return best
}
