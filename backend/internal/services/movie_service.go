// Package services implements business logic for syncing Jellyfin data, stats, sessions, and system settings.
package services

import (
	"context"

	"jellytics/backend/internal/errors"
	"jellytics/backend/internal/models"
	"jellytics/backend/internal/repository"
)

// MovieService provides movie operations.
type MovieService struct {
	movieStore repository.MovieStore
}

// NewMovieService returns a new MovieService.
func NewMovieService(movieStore repository.MovieStore) *MovieService {
	return &MovieService{movieStore: movieStore}
}

// List returns movies for a user with optional filters.
func (s *MovieService) List(ctx context.Context, userID int, filter repository.MovieListFilter) ([]*models.Movie, int, error) {
	if userID <= 0 {
		return nil, 0, errors.New(errors.CodeUnauthorized, "Unauthorized")
	}
	return s.movieStore.List(ctx, userID, filter)
}

// Get returns a movie by ID for a user.
func (s *MovieService) Get(ctx context.Context, id, userID int) (*models.Movie, error) {
	if userID <= 0 {
		return nil, errors.New(errors.CodeUnauthorized, "Unauthorized")
	}
	movie, err := s.movieStore.GetByID(ctx, id, userID)
	if err != nil {
		return nil, err
	}
	if movie == nil {
		return nil, errors.New(errors.CodeNotFound, "Movie not found")
	}
	return movie, nil
}

// Delete soft-deletes a movie and removes it from the watchlist.
func (s *MovieService) Delete(ctx context.Context, id, userID int) error {
	if userID <= 0 {
		return errors.New(errors.CodeUnauthorized, "Unauthorized")
	}
	exists, err := s.movieStore.Exists(ctx, id, userID)
	if err != nil {
		return err
	}
	if !exists {
		return errors.New(errors.CodeNotFound, "Movie not found")
	}
	_ = s.movieStore.RemoveFromWatchlist(ctx, userID, id)
	return s.movieStore.SoftDelete(ctx, id, userID)
}

// Restore restores a soft-deleted movie to the library.
func (s *MovieService) Restore(ctx context.Context, id, userID int) error {
	if userID <= 0 {
		return errors.New(errors.CodeUnauthorized, "Unauthorized")
	}
	return s.movieStore.Restore(ctx, id, userID)
}
