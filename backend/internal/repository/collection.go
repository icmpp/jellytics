package repository

import (
	"context"
	"database/sql"
	"strings"

	"jellytics/backend/internal/errors"
	"jellytics/backend/internal/models"
)

// CollectionStore defines data access for user collections and their items.
type CollectionStore interface {
	// List returns the user's collections. When filterItemType/filterItemID are
	// set, each row's HasItem reflects whether it contains that item.
	List(ctx context.Context, userID int, filterItemType string, filterItemID int) ([]models.CollectionListItem, error)
	// Create inserts a new collection and returns it.
	Create(ctx context.Context, userID int, name, description string) (models.Collection, error)
	// Get returns a collection with its resolved items, or nil if not found.
	Get(ctx context.Context, userID, id int) (*models.CollectionWithItems, error)
	// Update applies the non-nil fields to a collection, returning whether it existed.
	Update(ctx context.Context, userID, id int, name, description *string) (bool, error)
	// Delete removes a collection (and its items via cascade), returning whether it existed.
	Delete(ctx context.Context, userID, id int) (bool, error)
	// Owns reports whether the collection exists and belongs to the user.
	Owns(ctx context.Context, userID, id int) (bool, error)
	// AddItem adds an item to a collection (no-op if already present).
	AddItem(ctx context.Context, collectionID int, itemType string, itemID int) error
	// RemoveItem removes an item from a collection owned by the user, returning
	// whether a row was removed.
	RemoveItem(ctx context.Context, userID, collectionID int, itemType string, itemID int) (bool, error)
}

// SQLCollectionStore implements CollectionStore with SQLite.
type SQLCollectionStore struct {
	db *sql.DB
}

// NewSQLCollectionStore returns a new SQL-backed CollectionStore.
func NewSQLCollectionStore(db *sql.DB) *SQLCollectionStore {
	return &SQLCollectionStore{db: db}
}

