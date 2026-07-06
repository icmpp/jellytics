package models

// SearchShow is a show match in global search.
type SearchShow struct {
	ID         int    `json:"id"`
	JellyfinID string `json:"jellyfin_id"`
	Title      string `json:"title"`
	Year       *int   `json:"year"`
	Status     string `json:"status"`
}

// SearchMovie is a movie match in global search.
type SearchMovie struct {
	ID         int    `json:"id"`
	JellyfinID string `json:"jellyfin_id"`
	Title      string `json:"title"`
	Year       *int   `json:"year"`
	Status     string `json:"status"`
}

// SearchEpisode is an episode match in global search.
type SearchEpisode struct {
	ID             int    `json:"id"`
	ShowID         int    `json:"show_id"`
	ShowJellyfinID string `json:"show_jellyfin_id"`
	ShowTitle      string `json:"show_title"`
	Title          string `json:"title"`
	SeasonNumber   int    `json:"season_number"`
	EpisodeNumber  int    `json:"episode_number"`
	Watched        bool   `json:"watched"`
}
