package services

import (
	"context"
	"database/sql"
	"encoding/json"
	"strconv"
	"sync"
	"time"

	"jellytics/backend/internal/errors"
	"jellytics/backend/internal/models"

	"github.com/rs/zerolog/log"
)

type StatsService struct {
	db *sql.DB
}

func NewStatsService(db *sql.DB) *StatsService {
	return &StatsService{db: db}
}

func (s *StatsService) GetOverview(ctx context.Context, userID int) (*models.StatsOverview, error) {
	var stats models.StatsOverview

	var showsWatched, showsWatching, showsPending, totalShows int
	var showsWatchTime int
	var episodesWatched int
	var moviesWatched, moviesWatching, moviesPending, totalMovies int
	var moviesWatchTime int
	var showsErr, episodesErr, moviesErr error
	var wg sync.WaitGroup

	wg.Add(1)
	go func() {
		defer wg.Done()
		showsErr = s.db.QueryRowContext(ctx,
			`SELECT 
				COUNT(CASE WHEN status = 'watched' THEN 1 END),
				COUNT(CASE WHEN status = 'watching' THEN 1 END),
				COUNT(CASE WHEN status = 'pending' THEN 1 END),
				COALESCE(SUM(total_watch_time_minutes), 0),
				COUNT(*)
			FROM shows WHERE user_id = ?`,
			userID).Scan(&showsWatched, &showsWatching, &showsPending, &showsWatchTime, &totalShows)
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		episodesErr = s.db.QueryRowContext(ctx,
			`SELECT COUNT(*) FROM episodes e
			 INNER JOIN shows s ON e.show_id = s.id
			 WHERE s.user_id = ? AND e.watched = 1`,
			userID).Scan(&episodesWatched)
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		moviesErr = s.db.QueryRowContext(ctx,
			`SELECT 
				COUNT(DISTINCT CASE WHEN m.status = 'watched' THEN m.id END),
				COUNT(DISTINCT CASE WHEN m.status = 'watching' THEN m.id END),
				COUNT(DISTINCT CASE WHEN m.status = 'pending' THEN m.id END),
				COALESCE(SUM(m.total_watch_time_minutes), 0),
				COUNT(DISTINCT m.id)
			FROM movies m WHERE m.user_id = ?`,
			userID).Scan(&moviesWatched, &moviesWatching, &moviesPending, &moviesWatchTime, &totalMovies)
	}()

	wg.Wait()

	if showsErr != nil {
		return nil, errors.Wrap(showsErr, errors.CodeDatabaseError, "Failed to get shows stats")
	}
	if episodesErr != nil && episodesErr != sql.ErrNoRows {
		log.Warn().Err(episodesErr).Msg("Failed to get episodes watched count (non-critical)")
	}
	if moviesErr != nil && moviesErr != sql.ErrNoRows {
		log.Warn().Err(moviesErr).Msg("Failed to get movies stats (non-critical)")
	}

	stats.ShowsWatched = showsWatched
	stats.ShowsWatching = showsWatching
	stats.ShowsPending = showsPending
	stats.MoviesWatched = moviesWatched
	stats.MoviesWatching = moviesWatching
	stats.MoviesPending = moviesPending
	stats.TotalWatchTimeMinutes = showsWatchTime + moviesWatchTime
	stats.EpisodesWatched = episodesWatched
	stats.TotalShows = totalShows
	stats.TotalMovies = totalMovies

	return &stats, nil
}

func (s *StatsService) GetGenreBreakdown(ctx context.Context, userID int) (map[string]int, error) {
	query := `
		SELECT genre
		FROM (
			SELECT genre FROM shows WHERE user_id = ? AND genre IS NOT NULL
			UNION ALL
			SELECT genre FROM movies WHERE user_id = ? AND genre IS NOT NULL
		)
	`

	rows, err := s.db.QueryContext(ctx, query, userID, userID)
	if err != nil {
		return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to get genre breakdown")
	}
	defer rows.Close()

	genreCount := make(map[string]int)

	for rows.Next() {
		var genreJSON string
		if err := rows.Scan(&genreJSON); err != nil {
			continue
		}

		var genres []string
		if err := json.Unmarshal([]byte(genreJSON), &genres); err != nil {
			continue
		}

		for _, genre := range genres {
			genreCount[genre]++
		}
	}
	if err := rows.Err(); err != nil {
		log.Warn().Err(err).Msg("Error iterating genre rows")
	}

	return genreCount, nil
}

