package services

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"database/sql"
	"encoding/hex"
	"strconv"
	"strings"
	"time"

	"jellytics/backend/internal/database"
	"jellytics/backend/internal/errors"

	"github.com/rs/zerolog/log"
)

const (
	settingWebhookEnabled = "webhook_enabled"
	settingWebhookSecret  = "webhook_secret"
	// completedThreshold is the played-percentage at/above which a playback is
	// treated as "watched" when the payload doesn't say so explicitly.
	completedThreshold = 90.0
)

// WebhookService validates and ingests Jellyfin playback webhooks into
// watch_history, reusing the same conventions as the polling sync.
type WebhookService struct {
	db       *sql.DB
	settings *SystemSettingsService
}

// NewWebhookService returns a new WebhookService.
func NewWebhookService(db *sql.DB, settings *SystemSettingsService) *WebhookService {
	return &WebhookService{db: db, settings: settings}
}

// flexBool decodes a JSON boolean that Jellyfin webhook templates often render
// as a quoted string ("true"/"True"/"1").
type flexBool bool

func (b *flexBool) UnmarshalJSON(data []byte) error {
	switch strings.ToLower(strings.Trim(string(data), `"`)) {
	case "true", "1", "yes":
		*b = true
	default:
		*b = false
	}
	return nil
}

// flexInt64 decodes a JSON number that may arrive as a quoted string.
type flexInt64 int64

func (n *flexInt64) UnmarshalJSON(data []byte) error {
	s := strings.Trim(string(data), `"`)
	if s == "" || s == "null" {
		*n = 0
		return nil
	}
	v, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		*n = 0
		return nil // tolerate malformed numeric fields rather than rejecting the event
	}
	*n = flexInt64(v)
	return nil
}

// WebhookEvent is the subset of the Jellyfin webhook payload we consume. Field
// names match the documented Jellyfin webhook template variables.
type WebhookEvent struct {
	NotificationType      string    `json:"NotificationType"`
	UserID                string    `json:"UserId"`
	ItemID                string    `json:"ItemId"`
	ItemType              string    `json:"ItemType"` // "Movie" | "Episode"
	RunTimeTicks          flexInt64 `json:"RunTimeTicks"`
	PlaybackPositionTicks flexInt64 `json:"PlaybackPositionTicks"`
	PlayedToCompletion    flexBool  `json:"PlayedToCompletion"`
	PlaySessionID         string    `json:"PlaySessionId"`
	ClientName            string    `json:"ClientName"`
	DeviceName            string    `json:"DeviceName"`
}

// WebhookResult describes how an event was handled (for the ack response/logs).
type WebhookResult struct {
	Status string `json:"status"` // "processed" | "skipped"
	Detail string `json:"detail,omitempty"`
}

func skipped(detail string) WebhookResult { return WebhookResult{Status: "skipped", Detail: detail} }

// Enabled reports whether inbound webhooks are accepted.
func (s *WebhookService) Enabled(ctx context.Context) bool {
	return s.settings.GetBool(ctx, settingWebhookEnabled, true)
}

// Secret returns the webhook secret, generating and persisting one on first use.
func (s *WebhookService) Secret(ctx context.Context) (string, error) {
	secret, err := s.settings.Get(ctx, settingWebhookSecret)
	if err == nil && secret != "" {
		return secret, nil
	}
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", errors.Wrap(err, errors.CodeInternalError, "Failed to generate webhook secret")
	}
	secret = hex.EncodeToString(buf)
	if err := s.settings.Set(ctx, settingWebhookSecret, secret); err != nil {
		return "", err
	}
	return secret, nil
}

// Regenerate replaces the webhook secret with a fresh one and returns it.
func (s *WebhookService) Regenerate(ctx context.Context) (string, error) {
	if err := s.settings.Set(ctx, settingWebhookSecret, ""); err != nil {
		return "", err
	}
	return s.Secret(ctx)
}

// ValidateToken reports whether token matches the configured secret. Comparison
// is constant-time; an empty configured secret rejects everything.
func (s *WebhookService) ValidateToken(ctx context.Context, token string) bool {
	secret, err := s.Secret(ctx)
	if err != nil || secret == "" || token == "" {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(secret), []byte(token)) == 1
}

