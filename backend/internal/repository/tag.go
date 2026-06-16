package repository

import (
	"context"
	"database/sql"
	"strings"

	"jellytics/backend/internal/errors"
	"jellytics/backend/internal/models"
)

// TagStore defines data access for user tags and media-tag associations.
type TagStore interface {
	List(ctx context.Context, userID int) ([]models.Tag, error)
	Create(ctx context.Context, userID int, name, color string) (models.Tag, error)
	Update(ctx context.Context, userID, id int, name, color *string) (bool, error)
	Delete(ctx context.Context, userID, id int) (bool, error)
	// Owns reports whether the tag exists and belongs to the user.
	Owns(ctx context.Context, userID, id int) (bool, error)
	// Name returns the tag's name, or ("", false) if it does not belong to the user.
	Name(ctx context.Context, userID, id int) (string, bool, error)
	// AddItem attaches a tag owned by the user to a media item. The ownership
	// guard is part of the write, so it cannot touch another user's tag.
	AddItem(ctx context.Context, userID, tagID int, itemType string, itemID int) error
	RemoveItem(ctx context.Context, userID, tagID int, itemType string, itemID int) (bool, error)
	// Items returns the media carrying a tag (resolved to titles/posters).
	Items(ctx context.Context, userID, tagID int) ([]models.TaggedItem, error)
	// ForItem returns the tags attached to a given media item.
	ForItem(ctx context.Context, userID int, itemType string, itemID int) ([]models.Tag, error)
}

// SQLTagStore implements TagStore with SQLite.
type SQLTagStore struct {
	db *sql.DB
}

// NewSQLTagStore returns a new SQL-backed TagStore.
func NewSQLTagStore(db *sql.DB) *SQLTagStore {
	return &SQLTagStore{db: db}
}

func defaultColor(c string) string {
	if c == "" {
		return models.DefaultTagColor
	}
	return c
}

func (s *SQLTagStore) List(ctx context.Context, userID int) ([]models.Tag, error) {
	rows, err := s.db.QueryContext(ctx,
		"SELECT id, name, color, created_at FROM tags WHERE user_id = ? ORDER BY name ASC", userID)
	if err != nil {
		return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to list tags")
	}
	defer rows.Close()

	tags := []models.Tag{}
	for rows.Next() {
		var t models.Tag
		if err := rows.Scan(&t.ID, &t.Name, &t.Color, &t.CreatedAt); err != nil {
			return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to scan tag row")
		}
		t.Color = defaultColor(t.Color)
		tags = append(tags, t)
	}
	if err := rows.Err(); err != nil {
		return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to iterate tags")
	}
	return tags, nil
}

func (s *SQLTagStore) Create(ctx context.Context, userID int, name, color string) (models.Tag, error) {
	res, err := s.db.ExecContext(ctx,
		"INSERT INTO tags (user_id, name, color) VALUES (?, ?, ?)",
		userID, name, defaultColor(color))
	if err != nil {
		return models.Tag{}, errors.Wrap(err, errors.CodeDatabaseError, "Failed to create tag")
	}
	id, err := res.LastInsertId()
	if err != nil {
		return models.Tag{}, errors.Wrap(err, errors.CodeDatabaseError, "Failed to get new tag ID")
	}

	var t models.Tag
	if err := s.db.QueryRowContext(ctx,
		"SELECT id, name, color, created_at FROM tags WHERE id = ?", id).
		Scan(&t.ID, &t.Name, &t.Color, &t.CreatedAt); err != nil {
		return models.Tag{}, errors.Wrap(err, errors.CodeDatabaseError, "Failed to fetch created tag")
	}
	return t, nil
}

func (s *SQLTagStore) Update(ctx context.Context, userID, id int, name, color *string) (bool, error) {
	var sets []string
	var args []interface{}
	if name != nil {
		sets = append(sets, "name = ?")
		args = append(args, strings.TrimSpace(*name))
	}
	if color != nil {
		sets = append(sets, "color = ?")
		args = append(args, *color)
	}
	if len(sets) == 0 {
		return s.Owns(ctx, userID, id)
	}
	args = append(args, id, userID)

	res, err := s.db.ExecContext(ctx,
		"UPDATE tags SET "+strings.Join(sets, ", ")+" WHERE id = ? AND user_id = ?", args...)
	if err != nil {
		return false, errors.Wrap(err, errors.CodeDatabaseError, "Failed to update tag")
	}
	n, _ := res.RowsAffected()
	return n > 0, nil
}

