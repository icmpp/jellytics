package models

import "time"

type Review struct {
	ID         int       `json:"id" db:"id"`
	UserID     int       `json:"user_id" db:"user_id"`
	ItemType   string    `json:"item_type" db:"item_type"`
	ItemID     int       `json:"item_id" db:"item_id"`
	ReviewText string    `json:"review_text" db:"review_text"`
	Notes      string    `json:"notes" db:"notes"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
	UpdatedAt  time.Time `json:"updated_at" db:"updated_at"`
}