// Process ingests a single playback event. It is tolerant by design: anything it
// cannot map (unknown user/item, non-terminal event) is reported as "skipped"
// rather than erroring, so Jellyfin does not retry valid-but-irrelevant events.
func (s *WebhookService) Process(ctx context.Context, ev WebhookEvent) (WebhookResult, error) {
	// We only record terminal/completed playbacks. Progress pings that haven't
	// reached completion are ignored.
	completion := 0.0
	if ev.RunTimeTicks > 0 {
		completion = float64(ev.PlaybackPositionTicks) / float64(ev.RunTimeTicks) * 100
		if completion > 100 {
			completion = 100
		}
		if completion < 0 {
			completion = 0
		}
	}
	played := bool(ev.PlayedToCompletion) || completion >= completedThreshold

	switch ev.NotificationType {
	case "PlaybackStop", "":
		// recorded below
	case "PlaybackProgress":
		if !played {
			return skipped("in-progress playback"), nil
		}
	default:
		return skipped("ignored event type: " + ev.NotificationType), nil
	}

	var userID int
	err := s.db.QueryRowContext(ctx,
		"SELECT id FROM users WHERE jellyfin_user_id = ? AND deleted_at IS NULL", ev.UserID).Scan(&userID)
	if err == sql.ErrNoRows {
		return skipped("unknown jellyfin user"), nil
	}
	if err != nil {
		return WebhookResult{}, errors.Wrap(err, errors.CodeDatabaseError, "Failed to resolve user")
	}

	runtimeMinutes := int(int64(ev.RunTimeTicks) / ticksPerMinute)
	durationWatched := int(float64(runtimeMinutes) * completion / 100)
	watchedAt := time.Now()

	switch ev.ItemType {
	case "Movie":
		return s.processMovie(ctx, userID, ev, completion, played, runtimeMinutes, durationWatched, watchedAt)
	case "Episode":
		return s.processEpisode(ctx, userID, ev, completion, played, durationWatched, watchedAt)
	default:
		return skipped("unsupported item type: " + ev.ItemType), nil
	}
}

func (s *WebhookService) processMovie(ctx context.Context, userID int, ev WebhookEvent, completion float64, played bool, runtimeMinutes, durationWatched int, watchedAt time.Time) (WebhookResult, error) {
	result := WebhookResult{Status: "processed", Detail: "movie playback recorded"}
	err := database.WithTx(ctx, s.db, func(tx *sql.Tx) error {
		var movieID int
		err := tx.QueryRowContext(ctx,
			"SELECT id FROM movies WHERE jellyfin_id = ? AND user_id = ? AND deleted_at IS NULL",
			ev.ItemID, userID).Scan(&movieID)
		if err == sql.ErrNoRows {
			result = skipped("unknown movie")
			return nil
		}
		if err != nil {
			return errors.Wrap(err, errors.CodeDatabaseError, "Failed to resolve movie")
		}

		watchTime := durationWatched
		if played {
			watchTime = runtimeMinutes
		}
		if _, err := tx.ExecContext(ctx,
			`UPDATE movies SET
			   watched = CASE WHEN ? THEN 1 ELSE watched END,
			   watch_count = watch_count + CASE WHEN ? THEN 1 ELSE 0 END,
			   completion_percentage = MAX(COALESCE(completion_percentage, 0), ?),
			   total_watch_time_minutes = MAX(COALESCE(total_watch_time_minutes, 0), ?),
			   first_watched_at = COALESCE(first_watched_at, ?),
			   last_watched_at = ?,
			   status = CASE WHEN ? THEN 'watched' WHEN status = 'pending' THEN 'watching' ELSE status END,
			   updated_at = ?
			 WHERE id = ?`,
			played, played, completion, watchTime, watchedAt, watchedAt, played, watchedAt, movieID); err != nil {
			return errors.Wrap(err, errors.CodeDatabaseError, "Failed to update movie")
		}

		return upsertWatchHistory(ctx, tx, watchHistoryRow{
			userID: userID, movieID: &movieID, watchedAt: watchedAt,
			duration: durationWatched, completion: completion, ev: ev,
		})
	})
	if err != nil {
		return WebhookResult{}, err
	}
	return result, nil
}

