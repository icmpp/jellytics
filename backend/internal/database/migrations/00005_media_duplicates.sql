-- +goose Up
-- Semantic de-duplication: when Jellyfin holds the same title as several items
-- (different jellyfin_ids — e.g. re-imports or multiple libraries), we keep one
-- canonical row per user and point the rest at it via duplicate_of. Rows with
-- duplicate_of set are hidden from the library, search, stats, etc.; their watch
-- data is rolled onto the canonical. Recomputed every sync so it self-heals.
ALTER TABLE movies ADD COLUMN duplicate_of INTEGER;
ALTER TABLE shows ADD COLUMN duplicate_of INTEGER;

-- Filtering hidden duplicates, and grouping candidates by external id.
CREATE INDEX IF NOT EXISTS idx_movies_duplicate_of ON movies(duplicate_of);
CREATE INDEX IF NOT EXISTS idx_shows_duplicate_of  ON shows(duplicate_of);
CREATE INDEX IF NOT EXISTS idx_movies_user_tmdb ON movies(user_id, tmdb_id);
CREATE INDEX IF NOT EXISTS idx_movies_user_imdb ON movies(user_id, imdb_id);
CREATE INDEX IF NOT EXISTS idx_shows_user_tmdb  ON shows(user_id, tmdb_id);
CREATE INDEX IF NOT EXISTS idx_shows_user_imdb  ON shows(user_id, imdb_id);

-- +goose Down
DROP INDEX IF EXISTS idx_movies_duplicate_of;
DROP INDEX IF EXISTS idx_shows_duplicate_of;
DROP INDEX IF EXISTS idx_movies_user_tmdb;
DROP INDEX IF EXISTS idx_movies_user_imdb;
DROP INDEX IF EXISTS idx_shows_user_tmdb;
DROP INDEX IF EXISTS idx_shows_user_imdb;
ALTER TABLE movies DROP COLUMN duplicate_of;
ALTER TABLE shows DROP COLUMN duplicate_of;
