package services

import (
	"context"
	"testing"
	"time"

	"jellytics/backend/internal/repository"
)

// fakeRecStore is an in-memory RecommendationStore for testing the scorer.
type fakeRecStore struct {
	rated      []repository.RatedGenre
	watched    []string
	candidates []repository.RecCandidate
}

func (f fakeRecStore) RatedGenres(_ context.Context, _ int) ([]repository.RatedGenre, error) {
	return f.rated, nil
}
func (f fakeRecStore) WatchedGenres(_ context.Context, _ int) ([]string, error) {
	return f.watched, nil
}
func (f fakeRecStore) Candidates(_ context.Context, _ int) ([]repository.RecCandidate, error) {
	return f.candidates, nil
}

func TestRecommendRanksByAffinity(t *testing.T) {
	store := fakeRecStore{
		// User loves Action (rated 10), dislikes Romance (rated 2).
		rated: []repository.RatedGenre{
			{GenreJSON: `["Action","Thriller"]`, Rating: 10},
			{GenreJSON: `["Romance"]`, Rating: 2},
		},
		candidates: []repository.RecCandidate{
			{ID: 1, Type: "movie", Title: "Action Flick", JellyfinID: "jf1", GenreJSON: `["Action"]`},
			{ID: 2, Type: "movie", Title: "Romance Flick", JellyfinID: "jf2", GenreJSON: `["Romance"]`},
			{ID: 3, Type: "show", Title: "Neutral Doc", JellyfinID: "jf3", GenreJSON: `["Documentary"]`},
		},
	}
	svc := NewRecommendationService(store)

	items, err := svc.Recommend(context.Background(), 1, 10)
	if err != nil {
		t.Fatalf("Recommend: %v", err)
	}
	if len(items) != 3 {
		t.Fatalf("expected 3 items, got %d", len(items))
	}
	// Action (positive affinity) must rank first and be labelled "similar".
	if items[0].ID != 1 || items[0].Reason != "similar" {
		t.Errorf("expected Action first as 'similar', got id=%d reason=%s", items[0].ID, items[0].Reason)
	}
	// Romance has negative affinity (rated 2) -> "discover", ranked last.
	if items[2].ID != 2 {
		t.Errorf("expected Romance (negative affinity) ranked last, got id=%d", items[2].ID)
	}
	if items[2].Reason != "discover" {
		t.Errorf("negative-affinity item should be 'discover', got %s", items[2].Reason)
	}
	// Poster URL is derived from type + jellyfin id.
	if items[0].PosterURL == nil || *items[0].PosterURL != "/api/v1/images/movies/jf1/poster" {
		t.Errorf("unexpected poster url: %v", items[0].PosterURL)
	}
}

func TestRecommendWatchlistReasonAndLimit(t *testing.T) {
	store := fakeRecStore{
		candidates: []repository.RecCandidate{
			{ID: 1, Type: "movie", Title: "On Watchlist", JellyfinID: "w1", GenreJSON: `["Action"]`, OnWatchlist: true},
			{ID: 2, Type: "movie", Title: "Newer", JellyfinID: "d2", GenreJSON: `[]`, CreatedAt: time.Now()},
			{ID: 3, Type: "movie", Title: "Older", JellyfinID: "d3", GenreJSON: `[]`, CreatedAt: time.Now().Add(-time.Hour)},
		},
	}
	svc := NewRecommendationService(store)

	// No ratings/watch history -> all affinity zero. Watchlist item should rank
	// first (explicit intent) and be labelled "watchlist".
	items, err := svc.Recommend(context.Background(), 1, 2)
	if err != nil {
		t.Fatalf("Recommend: %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("limit not respected: got %d items", len(items))
	}
	if items[0].ID != 1 || items[0].Reason != "watchlist" {
		t.Errorf("expected watchlist item first, got id=%d reason=%s", items[0].ID, items[0].Reason)
	}
	// Between the two zero-score discover items, the newer one ranks higher.
	if items[1].ID != 2 || items[1].Reason != "discover" {
		t.Errorf("expected newer discover item second, got id=%d reason=%s", items[1].ID, items[1].Reason)
	}
}