func (s *SQLTagStore) Delete(ctx context.Context, userID, id int) (bool, error) {
	res, err := s.db.ExecContext(ctx, "DELETE FROM tags WHERE id = ? AND user_id = ?", id, userID)
	if err != nil {
		return false, errors.Wrap(err, errors.CodeDatabaseError, "Failed to delete tag")
	}
	n, _ := res.RowsAffected()
	return n > 0, nil
}

func (s *SQLTagStore) Owns(ctx context.Context, userID, id int) (bool, error) {
	_, found, err := s.Name(ctx, userID, id)
	return found, err
}

func (s *SQLTagStore) Name(ctx context.Context, userID, id int) (string, bool, error) {
	var name string
	err := s.db.QueryRowContext(ctx,
		"SELECT name FROM tags WHERE id = ? AND user_id = ?", id, userID).Scan(&name)
	if err == sql.ErrNoRows {
		return "", false, nil
	}
	if err != nil {
		return "", false, errors.Wrap(err, errors.CodeDatabaseError, "Failed to get tag")
	}
	return name, true, nil
}

func (s *SQLTagStore) AddItem(ctx context.Context, userID, tagID int, itemType string, itemID int) error {
	if _, err := s.db.ExecContext(ctx,
		`INSERT OR IGNORE INTO media_tags (tag_id, item_type, item_id)
		 SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM tags WHERE id = ? AND user_id = ?)`,
		tagID, itemType, itemID, tagID, userID); err != nil {
		return errors.Wrap(err, errors.CodeDatabaseError, "Failed to add tag to item")
	}
	return nil
}

func (s *SQLTagStore) RemoveItem(ctx context.Context, userID, tagID int, itemType string, itemID int) (bool, error) {
	res, err := s.db.ExecContext(ctx,
		`DELETE FROM media_tags WHERE tag_id = ? AND item_type = ? AND item_id = ?
		 AND tag_id IN (SELECT id FROM tags WHERE user_id = ?)`,
		tagID, itemType, itemID, userID)
	if err != nil {
		return false, errors.Wrap(err, errors.CodeDatabaseError, "Failed to remove tag from item")
	}
	n, _ := res.RowsAffected()
	return n > 0, nil
}

func (s *SQLTagStore) Items(ctx context.Context, userID, tagID int) ([]models.TaggedItem, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT mt.item_type, mt.item_id, COALESCE(m.title, s.title),
		       COALESCE(m.jellyfin_id, s.jellyfin_id)
		FROM media_tags mt
		LEFT JOIN movies m ON mt.item_type = 'movie' AND mt.item_id = m.id AND m.user_id = ?
		LEFT JOIN shows s ON mt.item_type = 'show' AND mt.item_id = s.id AND s.user_id = ?
		WHERE mt.tag_id = ? AND (m.id IS NOT NULL OR s.id IS NOT NULL)
		ORDER BY COALESCE(m.title, s.title) ASC`, userID, userID, tagID)
	if err != nil {
		return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to list tag items")
	}
	defer rows.Close()

	items := []models.TaggedItem{}
	for rows.Next() {
		var it models.TaggedItem
		var jellyfinID sql.NullString
		if err := rows.Scan(&it.ItemType, &it.ItemID, &it.Title, &jellyfinID); err != nil {
			return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to scan tag item")
		}
		if jellyfinID.Valid && jellyfinID.String != "" {
			it.PosterURL = "/api/v1/images/" + it.ItemType + "s/" + jellyfinID.String + "/poster"
		}
		items = append(items, it)
	}
	if err := rows.Err(); err != nil {
		return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to iterate tag items")
	}
	return items, nil
}

func (s *SQLTagStore) ForItem(ctx context.Context, userID int, itemType string, itemID int) ([]models.Tag, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT t.id, t.name, t.color
		FROM tags t
		JOIN media_tags mt ON mt.tag_id = t.id
		WHERE t.user_id = ? AND mt.item_type = ? AND mt.item_id = ?`, userID, itemType, itemID)
	if err != nil {
		return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to get tags")
	}
	defer rows.Close()

	tags := []models.Tag{}
	for rows.Next() {
		var t models.Tag
		if err := rows.Scan(&t.ID, &t.Name, &t.Color); err != nil {
			return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to scan tag")
		}
		t.Color = defaultColor(t.Color)
		tags = append(tags, t)
	}
	if err := rows.Err(); err != nil {
		return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to iterate tags")
	}
	return tags, nil
}
