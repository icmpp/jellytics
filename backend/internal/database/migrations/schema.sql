-- Jellystat database schema
-- Single consolidated schema file - all tables, columns, indexes and triggers.
-- Every statement uses IF NOT EXISTS / OR IGNORE so the file is safe to re-run
-- against both a brand-new database and an existing one.

PRAGMA foreign_keys = ON;

-- ─── Tables ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
    id                       INTEGER  PRIMARY KEY AUTOINCREMENT,
    username                 TEXT     NOT NULL,
    jellyfin_user_id         TEXT     NOT NULL UNIQUE,
    jellyfin_server_url      TEXT     NOT NULL,
    jellyfin_access_token    TEXT,
    jellyfin_token_valid     INTEGER  NOT NULL DEFAULT 1,
    jellyfin_token_expires_at DATETIME,
    jellyfin_api_key         TEXT,
    password_hash            TEXT,
    failed_login_attempts    INTEGER  DEFAULT 0,
    account_locked_until     DATETIME,
    last_login_at            DATETIME,
    last_login_ip            TEXT,
    mfa_enabled              BOOLEAN  DEFAULT 0,
    mfa_secret               TEXT,
    timezone                 TEXT     DEFAULT 'UTC',
    preferences              TEXT,    -- JSON
    created_at               DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at               DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_sync_at             DATETIME,
    deleted_at               DATETIME
);

CREATE TABLE IF NOT EXISTS shows (
    id                        INTEGER  PRIMARY KEY AUTOINCREMENT,
    jellyfin_id               TEXT     NOT NULL,
    title                     TEXT     NOT NULL,
    overview                  TEXT,
    poster_url                TEXT,
    genre                     TEXT,    -- JSON array
    year                      INTEGER,
    imdb_id                   TEXT,
    tmdb_id                   TEXT,
    status                    TEXT     CHECK(status IN ('watched', 'watching', 'pending')),
    total_episodes            INTEGER,
    watched_episodes          INTEGER  DEFAULT 0,
    total_watch_time_minutes  INTEGER  DEFAULT 0,
    user_id                   INTEGER  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    first_watched_at          DATETIME,
    last_watched_at           DATETIME,
    created_at                DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at                DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at                DATETIME,
    jellyfin_last_modified_at DATETIME,
    sync_hash                 TEXT,
    userdata_hash             TEXT,
    local_poster_path         TEXT,
    deleted_from_jellyfin     INTEGER  DEFAULT 0,
    UNIQUE(jellyfin_id, user_id)
);

CREATE TABLE IF NOT EXISTS episodes (
    id                   INTEGER  PRIMARY KEY AUTOINCREMENT,
    show_id              INTEGER  NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
    jellyfin_id          TEXT     NOT NULL,
    title                TEXT,
    episode_number       INTEGER  NOT NULL,
    season_number        INTEGER  NOT NULL,
    duration_minutes     INTEGER,
    watched              BOOLEAN  DEFAULT 0,
    watched_at           DATETIME,
    watch_count          INTEGER  DEFAULT 0,
    completion_percentage REAL,
    created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(jellyfin_id, show_id),
    UNIQUE(show_id, season_number, episode_number)
);