func (s *StatsService) GetTrends(ctx context.Context, userID int, days int, snapshotType string) ([]models.StatsSnapshot, error) {
	query := `
		WITH ordered AS (
			SELECT id, user_id, total_watch_time_minutes, shows_watched, shows_watching,
			       shows_pending, episodes_watched, genres_watched,
			       average_session_duration_minutes, longest_watch_streak_days,
			       snapshot_date, snapshot_type, created_at,
			       LAG(total_watch_time_minutes, 1, 0) OVER (
			           PARTITION BY user_id, snapshot_type ORDER BY snapshot_date
			       ) AS prev_total_watch_time,
			       LAG(episodes_watched, 1, 0) OVER (
			           PARTITION BY user_id, snapshot_type ORDER BY snapshot_date
			       ) AS prev_episodes_watched
			FROM stats_snapshots
			WHERE user_id = ?
			  AND snapshot_type = ?
		)
		SELECT id, user_id, total_watch_time_minutes, shows_watched, shows_watching,
		       shows_pending, episodes_watched, genres_watched,
		       average_session_duration_minutes, longest_watch_streak_days,
		       snapshot_date, snapshot_type, created_at,
		       MAX(0, total_watch_time_minutes - prev_total_watch_time) AS delta_watch_time,
		       MAX(0, episodes_watched - prev_episodes_watched) AS delta_episodes
		FROM ordered
		WHERE snapshot_date >= date('now', '-' || ? || ' days')
		ORDER BY snapshot_date ASC
	`

	rows, err := s.db.QueryContext(ctx, query, userID, snapshotType, days)
	if err != nil {
		return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to get trends")
	}
	defer rows.Close()

	var snapshots []models.StatsSnapshot
	for rows.Next() {
		var snapshot models.StatsSnapshot
		var genresWatched sql.NullString
		var avgSessionDuration sql.NullFloat64
		var longestStreak sql.NullInt64

		err := rows.Scan(
			&snapshot.ID, &snapshot.UserID, &snapshot.TotalWatchTimeMinutes,
			&snapshot.ShowsWatched, &snapshot.ShowsWatching, &snapshot.ShowsPending,
			&snapshot.EpisodesWatched, &genresWatched, &avgSessionDuration,
			&longestStreak, &snapshot.SnapshotDate, &snapshot.SnapshotType, &snapshot.CreatedAt,
			&snapshot.DeltaWatchTimeMinutes, &snapshot.DeltaEpisodesWatched,
		)
		if err != nil {
			log.Error().Err(err).Msg("Failed to scan stats snapshot")
			continue
		}

		if genresWatched.Valid {
			snapshot.GenresWatched = genresWatched.String
		}
		if avgSessionDuration.Valid {
			snapshot.AverageSessionDurationMinutes = &avgSessionDuration.Float64
		}
		if longestStreak.Valid {
			streak := int(longestStreak.Int64)
			snapshot.LongestWatchStreakDays = &streak
		}

		snapshots = append(snapshots, snapshot)
	}
	if err := rows.Err(); err != nil {
		log.Warn().Err(err).Msg("Error iterating trend snapshot rows")
	}

	return snapshots, nil
}

