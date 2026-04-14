package services

import (
	"context"
	"database/sql"
	"time"

	"jellytics/backend/internal/errors"
	"jellytics/backend/internal/jellyfin"
	"jellytics/backend/internal/models"

	"github.com/rs/zerolog/log"
)

type SessionsService struct {
	db             *sql.DB
	clientProvider jellyfin.ClientProvider
}

func NewSessionsService(db *sql.DB) *SessionsService {
	return &SessionsService{db: db, clientProvider: jellyfin.PooledClientProvider{}}
}

func (s *SessionsService) SyncActiveSessions(ctx context.Context, userID int) error {
	var serverURL, jellyfinUserID string
	err := s.db.QueryRowContext(ctx,
		"SELECT jellyfin_server_url, jellyfin_user_id FROM users WHERE id = ? AND deleted_at IS NULL",
		userID).Scan(&serverURL, &jellyfinUserID)
	if err != nil {
		log.Error().Err(err).Int("user_id", userID).Msg("Failed to get user info for session sync")
		return errors.Wrap(err, errors.CodeUserNotFound, "User not found")
	}

	log.Debug().Int("user_id", userID).Msg("Session sync starting")

	if serverURL == "" {
		log.Error().
			Int("user_id", userID).
			Msg("Jellyfin server URL is missing")
		return errors.New(errors.CodeSyncFailed, "Jellyfin server URL is missing")
	}

	tokenService := NewTokenRefreshService(s.db)
	accessToken, err := tokenService.GetValidToken(ctx, userID)
	if err != nil {
		log.Error().Err(err).Int("user_id", userID).Msg("Failed to get valid Jellyfin token for session sync")
		return errors.Wrap(err, errors.CodeSyncFailed, "Failed to get valid Jellyfin credentials. Please log in again or configure an API key.")
	}

	jfClient := s.clientProvider.Get(serverURL)

	log.Debug().Int("user_id", userID).Msg("Fetching sessions")

	sessionsResp, err := jfClient.GetSessions(ctx, accessToken)
	if err != nil {
		if errors.IsCode(err, errors.CodeInvalidCredentials) {
			_ = tokenService.InvalidateToken(ctx, userID)
			return err
		}
		log.Warn().
			Err(err).
			Int("user_id", userID).
			Str("server_url", serverURL).
			Msg("Failed to fetch sessions from Jellyfin")
		return nil
	}

	log.Debug().Int("user_id", userID).Int("sessions", len(sessionsResp.Sessions)).Msg("Retrieved sessions")

	var userSessions []jellyfin.Session
	for _, session := range sessionsResp.Sessions {
		if session.UserId == jellyfinUserID {
			userSessions = append(userSessions, session)
			log.Debug().
				Int("user_id", userID).
				Str("session_id", session.Id).
				Str("jellyfin_user_id", session.UserId).
				Msg("Found session for user")
		} else {
			log.Debug().
				Str("session_user_id", session.UserId).
				Str("expected_user_id", jellyfinUserID).
				Msg("Skipping session from different user")
		}
	}

	log.Debug().Int("user_id", userID).Int("user_sessions", len(userSessions)).Msg("Filtered sessions")

	now := time.Now()

	seenSessionIDs := make(map[string]bool)

	sessionsProcessed := 0
	for _, session := range userSessions {
		log.Debug().
			Int("user_id", userID).
			Str("session_id", session.Id).
			Bool("has_now_playing", session.NowPlayingItem != nil).
			Bool("has_play_state", session.PlayState != nil).
			Str("device_name", session.DeviceName).
			Str("client", session.Client).
			Msg("Examining session")

		if session.NowPlayingItem == nil {
			log.Debug().Int("user_id", userID).Str("session_id", session.Id).Msg("Skipping session, no now playing")
			continue
		}

		playState := session.PlayState
		if playState == nil {
			log.Debug().Int("user_id", userID).Str("session_id", session.Id).Msg("Skipping session, no play state")
			continue
		}

		seenSessionIDs[session.Id] = true
		sessionsProcessed++

		item := session.NowPlayingItem

		log.Debug().
			Int("user_id", userID).
			Str("session_id", session.Id).
			Str("item", item.Name).
			Str("device", session.DeviceName).
			Str("client", session.Client).
			Str("device_type", session.DeviceType).
			Int64("runtime_ticks", item.RunTimeTicks).
			Int64("position_ticks", playState.PositionTicks).
			Bool("is_paused", playState.IsPaused).
			Msg("Processing active session")

		playbackPercentage := 0.0
		if item.RunTimeTicks > 0 && playState.PositionTicks > 0 {
			playbackPercentage = float64(playState.PositionTicks) / float64(item.RunTimeTicks) * 100
		}

		itemType := "Episode"
		if item.Type == "Movie" {
			itemType = "Movie"
		}

		log.Debug().
			Int("user_id", userID).
			Str("session_id", session.Id).
			Str("item_id", item.Id).
			Float64("playback_percentage", playbackPercentage).
			Bool("is_paused", playState.IsPaused).
			Msg("Upserting active session to database")

		_, err = s.db.ExecContext(ctx,
			`INSERT INTO active_sessions (
				user_id, jellyfin_session_id, jellyfin_user_id, item_id, item_type, item_name,
				series_id, series_name, episode_id, season_number, episode_number,
				position_ticks, runtime_ticks, playback_percentage, is_paused,
				client_name, device_name, device_type, application_version, ip_address,
				started_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(jellyfin_session_id, user_id) DO UPDATE SET
				position_ticks = excluded.position_ticks,
				playback_percentage = excluded.playback_percentage,
				is_paused = excluded.is_paused,
				updated_at = excluded.updated_at,
				item_name = excluded.item_name,
				series_name = excluded.series_name,
				client_name = excluded.client_name,
				device_name = excluded.device_name`,
			userID, session.Id, session.UserId, item.Id, itemType, item.Name,
			item.SeriesId, item.SeriesName, item.Id, item.ParentIndexNumber, item.IndexNumber,
			playState.PositionTicks, item.RunTimeTicks, playbackPercentage, playState.IsPaused,
			session.Client, session.DeviceName, session.DeviceType, session.ApplicationVersion,
			session.RemoteEndPoint, now, now)
		if err != nil {
			log.Error().
				Err(err).
				Int("user_id", userID).
				Str("session_id", session.Id).
				Str("item_name", item.Name).
				Msg("Failed to upsert active session")
			continue
		}

		log.Debug().
			Int("user_id", userID).
			Str("session_id", session.Id).
			Str("item_name", item.Name).
			Msg("Successfully stored active session")
	}

	log.Debug().Int("user_id", userID).Int("processed", sessionsProcessed).Msg("Sessions processed")

	rows, err := s.db.QueryContext(ctx,
		"SELECT jellyfin_session_id FROM active_sessions WHERE user_id = ? AND ended_at IS NULL",
		userID)
	if err != nil {
		log.Warn().Err(err).Msg("Failed to query active sessions")
	} else {
		defer rows.Close()
		for rows.Next() {
			var sessionID string
			if err := rows.Scan(&sessionID); err != nil {
				continue
			}
			if !seenSessionIDs[sessionID] {
				_, err = s.db.ExecContext(ctx,
					"UPDATE active_sessions SET ended_at = ? WHERE jellyfin_session_id = ? AND user_id = ?",
					now, sessionID, userID)
				if err != nil {
					log.Warn().Err(err).Str("session_id", sessionID).Msg("Failed to mark session as ended")
				}
			}
		}
	}

	return nil
}