CREATE TABLE IF NOT EXISTS watch_history (
    id                       INTEGER  PRIMARY KEY AUTOINCREMENT,
    user_id                  INTEGER  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    show_id                  INTEGER  REFERENCES shows(id) ON DELETE CASCADE,
    episode_id               INTEGER  REFERENCES episodes(id) ON DELETE SET NULL,
    movie_id                 INTEGER  REFERENCES movies(id)   ON DELETE SET NULL,
    watched_at               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    duration_watched_minutes INTEGER,
    completion_percentage    REAL,
    device_type              TEXT,
    source                   TEXT,
    jellyfin_session_id      TEXT,
    position_ticks           BIGINT,
    runtime_ticks            BIGINT,
    client_name              TEXT,
    device_name              TEXT,
    created_at               DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS movies (
    id                        INTEGER  PRIMARY KEY AUTOINCREMENT,
    jellyfin_id               TEXT     NOT NULL,
    title                     TEXT     NOT NULL,
    overview                  TEXT,
    poster_url                TEXT,
    backdrop_url              TEXT,
    genre                     TEXT,    -- JSON array
    year                      INTEGER,
    imdb_id                   TEXT,
    tmdb_id                   TEXT,
    runtime_minutes           INTEGER,
    status                    TEXT     CHECK(status IN ('watched', 'watching', 'pending')),
    watched                   BOOLEAN  DEFAULT 0,
    watch_count               INTEGER  DEFAULT 0,
    total_watch_time_minutes  INTEGER  DEFAULT 0,
    user_id                   INTEGER  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    first_watched_at          DATETIME,
    last_watched_at           DATETIME,
    completion_percentage     REAL     DEFAULT 0,
    created_at                DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at                DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at                DATETIME,
    jellyfin_last_modified_at DATETIME,
    sync_hash                 TEXT,
    userdata_hash             TEXT,
    local_poster_path         TEXT,
    local_backdrop_path       TEXT,
    deleted_from_jellyfin     INTEGER  DEFAULT 0,
    UNIQUE(jellyfin_id, user_id)
);

CREATE TABLE IF NOT EXISTS active_sessions (
    id                   INTEGER  PRIMARY KEY AUTOINCREMENT,
    user_id              INTEGER  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    jellyfin_session_id  TEXT     NOT NULL,
    jellyfin_user_id     TEXT     NOT NULL,
    item_id              TEXT     NOT NULL,
    item_type            TEXT     NOT NULL CHECK(item_type IN ('Episode', 'Movie')),
    item_name            TEXT     NOT NULL,
    series_id            TEXT,
    series_name          TEXT,
    episode_id           TEXT,
    season_number        INTEGER,
    episode_number       INTEGER,
    position_ticks       BIGINT   DEFAULT 0,
    runtime_ticks        BIGINT   DEFAULT 0,
    playback_percentage  REAL     DEFAULT 0,
    is_paused            BOOLEAN  DEFAULT 0,
    client_name          TEXT,
    device_name          TEXT,
    device_type          TEXT,
    application_version  TEXT,
    ip_address           TEXT,
    started_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at             DATETIME,
    UNIQUE(jellyfin_session_id, user_id)
);

CREATE TABLE IF NOT EXISTS session_history (
    id                      INTEGER  PRIMARY KEY AUTOINCREMENT,
    user_id                 INTEGER  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    jellyfin_session_id     TEXT     NOT NULL,
    jellyfin_user_id        TEXT     NOT NULL,
    item_id                 TEXT     NOT NULL,
    item_type               TEXT     NOT NULL,
    item_name               TEXT     NOT NULL,
    series_id               TEXT,
    series_name             TEXT,
    episode_id              TEXT,
    season_number           INTEGER,
    episode_number          INTEGER,
    position_ticks_start    BIGINT   DEFAULT 0,
    position_ticks_end      BIGINT   DEFAULT 0,
    runtime_ticks           BIGINT   DEFAULT 0,
    completion_percentage   REAL     DEFAULT 0,
    client_name             TEXT,
    device_name             TEXT,
    device_type             TEXT,
    application_version     TEXT,
    ip_address              TEXT,
    started_at              DATETIME NOT NULL,
    ended_at                DATETIME,
    duration_seconds        INTEGER,
    created_at              DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stats_snapshots (
    id                               INTEGER  PRIMARY KEY AUTOINCREMENT,
    user_id                          INTEGER  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total_watch_time_minutes         INTEGER  DEFAULT 0,
    shows_watched                    INTEGER  DEFAULT 0,
    shows_watching                   INTEGER  DEFAULT 0,
    shows_pending                    INTEGER  DEFAULT 0,
    episodes_watched                 INTEGER  DEFAULT 0,
    genres_watched                   TEXT,    -- JSON
    average_session_duration_minutes REAL,
    longest_watch_streak_days        INTEGER,
    snapshot_date                    DATE     NOT NULL,
    snapshot_type                    TEXT     DEFAULT 'daily',
    created_at                       DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, snapshot_date, snapshot_type)
);

CREATE TABLE IF NOT EXISTS sync_logs (
    id                INTEGER  PRIMARY KEY AUTOINCREMENT,
    user_id           INTEGER  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sync_started_at   DATETIME NOT NULL,
    sync_completed_at DATETIME,
    status            TEXT     CHECK(status IN ('success', 'failed', 'partial')),
    items_synced      INTEGER  DEFAULT 0,
    items_failed      INTEGER  DEFAULT 0,
    error_message     TEXT,
    duration_seconds  REAL,
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sync_state (
    id                       INTEGER  PRIMARY KEY AUTOINCREMENT,
    user_id                  INTEGER  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entity_type              TEXT     NOT NULL, -- 'shows', 'movies', 'episodes'
    last_sync_at             DATETIME,
    last_jellyfin_modified_at DATETIME,
    items_synced             INTEGER  DEFAULT 0,
    sync_cursor              TEXT,
    created_at               DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at               DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, entity_type)
);

CREATE TABLE IF NOT EXISTS sessions (
    id               TEXT     PRIMARY KEY,
    user_id          INTEGER  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ip_address       TEXT,
    user_agent       TEXT,
    expires_at       DATETIME NOT NULL,
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    revoked          BOOLEAN  DEFAULT 0
);

CREATE TABLE IF NOT EXISTS watchlist (
    id         INTEGER  PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_type  TEXT     NOT NULL CHECK(item_type IN ('show', 'movie')),
    item_id    INTEGER  NOT NULL,
    title      TEXT     NOT NULL,
    poster_url TEXT,
    jellyfin_id TEXT,
    added_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, item_type, item_id)
);

