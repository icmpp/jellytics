// Package services implements business logic for syncing Jellyfin data, stats, sessions, and system settings.
package services

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
	"sync"
	"time"

	"jellytics/backend/internal/config"
	"jellytics/backend/internal/errors"
	"jellytics/backend/internal/jellyfin"
	"jellytics/backend/internal/models"

	"github.com/rs/zerolog/log"
)

// ticksPerMinute converts Jellyfin's 100-nanosecond ticks to minutes (10M ticks/sec * 60 sec/min).
const ticksPerMinute int64 = 600_000_000

// SyncConfig holds retry, batching, and incremental sync options for the sync service.
type SyncConfig struct {
	RetryAttempts     int
	RetryBackoff      time.Duration
	MaxRetryBackoff   time.Duration
	BatchSize         int
	EnableIncremental bool
}

func DefaultSyncConfig() SyncConfig {
	return SyncConfig{
		RetryAttempts:     3,
		RetryBackoff:      time.Second,
		MaxRetryBackoff:   30 * time.Second,
		BatchSize:         50,
		EnableIncremental: true,
	}
}

func SyncConfigFromAppConfig(c config.SyncConfig) SyncConfig {
	return SyncConfig{
		RetryAttempts:     c.RetryAttempts,
		RetryBackoff:      c.RetryBackoff,
		MaxRetryBackoff:   c.MaxRetryBackoff,
		BatchSize:         c.BatchSize,
		EnableIncremental: c.EnableIncremental,
	}
}

type SyncService struct {
	db             *sql.DB
	clientProvider jellyfin.ClientProvider
	imageService   *ImageService
	statsService   *StatsService
	mu             sync.Mutex
	syncing        map[int]bool
	config         SyncConfig
	dataPath       string
}

func NewSyncService(db *sql.DB) *SyncService {
	return NewSyncServiceWithConfig(db, DefaultSyncConfig())
}

func NewSyncServiceWithConfig(db *sql.DB, config SyncConfig) *SyncService {
	return &SyncService{
		db:             db,
		clientProvider: jellyfin.PooledClientProvider{},
		syncing:        make(map[int]bool),
		config:         config,
		statsService:   NewStatsService(db),
	}
}

func NewSyncServiceWithDataPath(db *sql.DB, config SyncConfig, dataPath string) *SyncService {
	return &SyncService{
		db:             db,
		clientProvider: jellyfin.PooledClientProvider{},
		syncing:        make(map[int]bool),
		config:         config,
		dataPath:       dataPath,
		imageService:   NewImageService(db, dataPath),
		statsService:   NewStatsService(db),
	}
}

// beginTxWithRetry retries BeginTx up to 5 times on SQLite lock errors with exponential backoff.
func beginTxWithRetry(ctx context.Context, db *sql.DB, logID string) (*sql.Tx, error) {
	const maxRetries = 5
	var tx *sql.Tx
	var err error
	for i := 0; i < maxRetries; i++ {
		tx, err = db.BeginTx(ctx, nil)
		if err == nil {
			return tx, nil
		}
		if strings.Contains(err.Error(), "locked") && i < maxRetries-1 {
			backoff := time.Duration(10*(1<<uint(i))) * time.Millisecond
			log.Debug().
				Int("retry", i+1).
				Dur("backoff", backoff).
				Str("id", logID).
				Msg("Database locked, retrying transaction")
			time.Sleep(backoff)
			continue
		}
		return nil, err
	}
	return nil, err
}

func computeItemHash(item jellyfin.Item) string {
	data := fmt.Sprintf("%s|%s|%s|%d|%v|%f",
		item.Name,
		item.Overview,
		strings.Join(item.Genres, ","),
		item.ProductionYear,
		item.UserData.Played,
		item.UserData.PlayedPercentage,
	)
	hash := sha256.Sum256([]byte(data))
	return hex.EncodeToString(hash[:8])
}

func computeUserDataHash(item jellyfin.Item) string {
	data := fmt.Sprintf("%v|%f|%s",
		item.UserData.Played,
		item.UserData.PlayedPercentage,
		item.UserData.LastPlayedDate.Format(time.RFC3339),
	)
	hash := sha256.Sum256([]byte(data))
	return hex.EncodeToString(hash[:8])
}

func (s *SyncService) getSyncState(ctx context.Context, userID int, entityType string) (lastSyncAt time.Time, syncHash string, err error) {
	err = s.db.QueryRowContext(ctx,
		`SELECT last_sync_at, sync_cursor FROM sync_state 
		 WHERE user_id = ? AND entity_type = ?`,
		userID, entityType).Scan(&lastSyncAt, &syncHash)

	if err == sql.ErrNoRows {
		return time.Time{}, "", nil
	}
	return
}

