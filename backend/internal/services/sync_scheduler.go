package services

import (
	"context"
	"database/sql"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
)

type SyncScheduler struct {
	mu               sync.RWMutex
	db               *sql.DB
	interval         time.Duration
	sessionsInterval time.Duration
	workerPoolSize   int
	dataPath         string
	syncConfig       SyncConfig
	fullSyncEnabled  bool
	reconfigCh       chan struct{} // signaled when intervals should be reloaded
	settingsService  *SystemSettingsService
}

func NewSyncScheduler(db *sql.DB, interval time.Duration, workerPoolSize int) *SyncScheduler {
	return &SyncScheduler{
		db:               db,
		interval:         interval,
		sessionsInterval: min(interval/2, 90*time.Second),
		workerPoolSize:   workerPoolSize,
		fullSyncEnabled:  true,
		reconfigCh:       make(chan struct{}, 1),
		settingsService:  NewSystemSettingsService(db),
	}
}

func NewSyncSchedulerWithDataPath(db *sql.DB, fullSyncInterval, sessionsInterval time.Duration, workerPoolSize int, dataPath string, syncConfig SyncConfig) *SyncScheduler {
	si := sessionsInterval
	if si < time.Second {
		si = min(fullSyncInterval/2, 90*time.Second)
	}
	return &SyncScheduler{
		db:               db,
		interval:         fullSyncInterval,
		sessionsInterval: si,
		workerPoolSize:   workerPoolSize,
		dataPath:         dataPath,
		syncConfig:       syncConfig,
		fullSyncEnabled:  true,
		reconfigCh:       make(chan struct{}, 1),
		settingsService:  NewSystemSettingsService(db),
	}
}

func (s *SyncScheduler) UpdateIntervals(ctx context.Context) {
	s.UpdateIntervalsWithSignal(ctx, true)
}

func (s *SyncScheduler) UpdateIntervalsWithSignal(ctx context.Context, signalReconfig bool) {
	if s.settingsService == nil {
		return
	}
	fullSec := s.settingsService.GetInt(ctx, "sync_interval_seconds", 300)
	sessSec := s.settingsService.GetInt(ctx, "sessions_sync_interval_seconds", 90)
	enabled := s.settingsService.GetBool(ctx, "sync_enabled", true)

	s.mu.Lock()
	s.interval = time.Duration(fullSec) * time.Second
	s.sessionsInterval = time.Duration(sessSec) * time.Second
	s.fullSyncEnabled = enabled
	s.mu.Unlock()

	if signalReconfig {
		select {
		case s.reconfigCh <- struct{}{}:
		default:
		}
	}
	log.Debug().Int("full_sync_seconds", fullSec).Int("sessions_seconds", sessSec).Bool("enabled", enabled).Msg("Sync intervals updated")
}

func (s *SyncScheduler) Start(ctx context.Context) {
	s.UpdateIntervalsWithSignal(ctx, false)

	s.mu.RLock()
	interval := s.interval
	sessionsInterval := s.sessionsInterval
	s.mu.RUnlock()

	fullTicker := time.NewTicker(interval)
	sessionsTicker := time.NewTicker(sessionsInterval)

	s.syncAllUsers(ctx)

	for {
		select {
		case <-ctx.Done():
			fullTicker.Stop()
			sessionsTicker.Stop()
			return
		case <-s.reconfigCh:
			fullTicker.Stop()
			sessionsTicker.Stop()
			s.mu.RLock()
			interval = s.interval
			sessionsInterval = s.sessionsInterval
			s.mu.RUnlock()
			fullTicker = time.NewTicker(interval)
			sessionsTicker = time.NewTicker(sessionsInterval)
			log.Debug().Dur("full_sync_interval", interval).Dur("sessions_interval", sessionsInterval).Msg("Sync reconfigured")
		case <-fullTicker.C:
			s.syncAllUsers(ctx)
		case <-sessionsTicker.C:
			s.syncSessionsOnly(ctx)
		}
	}
}

