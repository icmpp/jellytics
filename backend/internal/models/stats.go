package models

import "time"

type Milestone struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Achieved    bool   `json:"achieved"`
	Icon        string `json:"icon"`
}

type PeriodSummary struct {
	Period            string `json:"period"`
	TotalWatchMinutes int    `json:"total_watch_minutes"`
	EpisodesWatched   int    `json:"episodes_watched"`
	ShowsStarted      int    `json:"shows_started"`
	ShowsCompleted    int    `json:"shows_completed"`
	MoviesWatched     int    `json:"movies_watched"`
	TopGenre          string `json:"top_genre,omitempty"`
	MostWatchedDay    string `json:"most_watched_day,omitempty"`
}

type StatsOverview struct {
	TotalWatchTimeMinutes int `json:"total_watch_time_minutes"`
	ShowsWatched          int `json:"shows_watched"`
	ShowsWatching         int `json:"shows_watching"`
	ShowsPending          int `json:"shows_pending"`
	MoviesWatched         int `json:"movies_watched"`
	MoviesWatching        int `json:"movies_watching"`
	MoviesPending         int `json:"movies_pending"`
	EpisodesWatched       int `json:"episodes_watched"`
	TotalShows            int `json:"total_shows"`
	TotalMovies           int `json:"total_movies"`
}

type YearInReview struct {
	Year              int                `json:"year"`
	TotalWatchMinutes int                `json:"total_watch_minutes"`
	EpisodesWatched   int                `json:"episodes_watched"`
	MoviesWatched     int                `json:"movies_watched"`
	TopMovies         []YearInReviewItem `json:"top_movies"`
	TopShows          []YearInReviewItem `json:"top_shows"`
	TopGenres         map[string]int     `json:"top_genres"`
	MonthByMonth      []MonthSummary     `json:"month_by_month"`
}

type YearInReviewItem struct {
	ID                    int    `json:"id"`
	Title                 string `json:"title"`
	TotalWatchTimeMinutes int    `json:"total_watch_time_minutes"`
}

type MonthSummary struct {
	Month             string `json:"month"`
	TotalWatchMinutes int    `json:"total_watch_minutes"`
	EpisodesWatched   int    `json:"episodes_watched"`
	MoviesWatched     int    `json:"movies_watched"`
}

// WeeklyPeriodSummary holds watch stats for a single week.
type WeeklyPeriodSummary struct {
	WatchTimeMinutes int `json:"watch_time_minutes"`
	EpisodesWatched  int `json:"episodes_watched"`
	MoviesWatched    int `json:"movies_watched"`
}

// WeeklySummary holds this-week and last-week stats from watch_history.
type WeeklySummary struct {
	ThisWeek WeeklyPeriodSummary `json:"this_week"`
	LastWeek WeeklyPeriodSummary `json:"last_week"`
}

type StatsSnapshot struct {
	ID                            int       `json:"id" db:"id"`
	UserID                        int       `json:"user_id" db:"user_id"`
	TotalWatchTimeMinutes         int       `json:"total_watch_time_minutes" db:"total_watch_time_minutes"`
	DeltaWatchTimeMinutes         int       `json:"delta_watch_time_minutes"`
	ShowsWatched                  int       `json:"shows_watched" db:"shows_watched"`
	ShowsWatching                 int       `json:"shows_watching" db:"shows_watching"`
	ShowsPending                  int       `json:"shows_pending" db:"shows_pending"`
	EpisodesWatched               int       `json:"episodes_watched" db:"episodes_watched"`
	DeltaEpisodesWatched          int       `json:"delta_episodes_watched"`
	GenresWatched                 string    `json:"genres_watched" db:"genres_watched"` // JSON
	AverageSessionDurationMinutes *float64  `json:"average_session_duration_minutes" db:"average_session_duration_minutes"`
	LongestWatchStreakDays        *int      `json:"longest_watch_streak_days" db:"longest_watch_streak_days"`
	SnapshotDate                  time.Time `json:"snapshot_date" db:"snapshot_date"`
	SnapshotType                  string    `json:"snapshot_type" db:"snapshot_type"`
	CreatedAt                     time.Time `json:"created_at" db:"created_at"`
}
