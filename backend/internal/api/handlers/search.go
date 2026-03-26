package handlers

import (
	"database/sql"
	"net/http"
	"sync"

	"jellytics/backend/internal/api/middleware"
	"jellytics/backend/internal/errors"

	"github.com/go-chi/chi/v5"
)

type SearchHandler struct {
	db *sql.DB
}

func NewSearchHandler(db *sql.DB) *SearchHandler {
	return &SearchHandler{db: db}
}

type SearchResult struct {
	Shows    []SearchShow    `json:"shows"`
	Movies   []SearchMovie   `json:"movies"`
	Episodes []SearchEpisode `json:"episodes"`
}

type SearchShow struct {
	ID         int    `json:"id"`
	JellyfinID string `json:"jellyfin_id"`
	Title      string `json:"title"`
	Year       *int   `json:"year"`
	Status     string `json:"status"`
}

type SearchMovie struct {
	ID         int    `json:"id"`
	JellyfinID string `json:"jellyfin_id"`
	Title      string `json:"title"`
	Year       *int   `json:"year"`
	Status     string `json:"status"`
}

type SearchEpisode struct {
	ID             int    `json:"id"`
	ShowID         int    `json:"show_id"`
	ShowJellyfinID string `json:"show_jellyfin_id"`
	ShowTitle      string `json:"show_title"`
	Title          string `json:"title"`
	SeasonNumber   int    `json:"season_number"`
	EpisodeNumber  int    `json:"episode_number"`
	Watched        bool   `json:"watched"`
}

func (h *SearchHandler) Search(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	q := r.URL.Query().Get("q")
	if len(q) < 2 {
		writeJSON(w, r, SearchResult{
			Shows:    []SearchShow{},
			Movies:   []SearchMovie{},
			Episodes: []SearchEpisode{},
		})
		return
	}
	if len(q) > 200 {
		q = q[:200]
	}

	pattern := "%" + q + "%"
	result := SearchResult{
		Shows:    []SearchShow{},
		Movies:   []SearchMovie{},
		Episodes: []SearchEpisode{},
	}

	ctx := r.Context()
	var wg sync.WaitGroup
	var mu sync.Mutex

	wg.Add(1)
	go func() {
		defer wg.Done()
		rows, err := h.db.QueryContext(ctx,
			`SELECT id, jellyfin_id, title, year, status
			 FROM shows
			 WHERE user_id = ? AND deleted_at IS NULL AND title LIKE ?
			 ORDER BY COALESCE(last_watched_at, created_at) DESC
			 LIMIT 5`,
			userID, pattern)
		if err != nil {
			return
		}
		defer rows.Close()
		var shows []SearchShow
		for rows.Next() {
			var s SearchShow
			var year sql.NullInt64
			if err := rows.Scan(&s.ID, &s.JellyfinID, &s.Title, &year, &s.Status); err != nil {
				continue
			}
			if year.Valid {
				y := int(year.Int64)
				s.Year = &y
			}
			shows = append(shows, s)
		}
		mu.Lock()
		result.Shows = shows
		mu.Unlock()
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		rows, err := h.db.QueryContext(ctx,
			`SELECT id, jellyfin_id, title, year, status
			 FROM movies
			 WHERE user_id = ? AND deleted_at IS NULL AND title LIKE ?
			 ORDER BY COALESCE(last_watched_at, created_at) DESC
			 LIMIT 5`,
			userID, pattern)
		if err != nil {
			return
		}
		defer rows.Close()
		var movies []SearchMovie
		for rows.Next() {
			var m SearchMovie
			var year sql.NullInt64
			if err := rows.Scan(&m.ID, &m.JellyfinID, &m.Title, &year, &m.Status); err != nil {
				continue
			}
			if year.Valid {
				y := int(year.Int64)
				m.Year = &y
			}
			movies = append(movies, m)
		}
		mu.Lock()
		result.Movies = movies
		mu.Unlock()
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		rows, err := h.db.QueryContext(ctx,
			`SELECT e.id, e.show_id, s.jellyfin_id, s.title, e.title, e.season_number, e.episode_number, e.watched
			 FROM episodes e
			 JOIN shows s ON e.show_id = s.id
			 WHERE s.user_id = ? AND s.deleted_at IS NULL AND e.title LIKE ?
			 ORDER BY e.watched_at DESC
			 LIMIT 5`,
			userID, pattern)
		if err != nil {
			return
		}
		defer rows.Close()
		var episodes []SearchEpisode
		for rows.Next() {
			var ep SearchEpisode
			var epTitle sql.NullString
			if err := rows.Scan(&ep.ID, &ep.ShowID, &ep.ShowJellyfinID, &ep.ShowTitle, &epTitle, &ep.SeasonNumber, &ep.EpisodeNumber, &ep.Watched); err != nil {
				continue
			}
			if epTitle.Valid {
				ep.Title = epTitle.String
			}
			episodes = append(episodes, ep)
		}
		mu.Lock()
		result.Episodes = episodes
		mu.Unlock()
	}()

	wg.Wait()

	writeJSON(w, r, result)
}

func (h *SearchHandler) RegisterRoutes(r chi.Router) {
	r.Get("/", h.Search)
}