func (s *StatsService) GetMilestones(ctx context.Context, userID int) ([]models.Milestone, error) {
	var episodesWatched, totalWatchMinutes, longestStreak int
	var showsWatched, moviesWatched int
	var snapshotErr, showsErr, moviesErr error
	var wg sync.WaitGroup

	wg.Add(1)
	go func() {
		defer wg.Done()
		snapshotErr = s.db.QueryRowContext(ctx,
			`SELECT COALESCE(episodes_watched,0), COALESCE(total_watch_time_minutes,0), COALESCE(longest_watch_streak_days,0)
			 FROM stats_snapshots
			 WHERE user_id = ? AND snapshot_type = 'daily'
			 ORDER BY snapshot_date DESC LIMIT 1`,
			userID).Scan(&episodesWatched, &totalWatchMinutes, &longestStreak)
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		showsErr = s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM shows WHERE user_id = ? AND status = 'watched'`, userID).Scan(&showsWatched)
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		moviesErr = s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM movies WHERE user_id = ? AND status = 'watched'`, userID).Scan(&moviesWatched)
	}()

	wg.Wait()

	if snapshotErr != nil && snapshotErr != sql.ErrNoRows {
		return nil, errors.Wrap(snapshotErr, errors.CodeDatabaseError, "Failed to get snapshot")
	}
	if showsErr != nil {
		log.Warn().Err(showsErr).Msg("Failed to get shows watched count (GetMilestones)")
	}
	if moviesErr != nil {
		log.Warn().Err(moviesErr).Msg("Failed to get movies watched count (GetMilestones)")
	}

	totalHours := totalWatchMinutes / 60

	type spec struct {
		id          string
		title       string
		description string
		icon        string
		achieved    bool
	}

	specs := []spec{
		{"ep10", "First Ten", "Watched 10 episodes", "📺", episodesWatched >= 10},
		{"ep50", "Dedicated Viewer", "Watched 50 episodes", "🎬", episodesWatched >= 50},
		{"ep100", "Century Club", "Watched 100 episodes", "💯", episodesWatched >= 100},
		{"ep500", "Binge Master", "Watched 500 episodes", "🏆", episodesWatched >= 500},
		{"h10", "10 Hours In", "Watched 10 hours of content", "⏱️", totalHours >= 10},
		{"h50", "Half Century", "Watched 50 hours of content", "⌛", totalHours >= 50},
		{"h100", "Century of Hours", "Watched 100 hours of content", "🎯", totalHours >= 100},
		{"streak7", "Week Warrior", "Watched 7 days in a row", "🔥", longestStreak >= 7},
		{"streak30", "Monthly Dedication", "Watched 30 days in a row", "🌟", longestStreak >= 30},
		{"show1", "First Finish", "Completed your first show", "✅", showsWatched >= 1},
		{"show10", "Show Collector", "Completed 10 shows", "📚", showsWatched >= 10},
		{"show25", "Completionist", "Completed 25 shows", "🏅", showsWatched >= 25},
		{"movie1", "Movie Night", "Watched your first movie", "🎥", moviesWatched >= 1},
		{"movie25", "Film Buff", "Watched 25 movies", "🎞️", moviesWatched >= 25},
	}

	milestones := make([]models.Milestone, len(specs))
	for i, sp := range specs {
		milestones[i] = models.Milestone{
			ID:          sp.id,
			Title:       sp.title,
			Description: sp.description,
			Achieved:    sp.achieved,
			Icon:        sp.icon,
		}
	}
	return milestones, nil
}

