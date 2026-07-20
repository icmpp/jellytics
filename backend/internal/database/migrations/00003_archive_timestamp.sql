-- +goose Up
-- Records WHEN an item was detected as deleted from Jellyfin. deleted_from_jellyfin
-- is the archive marker; archived_at gives the archive page a real "Date Removed"
-- to sort on. Distinct from deleted_at, which is the user's "remove from library"
-- soft delete (hidden everywhere) — archived items stay visible, just flagged.
ALTER TABLE movies ADD COLUMN archived_at DATETIME;
ALTER TABLE shows ADD COLUMN archived_at DATETIME;

-- Backfill already-archived rows so existing data has a sensible removal time.
-- updated_at is the closest available approximation of when the sync flagged them.
UPDATE movies SET archived_at = updated_at WHERE deleted_from_jellyfin = 1 AND archived_at IS NULL;
UPDATE shows  SET archived_at = updated_at WHERE deleted_from_jellyfin = 1 AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_movies_archived_at ON movies(archived_at);
CREATE INDEX IF NOT EXISTS idx_shows_archived_at  ON shows(archived_at);

-- +goose Down
DROP INDEX IF EXISTS idx_movies_archived_at;
DROP INDEX IF EXISTS idx_shows_archived_at;
ALTER TABLE movies DROP COLUMN archived_at;
ALTER TABLE shows DROP COLUMN archived_at;
