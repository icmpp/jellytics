package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"jellytics/backend/internal/api"
	"jellytics/backend/internal/config"
	"jellytics/backend/internal/database"
	"jellytics/backend/internal/logger"
	"jellytics/backend/internal/services"
	"jellytics/backend/internal/telemetry"

	"github.com/rs/zerolog/log"
)

func main() {
	ctx := context.Background()
	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to load configuration")
	}

	logger.Init(cfg.Log.Level, cfg.Log.Format)

	shutdownTracer, err := telemetry.InitTracer(ctx)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to initialize tracer")
	}
	defer func() {
		if err := shutdownTracer(context.Background()); err != nil {
			log.Warn().Err(err).Msg("Tracer shutdown failed")
		}
	}()

	db, err := database.Initialize(cfg.Database.Path)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to initialize database")
	}
	defer database.Close(db)

	syncScheduler := services.NewSyncSchedulerWithDataPath(db, cfg.Sync.Interval, cfg.Sync.SessionsInterval, cfg.Sync.WorkerPoolSize, cfg.Database.DataDir(), services.SyncConfigFromAppConfig(cfg.Sync))

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go syncScheduler.Start(ctx)

	router := api.NewRouterWithServices(db, cfg, syncScheduler)

	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Server.Port),
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Info().Int("port", cfg.Server.Port).Msg("Server listening")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("Server failed to start")
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Error().Err(err).Msg("Shutdown failed")
	} else {
		log.Info().Msg("Server stopped")
	}
}