func (s *StatsService) GetPeriodSummary(ctx context.Context, userID int, period string) (*models.PeriodSummary, error) {
	var dateFilter string
	if period == "year" {
		dateFilter = "date('now', 'start of year')"
	} else {
		dateFilter = "date('now', 'start of month')"
	}

	summary := &models.PeriodSummary{Period: period}
	var wg sync.WaitGroup

	wg.Add(1)
	go func() {
		defer wg.Done()
		s.db.QueryRowContext(ctx, `
			SELECT COALESCE(SUM(total_watch_time_minutes),0), COALESCE(SUM(episodes_watched),0)
			FROM (
				SELECT total_watch_time_minutes - prev_wt as total_watch_time_minutes,
				       episodes_watched - prev_ep as episodes_watched
				FROM (
					SELECT total_watch_time_minutes, episodes_watched,
					       LAG(total_watch_time_minutes,1,0) OVER (PARTITION BY user_id, snapshot_type ORDER BY snapshot_date) as prev_wt,
					       LAG(episodes_watched,1,0) OVER (PARTITION BY user_id, snapshot_type ORDER BY snapshot_date) as prev_ep,
					       snapshot_date
					FROM stats_snapshots WHERE user_id = ? AND snapshot_type = 'daily'
				)
				WHERE snapshot_date >= `+dateFilter+`
			)`,
			userID,
		).Scan(&summary.TotalWatchMinutes, &summary.EpisodesWatched)
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		s.db.QueryRowContext(ctx,
			`SELECT COUNT(*) FROM shows WHERE user_id = ? AND first_watched_at >= `+dateFilter+` AND first_watched_at IS NOT NULL`, userID,
		).Scan(&summary.ShowsStarted)
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		s.db.QueryRowContext(ctx,
			`SELECT COUNT(*) FROM shows WHERE user_id = ? AND status = 'watched' AND last_watched_at >= `+dateFilter+` AND last_watched_at IS NOT NULL`, userID,
		).Scan(&summary.ShowsCompleted)
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		s.db.QueryRowContext(ctx,
			`SELECT COUNT(*) FROM movies WHERE user_id = ? AND status = 'watched' AND last_watched_at >= `+dateFilter+` AND last_watched_at IS NOT NULL`, userID,
		).Scan(&summary.MoviesWatched)
	}()

	wg.Wait()

	// Compute top genre by counting every genre entry across watched shows/movies in the period.
	genreRows, err := s.db.QueryContext(ctx, `
		SELECT genre FROM shows WHERE user_id = ? AND genre IS NOT NULL AND last_watched_at >= `+dateFilter+`
		UNION ALL
		SELECT genre FROM movies WHERE user_id = ? AND genre IS NOT NULL AND last_watched_at >= `+dateFilter,
		userID, userID)
	if err == nil {
		defer genreRows.Close()
		genreCount := make(map[string]int)
		for genreRows.Next() {
			var gJSON string
			if genreRows.Scan(&gJSON) == nil {
				var genres []string
				if json.Unmarshal([]byte(gJSON), &genres) == nil {
					for _, g := range genres {
						genreCount[g]++
					}
				}
			}
		}
		var topGenre string
		var maxCount int
		for g, c := range genreCount {
			if c > maxCount {
				maxCount = c
				topGenre = g
			}
		}
		summary.TopGenre = topGenre
	}

	return summary, nil
}