func (s *SyncService) updateSyncState(ctx context.Context, userID int, entityType string, itemsSynced int) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO sync_state (user_id, entity_type, last_sync_at, items_synced, updated_at)
		 VALUES (?, ?, ?, ?, ?)
		 ON CONFLICT(user_id, entity_type) DO UPDATE SET
		   last_sync_at = excluded.last_sync_at,
		   items_synced = excluded.items_synced,
		   updated_at = excluded.updated_at`,
		userID, entityType, time.Now(), itemsSynced, time.Now())

	if err != nil && strings.Contains(err.Error(), "no such table") {
		log.Debug().Msg("sync_state table not found, skipping sync state update")
		return nil
	}
	return err
}

func (s *SyncService) shouldSyncItem(ctx context.Context, jellyfinID string, userID int, tableName string, newHash string) (bool, error) {
	if !s.config.EnableIncremental {
		return true, nil
	}

	var existingHash sql.NullString
	query := fmt.Sprintf("SELECT sync_hash FROM %s WHERE jellyfin_id = ? AND user_id = ?", tableName)
	err := s.db.QueryRowContext(ctx, query, jellyfinID, userID).Scan(&existingHash)

	if err == sql.ErrNoRows {
		return true, nil
	}
	if err != nil {
		if strings.Contains(err.Error(), "no such column") {
			return true, nil
		}
		return true, nil
	}

	return !existingHash.Valid || existingHash.String != newHash, nil
}

func (s *SyncService) shouldSyncItemByUserData(ctx context.Context, jellyfinID string, userID int, tableName string, newUserDataHash string) (bool, error) {
	if !s.config.EnableIncremental {
		return true, nil
	}
	var existingHash sql.NullString
	query := fmt.Sprintf("SELECT userdata_hash FROM %s WHERE jellyfin_id = ? AND user_id = ?", tableName)
	err := s.db.QueryRowContext(ctx, query, jellyfinID, userID).Scan(&existingHash)
	if err == sql.ErrNoRows {
		return true, nil
	}
	if err != nil {
		if strings.Contains(err.Error(), "no such column") {
			return true, nil
		}
		return true, nil
	}
	return !existingHash.Valid || existingHash.String != newUserDataHash, nil
}

func (s *SyncService) getExistingUserDataHashes(ctx context.Context, userID int, tableName string) map[string]string {
	if !s.config.EnableIncremental {
		return nil
	}
	query := fmt.Sprintf("SELECT jellyfin_id, userdata_hash FROM %s WHERE user_id = ?", tableName)
	rows, err := s.db.QueryContext(ctx, query, userID)
	if err != nil {
		if strings.Contains(err.Error(), "no such column") {
			return nil
		}
		return nil
	}
	defer rows.Close()
	out := make(map[string]string)
	for rows.Next() {
		var id string
		var hash sql.NullString
		if err := rows.Scan(&id, &hash); err != nil {
			continue
		}
		if hash.Valid {
			out[id] = hash.String
		}
	}
	return out
}

func (s *SyncService) SyncUser(ctx context.Context, userID int) error {
	s.mu.Lock()
	if s.syncing[userID] {
		s.mu.Unlock()
		return errors.New(errors.CodeSyncInProgress, "Sync already in progress for this user")
	}
	s.syncing[userID] = true
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		delete(s.syncing, userID)
		s.mu.Unlock()
	}()

	var user models.User
	var serverURL string
	err := s.db.QueryRowContext(ctx,
		"SELECT id, username, jellyfin_user_id, jellyfin_server_url FROM users WHERE id = ? AND deleted_at IS NULL",
		userID).Scan(&user.ID, &user.Username, &user.JellyfinUserID, &serverURL)
	if err != nil {
		log.Error().Err(err).Int("user_id", userID).Msg("Failed to get user from database")
		return errors.Wrap(err, errors.CodeUserNotFound, "User not found")
	}

	log.Debug().Int("user_id", userID).Str("user", user.Username).Msg("Sync started")

	if serverURL == "" {
		log.Error().Int("user_id", userID).Msg("Jellyfin server URL is not configured")
		return errors.New(errors.CodeSyncFailed, "Jellyfin server URL is not configured. Please update your settings.")
	}

	tokenService := NewTokenRefreshService(s.db)
	accessToken, err := tokenService.GetValidToken(ctx, userID)
	if err != nil {
		log.Error().Err(err).Int("user_id", userID).Msg("Failed to get valid Jellyfin token")
		return errors.Wrap(err, errors.CodeSyncFailed, "Failed to get valid Jellyfin credentials. Please log in again or configure an API key.")
	}

	jfClient := s.clientProvider.Get(serverURL)

	syncLogID, err := s.startSyncLog(ctx, userID)
	if err != nil {
		log.Warn().Err(err).Msg("Failed to create sync log")
	}

	log.Debug().Int("user_id", userID).Msg("Fetching shows")

	lightResp, err := jfClient.GetUserItemsWithFields(ctx, accessToken, user.JellyfinUserID, "Series", jellyfin.LightItemFields)
	if err != nil {
		log.Error().
			Err(err).
			Int("user_id", userID).
			Str("server_url", serverURL).
			Msg("Failed to fetch shows from Jellyfin")
		if errors.IsCode(err, errors.CodeInvalidCredentials) {
			_ = tokenService.InvalidateToken(ctx, userID)
		}
		s.updateSyncLog(ctx, syncLogID, "failed", 0, 0, err.Error())
		return errors.Wrap(err, errors.CodeSyncFailed, "Failed to fetch shows from Jellyfin")
	}

	jellyfin.SanitizeItems(lightResp.Items)
	lightValid, _, _ := jellyfin.ValidateItems(lightResp.Items)

	existingHashes := s.getExistingUserDataHashes(ctx, userID, "shows")

	showsNeedingSync := make(map[string]bool)
	for _, item := range lightValid {
		udHash := computeUserDataHash(item)
		if existingHashes == nil {
			showsNeedingSync[item.Id] = true
			continue
		}
		existing, ok := existingHashes[item.Id]
		if !ok || existing != udHash {
			showsNeedingSync[item.Id] = true
		}
	}

	var validItems []jellyfin.Item
	jellyfinShowIDs := make(map[string]bool)
	if len(showsNeedingSync) > 0 {
		log.Debug().Int("shows", len(showsNeedingSync)).Msg("Fetching show metadata")
		itemsResp, err := jfClient.GetUserItems(ctx, accessToken, user.JellyfinUserID, "Series")
		if err != nil {
			log.Error().Err(err).Msg("Failed to fetch full show metadata, aborting sync")
			s.updateSyncLog(ctx, syncLogID, "failed", 0, 0, err.Error())
			return errors.Wrap(err, errors.CodeSyncFailed, "Failed to fetch shows from Jellyfin")
		}
		jellyfin.SanitizeItems(itemsResp.Items)
		validItems, _, _ = jellyfin.ValidateItems(itemsResp.Items)
	} else {
		validItems = lightValid
	}
	for _, item := range validItems {
		jellyfinShowIDs[item.Id] = true
	}

	log.Debug().Int("user_id", userID).Int("shows", len(validItems)).Int("to_sync", len(showsNeedingSync)).Msg("Show detection done")

	episodesBySeries := make(map[string][]jellyfin.Item)
	if len(validItems) > 0 {
		log.Debug().Int("total_shows", len(validItems)).Msg("Fetching episodes for all shows")
		allEpisodesResp, err := jfClient.GetUserItems(ctx, accessToken, user.JellyfinUserID, "Episode")
		if err != nil {
			log.Warn().Err(err).Msg("Failed to batch-fetch episodes; will fetch per-show as needed")
		} else {
			for _, ep := range allEpisodesResp.Items {
				if ep.SeriesId != "" {
					episodesBySeries[ep.SeriesId] = append(episodesBySeries[ep.SeriesId], ep)
				}
			}
			log.Debug().Int("episodes", len(allEpisodesResp.Items)).Int("series", len(episodesBySeries)).Msg("Cached episodes")
		}
	}

	if len(validItems) == 0 && len(lightResp.Items) == 0 {
		log.Warn().Int("user_id", userID).Msg("No series found in Jellyfin")
	}

	itemsSynced := 0
	itemsSkipped := 0
	itemsFailed := 0
	for i, item := range validItems {
		if !showsNeedingSync[item.Id] {
			// Metadata unchanged, but still sync episodes in case new episodes were added
			// (episode count can change without affecting series-level user data).
			if preFetchedEps := episodesBySeries[item.Id]; len(preFetchedEps) > 0 {
				var showID int
				if dbErr := s.db.QueryRowContext(ctx,
					"SELECT id FROM shows WHERE jellyfin_id = ? AND user_id = ?",
					item.Id, userID).Scan(&showID); dbErr == nil {
					epTx, txErr := beginTxWithRetry(ctx, s.db, item.Id)
					if txErr == nil {
						if epErr := s.syncEpisodes(ctx, epTx, showID, item.Id, jfClient, accessToken, userID, user.JellyfinUserID, preFetchedEps); epErr != nil {
							log.Warn().Err(epErr).Str("show_id", item.Id).Msg("Failed to sync episodes for unchanged show")
						}
						if commitErr := epTx.Commit(); commitErr != nil {
							log.Warn().Err(commitErr).Str("show_id", item.Id).Msg("Failed to commit episode sync for unchanged show")
						}
					}
				}
			}
			itemsSkipped++
			continue
		}

		itemHash := computeItemHash(item)
		log.Debug().
			Int("user_id", userID).
			Int("show_index", i+1).
			Int("total_shows", len(validItems)).
			Str("show_id", item.Id).
			Str("show_name", item.Name).
			Msg("Syncing show")

		if err, _ := s.syncShow(ctx, userID, user.JellyfinUserID, item, jfClient, accessToken, itemHash, episodesBySeries); err != nil {
			log.Error().
				Err(err).
				Int("user_id", userID).
				Str("jellyfin_id", item.Id).
				Str("show_name", item.Name).
				Msg("Failed to sync show")
			itemsFailed++
		} else {
			itemsSynced++
		}
		if i < len(validItems)-1 {
			time.Sleep(50 * time.Millisecond)
		}
	}

	log.Debug().Int("user_id", userID).Int("synced", itemsSynced).Int("skipped", itemsSkipped).Int("failed", itemsFailed).Msg("Shows sync done")

	if err := s.updateSyncState(ctx, userID, "shows", itemsSynced); err != nil {
		log.Warn().Err(err).Msg("Failed to update sync state for shows")
	}

	log.Debug().Int("user_id", userID).Msg("Fetching movies")

	lightMoviesResp, err := jfClient.GetUserItemsWithFields(ctx, accessToken, user.JellyfinUserID, "Movie", jellyfin.LightItemFields)
	if err != nil {
		log.Warn().
			Err(err).
			Int("user_id", userID).
			Msg("Failed to fetch movies from Jellyfin (non-critical)")
	} else {
		jellyfin.SanitizeItems(lightMoviesResp.Items)
		lightMovies, _, _ := jellyfin.ValidateItems(lightMoviesResp.Items)

		existingMovieHashes := s.getExistingUserDataHashes(ctx, userID, "movies")
		moviesNeedingSync := make(map[string]bool)
		for _, item := range lightMovies {
			udHash := computeUserDataHash(item)
			if existingMovieHashes == nil {
				moviesNeedingSync[item.Id] = true
				continue
			}
			existing, ok := existingMovieHashes[item.Id]
			if !ok || existing != udHash {
				moviesNeedingSync[item.Id] = true
			}
		}

		var validMovies []jellyfin.Item
		fullMovieFetchOk := false
		if len(moviesNeedingSync) > 0 {
			moviesResp, err := jfClient.GetUserItems(ctx, accessToken, user.JellyfinUserID, "Movie")
			if err != nil {
				log.Warn().Err(err).Msg("Failed to fetch full movie metadata, skipping movie sync this cycle")
				validMovies = lightMovies
			} else {
				jellyfin.SanitizeItems(moviesResp.Items)
				validMovies, _, _ = jellyfin.ValidateItems(moviesResp.Items)
				fullMovieFetchOk = true
			}
		} else {
			validMovies = lightMovies
		}

		moviesSynced := 0
		moviesSkipped := 0
		moviesFailed := 0
		for i, item := range validMovies {
			if !moviesNeedingSync[item.Id] {
				moviesSkipped++
				continue
			}
			if !fullMovieFetchOk {
				moviesSkipped++
				continue // Have only light data, can't sync
			}

			itemHash := computeItemHash(item)
			log.Debug().
				Int("user_id", userID).
				Int("movie_index", i+1).
				Int("total_movies", len(validMovies)).
				Str("movie_id", item.Id).
				Str("movie_name", item.Name).
				Msg("Syncing movie")

			if err := s.syncMovie(ctx, userID, item, jfClient, itemHash); err != nil {
				log.Error().
					Err(err).
					Int("user_id", userID).
					Str("jellyfin_id", item.Id).
					Str("movie_name", item.Name).
					Msg("Failed to sync movie")
				moviesFailed++
			} else {
				moviesSynced++
			}
			if i < len(validMovies)-1 {
				time.Sleep(50 * time.Millisecond)
			}
		}

		log.Debug().Int("user_id", userID).Int("synced", moviesSynced).Int("skipped", moviesSkipped).Int("failed", moviesFailed).Msg("Movies sync done")

		if err := s.updateSyncState(ctx, userID, "movies", moviesSynced); err != nil {
			log.Warn().Err(err).Msg("Failed to update sync state for movies")
		}

		itemsSynced += moviesSynced
		itemsFailed += moviesFailed

		jellyfinMovieIDs := make(map[string]bool, len(validMovies))
		for _, item := range validMovies {
			jellyfinMovieIDs[item.Id] = true
		}
		s.markDeletedMovies(ctx, userID, jellyfinMovieIDs)
	}

	s.markDeletedShows(ctx, userID, jellyfinShowIDs)

	_, err = s.db.ExecContext(ctx, "UPDATE users SET last_sync_at = ? WHERE id = ?", time.Now(), userID)
	if err != nil {
		log.Warn().Err(err).Msg("Failed to update last sync time")
	}

	s.updateSyncLog(ctx, syncLogID, "success", itemsSynced, itemsFailed, "")

	if itemsSynced > 0 {
		if err := s.statsService.CreateSnapshot(ctx, userID); err != nil {
			log.Warn().Err(err).Msg("Failed to create stats snapshot")
		}
	}

	return nil
}

func (s *SyncService) syncShow(ctx context.Context, userID int, jellyfinUserID string, item jellyfin.Item, jfClient jellyfin.API, accessToken string, syncHash string, episodesBySeries map[string][]jellyfin.Item) (error, bool) {
	userDataHash := computeUserDataHash(item)
	tx, err := beginTxWithRetry(ctx, s.db, item.Id)
	if err != nil {
		return errors.Wrap(err, errors.CodeDatabaseError, "Failed to begin transaction"), false
	}
	defer tx.Rollback()

	genreJSON, _ := json.Marshal(item.Genres)

	var showID int
	var isNewShow bool
	err = tx.QueryRowContext(ctx,
		`SELECT id FROM shows WHERE jellyfin_id = ? AND user_id = ?`,
		item.Id, userID).Scan(&showID)

	if err == sql.ErrNoRows {
		isNewShow = true
		result, err := tx.ExecContext(ctx,
			`INSERT INTO shows (jellyfin_id, title, overview, poster_url, genre, year, imdb_id, tmdb_id, status, user_id, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
			item.Id, item.Name, item.Overview,
			fmt.Sprintf("%s/Items/%s/Images/Primary", jfClient.BaseURL(), item.Id),
			string(genreJSON), item.ProductionYear,
			item.ProviderIds.Imdb, item.ProviderIds.Tmdb,
			userID, time.Now(), time.Now())
		if err != nil {
			return errors.Wrap(err, errors.CodeDatabaseError, "Failed to insert show"), false
		}
		showID64, _ := result.LastInsertId()
		showID = int(showID64)

		if _, hashErr := tx.ExecContext(ctx, "UPDATE shows SET sync_hash = ?, userdata_hash = ? WHERE id = ?", syncHash, userDataHash, showID); hashErr != nil {
			log.Warn().Err(hashErr).Int("show_id", showID).Msg("Failed to update show hash")
		}
	} else if err != nil {
		return errors.Wrap(err, errors.CodeDatabaseError, "Failed to look up show"), false
	} else {
		_, err = tx.ExecContext(ctx,
			`UPDATE shows SET title = ?, overview = ?, poster_url = ?, genre = ?, year = ?, imdb_id = ?, tmdb_id = ?, updated_at = ? WHERE id = ?`,
			item.Name, item.Overview,
			fmt.Sprintf("%s/Items/%s/Images/Primary", jfClient.BaseURL(), item.Id),
			string(genreJSON), item.ProductionYear,
			item.ProviderIds.Imdb, item.ProviderIds.Tmdb,
			time.Now(), showID)
		if err != nil {
			return errors.Wrap(err, errors.CodeDatabaseError, "Failed to update show"), false
		}

		if _, hashErr := tx.ExecContext(ctx, "UPDATE shows SET sync_hash = ?, userdata_hash = ? WHERE id = ?", syncHash, userDataHash, showID); hashErr != nil {
			log.Warn().Err(hashErr).Int("show_id", showID).Msg("Failed to update show hash")
		}
	}

	if err := s.syncEpisodes(ctx, tx, showID, item.Id, jfClient, accessToken, userID, jellyfinUserID, episodesBySeries[item.Id]); err != nil {
		log.Warn().
			Err(err).
			Int("show_id", showID).
			Str("series_id", item.Id).
			Msg("Failed to sync episodes, but show will still be saved")
	}

	if err := tx.Commit(); err != nil {
		return errors.Wrap(err, errors.CodeDatabaseError, "Failed to commit show transaction"), false
	}

	if s.imageService != nil && !s.imageService.ImageExists("shows", item.Id, "poster") {
		posterURL := fmt.Sprintf("%s/Items/%s/Images/Primary", jfClient.BaseURL(), item.Id)
		if accessToken != "" {
			posterURL = posterURL + "?ApiKey=" + url.QueryEscape(accessToken)
		}
		posterPath := s.imageService.CacheImageForWatchedShow(ctx, item.Id, posterURL)
		if posterPath != "" {
			_, updateErr := s.db.ExecContext(ctx,
				`UPDATE shows SET local_poster_path = ? WHERE id = ?`,
				posterPath, showID)
			if updateErr != nil {
				log.Warn().Err(updateErr).Str("show_id", item.Id).Msg("Failed to update local image path")
			} else {
				log.Debug().
					Str("show_id", item.Id).
					Str("show_name", item.Name).
					Str("poster_path", posterPath).
					Msg("Cached poster for new show")
			}
		}
	}

	return nil, isNewShow
}

