package models

import "time"

type Show struct {
	ID                    int        `json:"id" db:"id"`
	JellyfinID            string     `json:"jellyfin_id" db:"jellyfin_id"`
	Title                 string     `json:"title" db:"title"`
	Overview              string     `json:"overview" db:"overview"`
	PosterURL             string     `json:"poster_url" db:"poster_url"`
	LocalPosterPath       *string    `json:"local_poster_path" db:"local_poster_path"`
	DeletedFromJellyfin   bool       `json:"deleted_from_jellyfin" db:"deleted_from_jellyfin"`
	Genre                 string     `json:"genre" db:"genre"`
	Year                  *int       `json:"year" db:"year"`
	IMDBID                string     `json:"imdb_id" db:"imdb_id"`
	TMDBID                string     `json:"tmdb_id" db:"tmdb_id"`
	Status                string     `json:"status" db:"status"`
	TotalEpisodes         *int       `json:"total_episodes" db:"total_episodes"`
	WatchedEpisodes       int        `json:"watched_episodes" db:"watched_episodes"`
	TotalWatchTimeMinutes int        `json:"total_watch_time_minutes" db:"total_watch_time_minutes"`
	UserID                int        `json:"user_id" db:"user_id"`
	FirstWatchedAt        *time.Time `json:"first_watched_at" db:"first_watched_at"`
	LastWatchedAt         *time.Time `json:"last_watched_at" db:"last_watched_at"`
	CreatedAt             time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt             time.Time  `json:"updated_at" db:"updated_at"`
	RemovedFromLibrary    bool       `json:"removed_from_library"`
}

type Episode struct {
	ID                   int        `json:"id" db:"id"`
	ShowID               int        `json:"show_id" db:"show_id"`
	JellyfinID           string     `json:"jellyfin_id" db:"jellyfin_id"`
	Title                string     `json:"title" db:"title"`
	EpisodeNumber        int        `json:"episode_number" db:"episode_number"`
	SeasonNumber         int        `json:"season_number" db:"season_number"`
	DurationMinutes      *int       `json:"duration_minutes" db:"duration_minutes"`
	Watched              bool       `json:"watched" db:"watched"`
	WatchedAt            *time.Time `json:"watched_at" db:"watched_at"`
	WatchCount           int        `json:"watch_count" db:"watch_count"`
	CompletionPercentage *float64   `json:"completion_percentage" db:"completion_percentage"`
	CreatedAt            time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at" db:"updated_at"`
}