func (s *StatsService) GetYearInReview(ctx context.Context, userID int, year int) (*models.YearInReview, error) {
	result := &models.YearInReview{
		Year:         year,
		TopGenres:    make(map[string]int),
		MonthByMonth: make([]models.MonthSummary, 0, 12),
	}

	yearStart := time.Date(year, 1, 1, 0, 0, 0, 0, time.UTC)
	yearEnd := time.Date(year, 12, 31, 23, 59, 59, 0, time.UTC)
	startStr := yearStart.Format("2006-01-02")
	endStr := yearEnd.Format("2006-01-02")

	var totalMinutes, episodesWatched, moviesWatched int
	err := s.db.QueryRowContext(ctx, `
		SELECT 
			COALESCE(SUM(CASE WHEN delta_wt > 0 THEN delta_wt ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN delta_ep > 0 THEN delta_ep ELSE 0 END), 0)
		FROM (
			SELECT 
				total_watch_time_minutes - LAG(total_watch_time_minutes, 1, 0) OVER (ORDER BY snapshot_date) AS delta_wt,
				episodes_watched - LAG(episodes_watched, 1, 0) OVER (ORDER BY snapshot_date) AS delta_ep
			FROM stats_snapshots
			WHERE user_id = ? AND snapshot_type = 'daily'
			  AND snapshot_date >= ? AND snapshot_date <= ?
		)`,
		userID, startStr, endStr).Scan(&totalMinutes, &episodesWatched)
	if err != nil && err != sql.ErrNoRows {
		return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to get year watch time")
	}
	result.TotalWatchMinutes = totalMinutes
	result.EpisodesWatched = episodesWatched

	_ = s.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM movies WHERE user_id = ? AND status = 'watched' 
		 AND date(last_watched_at) >= ? AND date(last_watched_at) <= ?`,
		userID, startStr, endStr).Scan(&moviesWatched)
	result.MoviesWatched = moviesWatched

	movieRows, err := s.db.QueryContext(ctx, `
		SELECT id, title, total_watch_time_minutes
		FROM movies
		WHERE user_id = ? AND last_watched_at IS NOT NULL
		  AND date(last_watched_at) >= ? AND date(last_watched_at) <= ?
		ORDER BY total_watch_time_minutes DESC
		LIMIT 5`, userID, startStr, endStr)
	if err != nil {
		log.Warn().Err(err).Int("user_id", userID).Msg("Failed to query top movies for year in review")
	} else {
		defer movieRows.Close()
		for movieRows.Next() {
			var item models.YearInReviewItem
			if movieRows.Scan(&item.ID, &item.Title, &item.TotalWatchTimeMinutes) == nil {
				result.TopMovies = append(result.TopMovies, item)
			}
		}
		if err := movieRows.Err(); err != nil {
			log.Warn().Err(err).Msg("Error iterating top movies for year in review")
		}
	}

	showRows, err := s.db.QueryContext(ctx, `
		SELECT id, title, total_watch_time_minutes
		FROM shows
		WHERE user_id = ? AND last_watched_at IS NOT NULL
		  AND date(last_watched_at) >= ? AND date(last_watched_at) <= ?
		ORDER BY total_watch_time_minutes DESC
		LIMIT 5`, userID, startStr, endStr)
	if err != nil {
		log.Warn().Err(err).Int("user_id", userID).Msg("Failed to query top shows for year in review")
	} else {
		defer showRows.Close()
		for showRows.Next() {
			var item models.YearInReviewItem
			if showRows.Scan(&item.ID, &item.Title, &item.TotalWatchTimeMinutes) == nil {
				result.TopShows = append(result.TopShows, item)
			}
		}
		if err := showRows.Err(); err != nil {
			log.Warn().Err(err).Msg("Error iterating top shows for year in review")
		}
	}

	genreRows, err := s.db.QueryContext(ctx, `
		SELECT genre FROM (
			SELECT genre FROM shows WHERE user_id = ? AND genre IS NOT NULL
			  AND date(last_watched_at) >= ? AND date(last_watched_at) <= ?
			UNION ALL
			SELECT genre FROM movies WHERE user_id = ? AND genre IS NOT NULL
			  AND date(last_watched_at) >= ? AND date(last_watched_at) <= ?
		)`, userID, startStr, endStr, userID, startStr, endStr)
	if err != nil {
		log.Warn().Err(err).Int("user_id", userID).Msg("Failed to query genres for year in review")
	} else {
		defer genreRows.Close()
		for genreRows.Next() {
			var genreJSON string
			if genreRows.Scan(&genreJSON) == nil && genreJSON != "" {
				var genres []string
				if json.Unmarshal([]byte(genreJSON), &genres) == nil {
					for _, g := range genres {
						result.TopGenres[g]++
					}
				}
			}
		}
		if err := genreRows.Err(); err != nil {
			log.Warn().Err(err).Msg("Error iterating genres for year in review")
		}
	}

	monthRows, err := s.db.QueryContext(ctx, `
		SELECT strftime('%Y-%m', snapshot_date) as month,
		       COALESCE(SUM(CASE WHEN prev_wt IS NOT NULL AND total_watch_time_minutes - prev_wt > 0
		                    THEN total_watch_time_minutes - prev_wt ELSE 0 END), 0),
		       COALESCE(SUM(CASE WHEN prev_ep IS NOT NULL AND episodes_watched - prev_ep > 0
		                    THEN episodes_watched - prev_ep ELSE 0 END), 0)
		FROM (
			SELECT total_watch_time_minutes, episodes_watched, snapshot_date,
			       LAG(total_watch_time_minutes, 1) OVER (ORDER BY snapshot_date) as prev_wt,
			       LAG(episodes_watched, 1) OVER (ORDER BY snapshot_date) as prev_ep
			FROM stats_snapshots
			WHERE user_id = ? AND snapshot_type = 'daily'
			  AND snapshot_date >= ? AND snapshot_date <= ?
		)
		GROUP BY strftime('%Y-%m', snapshot_date)
		ORDER BY month`, userID, startStr, endStr)
	if err != nil {
		log.Warn().Err(err).Int("user_id", userID).Msg("Failed to query month-by-month for year in review")
	} else {
		defer monthRows.Close()
		for monthRows.Next() {
			var ms models.MonthSummary
			if monthRows.Scan(&ms.Month, &ms.TotalWatchMinutes, &ms.EpisodesWatched) == nil {
				result.MonthByMonth = append(result.MonthByMonth, ms)
			}
		}
		if err := monthRows.Err(); err != nil {
			log.Warn().Err(err).Msg("Error iterating month-by-month for year in review")
		}
	}

	// Overlay per-month movie counts — movies table is the source of truth since movie
	// watch sessions may not be in watch_history on older databases.
	movieMonthRows, mmErr := s.db.QueryContext(ctx, `
		SELECT strftime('%Y-%m', last_watched_at) as month, COUNT(*)
		FROM movies
		WHERE user_id = ? AND status = 'watched'
		  AND date(last_watched_at) >= ? AND date(last_watched_at) <= ?
		GROUP BY strftime('%Y-%m', last_watched_at)
		ORDER BY month`, userID, startStr, endStr)
	if mmErr != nil {
		log.Warn().Err(mmErr).Int("user_id", userID).Msg("Failed to query per-month movies for year in review")
	} else {
		defer movieMonthRows.Close()
		monthIndex := make(map[string]int, len(result.MonthByMonth))
		for i, ms := range result.MonthByMonth {
			monthIndex[ms.Month] = i
		}
		for movieMonthRows.Next() {
			var month string
			var count int
			if movieMonthRows.Scan(&month, &count) == nil {
				if idx, ok := monthIndex[month]; ok {
					result.MonthByMonth[idx].MoviesWatched = count
				} else {
					result.MonthByMonth = append(result.MonthByMonth, models.MonthSummary{
						Month:         month,
						MoviesWatched: count,
					})
				}
			}
		}
		if err := movieMonthRows.Err(); err != nil {
			log.Warn().Err(err).Msg("Error iterating per-month movies for year in review")
		}
	}

	if result.TopMovies == nil {
		result.TopMovies = []models.YearInReviewItem{}
	}
	if result.TopShows == nil {
		result.TopShows = []models.YearInReviewItem{}
	}

	return result, nil
}

func (s *StatsService) GetWatchPatterns(ctx context.Context, userID int, days int) (map[string]interface{}, error) {
	byHour := make(map[string]int)
	byDow := make(map[string]int)
	for i := 0; i < 24; i++ {
		byHour[strconv.Itoa(i)] = 0
	}
	for i := 0; i < 7; i++ {
		byDow[strconv.Itoa(i)] = 0
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT CAST(strftime('%H', watched_at) AS INTEGER) as hour,
		       CAST(strftime('%w', watched_at) AS INTEGER) as dow,
		       COALESCE(duration_watched_minutes, 0)
		FROM watch_history
		WHERE user_id = ? AND watched_at >= datetime('now', ? || ' days')
		  AND duration_watched_minutes IS NOT NULL`, userID, "-"+strconv.Itoa(days))
	if err != nil {
		return map[string]interface{}{
			"by_hour":             byHour,
			"by_day_of_week":      byDow,
			"avg_session_minutes": float64(0),
		}, nil
	}
	defer rows.Close()

	var totalMinutes, sessionCount int64

	for rows.Next() {
		var hour, dow int
		var mins int64
		if rows.Scan(&hour, &dow, &mins) == nil {
			byHour[strconv.Itoa(hour)]++
			byDow[strconv.Itoa(dow)]++
			totalMinutes += mins
			sessionCount++
		}
	}
	if err := rows.Err(); err != nil {
		log.Warn().Err(err).Msg("Error iterating watch pattern rows")
	}

	avgSession := float64(0)
	if sessionCount > 0 {
		avgSession = float64(totalMinutes) / float64(sessionCount)
	}

	return map[string]interface{}{
		"by_hour":             byHour,
		"by_day_of_week":      byDow,
		"avg_session_minutes": avgSession,
	}, nil
}

