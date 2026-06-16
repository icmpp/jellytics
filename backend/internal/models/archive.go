package models

// ArchiveItem is a soft-deleted (removed from Jellyfin) movie or show.
type ArchiveItem struct {
	ID                 int     `json:"id"`
	Type               string  `json:"type"` // "movie" | "show"
	JellyfinID         string  `json:"jellyfin_id"`
	Title              string  `json:"title"`
	PosterURL          *string `json:"posterUrl,omitempty"`
	Year               *int    `json:"year,omitempty"`
	Status             string  `json:"status,omitempty"`
	TotalWatchTimeMins int     `json:"totalWatchTimeMinutes,omitempty"`
	WatchCount         int     `json:"watchCount,omitempty"`
	RemovedAt          *string `json:"removedAt,omitempty"` // ISO8601 for "Date Removed" sorting
}
