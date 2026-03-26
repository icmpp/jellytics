package services

import (
	"context"
	"errors"

	apperr "jellytics/backend/internal/errors"
	"jellytics/backend/internal/models"
	"jellytics/backend/internal/repository"

	"testing"
)

type mockMovieStore struct {
	listFunc    func(ctx context.Context, userID int, filter repository.MovieListFilter) ([]*models.Movie, int, error)
	getByIDFunc func(ctx context.Context, id, userID int) (*models.Movie, error)
	existsFunc  func(ctx context.Context, id, userID int) (bool, error)
	deleteFunc  func(ctx context.Context, id, userID int) error
}

func (m *mockMovieStore) List(ctx context.Context, userID int, filter repository.MovieListFilter) ([]*models.Movie, int, error) {
	if m.listFunc != nil {
		return m.listFunc(ctx, userID, filter)
	}
	return nil, 0, nil
}

func (m *mockMovieStore) GetByID(ctx context.Context, id, userID int) (*models.Movie, error) {
	if m.getByIDFunc != nil {
		return m.getByIDFunc(ctx, id, userID)
	}
	return nil, nil
}

func (m *mockMovieStore) Exists(ctx context.Context, id, userID int) (bool, error) {
	if m.existsFunc != nil {
		return m.existsFunc(ctx, id, userID)
	}
	return false, nil
}

func (m *mockMovieStore) SoftDelete(ctx context.Context, id, userID int) error {
	if m.deleteFunc != nil {
		return m.deleteFunc(ctx, id, userID)
	}
	return nil
}

func (m *mockMovieStore) Restore(ctx context.Context, id, userID int) error {
	return nil
}

func (m *mockMovieStore) RemoveFromWatchlist(ctx context.Context, userID, itemID int) error {
	return nil
}

func TestMovieService_Get_Unauthorized(t *testing.T) {
	svc := NewMovieService(&mockMovieStore{})
	_, err := svc.Get(context.Background(), 1, 0)
	if err == nil {
		t.Fatal("expected error for userID 0")
	}
	var appErr *apperr.Error
	if !errors.As(err, &appErr) || appErr.Code != apperr.CodeUnauthorized {
		t.Errorf("expected CodeUnauthorized, got %v", err)
	}
}

func TestMovieService_Get_NotFound(t *testing.T) {
	store := &mockMovieStore{
		getByIDFunc: func(ctx context.Context, id, userID int) (*models.Movie, error) {
			return nil, nil // no rows
		},
	}
	svc := NewMovieService(store)
	_, err := svc.Get(context.Background(), 1, 42)
	if err == nil {
		t.Fatal("expected error when movie not found")
	}
	var appErr *apperr.Error
	if !errors.As(err, &appErr) || appErr.Code != apperr.CodeNotFound {
		t.Errorf("expected CodeNotFound, got %v", err)
	}
}

func TestMovieService_Delete_Unauthorized(t *testing.T) {
	svc := NewMovieService(&mockMovieStore{})
	err := svc.Delete(context.Background(), 1, 0)
	if err == nil {
		t.Fatal("expected error for userID 0")
	}
	var appErr *apperr.Error
	if !errors.As(err, &appErr) || appErr.Code != apperr.CodeUnauthorized {
		t.Errorf("expected CodeUnauthorized, got %v", err)
	}
}