func (s *StatsService) GetGoals(ctx context.Context, userID int) (map[string]interface{}, error) {
	result := map[string]interface{}{
		"weekly_progress":  0,
		"weekly_target":    0,
		"monthly_progress": 0,
		"monthly_target":   0,
		"current_streak":   0,
		"longest_streak":   0,
	}

	var prefsJSON sql.NullString
	_ = s.db.QueryRowContext(ctx, "SELECT preferences FROM users WHERE id = ? AND deleted_at IS NULL", userID).Scan(&prefsJSON)
	var prefs map[string]interface{}
	if prefsJSON.Valid && prefsJSON.String != "" {
		_ = json.Unmarshal([]byte(prefsJSON.String), &prefs)
	}
	if prefs == nil {
		prefs = make(map[string]interface{})
	}

	var weeklyTarget, monthlyTarget int
	if t, ok := prefs["weekly_target_minutes"].(float64); ok {
		weeklyTarget = int(t)
	}
	if t, ok := prefs["monthly_target_minutes"].(float64); ok {
		monthlyTarget = int(t)
	}
	result["weekly_target"] = weeklyTarget
	result["monthly_target"] = monthlyTarget

	var weeklyProgress, monthlyProgress int
	_ = s.db.QueryRowContext(ctx, `
		SELECT COALESCE(SUM(duration_watched_minutes), 0)
		FROM watch_history
		WHERE user_id = ? AND date(watched_at) >= date('now', 'weekday 0', '-6 days')
		  AND duration_watched_minutes IS NOT NULL`, userID).Scan(&weeklyProgress)

	_ = s.db.QueryRowContext(ctx, `
		SELECT COALESCE(SUM(duration_watched_minutes), 0)
		FROM watch_history
		WHERE user_id = ? AND date(watched_at) >= date('now', 'start of month')
		  AND duration_watched_minutes IS NOT NULL`, userID).Scan(&monthlyProgress)

	result["weekly_progress"] = weeklyProgress
	result["monthly_progress"] = monthlyProgress

	streak, _ := s.CalculateWatchStreak(ctx, userID)
	result["current_streak"] = streak

	var longestStreak int
	_ = s.db.QueryRowContext(ctx, `
		SELECT COALESCE(MAX(longest_watch_streak_days), 0)
		FROM stats_snapshots
		WHERE user_id = ? AND snapshot_type = 'daily'`, userID).Scan(&longestStreak)
	result["longest_streak"] = longestStreak

	return result, nil
}

