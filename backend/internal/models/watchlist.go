package models

import "time"

type WatchlistItem struct {
	ID         int       `json:"id" db:"id"`
	UserID     int       `json:"user_id" db:"user_id"`
	ItemType   string    `json:"item_type" db:"item_type"`
	ItemID     int       `json:"item_id" db:"item_id"`
	JellyfinID string    `json:"jellyfin_id,omitempty"`
	Title      string    `json:"title" db:"title"`
	PosterURL  string    `json:"poster_url" db:"poster_url"`
	AddedAt    time.Time `json:"added_at" db:"added_at"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
	UpdatedAt  time.Time `json:"updated_at" db:"updated_at"`
}
