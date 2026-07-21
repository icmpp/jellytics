-- +goose Up
-- Guarantee one row per Jellyfin item. The baseline tables already declare these
-- UNIQUE constraints, so on any install created through goose this whole migration
-- is a no-op. It exists to (a) repair legacy databases whose tables predate the
-- constraints (created with CREATE TABLE IF NOT EXISTS, so never altered) and
-- (b) formalize the guarantee as named unique indexes the upsert code relies on.
--
-- Dedup keeps the lowest id per key and re-points watch history to the survivor
-- so watch data isn't orphaned, then the unique indexes are (re)created.

-- Movies: dedup on (jellyfin_id, user_id).
UPDATE watch_history
SET movie_id = (
    SELECT MIN(m2.id) FROM movies m2
    WHERE m2.jellyfin_id = (SELECT m1.jellyfin_id FROM movies m1 WHERE m1.id = watch_history.movie_id)
      AND m2.user_id    = (SELECT m1.user_id    FROM movies m1 WHERE m1.id = watch_history.movie_id)
)
WHERE movie_id IS NOT NULL
  AND movie_id NOT IN (SELECT MIN(id) FROM movies GROUP BY jellyfin_id, user_id);

DELETE FROM movies
WHERE id NOT IN (SELECT MIN(id) FROM movies GROUP BY jellyfin_id, user_id);

-- Shows: dedup on (jellyfin_id, user_id). Episodes of a removed duplicate show
-- cascade away (the surviving show keeps its own episode set).
UPDATE watch_history
SET show_id = (
    SELECT MIN(s2.id) FROM shows s2
    WHERE s2.jellyfin_id = (SELECT s1.jellyfin_id FROM shows s1 WHERE s1.id = watch_history.show_id)
      AND s2.user_id    = (SELECT s1.user_id    FROM shows s1 WHERE s1.id = watch_history.show_id)
)
WHERE show_id IS NOT NULL
  AND show_id NOT IN (SELECT MIN(id) FROM shows GROUP BY jellyfin_id, user_id);

DELETE FROM shows
WHERE id NOT IN (SELECT MIN(id) FROM shows GROUP BY jellyfin_id, user_id);

-- Episodes: dedup on the canonical (show_id, season_number, episode_number) key,
-- re-pointing watch history, then on (jellyfin_id, show_id) for index safety.
UPDATE watch_history
SET episode_id = (
    SELECT MIN(e2.id) FROM episodes e2
    WHERE e2.show_id        = (SELECT e1.show_id        FROM episodes e1 WHERE e1.id = watch_history.episode_id)
      AND e2.season_number  = (SELECT e1.season_number  FROM episodes e1 WHERE e1.id = watch_history.episode_id)
      AND e2.episode_number = (SELECT e1.episode_number FROM episodes e1 WHERE e1.id = watch_history.episode_id)
)
WHERE episode_id IS NOT NULL
  AND episode_id NOT IN (SELECT MIN(id) FROM episodes GROUP BY show_id, season_number, episode_number);

DELETE FROM episodes
WHERE id NOT IN (SELECT MIN(id) FROM episodes GROUP BY show_id, season_number, episode_number);

DELETE FROM episodes
WHERE id NOT IN (SELECT MIN(id) FROM episodes GROUP BY jellyfin_id, show_id);

-- Named unique indexes enforce uniqueness even where the inline table
-- constraints are absent, and give the ON CONFLICT upserts a stable target.
CREATE UNIQUE INDEX IF NOT EXISTS ux_movies_jellyfin_user   ON movies(jellyfin_id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_shows_jellyfin_user    ON shows(jellyfin_id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_episodes_jellyfin_show ON episodes(jellyfin_id, show_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_episodes_show_season_ep ON episodes(show_id, season_number, episode_number);

-- +goose Down
DROP INDEX IF EXISTS ux_movies_jellyfin_user;
DROP INDEX IF EXISTS ux_shows_jellyfin_user;
DROP INDEX IF EXISTS ux_episodes_jellyfin_show;
DROP INDEX IF EXISTS ux_episodes_show_season_ep;