// GetWeeklySummary returns this-week and last-week stats from watch_history,
// so QuickStats always has comparison data regardless of stats_snapshots.
func (s *StatsService) GetWeeklySummary(ctx context.Context, userID int) (*models.WeeklySummary, error) {
	result := &models.WeeklySummary{}

	// This week: last 7 days (today + 6 days back)
	_ = s.db.QueryRowContext(ctx, `
		SELECT
			COALESCE(SUM(duration_watched_minutes), 0),
			COUNT(CASE WHEN episode_id IS NOT NULL THEN 1 END),
			COUNT(DISTINCT CASE WHEN movie_id IS NOT NULL THEN movie_id END)
		FROM watch_history
		WHERE user_id = ? AND date(watched_at) >= date('now', '-6 days')
		  AND duration_watched_minutes IS NOT NULL`,
		userID).Scan(&result.ThisWeek.WatchTimeMinutes, &result.ThisWeek.EpisodesWatched, &result.ThisWeek.MoviesWatched)

	// Last week: 7-14 days ago
	_ = s.db.QueryRowContext(ctx, `
		SELECT
			COALESCE(SUM(duration_watched_minutes), 0),
			COUNT(CASE WHEN episode_id IS NOT NULL THEN 1 END),
			COUNT(DISTINCT CASE WHEN movie_id IS NOT NULL THEN movie_id END)
		FROM watch_history
		WHERE user_id = ? AND date(watched_at) >= date('now', '-13 days')
		  AND date(watched_at) < date('now', '-6 days')
		  AND duration_watched_minutes IS NOT NULL`,
		userID).Scan(&result.LastWeek.WatchTimeMinutes, &result.LastWeek.EpisodesWatched, &result.LastWeek.MoviesWatched)

	return result, nil
}