CREATE TABLE IF NOT EXISTS ratings (
    id         INTEGER  PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_type  TEXT     NOT NULL CHECK(item_type IN ('show', 'movie')),
    item_id    INTEGER  NOT NULL,
    rating     INTEGER  NOT NULL CHECK(rating >= 1 AND rating <= 10),
    rated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, item_type, item_id)
);

CREATE TABLE IF NOT EXISTS reviews (
    id          INTEGER  PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_type   TEXT     NOT NULL CHECK(item_type IN ('show', 'movie')),
    item_id     INTEGER  NOT NULL,
    review_text TEXT     NOT NULL,
    notes       TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, item_type, item_id)
);

CREATE TABLE IF NOT EXISTS collections (
    id          INTEGER  PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT     NOT NULL,
    description TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS collection_items (
    collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    item_type     TEXT    NOT NULL CHECK(item_type IN ('show', 'movie')),
    item_id       INTEGER NOT NULL,
    added_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (collection_id, item_type, item_id)
);

CREATE TABLE IF NOT EXISTS system_settings (
    key        TEXT     PRIMARY KEY,
    value      TEXT     NOT NULL,
    description TEXT,
    category   TEXT     DEFAULT 'general',
    data_type  TEXT     DEFAULT 'string', -- string, int, bool, json
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ─── Default system settings ─────────────────────────────────────────────────

INSERT OR IGNORE INTO system_settings (key, value, description, category, data_type) VALUES
    ('sync_interval_seconds',        '300',   'Full library sync interval (seconds)',                    'sync',     'int'),
    ('sessions_sync_interval_seconds','90',   'Active sessions sync interval (seconds)',                'sync',     'int'),
    ('sync_worker_pool_size',        '5',     'Number of concurrent sync workers',                     'sync',     'int'),
    ('sync_enabled',                 'true',  'Enable automatic background syncing',                   'sync',     'bool'),
    ('rate_limit_requests_per_minute','100',  'API rate limit requests per minute',                    'security', 'int'),
    ('rate_limit_burst_size',        '10',    'API rate limit burst size',                             'security', 'int'),
    ('jwt_access_expiry_minutes',    '15',    'JWT access token expiry in minutes',                    'security', 'int'),
    ('jwt_refresh_expiry_hours',     '168',   'JWT refresh token expiry in hours (168 = 7 days)',      'security', 'int'),
    ('log_level',                    'info',  'Logging level (debug, info, warn, error)',               'system',   'string'),
    ('maintenance_mode',             'false', 'Enable maintenance mode',                               'system',   'bool');

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_users_jellyfin_user_id         ON users(jellyfin_user_id);
CREATE INDEX IF NOT EXISTS idx_users_username                  ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at                ON users(deleted_at);

CREATE INDEX IF NOT EXISTS idx_shows_user_id_status_genre      ON shows(user_id, status, genre);
CREATE INDEX IF NOT EXISTS idx_shows_user_id_last_watched_at   ON shows(user_id, last_watched_at);
CREATE INDEX IF NOT EXISTS idx_shows_deleted_at                ON shows(deleted_at);
CREATE INDEX IF NOT EXISTS idx_shows_jellyfin_last_modified    ON shows(jellyfin_last_modified_at);
CREATE INDEX IF NOT EXISTS idx_shows_user_deleted              ON shows(user_id, deleted_from_jellyfin);

CREATE INDEX IF NOT EXISTS idx_episodes_show_id_watched_season ON episodes(show_id, watched, season_number);
CREATE INDEX IF NOT EXISTS idx_episodes_show_id_season_episode ON episodes(show_id, season_number, episode_number);
CREATE INDEX IF NOT EXISTS idx_episodes_watched_at             ON episodes(watched_at);

CREATE INDEX IF NOT EXISTS idx_watch_history_user_id_watched_at  ON watch_history(user_id, watched_at);
CREATE INDEX IF NOT EXISTS idx_watch_history_show_id_watched_at  ON watch_history(show_id, watched_at);
CREATE INDEX IF NOT EXISTS idx_watch_history_episode_id_watched_at ON watch_history(episode_id, watched_at);
CREATE INDEX IF NOT EXISTS idx_watch_history_watched_at          ON watch_history(watched_at);
CREATE INDEX IF NOT EXISTS idx_watch_history_movie_id            ON watch_history(movie_id);
CREATE INDEX IF NOT EXISTS idx_watch_history_jellyfin_session_id ON watch_history(jellyfin_session_id);
CREATE INDEX IF NOT EXISTS idx_watch_history_dedup               ON watch_history(user_id, show_id, episode_id, date(watched_at));
CREATE INDEX IF NOT EXISTS idx_watch_history_created_at          ON watch_history(created_at);

CREATE INDEX IF NOT EXISTS idx_movies_user_id_status_genre     ON movies(user_id, status, genre);
CREATE INDEX IF NOT EXISTS idx_movies_user_id_last_watched_at  ON movies(user_id, last_watched_at);
CREATE INDEX IF NOT EXISTS idx_movies_deleted_at               ON movies(deleted_at);
CREATE INDEX IF NOT EXISTS idx_movies_jellyfin_last_modified   ON movies(jellyfin_last_modified_at);
CREATE INDEX IF NOT EXISTS idx_movies_user_deleted             ON movies(user_id, deleted_from_jellyfin);

CREATE INDEX IF NOT EXISTS idx_active_sessions_user_id              ON active_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_jellyfin_session_id  ON active_sessions(jellyfin_session_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_item_id              ON active_sessions(item_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_updated_at           ON active_sessions(updated_at);
CREATE INDEX IF NOT EXISTS idx_active_sessions_ended_at             ON active_sessions(ended_at);

CREATE INDEX IF NOT EXISTS idx_session_history_user_id_started_at   ON session_history(user_id, started_at);
CREATE INDEX IF NOT EXISTS idx_session_history_item_id_started_at   ON session_history(item_id, started_at);
CREATE INDEX IF NOT EXISTS idx_session_history_jellyfin_session_id  ON session_history(jellyfin_session_id);

CREATE INDEX IF NOT EXISTS idx_stats_snapshots_user_id_date ON stats_snapshots(user_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_stats_snapshots_date         ON stats_snapshots(snapshot_date);

CREATE INDEX IF NOT EXISTS idx_sync_logs_user_id_started_at ON sync_logs(user_id, sync_started_at);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status_started_at  ON sync_logs(status, sync_started_at);

CREATE INDEX IF NOT EXISTS idx_sync_state_user_entity ON sync_state(user_id, entity_type);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id_expires_at ON sessions(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at         ON sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_watchlist_user_id           ON watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_user_id_item_type ON watchlist(user_id, item_type);
CREATE INDEX IF NOT EXISTS idx_watchlist_item_id_item_type ON watchlist(item_id, item_type);
CREATE INDEX IF NOT EXISTS idx_watchlist_added_at          ON watchlist(added_at);

CREATE INDEX IF NOT EXISTS idx_ratings_user_id           ON ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_ratings_item_type_item_id ON ratings(item_type, item_id);
CREATE INDEX IF NOT EXISTS idx_ratings_user_item         ON ratings(user_id, item_type, item_id);

CREATE INDEX IF NOT EXISTS idx_reviews_user_id           ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_item_type_item_id ON reviews(item_type, item_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_item         ON reviews(user_id, item_type, item_id);

CREATE INDEX IF NOT EXISTS idx_collections_user_id       ON collections(user_id);
CREATE INDEX IF NOT EXISTS idx_collection_items_collection_id ON collection_items(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_items_item    ON collection_items(item_type, item_id);

CREATE TABLE IF NOT EXISTS tags (
    id         INTEGER  PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       TEXT     NOT NULL,
    color      TEXT     DEFAULT '#6366f1',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS media_tags (
    tag_id    INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    item_type TEXT    NOT NULL CHECK(item_type IN ('show', 'movie')),
    item_id   INTEGER NOT NULL,
    PRIMARY KEY (tag_id, item_type, item_id)
);

CREATE INDEX IF NOT EXISTS idx_tags_user_id    ON tags(user_id);
CREATE INDEX IF NOT EXISTS idx_media_tags_tag  ON media_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_media_tags_item ON media_tags(item_type, item_id);

CREATE TABLE IF NOT EXISTS notifications (
    id         INTEGER  PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       TEXT     NOT NULL,
    title      TEXT     NOT NULL,
    body       TEXT,
    data       TEXT,
    read_at    DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read_at);

CREATE INDEX IF NOT EXISTS idx_system_settings_category ON system_settings(category);

-- ─── Triggers ────────────────────────────────────────────────────────────────

-- Update show statistics when an episode's watched flag changes
CREATE TRIGGER IF NOT EXISTS update_show_stats_on_episode_watch
AFTER UPDATE OF watched ON episodes
BEGIN
    UPDATE shows SET
        watched_episodes = (
            SELECT COUNT(*)
            FROM episodes
            WHERE show_id = NEW.show_id AND watched = 1
        ),
        total_watch_time_minutes = (
            SELECT COALESCE(SUM(duration_minutes), 0)
            FROM episodes
            WHERE show_id = NEW.show_id AND watched = 1
        ),
        last_watched_at = CASE
            WHEN NEW.watched = 1 THEN CURRENT_TIMESTAMP
            ELSE last_watched_at
        END,
        first_watched_at = CASE
            WHEN first_watched_at IS NULL AND NEW.watched = 1 THEN CURRENT_TIMESTAMP
            ELSE first_watched_at
        END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.show_id;
END;

-- Update show status based on watched episode count
CREATE TRIGGER IF NOT EXISTS update_show_status
AFTER UPDATE OF watched_episodes ON shows
BEGIN
    UPDATE shows SET
        status = CASE
            WHEN watched_episodes = 0 THEN 'pending'
            WHEN watched_episodes >= total_episodes THEN 'watched'
            ELSE 'watching'
        END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

-- Auto-update updated_at timestamps
CREATE TRIGGER IF NOT EXISTS update_users_timestamp
AFTER UPDATE ON users
BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_shows_timestamp
AFTER UPDATE ON shows
BEGIN
    UPDATE shows SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_episodes_timestamp
AFTER UPDATE ON episodes
BEGIN
    UPDATE episodes SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ─── Idempotent column additions (existing databases) ────────────────────────
-- SQLite does not support ADD COLUMN IF NOT EXISTS before version 3.37.
-- These statements rely on the migration runner ignoring "duplicate column" errors,
-- which init.go already does. They are no-ops on a fresh database because the
-- columns are already declared in the CREATE TABLE statements above.

ALTER TABLE users       ADD COLUMN jellyfin_api_key         TEXT;
ALTER TABLE users       ADD COLUMN jellyfin_token_valid     INTEGER NOT NULL DEFAULT 1;
ALTER TABLE shows       ADD COLUMN jellyfin_last_modified_at DATETIME;
ALTER TABLE shows       ADD COLUMN sync_hash                 TEXT;
ALTER TABLE shows       ADD COLUMN local_poster_path         TEXT;
ALTER TABLE shows       ADD COLUMN deleted_from_jellyfin     INTEGER DEFAULT 0;
ALTER TABLE movies      ADD COLUMN jellyfin_last_modified_at DATETIME;
ALTER TABLE movies      ADD COLUMN sync_hash                 TEXT;
ALTER TABLE movies      ADD COLUMN local_poster_path         TEXT;
ALTER TABLE movies      ADD COLUMN local_backdrop_path       TEXT;
ALTER TABLE movies      ADD COLUMN deleted_from_jellyfin     INTEGER DEFAULT 0;
ALTER TABLE watch_history ADD COLUMN jellyfin_session_id     TEXT;
ALTER TABLE watch_history ADD COLUMN position_ticks          BIGINT;
ALTER TABLE watch_history ADD COLUMN runtime_ticks           BIGINT;
ALTER TABLE watch_history ADD COLUMN client_name             TEXT;
ALTER TABLE watch_history ADD COLUMN device_name             TEXT;
ALTER TABLE watch_history ADD COLUMN movie_id                INTEGER REFERENCES movies(id) ON DELETE SET NULL;
ALTER TABLE shows       ADD COLUMN userdata_hash              TEXT;
ALTER TABLE movies      ADD COLUMN userdata_hash              TEXT;
ALTER TABLE stats_snapshots ADD COLUMN average_session_duration_minutes REAL;

-- Normalize any pre-existing NULL flags to 0
UPDATE movies SET deleted_from_jellyfin = 0 WHERE deleted_from_jellyfin IS NULL;
UPDATE shows  SET deleted_from_jellyfin = 0 WHERE deleted_from_jellyfin IS NULL;

-- ─── Migration: make watch_history.show_id nullable ──────────────────────────
-- Existing databases were created with show_id NOT NULL, which silently blocks
-- movie entries. This recreates the table with a nullable show_id each startup
-- (idempotent via INSERT OR IGNORE on the primary key). Runtime is negligible
-- for typical personal-library sizes.
CREATE TABLE IF NOT EXISTS _watch_history_v2 (
    id                       INTEGER  PRIMARY KEY AUTOINCREMENT,
    user_id                  INTEGER  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    show_id                  INTEGER  REFERENCES shows(id) ON DELETE CASCADE,
    episode_id               INTEGER  REFERENCES episodes(id) ON DELETE SET NULL,
    movie_id                 INTEGER  REFERENCES movies(id)   ON DELETE SET NULL,
    watched_at               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    duration_watched_minutes INTEGER,
    completion_percentage    REAL,
    device_type              TEXT,
    source                   TEXT,
    jellyfin_session_id      TEXT,
    position_ticks           BIGINT,
    runtime_ticks            BIGINT,
    client_name              TEXT,
    device_name              TEXT,
    created_at               DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO _watch_history_v2
    SELECT id, user_id, show_id, episode_id, movie_id, watched_at,
           duration_watched_minutes, completion_percentage, device_type, source,
           jellyfin_session_id, position_ticks, runtime_ticks, client_name,
           device_name, created_at
    FROM watch_history;
DROP TABLE IF EXISTS watch_history;
ALTER TABLE _watch_history_v2 RENAME TO watch_history;
CREATE INDEX IF NOT EXISTS idx_watch_history_user_id_watched_at    ON watch_history(user_id, watched_at);
CREATE INDEX IF NOT EXISTS idx_watch_history_show_id_watched_at    ON watch_history(show_id, watched_at);
CREATE INDEX IF NOT EXISTS idx_watch_history_episode_id_watched_at ON watch_history(episode_id, watched_at);
CREATE INDEX IF NOT EXISTS idx_watch_history_watched_at            ON watch_history(watched_at);
CREATE INDEX IF NOT EXISTS idx_watch_history_movie_id              ON watch_history(movie_id);
CREATE INDEX IF NOT EXISTS idx_watch_history_jellyfin_session_id   ON watch_history(jellyfin_session_id);
CREATE INDEX IF NOT EXISTS idx_watch_history_dedup                 ON watch_history(user_id, show_id, episode_id, date(watched_at));
CREATE INDEX IF NOT EXISTS idx_watch_history_created_at            ON watch_history(created_at);