func (s *SyncService) syncEpisodes(ctx context.Context, tx *sql.Tx, showID int, seriesID string, jfClient jellyfin.API, accessToken string, userID int, jellyfinUserID string, preFetchedEpisodes []jellyfin.Item) error {
	var countBefore int
	_ = tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM episodes WHERE show_id = ?", showID).Scan(&countBefore)

	var seriesEpisodes []jellyfin.Item
	var err error
	if len(preFetchedEpisodes) > 0 {
		seriesEpisodes = preFetchedEpisodes
	} else {
		episodesResp, err := jfClient.GetEpisodesForSeries(ctx, accessToken, seriesID)
		if err != nil {
			allEpisodes, err2 := jfClient.GetUserItems(ctx, accessToken, jellyfinUserID, "Episode")
			if err2 != nil {
				log.Warn().Err(err2).Str("series_id", seriesID).Msg("Failed to fetch episodes, will retry later")
				return nil
			}
			for _, ep := range allEpisodes.Items {
				if ep.SeriesId == seriesID {
					seriesEpisodes = append(seriesEpisodes, ep)
				}
			}
		} else {
			for _, ep := range episodesResp.Items {
				if ep.SeriesId == seriesID {
					seriesEpisodes = append(seriesEpisodes, ep)
				}
			}
		}
	}

	for _, ep := range seriesEpisodes {
		durationMinutes := int(ep.RunTimeTicks / ticksPerMinute)
		watched := ep.UserData.Played
		var watchedAt *time.Time
		hasProgress := ep.UserData.PlayedPercentage > 0

		if !ep.UserData.LastPlayedDate.IsZero() {
			watchedAt = &ep.UserData.LastPlayedDate
		}

		epCompletion := ep.UserData.PlayedPercentage
		if watched {
			epCompletion = 100.0
		}

		_, err = tx.ExecContext(ctx,
			`INSERT INTO episodes (show_id, jellyfin_id, title, episode_number, season_number, duration_minutes, watched, watched_at, completion_percentage, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT(show_id, season_number, episode_number) DO UPDATE SET
			   jellyfin_id = excluded.jellyfin_id,
			   title = excluded.title,
			   duration_minutes = excluded.duration_minutes,
			   watched = excluded.watched,
			   watched_at = excluded.watched_at,
			   completion_percentage = excluded.completion_percentage,
			   updated_at = excluded.updated_at`,
			showID, ep.Id, ep.Name, ep.IndexNumber, ep.ParentIndexNumber,
			durationMinutes, watched, watchedAt, epCompletion, time.Now(), time.Now())

		if err != nil {
			log.Warn().Err(err).Str("episode_id", ep.Id).Msg("Failed to sync episode")
		}

		if watchedAt != nil && hasProgress {
			durationWatched := int(float64(durationMinutes) * ep.UserData.PlayedPercentage / 100)

			var episodeID int
			err = tx.QueryRowContext(ctx,
				"SELECT id FROM episodes WHERE jellyfin_id = ? AND show_id = ?", ep.Id, showID).Scan(&episodeID)
			if err != nil {
				log.Warn().Err(err).Msg("Failed to get episode ID for watch history")
			} else {
				var existingCount int
				err = tx.QueryRowContext(ctx,
					`SELECT COUNT(*) FROM watch_history 
					 WHERE user_id = ? AND show_id = ? AND episode_id = ? 
					 AND date(watched_at) = date(?)`,
					userID, showID, episodeID, *watchedAt).Scan(&existingCount)

				if err != nil {
					log.Warn().Err(err).Msg("Failed to check existing watch history")
				} else if existingCount == 0 {
					_, err = tx.ExecContext(ctx,
						`INSERT INTO watch_history (user_id, show_id, episode_id, watched_at, duration_watched_minutes, completion_percentage)
						 VALUES (?, ?, ?, ?, ?, ?)`,
						userID, showID, episodeID, *watchedAt, durationWatched, ep.UserData.PlayedPercentage)
					if err != nil {
						log.Warn().Err(err).Msg("Failed to insert watch history")
					}
				} else {
					_, err = tx.ExecContext(ctx,
						`UPDATE watch_history 
						 SET duration_watched_minutes = MAX(duration_watched_minutes, ?),
						     completion_percentage = MAX(completion_percentage, ?)
						 WHERE user_id = ? AND show_id = ? AND episode_id = ? 
						 AND date(watched_at) = date(?)`,
						durationWatched, ep.UserData.PlayedPercentage,
						userID, showID, episodeID, *watchedAt)
					if err != nil {
						log.Warn().Err(err).Msg("Failed to update watch history")
					}
				}
			}
		}
	}

	var countAfter int
	_ = tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM episodes WHERE show_id = ?", showID).Scan(&countAfter)
	if countAfter > countBefore {
		var showTitle string
		if e := tx.QueryRowContext(ctx, "SELECT title FROM shows WHERE id = ?", showID).Scan(&showTitle); e == nil {
			newCount := countAfter - countBefore
			body := fmt.Sprintf("%d new episode", newCount)
			if newCount > 1 {
				body += "s"
			}
			body += " available"
			dataJSON, _ := json.Marshal(map[string]interface{}{"show_id": showID, "type": "new_episodes"})
			_, _ = tx.ExecContext(ctx,
				`INSERT INTO notifications (user_id, type, title, body, data) VALUES (?, 'new_episodes', ?, ?, ?)`,
				userID, "New episodes: "+showTitle, body, string(dataJSON))
		}
	}

	_, err = tx.ExecContext(ctx,
		`UPDATE shows SET
		 total_episodes = (SELECT COUNT(*) FROM episodes WHERE show_id = ?),
		 watched_episodes = (SELECT COUNT(*) FROM episodes WHERE show_id = ? AND watched = 1),
		 total_watch_time_minutes = (
		   -- Fully watched episodes count at their full duration
		   SELECT COALESCE(SUM(
		     CASE
		       WHEN watched = 1 THEN duration_minutes
		       WHEN completion_percentage > 0 THEN CAST(duration_minutes * completion_percentage / 100.0 AS INTEGER)
		       ELSE 0
		     END
		   ), 0)
		   FROM episodes WHERE show_id = ?
		 ),
		 status = CASE
		   WHEN (SELECT COUNT(*) FROM episodes WHERE show_id = ? AND watched = 1) >= (SELECT COUNT(*) FROM episodes WHERE show_id = ?) AND (SELECT COUNT(*) FROM episodes WHERE show_id = ?) > 0 THEN 'watched'
		   WHEN EXISTS (
		     SELECT 1 FROM episodes 
		     WHERE show_id = ? 
		     AND watched_at > datetime('now', '-2 minutes')
		   ) THEN 'watching'
		   WHEN (SELECT COUNT(*) FROM episodes WHERE show_id = ? AND watched = 1) > 0 THEN 'watching'
		   ELSE 'pending'
		 END,
		 last_watched_at = (
		   SELECT MAX(watched_at) FROM episodes 
		   WHERE show_id = ? AND watched_at IS NOT NULL
		 ),
		 updated_at = ?
		 WHERE id = ?`,
		showID, showID, showID, showID, showID, showID, showID, showID, showID, time.Now(), showID)

	return err
}

