-- +goose Up
-- Settings backing the Jellyfin playback webhook. The secret is seeded empty and
-- generated lazily on first access (see services.WebhookService.Secret).
INSERT OR IGNORE INTO system_settings (key, value, description, category, data_type) VALUES
    ('webhook_enabled', 'true', 'Accept inbound Jellyfin playback webhooks',                 'webhook', 'bool'),
    ('webhook_secret',  '',     'Secret token for the Jellyfin playback webhook (?token=...)', 'webhook', 'string');

-- +goose Down
DELETE FROM system_settings WHERE key IN ('webhook_enabled', 'webhook_secret');
