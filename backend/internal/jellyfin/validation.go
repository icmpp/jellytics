package jellyfin

import (
	"strings"

	"github.com/rs/zerolog/log"
)

var validItemTypes = map[string]bool{
	"Series": true, "Movie": true, "Episode": true, "Season": true, "Audio": true, "Video": true,
}

type ValidationResult struct {
	IsValid  bool
	Warnings []string
	Errors   []string
}

func ValidateItem(item Item) ValidationResult {
	result := ValidationResult{
		IsValid:  true,
		Warnings: []string{},
		Errors:   []string{},
	}

	if item.Id == "" {
		result.Errors = append(result.Errors, "missing item ID")
		result.IsValid = false
	}

	if item.Name == "" {
		result.Warnings = append(result.Warnings, "missing item name")
	}

	if item.Type == "" {
		result.Warnings = append(result.Warnings, "missing item type")
	}

	if item.Type != "" && !validItemTypes[item.Type] {
		result.Warnings = append(result.Warnings, "unexpected item type: "+item.Type)
	}

	if item.Type == "Episode" {
		if item.SeriesId == "" {
			result.Warnings = append(result.Warnings, "episode missing series ID")
		}
		if item.IndexNumber <= 0 {
			result.Warnings = append(result.Warnings, "episode missing or invalid episode number")
		}
		if item.ParentIndexNumber <= 0 {
			result.Warnings = append(result.Warnings, "episode missing or invalid season number")
		}
	}

	if (item.Type == "Movie" || item.Type == "Episode") && item.RunTimeTicks <= 0 {
		result.Warnings = append(result.Warnings, "missing runtime")
	}

	if len(result.Warnings) > 0 || len(result.Errors) > 0 {
		log.Debug().
			Str("item_id", item.Id).
			Str("item_name", item.Name).
			Str("item_type", item.Type).
			Strs("warnings", result.Warnings).
			Strs("errors", result.Errors).
			Bool("is_valid", result.IsValid).
			Msg("Item validation completed with issues")
	}

	return result
}

func ValidateItems(items []Item) (valid []Item, invalid []Item, stats ValidationStats) {
	stats = ValidationStats{}

	for _, item := range items {
		result := ValidateItem(item)
		stats.Total++
		stats.TotalWarnings += len(result.Warnings)
		stats.TotalErrors += len(result.Errors)

		if result.IsValid {
			valid = append(valid, item)
			stats.Valid++
		} else {
			invalid = append(invalid, item)
			stats.Invalid++
		}
	}

	return valid, invalid, stats
}

type ValidationStats struct {
	Total         int
	Valid         int
	Invalid       int
	TotalWarnings int
	TotalErrors   int
}

func SanitizeItem(item *Item) {
	item.Id = strings.TrimSpace(item.Id)
	item.Name = strings.TrimSpace(item.Name)
	item.Overview = strings.TrimSpace(item.Overview)
	item.SeriesId = strings.TrimSpace(item.SeriesId)
	item.SeasonId = strings.TrimSpace(item.SeasonId)
	item.Type = strings.TrimSpace(item.Type)

	if item.IndexNumber < 0 {
		item.IndexNumber = 0
	}
	if item.ParentIndexNumber < 0 {
		item.ParentIndexNumber = 0
	}
	if item.RunTimeTicks < 0 {
		item.RunTimeTicks = 0
	}
	if item.ProductionYear < 0 {
		item.ProductionYear = 0
	}

	sanitizedGenres := make([]string, 0, len(item.Genres))
	for _, genre := range item.Genres {
		genre = strings.TrimSpace(genre)
		if genre != "" {
			sanitizedGenres = append(sanitizedGenres, genre)
		}
	}
	item.Genres = sanitizedGenres

	item.ProviderIds.Imdb = strings.TrimSpace(item.ProviderIds.Imdb)
	item.ProviderIds.Tmdb = strings.TrimSpace(item.ProviderIds.Tmdb)
}

func SanitizeItems(items []Item) {
	for i := range items {
		SanitizeItem(&items[i])
	}
}
