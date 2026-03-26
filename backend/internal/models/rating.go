package models

import "time"

type Rating struct {
	ID        int       `json:"id" db:"id"`
	UserID    int       `json:"user_id" db:"user_id"`
	ItemType  string    `json:"item_type" db:"item_type"`
	ItemID    int       `json:"item_id" db:"item_id"`
	Rating    int       `json:"rating" db:"rating"`
	RatedAt   time.Time `json:"rated_at" db:"rated_at"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}
