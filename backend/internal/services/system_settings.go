package services

import (
	"context"
	"database/sql"
	"encoding/json"
	"strconv"
	"sync"
	"time"

	"jellytics/backend/internal/errors"

	"github.com/rs/zerolog/log"
)

type SystemSettingsService struct {
	db    *sql.DB
	mu    sync.RWMutex
	cache map[string]string
}

type SystemSetting struct {
	Key         string    `json:"key"`
	Value       string    `json:"value"`
	Description string    `json:"description"`
	Category    string    `json:"category"`
	DataType    string    `json:"data_type"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type SystemSettingsMap map[string]interface{}

func NewSystemSettingsService(db *sql.DB) *SystemSettingsService {
	return &SystemSettingsService{db: db, cache: make(map[string]string)}
}

func (s *SystemSettingsService) loadCache(ctx context.Context) error {
	rows, err := s.db.QueryContext(ctx, "SELECT key, value FROM system_settings")
	if err != nil {
		return err
	}
	defer rows.Close()

	s.cache = make(map[string]string)
	for rows.Next() {
		var key, value string
		if err := rows.Scan(&key, &value); err != nil {
			continue
		}
		s.cache[key] = value
	}
	return nil
}

func (s *SystemSettingsService) GetAll(ctx context.Context) (map[string][]SystemSetting, error) {
	query := `
		SELECT key, value, COALESCE(description, ''), COALESCE(category, 'general'), 
		       COALESCE(data_type, 'string'), updated_at
		FROM system_settings
		ORDER BY category, key
	`

	rows, err := s.db.QueryContext(ctx, query)
	if err != nil {
		return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to get system settings")
	}
	defer rows.Close()

	result := make(map[string][]SystemSetting)
	for rows.Next() {
		var setting SystemSetting
		if err := rows.Scan(&setting.Key, &setting.Value, &setting.Description,
			&setting.Category, &setting.DataType, &setting.UpdatedAt); err != nil {
			log.Warn().Err(err).Msg("Failed to scan system setting")
			continue
		}
		result[setting.Category] = append(result[setting.Category], setting)
	}

	return result, nil
}

func (s *SystemSettingsService) GetByCategory(ctx context.Context, category string) ([]SystemSetting, error) {
	query := `
		SELECT key, value, COALESCE(description, ''), COALESCE(category, 'general'), 
		       COALESCE(data_type, 'string'), updated_at
		FROM system_settings
		WHERE category = ?
		ORDER BY key
	`

	rows, err := s.db.QueryContext(ctx, query, category)
	if err != nil {
		return nil, errors.Wrap(err, errors.CodeDatabaseError, "Failed to get system settings")
	}
	defer rows.Close()

	var settings []SystemSetting
	for rows.Next() {
		var setting SystemSetting
		if err := rows.Scan(&setting.Key, &setting.Value, &setting.Description,
			&setting.Category, &setting.DataType, &setting.UpdatedAt); err != nil {
			log.Warn().Err(err).Msg("Failed to scan system setting")
			continue
		}
		settings = append(settings, setting)
	}

	return settings, nil
}

func (s *SystemSettingsService) Get(ctx context.Context, key string) (string, error) {
	s.mu.RLock()
	value, ok := s.cache[key]
	s.mu.RUnlock()

	if ok {
		return value, nil
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.cache[key]; ok {
		return s.cache[key], nil
	}
	if err := s.loadCache(ctx); err != nil {
		return "", errors.Wrap(err, errors.CodeDatabaseError, "Failed to get setting")
	}
	value, ok = s.cache[key]
	if !ok {
		return "", errors.New(errors.CodeNotFound, "Setting not found: "+key)
	}
	return value, nil
}

func (s *SystemSettingsService) GetInt(ctx context.Context, key string, defaultValue int) int {
	value, err := s.Get(ctx, key)
	if err != nil {
		return defaultValue
	}
	intVal, err := strconv.Atoi(value)
	if err != nil {
		return defaultValue
	}
	return intVal
}

func (s *SystemSettingsService) GetBool(ctx context.Context, key string, defaultValue bool) bool {
	value, err := s.Get(ctx, key)
	if err != nil {
		return defaultValue
	}
	return value == "true" || value == "1" || value == "yes"
}

func (s *SystemSettingsService) Set(ctx context.Context, key string, value string) error {
	result, err := s.db.ExecContext(ctx,
		`UPDATE system_settings SET value = ?, updated_at = ? WHERE key = ?`,
		value, time.Now(), key)
	if err != nil {
		return errors.Wrap(err, errors.CodeDatabaseError, "Failed to update setting")
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return errors.New(errors.CodeNotFound, "Setting not found: "+key)
	}

	s.mu.Lock()
	s.cache[key] = value
	s.mu.Unlock()

	log.Debug().Str("key", key).Msg("Setting updated")
	return nil
}

func (s *SystemSettingsService) SetMultiple(ctx context.Context, settings map[string]string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return errors.Wrap(err, errors.CodeDatabaseError, "Failed to start transaction")
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx,
		`UPDATE system_settings SET value = ?, updated_at = ? WHERE key = ?`)
	if err != nil {
		return errors.Wrap(err, errors.CodeDatabaseError, "Failed to prepare statement")
	}
	defer stmt.Close()

	for key, value := range settings {
		result, err := stmt.ExecContext(ctx, value, time.Now(), key)
		if err != nil {
			return errors.Wrap(err, errors.CodeDatabaseError, "Failed to update setting: "+key)
		}
		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			log.Warn().Str("key", key).Msg("Setting not found, skipping")
		}
	}

	if err := tx.Commit(); err != nil {
		return errors.Wrap(err, errors.CodeDatabaseError, "Failed to commit transaction")
	}

	s.mu.Lock()
	for k, v := range settings {
		s.cache[k] = v
	}
	s.mu.Unlock()

	log.Debug().Int("count", len(settings)).Msg("Settings updated")
	return nil
}

func (s *SystemSettingsService) GetTypedValue(setting SystemSetting) interface{} {
	switch setting.DataType {
	case "int":
		val, _ := strconv.Atoi(setting.Value)
		return val
	case "bool":
		return setting.Value == "true" || setting.Value == "1" || setting.Value == "yes"
	case "json":
		var result interface{}
		if err := json.Unmarshal([]byte(setting.Value), &result); err != nil {
			return setting.Value
		}
		return result
	default:
		return setting.Value
	}
}
