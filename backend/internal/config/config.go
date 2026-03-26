// Package config loads and validates application configuration from environment variables.
package config

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
	"github.com/rs/zerolog/log"
)

type Config struct {
	Server    ServerConfig
	Database  DatabaseConfig
	JWT       JWTConfig
	Log       LogConfig
	CORS      CORSConfig
	Sync      SyncConfig
	RateLimit RateLimitConfig
}

type ServerConfig struct {
	Port int
	Host string
}

type DatabaseConfig struct {
	Path string
}

func (c *DatabaseConfig) DataDir() string {
	return filepath.Dir(c.Path)
}

type JWTConfig struct {
	Secret        string
	AccessExpiry  time.Duration
	RefreshExpiry time.Duration
}

type LogConfig struct {
	Level  string
	Format string
}

type CORSConfig struct {
	AllowedOrigins []string
	AllowedMethods []string
	AllowedHeaders []string
}

type SyncConfig struct {
	Interval          time.Duration
	SessionsInterval  time.Duration
	WorkerPoolSize    int
	RetryAttempts     int
	RetryBackoff      time.Duration
	MaxRetryBackoff   time.Duration
	RequestTimeout    time.Duration
	BatchSize         int
	EnableIncremental bool
}

type RateLimitConfig struct {
	RequestsPerMinute int
	BurstSize         int
}

func Load() (*Config, error) {
	_ = godotenv.Load()

	cfg := &Config{
		Server: ServerConfig{
			Port: getEnvInt("JELLYTICS_SERVER_PORT", 8080),
			Host: getEnv("JELLYTICS_SERVER_HOST", "0.0.0.0"),
		},
		Database: DatabaseConfig{
			Path: getEnv("JELLYTICS_DATABASE_PATH", "./data/jellytics.db"),
		},
		JWT: JWTConfig{
			Secret:        getEnv("JWT_SECRET", ""),
			AccessExpiry:  time.Duration(getEnvInt("JELLYTICS_JWT_ACCESS_EXPIRY_MINUTES", 15)) * time.Minute,
			RefreshExpiry: time.Duration(getEnvInt("JELLYTICS_JWT_REFRESH_EXPIRY_HOURS", 168)) * time.Hour,
		},
		Log: LogConfig{
			Level:  getEnv("JELLYTICS_LOG_LEVEL", "info"),
			Format: getEnv("JELLYTICS_LOG_FORMAT", "console"),
		},
		CORS: CORSConfig{
			AllowedOrigins: getEnvSlice("JELLYTICS_CORS_ALLOWED_ORIGINS", []string{
				"http://localhost:3000", "http://localhost:3001", "http://localhost:3002",
				"http://127.0.0.1:3000", "http://127.0.0.1:3001", "http://127.0.0.1:3002",
				"http://localhost", "http://127.0.0.1",
			}),
			AllowedMethods: getEnvSlice("JELLYTICS_CORS_ALLOWED_METHODS", []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}),
			AllowedHeaders: getEnvSlice("JELLYTICS_CORS_ALLOWED_HEADERS", []string{"Content-Type", "Authorization"}),
		},
		Sync: SyncConfig{
			Interval:          time.Duration(getEnvInt("JELLYTICS_SYNC_INTERVAL_SECONDS", 300)) * time.Second,
			SessionsInterval:  time.Duration(getEnvInt("JELLYTICS_SESSIONS_SYNC_INTERVAL_SECONDS", 90)) * time.Second,
			WorkerPoolSize:    getEnvInt("JELLYTICS_SYNC_WORKER_POOL_SIZE", 5),
			RetryAttempts:     getEnvInt("JELLYTICS_SYNC_RETRY_ATTEMPTS", 3),
			RetryBackoff:      time.Duration(getEnvInt("JELLYTICS_SYNC_RETRY_BACKOFF_MS", 1000)) * time.Millisecond,
			MaxRetryBackoff:   time.Duration(getEnvInt("JELLYTICS_SYNC_MAX_RETRY_BACKOFF_MS", 30000)) * time.Millisecond,
			RequestTimeout:    time.Duration(getEnvInt("JELLYTICS_SYNC_REQUEST_TIMEOUT_SECONDS", 30)) * time.Second,
			BatchSize:         getEnvInt("JELLYTICS_SYNC_BATCH_SIZE", 50),
			EnableIncremental: getEnvBool("JELLYTICS_SYNC_ENABLE_INCREMENTAL", true),
		},
		RateLimit: RateLimitConfig{
			RequestsPerMinute: getEnvInt("JELLYTICS_RATE_LIMIT_REQUESTS_PER_MINUTE", 300),
			BurstSize:         getEnvInt("JELLYTICS_RATE_LIMIT_BURST_SIZE", 60),
		},
	}

	if err := cfg.Validate(); err != nil {
		return nil, fmt.Errorf("invalid configuration: %w", err)
	}

	return cfg, nil
}

func (c *Config) Validate() error {
	if c.Server.Port <= 0 || c.Server.Port > 65535 {
		return fmt.Errorf("invalid server port: %d", c.Server.Port)
	}

	if c.Database.Path == "" {
		return fmt.Errorf("database path is required")
	}

	if c.JWT.Secret == "" {
		secret, err := generateSecureSecret(32)
		if err != nil {
			return fmt.Errorf("failed to generate JWT secret: %w", err)
		}
		c.JWT.Secret = secret
		log.Warn().Msg("JWT_SECRET not set - auto-generated a secure secret. Set JWT_SECRET in your environment variables.")
	}

	if c.Sync.Interval < time.Second {
		return fmt.Errorf("sync interval must be at least 1 second")
	}
	if c.Sync.SessionsInterval < time.Second {
		return fmt.Errorf("sessions sync interval must be at least 1 second")
	}

	if c.Sync.WorkerPoolSize <= 0 {
		return fmt.Errorf("worker pool size must be greater than 0")
	}
	if c.Sync.WorkerPoolSize > 50 {
		return fmt.Errorf("worker pool size must not exceed 50")
	}
	if c.Sync.BatchSize <= 0 || c.Sync.BatchSize > 1000 {
		return fmt.Errorf("sync batch size must be between 1 and 1000")
	}

	if c.RateLimit.RequestsPerMinute <= 0 {
		return fmt.Errorf("rate limit requests per minute must be greater than 0")
	}
	if c.RateLimit.BurstSize <= 0 {
		return fmt.Errorf("rate limit burst size must be greater than 0")
	}

	return nil
}

func generateSecureSecret(length int) (string, error) {
	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(bytes), nil
}

func getEnv(key, defaultValue string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if val := os.Getenv(key); val != "" {
		if intVal, err := strconv.Atoi(val); err == nil {
			return intVal
		}
	}
	return defaultValue
}

func getEnvSlice(key string, defaultValue []string) []string {
	if val := os.Getenv(key); val != "" {
		parts := strings.Split(val, ",")
		for i, p := range parts {
			parts[i] = strings.TrimSpace(p)
		}
		return parts
	}
	return defaultValue
}

func getEnvBool(key string, defaultValue bool) bool {
	if val := os.Getenv(key); val != "" {
		lower := strings.ToLower(val)
		return lower == "true" || lower == "1" || lower == "yes"
	}
	return defaultValue
}