func (s *SQLCollectionStore) List(ctx context.Context, userID int, filterItemType string, filterItemID int) ([]models.CollectionListItem, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT c.id, c.name, c.description, c.created_at,
		       (SELECT COUNT(*) FROM collection_items WHERE collection_id = c.id) as item_count
		FROM collections c
		WHERE c.user_id = ?
		ORDER BY c.updated_at DESC`, userID)
	if err != nil {
		return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to list collections")
	}
	defer rows.Close()

	collections := []models.CollectionListItem{}
	for rows.Next() {
		var c models.Collection
		if err := rows.Scan(&c.ID, &c.Name, &c.Description, &c.CreatedAt, &c.ItemCount); err != nil {
			return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to scan collection row")
		}
		item := models.CollectionListItem{Collection: c}
		if filterItemType != "" && filterItemID > 0 {
			var has int
			err := s.db.QueryRowContext(ctx,
				"SELECT 1 FROM collection_items WHERE collection_id = ? AND item_type = ? AND item_id = ? LIMIT 1",
				c.ID, filterItemType, filterItemID).Scan(&has)
			if err != nil && err != sql.ErrNoRows {
				return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to check collection item")
			}
			item.HasItem = has == 1
		}
		collections = append(collections, item)
	}
	if err := rows.Err(); err != nil {
		return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to iterate collections")
	}
	return collections, nil
}

func (s *SQLCollectionStore) Create(ctx context.Context, userID int, name, description string) (models.Collection, error) {
	res, err := s.db.ExecContext(ctx,
		"INSERT INTO collections (user_id, name, description) VALUES (?, ?, ?)",
		userID, name, description)
	if err != nil {
		return models.Collection{}, errors.Wrap(err, errors.CodeDatabaseError, "Failed to create collection")
	}
	id, err := res.LastInsertId()
	if err != nil {
		return models.Collection{}, errors.Wrap(err, errors.CodeDatabaseError, "Failed to get new collection ID")
	}

	var c models.Collection
	if err := s.db.QueryRowContext(ctx,
		"SELECT id, name, description, created_at, 0 FROM collections WHERE id = ?", id).
		Scan(&c.ID, &c.Name, &c.Description, &c.CreatedAt, &c.ItemCount); err != nil {
		return models.Collection{}, errors.Wrap(err, errors.CodeDatabaseError, "Failed to fetch created collection")
	}
	return c, nil
}

func (s *SQLCollectionStore) Get(ctx context.Context, userID, id int) (*models.CollectionWithItems, error) {
	var c models.Collection
	err := s.db.QueryRowContext(ctx, `
		SELECT id, name, description, created_at,
		       (SELECT COUNT(*) FROM collection_items WHERE collection_id = ?)
		FROM collections WHERE id = ? AND user_id = ?`,
		id, id, userID).Scan(&c.ID, &c.Name, &c.Description, &c.CreatedAt, &c.ItemCount)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to get collection")
	}

	itemRows, err := s.db.QueryContext(ctx, `
		SELECT ci.item_type, ci.item_id, COALESCE(m.title, s.title) as title,
		       COALESCE(m.jellyfin_id, s.jellyfin_id) as jellyfin_id
		FROM collection_items ci
		LEFT JOIN movies m ON ci.item_type = 'movie' AND ci.item_id = m.id AND m.user_id = ?
		LEFT JOIN shows s ON ci.item_type = 'show' AND ci.item_id = s.id AND s.user_id = ?
		WHERE ci.collection_id = ? AND (m.id IS NOT NULL OR s.id IS NOT NULL)
		ORDER BY ci.added_at DESC`, userID, userID, id)
	if err != nil {
		return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to get collection items")
	}
	defer itemRows.Close()

	items := []models.CollectionItem{}
	for itemRows.Next() {
		var it models.CollectionItem
		var jellyfinID sql.NullString
		if err := itemRows.Scan(&it.ItemType, &it.ItemID, &it.Title, &jellyfinID); err != nil {
			return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to scan collection item")
		}
		if jellyfinID.Valid && jellyfinID.String != "" {
			it.PosterURL = "/api/v1/images/" + it.ItemType + "s/" + jellyfinID.String + "/poster"
		}
		items = append(items, it)
	}
	if err := itemRows.Err(); err != nil {
		return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to iterate collection items")
	}

	return &models.CollectionWithItems{Collection: c, Items: items}, nil
}

func (s *SQLCollectionStore) Update(ctx context.Context, userID, id int, name, description *string) (bool, error) {
	var sets []string
	var args []interface{}
	if name != nil {
		sets = append(sets, "name = ?")
		args = append(args, *name)
	}
	if description != nil {
		sets = append(sets, "description = ?")
		args = append(args, *description)
	}
	if len(sets) == 0 {
		// Nothing to change; treat as a successful no-op against an owned row.
		return s.Owns(ctx, userID, id)
	}
	sets = append(sets, "updated_at = CURRENT_TIMESTAMP")
	args = append(args, id, userID)

	res, err := s.db.ExecContext(ctx,
		"UPDATE collections SET "+strings.Join(sets, ", ")+" WHERE id = ? AND user_id = ?", args...)
	if err != nil {
		return false, errors.Wrap(err, errors.CodeDatabaseError, "Failed to update collection")
	}
	n, _ := res.RowsAffected()
	return n > 0, nil
}

func (s *SQLCollectionStore) Delete(ctx context.Context, userID, id int) (bool, error) {
	res, err := s.db.ExecContext(ctx, "DELETE FROM collections WHERE id = ? AND user_id = ?", id, userID)
	if err != nil {
		return false, errors.Wrap(err, errors.CodeDatabaseError, "Failed to delete collection")
	}
	n, _ := res.RowsAffected()
	return n > 0, nil
}

func (s *SQLCollectionStore) Owns(ctx context.Context, userID, id int) (bool, error) {
	var exists int
	err := s.db.QueryRowContext(ctx,
		"SELECT 1 FROM collections WHERE id = ? AND user_id = ?", id, userID).Scan(&exists)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, errors.Wrap(err, errors.CodeDatabaseError, "Failed to verify collection")
	}
	return true, nil
}

func (s *SQLCollectionStore) AddItem(ctx context.Context, collectionID int, itemType string, itemID int) error {
	if _, err := s.db.ExecContext(ctx,
		"INSERT OR IGNORE INTO collection_items (collection_id, item_type, item_id) VALUES (?, ?, ?)",
		collectionID, itemType, itemID); err != nil {
		return errors.Wrap(err, errors.CodeDatabaseError, "Failed to add item")
	}
	return nil
}

func (s *SQLCollectionStore) RemoveItem(ctx context.Context, userID, collectionID int, itemType string, itemID int) (bool, error) {
	res, err := s.db.ExecContext(ctx,
		`DELETE FROM collection_items
		 WHERE collection_id = ? AND item_type = ? AND item_id = ?
		   AND collection_id IN (SELECT id FROM collections WHERE user_id = ?)`,
		collectionID, itemType, itemID, userID)
	if err != nil {
		return false, errors.Wrap(err, errors.CodeDatabaseError, "Failed to remove item")
	}
	n, _ := res.RowsAffected()
	return n > 0, nil
}
