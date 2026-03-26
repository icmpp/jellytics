package models

import "time"

type Movie struct {
	ID                    int        `json:"id" db:"id"`
	JellyfinID            string     `json:"jellyfin_id" db:"jellyfin_id"`
	Title                 string     `json:"title" db:"title"`
	Overview              string     `json:"overview" db:"overview"`
	PosterURL             string     `json:"poster_url" db:"poster_url"`
	BackdropURL           string     `json:"backdrop_url" db:"backdrop_url"`
	LocalPosterPath       *string    `json:"local_poster_path" db:"local_poster_path"`
	LocalBackdropPath     *string    `json:"local_backdrop_path" db:"local_backdrop_path"`
	DeletedFromJellyfin   bool       `json:"deleted_from_jellyfin" db:"deleted_from_jellyfin"`
	Genre                 string     `json:"genre" db:"genre"`
	Year                  *int       `json:"year" db:"year"`
	IMDBID                string     `json:"imdb_id" db:"imdb_id"`
	TMDBID                string     `json:"tmdb_id" db:"tmdb_id"`
	RuntimeMinutes        *int       `json:"runtime_minutes" db:"runtime_minutes"`
	Status                string     `json:"status" db:"status"`
	Watched               bool       `json:"watched" db:"watched"`
	WatchCount            int        `json:"watch_count" db:"watch_count"`
	TotalWatchTimeMinutes int        `json:"total_watch_time_minutes" db:"total_watch_time_minutes"`
	CompletionPercentage  float64    `json:"completion_percentage" db:"completion_percentage"`
	UserID                int        `json:"user_id" db:"user_id"`
	FirstWatchedAt        *time.Time `json:"first_watched_at" db:"first_watched_at"`
	LastWatchedAt         *time.Time `json:"last_watched_at" db:"last_watched_at"`
	CreatedAt             time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt             time.Time  `json:"updated_at" db:"updated_at"`
	RemovedFromLibrary    bool       `json:"removed_from_library"`
}
