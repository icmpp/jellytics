# Data consistency rules

These are the invariants the backend enforces. They exist so the database can
never be left in a half-written or cross-user-leaking state. Keep new code
aligned with them.

## 1. Multi-user isolation

- Every user-owned table carries a `user_id` with
  `REFERENCES users(id) ON DELETE CASCADE`. Deleting a user removes all of their
  rows automatically.
- **Every read and write of a user-owned row MUST be scoped by `user_id`.** Never
  trust an `id` from the request alone — always pair it with the authenticated
  `user_id` (`WHERE id = ? AND user_id = ?`). A mutation that affects 0 rows is a
  `404`, not a silent success.
- `item_id` columns on `watchlist`, `ratings`, `reviews`, `collection_items`, and
  `media_tags` are **not** real foreign keys (they point at either `shows` or
  `movies` depending on `item_type`). Existence/ownership of the referenced media
  is verified in application code via `repository.MediaStore.Exists`
  (`verifyItemExists` helper) before writing.

## 2. Atomicity — use `database.WithTx`

`database.WithTx(ctx, db, func(tx *sql.Tx) error { ... })` runs its body in a
transaction: commit on `nil`, rollback on error or panic. SQLite serialises
writers, so a read-then-write inside one `WithTx` cannot interleave with another
transaction's write.

Use it for:

- **Upserts** done as read-then-write or UPDATE-then-INSERT. The idiom is:
  `UPDATE … WHERE <unique key>`; if `RowsAffected() == 0`, `INSERT`. Both inside
  one `WithTx`. This is race-free and distinguishes create (`201`) from update
  (`200`). Applied in `SetRating`, `SetReview`, and watchlist `Add`.
- **Any operation with two or more dependent writes**, e.g. soft-deleting a show
  *and* removing it from the watchlist (`DeleteShow`). If the parent delete is a
  no-op (already gone) nothing else is committed.

Do **not** reach for a transaction for a single statement — single
`INSERT`/`UPDATE`/`DELETE`/`INSERT OR IGNORE`/`ON CONFLICT … DO UPDATE` calls are
already atomic.

## 3. Foreign keys are ON

`PRAGMA foreign_keys = ON` is set on every connection (DSN `_foreign_keys=1`).
Cascade behaviour is part of the contract:

- `users` → cascade-deletes every owned row.
- `shows` → cascade-deletes its `episodes`; `watch_history.show_id` cascades,
  `episode_id`/`movie_id` are `ON DELETE SET NULL`.
- `collections` → cascade-deletes `collection_items`; `tags` → `media_tags`.

Because FKs are enforced, an `INSERT` referencing a parent that was just deleted
fails cleanly rather than creating an orphan — this is why the child-table insert
flows (collection items, media tags) do not need an explicit transaction. Those
inserts additionally guard ownership *in the write itself*
(`INSERT … SELECT … WHERE EXISTS (SELECT 1 FROM <parent> WHERE id = ? AND user_id = ?)`),
so a store method cannot attach to another user's collection/tag even if a caller
forgets the pre-check.

## Isolation is enforced and tested

Every store read is scoped by `user_id`, and every mutation is scoped by
`user_id` (or guards parent ownership in the write). A mutation that matches no
owned row returns "not found" rather than acting on another user's data — so
"someone else's id" is indistinguishable from "no such id". This is covered by
the cross-user tests in `internal/repository/isolation_test.go`.

## 4. `watch_history` de-duplication

A playback record is identified for de-duplication by
`(user_id, show_id, episode_id, date(watched_at))` (index
`idx_watch_history_dedup`) and, when present, by `jellyfin_session_id`
(`idx_watch_history_jellyfin_session_id`). Any new ingestion path (sync, webhooks)
must dedupe against these so polling and real-time sources do not double-count.

## 5. Schema changes go through goose

The schema is owned by goose migrations in
`internal/database/migrations/` (`00001_baseline.sql` and onwards). Add a new
numbered migration for every change; never hand-edit the live schema or re-shape a
shipped migration. Migrations fail loud — a bad migration aborts startup.

## Known follow-ups

- `MovieService.Delete` performs `RemoveFromWatchlist` + `SoftDelete` as separate
  repository calls (not yet atomic). To be folded into one `WithTx` when the
  repository stores become transaction-aware (Stage 3).
