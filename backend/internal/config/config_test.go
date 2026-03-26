package config

import (
	"testing"
	"time"
)

func TestConfig_Validate(t *testing.T) {
	tests := []struct {
		name    string
		modify  func(*Config)
		wantErr bool
	}{
		{
			name:    "valid minimal",
			modify:  func(c *Config) {},
			wantErr: false,
		},
		{
			name: "invalid port zero",
			modify: func(c *Config) {
				c.Server.Port = 0
			},
			wantErr: true,
		},
		{
			name: "invalid port too high",
			modify: func(c *Config) {
				c.Server.Port = 70000
			},
			wantErr: true,
		},
		{
			name: "empty database path",
			modify: func(c *Config) {
				c.Database.Path = ""
			},
			wantErr: true,
		},
		{
			name: "sync interval too short",
			modify: func(c *Config) {
				c.Sync.Interval = time.Millisecond
			},
			wantErr: true,
		},
		{
			name: "worker pool size zero",
			modify: func(c *Config) {
				c.Sync.WorkerPoolSize = 0
			},
			wantErr: true,
		},
		{
			name: "worker pool size over 50",
			modify: func(c *Config) {
				c.Sync.WorkerPoolSize = 51
			},
			wantErr: true,
		},
		{
			name: "batch size zero",
			modify: func(c *Config) {
				c.Sync.BatchSize = 0
			},
			wantErr: true,
		},
		{
			name: "batch size over 1000",
			modify: func(c *Config) {
				c.Sync.BatchSize = 1001
			},
			wantErr: true,
		},
		{
			name: "rate limit zero",
			modify: func(c *Config) {
				c.RateLimit.RequestsPerMinute = 0
			},
			wantErr: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := &Config{
				Server:   ServerConfig{Port: 8080, Host: "localhost"},
				Database: DatabaseConfig{Path: "/tmp/test.db"},
				JWT:      JWTConfig{Secret: "test-secret"},
				Sync: SyncConfig{
					Interval:         time.Minute,
					SessionsInterval: 90 * time.Second,
					WorkerPoolSize:   5,
					BatchSize:        50,
				},
				RateLimit: RateLimitConfig{
					RequestsPerMinute: 300,
					BurstSize:         60,
				},
			}
			tt.modify(cfg)
			err := cfg.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
