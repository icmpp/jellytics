package models

// RecommendationItem is a single recommended movie/show.
type RecommendationItem struct {
	ID                   int     `json:"id"`
	Type                 string  `json:"type"` // "movie" | "show"
	Title                string  `json:"title"`
	PosterURL            *string `json:"posterUrl,omitempty"`
	JellyfinID           string  `json:"jellyfinId"`
	CompletionPercentage float64 `json:"completionPercentage,omitempty"`
	Reason               string  `json:"reason"` // "similar" | "watchlist" | "discover"
}