func (s *SyncScheduler) SyncAllUsers(ctx context.Context) {
	s.syncAllUsers(ctx)
}

func (s *SyncScheduler) syncSessionsOnly(ctx context.Context) {
	s.mu.RLock()
	enabled := s.fullSyncEnabled
	s.mu.RUnlock()
	if !enabled {
		return
	}

	rows, err := s.db.QueryContext(ctx, "SELECT id FROM users WHERE deleted_at IS NULL")
	if err != nil {
		log.Error().Err(err).Msg("Failed to get users for sessions sync")
		return
	}
	defer rows.Close()

	var userIDs []int
	for rows.Next() {
		var userID int
		if err := rows.Scan(&userID); err != nil {
			continue
		}
		userIDs = append(userIDs, userID)
	}
	if len(userIDs) == 0 {
		return
	}

	sessionsService := NewSessionsService(s.db)
	sem := make(chan struct{}, s.workerPoolSize)
	var wg sync.WaitGroup
	for _, userID := range userIDs {
		wg.Add(1)
		go func(uid int) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			if err := sessionsService.SyncActiveSessions(ctx, uid); err != nil {
				log.Debug().Err(err).Int("user_id", uid).Msg("Sessions sync failed (non-critical)")
			}
		}(userID)
	}
	wg.Wait()
}

func (s *SyncScheduler) syncAllUsers(ctx context.Context) {

	rows, err := s.db.QueryContext(ctx, "SELECT id FROM users WHERE deleted_at IS NULL")
	if err != nil {
		log.Error().Err(err).Msg("Failed to get users for sync")
		return
	}
	defer rows.Close()

	var userIDs []int
	for rows.Next() {
		var userID int
		if err := rows.Scan(&userID); err != nil {
			log.Warn().Err(err).Msg("Failed to scan user ID")
			continue
		}
		userIDs = append(userIDs, userID)
	}

	log.Debug().Int("users", len(userIDs)).Msg("Sync cycle starting")

	if len(userIDs) == 0 {
		log.Debug().Msg("No users to sync")
		return
	}

	var syncService *SyncService
	if s.dataPath != "" {
		syncService = NewSyncServiceWithDataPath(s.db, s.syncConfig, s.dataPath)
	} else {
		syncService = NewSyncServiceWithConfig(s.db, s.syncConfig)
	}
	sessionsService := NewSessionsService(s.db)

	sem := make(chan struct{}, s.workerPoolSize)
	var wg sync.WaitGroup

	syncStartTime := time.Now()
	for _, userID := range userIDs {
		wg.Add(1)
		go func(uid int) {
			defer wg.Done()
			sem <- struct{}{}        // Acquire
			defer func() { <-sem }() // Release

			log.Debug().Int("user_id", uid).Msg("Starting sync for user")

			syncStart := time.Now()
			if err := syncService.SyncUser(ctx, uid); err != nil {
				log.Error().
					Err(err).
					Int("user_id", uid).
					Dur("duration", time.Since(syncStart)).
					Msg("Failed to sync user")
			} else {
				log.Debug().
					Int("user_id", uid).
					Dur("duration", time.Since(syncStart)).
					Msg("Successfully synced user data")
			}

			sessionsStart := time.Now()
			if err := sessionsService.SyncActiveSessions(ctx, uid); err != nil {
				log.Warn().
					Err(err).
					Int("user_id", uid).
					Dur("duration", time.Since(sessionsStart)).
					Msg("Failed to sync active sessions")
			} else {
				log.Debug().
					Int("user_id", uid).
					Dur("duration", time.Since(sessionsStart)).
					Msg("Successfully synced active sessions")
			}
		}(userID)
	}

	wg.Wait()
	totalDuration := time.Since(syncStartTime)
	log.Info().Int("users", len(userIDs)).Dur("duration", totalDuration).Msg("Sync complete")
}