func (s *StatsService) CalculateWatchStreak(ctx context.Context, userID int) (int, error) {
	// Group consecutive dates by adding the DESC row number to each date —
	// for a run of consecutive days this sum is constant, forming an "island".
	// We then count the island that contains the most recent watch date.
	query := `
		WITH daily_watches AS (
			SELECT DISTINCT DATE(watched_at) as watch_date
			FROM watch_history
			WHERE user_id = ?
		),
		grouped AS (
			SELECT watch_date,
				   DATE(watch_date, '+' || ROW_NUMBER() OVER (ORDER BY watch_date DESC) || ' days') as grp
			FROM daily_watches
		)
		SELECT COUNT(*) as streak_days
		FROM grouped
		WHERE grp = (
			SELECT grp FROM grouped ORDER BY watch_date DESC LIMIT 1
		)
	`

	var streak int
	err := s.db.QueryRowContext(ctx, query, userID).Scan(&streak)
	if err == sql.ErrNoRows {
		return 0, nil
	}
	if err != nil {
		return 0, errors.Wrap(err, errors.CodeDatabaseError, "Failed to calculate watch streak")
	}

	return streak, nil
}

func (s *StatsService) CreateSnapshot(ctx context.Context, userID int) error {
	overview, err := s.GetOverview(ctx, userID)
	if err != nil {
		return err
	}

	genreBreakdown, err := s.GetGenreBreakdown(ctx, userID)
	if err != nil {
		return err
	}

	streak, err := s.CalculateWatchStreak(ctx, userID)
	if err != nil {
		return err
	}

	var avgSessionMinutes sql.NullFloat64
	_ = s.db.QueryRowContext(ctx,
		`SELECT AVG(duration_watched_minutes) FROM watch_history
		 WHERE user_id = ? AND duration_watched_minutes IS NOT NULL AND duration_watched_minutes > 0`,
		userID).Scan(&avgSessionMinutes)

	genreJSON, _ := json.Marshal(genreBreakdown)
	today := time.Now().Format("2006-01-02")

	// Snapshot stores combined shows+movies counts for backward-compatible trends queries.
	query := `
		INSERT INTO stats_snapshots
		(user_id, total_watch_time_minutes, shows_watched, shows_watching, shows_pending,
		 episodes_watched, genres_watched, longest_watch_streak_days,
		 average_session_duration_minutes, snapshot_date, snapshot_type)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'daily')
		ON CONFLICT(user_id, snapshot_date, snapshot_type)
		DO UPDATE SET
			total_watch_time_minutes = excluded.total_watch_time_minutes,
			shows_watched = excluded.shows_watched,
			shows_watching = excluded.shows_watching,
			shows_pending = excluded.shows_pending,
			episodes_watched = excluded.episodes_watched,
			genres_watched = excluded.genres_watched,
			longest_watch_streak_days = excluded.longest_watch_streak_days,
			average_session_duration_minutes = excluded.average_session_duration_minutes
	`

	_, err = s.db.ExecContext(ctx, query,
		userID,
		overview.TotalWatchTimeMinutes,
		overview.ShowsWatched+overview.MoviesWatched,
		overview.ShowsWatching+overview.MoviesWatching,
		overview.ShowsPending+overview.MoviesPending,
		overview.EpisodesWatched,
		string(genreJSON),
		streak,
		avgSessionMinutes,
		today,
	)

	if err != nil {
		return errors.Wrap(err, errors.CodeDatabaseError, "Failed to create snapshot")
	}

	return nil
}