func (s *SessionsService) GetCurrentlyWatching(ctx context.Context, userID int) ([]models.ActiveSession, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, jellyfin_session_id, item_id, item_type, item_name, series_id, series_name,
			episode_id, season_number, episode_number, position_ticks, runtime_ticks,
			playback_percentage, is_paused, client_name, device_name, device_type,
			started_at, updated_at
		FROM active_sessions
		WHERE user_id = ? AND ended_at IS NULL
		ORDER BY updated_at DESC`,
		userID)
	if err != nil {
		return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to query active sessions")
	}
	defer rows.Close()

	var sessions []models.ActiveSession
	for rows.Next() {
		var session models.ActiveSession
		var episodeID sql.NullString
		var seasonNumber, episodeNumber sql.NullInt64
		var seriesID, seriesName sql.NullString

		err := rows.Scan(
			&session.ID, &session.JellyfinSessionID, &session.ItemID, &session.ItemType,
			&session.ItemName, &seriesID, &seriesName, &episodeID, &seasonNumber, &episodeNumber,
			&session.PositionTicks, &session.RuntimeTicks, &session.PlaybackPercentage,
			&session.IsPaused, &session.ClientName, &session.DeviceName, &session.DeviceType,
			&session.StartedAt, &session.UpdatedAt)
		if err != nil {
			log.Warn().Err(err).Msg("Failed to scan active session")
			continue
		}

		if seriesID.Valid {
			session.SeriesID = seriesID.String
		}
		if seriesName.Valid {
			session.SeriesName = seriesName.String
		}
		if episodeID.Valid {
			session.EpisodeID = episodeID.String
		}
		if seasonNumber.Valid {
			session.SeasonNumber = int(seasonNumber.Int64)
		}
		if episodeNumber.Valid {
			session.EpisodeNumber = int(episodeNumber.Int64)
		}

		sessions = append(sessions, session)
	}

	return sessions, nil
}
