package models

import "time"

type User struct {
	ID                     int        `json:"id" db:"id"`
	Username               string     `json:"username" db:"username"`
	JellyfinUserID         string     `json:"jellyfin_user_id" db:"jellyfin_user_id"`
	JellyfinServerURL      string     `json:"jellyfin_server_url" db:"jellyfin_server_url"`
	JellyfinAccessToken    string     `json:"-" db:"jellyfin_access_token"`
	JellyfinTokenExpiresAt *time.Time `json:"-" db:"jellyfin_token_expires_at"`
	LastLoginAt            *time.Time `json:"last_login_at" db:"last_login_at"`
	LastLoginIP            string     `json:"-" db:"last_login_ip"`
	Timezone               string     `json:"timezone" db:"timezone"`
	CreatedAt              time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt              time.Time  `json:"updated_at" db:"updated_at"`
	LastSyncAt             *time.Time `json:"last_sync_at" db:"last_sync_at"`
}
