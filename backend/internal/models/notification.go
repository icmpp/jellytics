package models

// Notification is a user-facing notification (new episodes, milestones, sync
// events, etc.). The JSON field names are camelCase to match the frontend.
type Notification struct {
	ID        int                    `json:"id"`
	Type      string                 `json:"type"`
	Title     string                 `json:"title"`
	Body      string                 `json:"body"`
	Data      map[string]interface{} `json:"data,omitempty"`
	ReadAt    *string                `json:"readAt,omitempty"`
	CreatedAt string                 `json:"createdAt"`
}
