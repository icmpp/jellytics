# Jellyfin playback webhooks

Jellytics can ingest playback events from Jellyfin in real time, in addition to
the polling sync. This keeps watch history fresh without waiting for the next
sync cycle.

## Endpoint

```
POST /api/v1/webhooks/jellyfin?token=<secret>
```

- Unauthenticated by JWT (Jellyfin's webhook plugin can't log in); instead it is
  guarded by a per-install **secret** passed as the `token` query parameter.
- The secret lives in `system_settings` (`webhook_secret`) and is generated on
  first access. Fetch it (and the path) from the authenticated config endpoint:

  ```
  GET  /api/v1/webhook/config      -> { "enabled": true, "path": "...", "secret": "..." }
  POST /api/v1/webhook/regenerate  -> rotates the secret
  ```

- Ingestion can be toggled with the `webhook_enabled` system setting.

## Configuring Jellyfin

Install the official **Webhook** plugin in Jellyfin, then add a *Generic
Destination*:

- **Webhook URL:** `https://<your-jellytics>/api/v1/webhooks/jellyfin?token=<secret>`
- **Notification Type:** Playback Stop (Playback Progress also works; only
  completed playbacks are recorded).
- **Template** (Handlebars → JSON). The handler tolerates values rendered as
  quoted strings, so this minimal template is enough:

  ```json
  {
    "NotificationType": "{{NotificationType}}",
    "UserId": "{{UserId}}",
    "ItemId": "{{ItemId}}",
    "ItemType": "{{ItemType}}",
    "RunTimeTicks": "{{RunTimeTicks}}",
    "PlaybackPositionTicks": "{{PlaybackPositionTicks}}",
    "PlayedToCompletion": "{{PlayedToCompletion}}",
    "PlaySessionId": "{{PlaySessionId}}",
    "ClientName": "{{ClientName}}",
    "DeviceName": "{{DeviceName}}"
  }
  ```

## Behaviour

- The event's `UserId` is matched against `users.jellyfin_user_id`; events for
  unknown users are acknowledged but ignored (so Jellyfin does not retry).
- `ItemId` is matched against the local `movies`/`episodes` `jellyfin_id`.
- A playback is treated as **watched** when `PlayedToCompletion` is true or the
  played fraction is ≥ 90%.
- Episodes flip `episodes.watched`, which fires the existing trigger to roll the
  parent show's `watched_episodes` / `status` / `last_watched_at` forward.
- A `watch_history` row (`source = 'webhook'`) is written inside a transaction,
  **deduplicated** against the polling sync by `(user_id, item, date(watched_at))`
  — replays and overlap with sync upgrade the recorded duration/completion rather
  than double-counting.

All responses are `200` with `{ "status": "processed" | "skipped", ... }` for a
valid token, or `401` for a bad/missing token.
