package models

import "time"

type ActiveSession struct {
	ID                 int       `json:"id" db:"id"`
	JellyfinSessionID  string    `json:"jellyfin_session_id" db:"jellyfin_session_id"`
	ItemID             string    `json:"item_id" db:"item_id"`
	ItemType           string    `json:"item_type" db:"item_type"`
	ItemName           string    `json:"item_name" db:"item_name"`
	SeriesID           string    `json:"series_id,omitempty" db:"series_id"`
	SeriesName         string    `json:"series_name,omitempty" db:"series_name"`
	EpisodeID          string    `json:"episode_id,omitempty" db:"episode_id"`
	SeasonNumber       int       `json:"season_number,omitempty" db:"season_number"`
	EpisodeNumber      int       `json:"episode_number,omitempty" db:"episode_number"`
	PositionTicks      int64     `json:"position_ticks" db:"position_ticks"`
	RuntimeTicks       int64     `json:"runtime_ticks" db:"runtime_ticks"`
	PlaybackPercentage float64   `json:"playback_percentage" db:"playback_percentage"`
	IsPaused           bool      `json:"is_paused" db:"is_paused"`
	ClientName         string    `json:"client_name" db:"client_name"`
	DeviceName         string    `json:"device_name" db:"device_name"`
	DeviceType         string    `json:"device_type" db:"device_type"`
	StartedAt          time.Time `json:"started_at" db:"started_at"`
	UpdatedAt          time.Time `json:"updated_at" db:"updated_at"`
}