func (s *WebhookService) processEpisode(ctx context.Context, userID int, ev WebhookEvent, completion float64, played bool, durationWatched int, watchedAt time.Time) (WebhookResult, error) {
	result := WebhookResult{Status: "processed", Detail: "episode playback recorded"}
	err := database.WithTx(ctx, s.db, func(tx *sql.Tx) error {
		var episodeID, showID int
		err := tx.QueryRowContext(ctx,
			`SELECT e.id, e.show_id FROM episodes e
			 JOIN shows sh ON e.show_id = sh.id
			 WHERE e.jellyfin_id = ? AND sh.user_id = ? AND sh.deleted_at IS NULL`,
			ev.ItemID, userID).Scan(&episodeID, &showID)
		if err == sql.ErrNoRows {
			result = skipped("unknown episode")
			return nil
		}
		if err != nil {
			return errors.Wrap(err, errors.CodeDatabaseError, "Failed to resolve episode")
		}

		// Updating episodes.watched fires the show-stats trigger, which keeps the
		// parent show's watched_episodes/status/last_watched_at in sync.
		if _, err := tx.ExecContext(ctx,
			`UPDATE episodes SET
			   watched = CASE WHEN ? THEN 1 ELSE watched END,
			   watch_count = watch_count + CASE WHEN ? THEN 1 ELSE 0 END,
			   watched_at = ?,
			   completion_percentage = MAX(COALESCE(completion_percentage, 0), ?),
			   updated_at = ?
			 WHERE id = ?`,
			played, played, watchedAt, completion, watchedAt, episodeID); err != nil {
			return errors.Wrap(err, errors.CodeDatabaseError, "Failed to update episode")
		}

		return upsertWatchHistory(ctx, tx, watchHistoryRow{
			userID: userID, showID: &showID, episodeID: &episodeID, watchedAt: watchedAt,
			duration: durationWatched, completion: completion, ev: ev,
		})
	})
	if err != nil {
		return WebhookResult{}, err
	}
	return result, nil
}

type watchHistoryRow struct {
	userID     int
	showID     *int
	episodeID  *int
	movieID    *int
	watchedAt  time.Time
	duration   int
	completion float64
	ev         WebhookEvent
}

// upsertWatchHistory inserts a watch_history row, deduplicating against existing
// rows for the same item on the same day (matching the polling sync's dedup
// rule and the idx_watch_history_dedup index). Same-day repeats upgrade the
// recorded duration/completion to the maximum seen.
func upsertWatchHistory(ctx context.Context, tx *sql.Tx, r watchHistoryRow) error {
	var existing int
	err := tx.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM watch_history
		 WHERE user_id = ?
		   AND COALESCE(movie_id, 0) = COALESCE(?, 0)
		   AND COALESCE(episode_id, 0) = COALESCE(?, 0)
		   AND date(watched_at) = date(?)`,
		r.userID, r.movieID, r.episodeID, r.watchedAt).Scan(&existing)
	if err != nil {
		return errors.Wrap(err, errors.CodeDatabaseError, "Failed to check watch history")
	}

	if existing > 0 {
		_, err := tx.ExecContext(ctx,
			`UPDATE watch_history
			 SET duration_watched_minutes = MAX(COALESCE(duration_watched_minutes, 0), ?),
			     completion_percentage = MAX(COALESCE(completion_percentage, 0), ?)
			 WHERE user_id = ?
			   AND COALESCE(movie_id, 0) = COALESCE(?, 0)
			   AND COALESCE(episode_id, 0) = COALESCE(?, 0)
			   AND date(watched_at) = date(?)`,
			r.duration, r.completion, r.userID, r.movieID, r.episodeID, r.watchedAt)
		if err != nil {
			return errors.Wrap(err, errors.CodeDatabaseError, "Failed to update watch history")
		}
		return nil
	}

	var sessionID, clientName, deviceName interface{}
	if r.ev.PlaySessionID != "" {
		sessionID = r.ev.PlaySessionID
	}
	if r.ev.ClientName != "" {
		clientName = r.ev.ClientName
	}
	if r.ev.DeviceName != "" {
		deviceName = r.ev.DeviceName
	}

	_, err = tx.ExecContext(ctx,
		`INSERT INTO watch_history
		   (user_id, show_id, episode_id, movie_id, watched_at, duration_watched_minutes,
		    completion_percentage, source, jellyfin_session_id, position_ticks, runtime_ticks,
		    client_name, device_name)
		 VALUES (?, ?, ?, ?, ?, ?, ?, 'webhook', ?, ?, ?, ?, ?)`,
		r.userID, r.showID, r.episodeID, r.movieID, r.watchedAt, r.duration,
		r.completion, sessionID, int64(r.ev.PlaybackPositionTicks), int64(r.ev.RunTimeTicks),
		clientName, deviceName)
	if err != nil {
		return errors.Wrap(err, errors.CodeDatabaseError, "Failed to insert watch history")
	}
	log.Debug().Int("user_id", r.userID).Str("source", "webhook").Msg("Recorded playback from webhook")
	return nil
}
