package repository

import (
	"context"
	"database/sql"
	"encoding/json"

	"jellytics/backend/internal/errors"
	"jellytics/backend/internal/models"
)

// NotificationStore defines data access for user notifications.
type NotificationStore interface {
	// List returns the user's most recent notifications (newest first, capped at
	// 50). When unreadOnly is true, only unread notifications are returned.
	List(ctx context.Context, userID int, unreadOnly bool) ([]models.Notification, error)
	// UnreadCount returns the number of unread notifications for the user.
	UnreadCount(ctx context.Context, userID int) (int, error)
	// MarkRead marks a single notification read, returning whether it existed.
	MarkRead(ctx context.Context, userID, id int) (bool, error)
	// MarkAllRead marks all of the user's unread notifications read.
	MarkAllRead(ctx context.Context, userID int) error
}

// SQLNotificationStore implements NotificationStore with SQLite.
type SQLNotificationStore struct {
	db *sql.DB
}

// NewSQLNotificationStore returns a new SQL-backed NotificationStore.
func NewSQLNotificationStore(db *sql.DB) *SQLNotificationStore {
	return &SQLNotificationStore{db: db}
}

func (s *SQLNotificationStore) List(ctx context.Context, userID int, unreadOnly bool) ([]models.Notification, error) {
	query := `SELECT id, type, title, body, data, read_at, created_at
		FROM notifications WHERE user_id = ?`
	if unreadOnly {
		query += " AND read_at IS NULL"
	}
	query += " ORDER BY created_at DESC LIMIT 50"

	rows, err := s.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to list notifications")
	}
	defer rows.Close()

	notifications := []models.Notification{}
	for rows.Next() {
		var n models.Notification
		var body, dataJSON, readAt sql.NullString
		if err := rows.Scan(&n.ID, &n.Type, &n.Title, &body, &dataJSON, &readAt, &n.CreatedAt); err != nil {
			return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to scan notification row")
		}
		n.Body = body.String
		if readAt.Valid {
			n.ReadAt = &readAt.String
		}
		if dataJSON.Valid && dataJSON.String != "" {
			_ = json.Unmarshal([]byte(dataJSON.String), &n.Data)
		}
		notifications = append(notifications, n)
	}
	if err := rows.Err(); err != nil {
		return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to iterate notifications")
	}
	return notifications, nil
}

func (s *SQLNotificationStore) UnreadCount(ctx context.Context, userID int) (int, error) {
	var count int
	if err := s.db.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM notifications WHERE user_id = ? AND read_at IS NULL", userID).Scan(&count); err != nil {
		return 0, errors.Wrap(err, errors.CodeDatabaseError, "Failed to count notifications")
	}
	return count, nil
}

func (s *SQLNotificationStore) MarkRead(ctx context.Context, userID, id int) (bool, error) {
	res, err := s.db.ExecContext(ctx,
		"UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?", id, userID)
	if err != nil {
		return false, errors.Wrap(err, errors.CodeDatabaseError, "Failed to mark notification read")
	}
	n, _ := res.RowsAffected()
	return n > 0, nil
}

func (s *SQLNotificationStore) MarkAllRead(ctx context.Context, userID int) error {
	if _, err := s.db.ExecContext(ctx,
		"UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND read_at IS NULL", userID); err != nil {
		return errors.Wrap(err, errors.CodeDatabaseError, "Failed to mark notifications read")
	}
	return nil
}