func (s *SyncService) syncMovie(ctx context.Context, userID int, item jellyfin.Item, jfClient jellyfin.API, syncHash string) error {
	userDataHash := computeUserDataHash(item)
	tx, err := beginTxWithRetry(ctx, s.db, item.Id)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	genreJSON, _ := json.Marshal(item.Genres)

	runtimeMinutes := int(item.RunTimeTicks / ticksPerMinute)

	status := "pending"
	watched := false
	watchCount := 0
	var firstWatchedAt, lastWatchedAt *time.Time
	completionPercentage := 0.0

	if item.UserData.Played {
		watched = true
		watchCount = 1
		status = "watched"
		if !item.UserData.LastPlayedDate.IsZero() {
			t := item.UserData.LastPlayedDate
			firstWatchedAt = &t
			lastWatchedAt = &t
		}
	} else if item.UserData.PlayedPercentage > 0 {
		status = "watching"
		completionPercentage = item.UserData.PlayedPercentage
		if !item.UserData.LastPlayedDate.IsZero() {
			t := item.UserData.LastPlayedDate
			firstWatchedAt = &t
			lastWatchedAt = &t
		}
	}

	totalWatchTimeMinutes := 0
	if watched {
		totalWatchTimeMinutes = runtimeMinutes
	} else if item.UserData.PlayedPercentage > 0 {
		totalWatchTimeMinutes = int(float64(runtimeMinutes) * item.UserData.PlayedPercentage / 100)
	}

	var movieID int
	err = tx.QueryRowContext(ctx,
		`SELECT id FROM movies WHERE jellyfin_id = ? AND user_id = ?`,
		item.Id, userID).Scan(&movieID)

	if err == sql.ErrNoRows {

		result, err := tx.ExecContext(ctx,
			`INSERT INTO movies (
				jellyfin_id, title, overview, poster_url, backdrop_url, genre, year,
				imdb_id, tmdb_id, runtime_minutes, status, watched, watch_count,
				total_watch_time_minutes, completion_percentage,
				first_watched_at, last_watched_at, user_id, created_at, updated_at
			) VALUES (?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			item.Id, item.Name, item.Overview,
			fmt.Sprintf("%s/Items/%s/Images/Primary", jfClient.BaseURL(), item.Id),
			string(genreJSON), item.ProductionYear,
			item.ProviderIds.Imdb, item.ProviderIds.Tmdb,
			runtimeMinutes, status, watched, watchCount,
			totalWatchTimeMinutes, completionPercentage,
			firstWatchedAt, lastWatchedAt, userID, time.Now(), time.Now())
		if err != nil {
			return err
		}
		movieID64, _ := result.LastInsertId()
		movieID = int(movieID64)

		if _, hashErr := tx.ExecContext(ctx, "UPDATE movies SET sync_hash = ?, userdata_hash = ? WHERE id = ?", syncHash, userDataHash, movieID); hashErr != nil {
			log.Warn().Err(hashErr).Int("movie_id", movieID).Msg("Failed to update movie hash")
		}
	} else if err != nil {
		return err
	} else {
		_, err = tx.ExecContext(ctx,
			`UPDATE movies SET
				title = ?, overview = ?, poster_url = ?,
				genre = ?, year = ?, imdb_id = ?, tmdb_id = ?,
				runtime_minutes = ?, status = ?, watched = ?, watch_count = ?,
				total_watch_time_minutes = ?, completion_percentage = ?,
				first_watched_at = ?, last_watched_at = ?, updated_at = ?
			WHERE id = ?`,
			item.Name, item.Overview,
			fmt.Sprintf("%s/Items/%s/Images/Primary", jfClient.BaseURL(), item.Id),
			string(genreJSON), item.ProductionYear,
			item.ProviderIds.Imdb, item.ProviderIds.Tmdb,
			runtimeMinutes, status, watched, watchCount,
			totalWatchTimeMinutes, completionPercentage,
			firstWatchedAt, lastWatchedAt, time.Now(), movieID)
		if err != nil {
			return err
		}

		if _, hashErr := tx.ExecContext(ctx, "UPDATE movies SET sync_hash = ?, userdata_hash = ? WHERE id = ?", syncHash, userDataHash, movieID); hashErr != nil {
			log.Warn().Err(hashErr).Int("movie_id", movieID).Msg("Failed to update movie hash")
		}
	}

	if (watched || completionPercentage > 0) && lastWatchedAt != nil {
		var existingWH int
		_ = tx.QueryRowContext(ctx,
			`SELECT COUNT(*) FROM watch_history WHERE user_id = ? AND movie_id = ? AND date(watched_at) = date(?)`,
			userID, movieID, lastWatchedAt.Format("2006-01-02")).Scan(&existingWH)
		if existingWH == 0 {
			_, err = tx.ExecContext(ctx,
				`INSERT INTO watch_history (
						user_id, show_id, movie_id, watched_at, duration_watched_minutes, completion_percentage
					) VALUES (?, NULL, ?, ?, ?, ?)`,
				userID, movieID, *lastWatchedAt, totalWatchTimeMinutes, completionPercentage)
			if err != nil {
				log.Warn().
					Err(err).
					Str("movie_id", item.Id).
					Str("movie_name", item.Name).
					Msg("Failed to insert movie into watch_history")
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	if s.imageService != nil && !s.imageService.ImageExists("movies", item.Id, "poster") {
		posterURL := fmt.Sprintf("%s/Items/%s/Images/Primary", jfClient.BaseURL(), item.Id)
		var accessToken string
		if ts := NewTokenRefreshService(s.db); ts != nil {
			if tok, err := ts.GetValidToken(ctx, userID); err == nil && tok != "" {
				accessToken = tok
			}
		}
		if accessToken != "" {
			posterURL = posterURL + "?ApiKey=" + url.QueryEscape(accessToken)
		}
		posterPath := s.imageService.CacheImageForWatchedMovie(ctx, item.Id, posterURL)
		if posterPath != "" {
			_, updateErr := s.db.ExecContext(ctx,
				`UPDATE movies SET local_poster_path = ? WHERE id = ?`,
				posterPath, movieID)
			if updateErr != nil {
				log.Warn().Err(updateErr).Str("movie_id", item.Id).Msg("Failed to update local poster path")
			} else {
				log.Debug().
					Str("movie_id", item.Id).
					Str("movie_name", item.Name).
					Str("poster_path", posterPath).
					Msg("Cached poster for new movie")
			}
		}
	}

	return nil
}

func nullIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func (s *SyncService) markDeletedMovies(ctx context.Context, userID int, activeJellyfinIDs map[string]bool) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, jellyfin_id FROM movies WHERE user_id = ? AND (deleted_from_jellyfin = 0 OR deleted_from_jellyfin IS NULL)`,
		userID)
	if err != nil {
		if strings.Contains(err.Error(), "no such column") {
			return // Column not yet migrated, skip
		}
		log.Warn().Err(err).Int("user_id", userID).Msg("Failed to query movies for deletion check")
		return
	}
	defer rows.Close()

	var toMark []int
	for rows.Next() {
		var id int
		var jellyfinID string
		if err := rows.Scan(&id, &jellyfinID); err != nil {
			continue
		}
		if !activeJellyfinIDs[jellyfinID] {
			toMark = append(toMark, id)
		}
	}
	if err := rows.Err(); err != nil {
		log.Warn().Err(err).Int("user_id", userID).Msg("Error iterating movies for deletion check")
	}

	if len(toMark) == 0 {
		return
	}
	now := time.Now()
	const batchSize = 100
	for i := 0; i < len(toMark); i += batchSize {
		end := i + batchSize
		if end > len(toMark) {
			end = len(toMark)
		}
		batch := toMark[i:end]
		placeholders := make([]string, len(batch))
		args := make([]interface{}, 0, len(batch)+1)
		args = append(args, now)
		for j, id := range batch {
			placeholders[j] = "?"
			args = append(args, id)
		}
		query := `UPDATE movies SET deleted_from_jellyfin = 1, updated_at = ? WHERE id IN (` + strings.Join(placeholders, ",") + `)`
		_, err := s.db.ExecContext(ctx, query, args...)
		if err != nil {
			log.Warn().Err(err).Int("count", len(batch)).Msg("Failed to mark movies as deleted from Jellyfin")
		} else if len(batch) > 0 {
			log.Debug().Int("count", len(batch)).Msg("Marked movies deleted")
		}
	}
}

func (s *SyncService) markDeletedShows(ctx context.Context, userID int, activeJellyfinIDs map[string]bool) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, jellyfin_id FROM shows WHERE user_id = ? AND (deleted_from_jellyfin = 0 OR deleted_from_jellyfin IS NULL)`,
		userID)
	if err != nil {
		if strings.Contains(err.Error(), "no such column") {
			return // Column not yet migrated, skip
		}
		log.Warn().Err(err).Int("user_id", userID).Msg("Failed to query shows for deletion check")
		return
	}
	defer rows.Close()

	var toMark []int
	for rows.Next() {
		var id int
		var jellyfinID string
		if err := rows.Scan(&id, &jellyfinID); err != nil {
			continue
		}
		if !activeJellyfinIDs[jellyfinID] {
			toMark = append(toMark, id)
		}
	}
	if err := rows.Err(); err != nil {
		log.Warn().Err(err).Int("user_id", userID).Msg("Error iterating shows for deletion check")
	}

	if len(toMark) == 0 {
		return
	}
	now := time.Now()
	const batchSize = 100
	for i := 0; i < len(toMark); i += batchSize {
		end := i + batchSize
		if end > len(toMark) {
			end = len(toMark)
		}
		batch := toMark[i:end]
		placeholders := make([]string, len(batch))
		args := make([]interface{}, 0, len(batch)+1)
		args = append(args, now)
		for j, id := range batch {
			placeholders[j] = "?"
			args = append(args, id)
		}
		query := `UPDATE shows SET deleted_from_jellyfin = 1, updated_at = ? WHERE id IN (` + strings.Join(placeholders, ",") + `)`
		_, err := s.db.ExecContext(ctx, query, args...)
		if err != nil {
			log.Warn().Err(err).Int("count", len(batch)).Msg("Failed to mark shows as deleted from Jellyfin")
		} else if len(batch) > 0 {
			log.Debug().Int("count", len(batch)).Msg("Marked shows deleted")
		}
	}
}

func (s *SyncService) startSyncLog(ctx context.Context, userID int) (int64, error) {
	result, err := s.db.ExecContext(ctx,
		"INSERT INTO sync_logs (user_id, sync_started_at, status) VALUES (?, ?, 'partial')",
		userID, time.Now())
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func (s *SyncService) updateSyncLog(ctx context.Context, logID int64, status string, itemsSynced, itemsFailed int, errorMsg string) {
	if logID == 0 {
		return
	}

	var startedAt time.Time
	err := s.db.QueryRowContext(ctx, "SELECT sync_started_at FROM sync_logs WHERE id = ?", logID).Scan(&startedAt)
	if err != nil {
		log.Warn().Err(err).Msg("Failed to get sync start time")
		return
	}

	duration := time.Since(startedAt)
	_, err = s.db.ExecContext(ctx,
		`UPDATE sync_logs SET sync_completed_at = ?, status = ?, items_synced = ?, items_failed = ?, error_message = ?, duration_seconds = ?
		 WHERE id = ?`,
		time.Now(), status, itemsSynced, itemsFailed, errorMsg, duration.Seconds(), logID)
	if err != nil {
		log.Warn().Err(err).Msg("Failed to update sync log")
	}
}

func (s *SyncService) GetLastSyncStatus(ctx context.Context, userID int) (map[string]interface{}, error) {
	var status struct {
		LastSyncAt      sql.NullTime
		Status          sql.NullString
		ItemsSynced     sql.NullInt64
		ItemsFailed     sql.NullInt64
		DurationSeconds sql.NullFloat64
	}
	err := s.db.QueryRowContext(ctx,
		`SELECT sync_completed_at, status, items_synced, items_failed, duration_seconds
		 FROM sync_logs
		 WHERE user_id = ?
		 ORDER BY sync_started_at DESC
		 LIMIT 1`,
		userID).Scan(&status.LastSyncAt, &status.Status, &status.ItemsSynced, &status.ItemsFailed, &status.DurationSeconds)

	result := make(map[string]interface{})

	if err == sql.ErrNoRows {
		result["status"] = "never"
		result["last_sync_at"] = ""
		result["items_synced"] = 0
		result["items_failed"] = 0
		result["duration_seconds"] = 0.0
		return result, nil
	}
	if err != nil {
		return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to get sync status")
	}

	if status.LastSyncAt.Valid {
		result["last_sync_at"] = status.LastSyncAt.Time.Format(time.RFC3339)
	} else {
		result["last_sync_at"] = ""
	}

	if status.Status.Valid {
		result["status"] = status.Status.String
	} else {
		result["status"] = "unknown"
	}

	if status.ItemsSynced.Valid {
		result["items_synced"] = status.ItemsSynced.Int64
	} else {
		result["items_synced"] = 0
	}

	if status.ItemsFailed.Valid {
		result["items_failed"] = status.ItemsFailed.Int64
	} else {
		result["items_failed"] = 0
	}

	if status.DurationSeconds.Valid {
		result["duration_seconds"] = status.DurationSeconds.Float64
	} else {
		result["duration_seconds"] = 0.0
	}

	return result, nil
}
