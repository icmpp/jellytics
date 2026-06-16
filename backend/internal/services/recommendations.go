package services

import (
	"context"
	"encoding/json"
	"sort"

	"jellytics/backend/internal/errors"
	"jellytics/backend/internal/models"
	"jellytics/backend/internal/repository"
)

// RecommendationService scores recommendation candidates using a per-user genre
// affinity profile built from ratings and watch history. All scoring happens in
// Go; the store only supplies raw rows.
type RecommendationService struct {
	store repository.RecommendationStore
}

// NewRecommendationService returns a new RecommendationService.
func NewRecommendationService(store repository.RecommendationStore) *RecommendationService {
	return &RecommendationService{store: store}
}

// Affinity weights. Ratings are the strongest signal (centered so dislikes push
// a genre down); merely having watched something is a mild positive nudge.
const (
	ratingNeutral  = 5.5 // ratings above this add affinity, below subtract
	watchedWeight  = 0.5 // per watched item per genre
)

// Recommend returns up to limit scored recommendations for the user.
func (s *RecommendationService) Recommend(ctx context.Context, userID, limit int) ([]models.RecommendationItem, error) {
	if userID <= 0 {
		return nil, errors.New(errors.CodeUnauthorized, "Unauthorized")
	}
	if limit <= 0 {
		limit = 12
	}

	affinity, err := s.buildAffinity(ctx, userID)
	if err != nil {
		return nil, err
	}

	candidates, err := s.store.Candidates(ctx, userID)
	if err != nil {
		return nil, err
	}

	type scored struct {
		cand  repository.RecCandidate
		score float64
	}
	ranked := make([]scored, 0, len(candidates))
	for _, c := range candidates {
		score := 0.0
		for _, g := range parseGenres(c.GenreJSON) {
			score += affinity[g]
		}
		ranked = append(ranked, scored{cand: c, score: score})
	}

	// Highest affinity first. For equal scores, prefer watchlist items (explicit
	// intent), then newer additions, then a stable id tiebreak.
	sort.SliceStable(ranked, func(i, j int) bool {
		if ranked[i].score != ranked[j].score {
			return ranked[i].score > ranked[j].score
		}
		if ranked[i].cand.OnWatchlist != ranked[j].cand.OnWatchlist {
			return ranked[i].cand.OnWatchlist
		}
		if !ranked[i].cand.CreatedAt.Equal(ranked[j].cand.CreatedAt) {
			return ranked[i].cand.CreatedAt.After(ranked[j].cand.CreatedAt)
		}
		return ranked[i].cand.ID < ranked[j].cand.ID
	})

	items := make([]models.RecommendationItem, 0, limit)
	for _, r := range ranked {
		if len(items) >= limit {
			break
		}
		items = append(items, toRecItem(r.cand, reasonFor(r.cand, r.score)))
	}
	return items, nil
}

func (s *RecommendationService) buildAffinity(ctx context.Context, userID int) (map[string]float64, error) {
	affinity := make(map[string]float64)

	rated, err := s.store.RatedGenres(ctx, userID)
	if err != nil {
		return nil, err
	}
	for _, rg := range rated {
		w := float64(rg.Rating) - ratingNeutral
		for _, g := range parseGenres(rg.GenreJSON) {
			affinity[g] += w
		}
	}

	watched, err := s.store.WatchedGenres(ctx, userID)
	if err != nil {
		return nil, err
	}
	for _, genreJSON := range watched {
		for _, g := range parseGenres(genreJSON) {
			affinity[g] += watchedWeight
		}
	}

	return affinity, nil
}

// reasonFor classifies a scored candidate. Watchlist membership (explicit intent)
// takes precedence; otherwise a positive affinity score means "similar", and the
// rest are "discover".
func reasonFor(c repository.RecCandidate, score float64) string {
	switch {
	case c.OnWatchlist:
		return "watchlist"
	case score > 0:
		return "similar"
	default:
		return "discover"
	}
}

func toRecItem(c repository.RecCandidate, reason string) models.RecommendationItem {
	item := models.RecommendationItem{
		ID:         c.ID,
		Type:       c.Type,
		Title:      c.Title,
		JellyfinID: c.JellyfinID,
		Reason:     reason,
	}
	if c.JellyfinID != "" {
		url := "/api/v1/images/" + c.Type + "s/" + c.JellyfinID + "/poster"
		item.PosterURL = &url
	}
	return item
}

// parseGenres decodes the genre column, a JSON array of strings (e.g.
// ["Action","Drama"]). Empty/malformed values yield no genres.
func parseGenres(genreJSON string) []string {
	if genreJSON == "" || genreJSON == "[]" {
		return nil
	}
	var genres []string
	if err := json.Unmarshal([]byte(genreJSON), &genres); err != nil {
		return nil
	}
	return genres
}
