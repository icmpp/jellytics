// Package api provides the HTTP router and middleware stack for the Jellytics API.
package api

import (
	"database/sql"
	"time"

	"jellytics/backend/internal/api/handlers"
	apiMiddleware "jellytics/backend/internal/api/middleware"
	"jellytics/backend/internal/config"
	"jellytics/backend/internal/jellyfin"
	"jellytics/backend/internal/services"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/rs/cors"
)

func NewRouterWithServices(db *sql.DB, cfg *config.Config, syncScheduler *services.SyncScheduler) *chi.Mux {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(apiMiddleware.Tracing())
	r.Use(apiMiddleware.RequestLogger())
	r.Use(apiMiddleware.Recovery)
	r.Use(apiMiddleware.Metrics)
	r.Use(middleware.Timeout(60 * time.Second))
	r.Use(middleware.Compress(5, "application/json", "text/html", "text/plain"))
	r.Use(apiMiddleware.SecurityHeaders)

	rateLimiter := apiMiddleware.NewRateLimiter(cfg.RateLimit.RequestsPerMinute, cfg.RateLimit.BurstSize)
	r.Use(rateLimiter.Limit)

	c := cors.New(cors.Options{
		AllowedOrigins:   cfg.CORS.AllowedOrigins,
		AllowedMethods:   cfg.CORS.AllowedMethods,
		AllowedHeaders:   cfg.CORS.AllowedHeaders,
		AllowCredentials: true,
	})
	r.Use(c.Handler)

	r.Get("/health", handlers.HealthHandler)
	r.Handle("/metrics", handlers.MetricsHandler())

	authHandler := handlers.NewAuthHandler(db, cfg, jellyfin.PooledClientProvider{})

	r.Route("/api/v1", func(r chi.Router) {
		r.Route("/auth", func(r chi.Router) {
			r.Get("/onboarding-status", authHandler.GetOnboardingStatus)
			r.Post("/login", authHandler.Login)
			r.Post("/logout", authHandler.Logout)
			r.Post("/refresh", authHandler.Refresh)
		})

		showsHandler := handlers.NewShowsHandler(db, cfg.Database.DataDir())
		moviesHandler := handlers.NewMoviesHandlerWithDB(db, cfg.Database.DataDir())
		statsHandler := handlers.NewStatsHandler(db)
		syncHandler := handlers.NewSyncHandlerWithDataPath(db, cfg.Database.DataDir(), services.SyncConfigFromAppConfig(cfg.Sync))
		settingsHandler := handlers.NewSettingsHandler(db)
		sessionsHandler := handlers.NewSessionsHandler(db)
		watchlistHandler := handlers.NewWatchlistHandler(db)
		ratingsHandler := handlers.NewRatingsHandler(db)
		reviewsHandler := handlers.NewReviewsHandler(db)
		imagesHandler := handlers.NewImagesHandler(db, cfg.Database.DataDir())
		searchHandler := handlers.NewSearchHandler(db)
		historyHandler := handlers.NewHistoryHandler(db)
		archiveHandler := handlers.NewArchiveHandler(db)
		recommendationsHandler := handlers.NewRecommendationsHandler(db)
		collectionsHandler := handlers.NewCollectionsHandler(db)
		tagsHandler := handlers.NewTagsHandler(db)
		notificationsHandler := handlers.NewNotificationsHandler(db)

		systemSettingsService := services.NewSystemSettingsService(db)
		systemSettingsHandler := handlers.NewSystemSettingsHandler(systemSettingsService, syncScheduler)

		r.Route("/images", imagesHandler.RegisterRoutes)

		r.Group(func(r chi.Router) {
			r.Use(apiMiddleware.AuthMiddleware(cfg, db))

			r.Route("/shows", showsHandler.RegisterRoutes)
			r.Route("/movies", moviesHandler.RegisterRoutes)
			r.Route("/stats", statsHandler.RegisterRoutes)
			r.Route("/search", searchHandler.RegisterRoutes)
			r.Route("/history", historyHandler.RegisterRoutes)
			r.Route("/archive", archiveHandler.RegisterRoutes)
			r.Route("/recommendations", recommendationsHandler.RegisterRoutes)
			r.Route("/sync", syncHandler.RegisterRoutes)
			r.Route("/settings", settingsHandler.RegisterRoutes)
			r.Route("/system-settings", systemSettingsHandler.RegisterRoutes)
			r.Route("/sessions", sessionsHandler.RegisterRoutes)
			r.Route("/watchlist", watchlistHandler.RegisterRoutes)
			r.Route("/ratings", ratingsHandler.RegisterRoutes)
			r.Route("/reviews", reviewsHandler.RegisterRoutes)
			r.Route("/collections", collectionsHandler.RegisterRoutes)
			r.Route("/tags", tagsHandler.RegisterRoutes)
			r.Route("/notifications", notificationsHandler.RegisterRoutes)
		})
	})

	return r
}
