package models

// DefaultTagColor is applied when a tag has no explicit color.
const DefaultTagColor = "#6366f1"

// Tag is a user-defined label that can be attached to media.
type Tag struct {
	ID        int    `json:"id"`
	Name      string `json:"name"`
	Color     string `json:"color"`
	CreatedAt string `json:"createdAt"`
}

// TaggedItem is a movie/show that carries a given tag.
type TaggedItem struct {
	ItemType  string `json:"itemType"`
	ItemID    int    `json:"itemId"`
	Title     string `json:"title"`
	PosterURL string `json:"posterUrl,omitempty"`
}
