package models

// HistoryItem is a single watch-history entry (episode or movie) as shown on the
// History page.
type HistoryItem struct {
	ID                   string   `json:"id"`
	Type                 string   `json:"type"` // "episode" | "movie"
	Title                string   `json:"title"`
	ShowTitle            *string  `json:"showTitle,omitempty"`
	SeasonNumber         *int     `json:"seasonNumber,omitempty"`
	EpisodeNumber        *int     `json:"episodeNumber,omitempty"`
	WatchedAt            string   `json:"watchedAt"`
	FirstWatchedAt       *string  `json:"firstWatchedAt,omitempty"`
	Duration             *int     `json:"duration,omitempty"`
	TotalWatchTime       *int     `json:"totalWatchTime,omitempty"`
	WatchCount           *int     `json:"watchCount,omitempty"`
	CompletionPercentage *float64 `json:"completionPercentage,omitempty"`
	Status               *string  `json:"status,omitempty"`
	PosterURL            *string  `json:"posterUrl,omitempty"`
	ShowID               *int     `json:"showId,omitempty"`
	MovieID              *int     `json:"movieId,omitempty"`
	RemovedFromLibrary   bool     `json:"removedFromLibrary,omitempty"`
}
