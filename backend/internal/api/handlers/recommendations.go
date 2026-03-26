package handlers

import (
	"database/sql"
	"net/http"
	"strconv"

	"jellytics/backend/internal/api/middleware"
	"jellytics/backend/internal/errors"

	"github.com/go-chi/chi/v5"
)

type RecommendationsHandler struct {
	db *sql.DB
}

func NewRecommendationsHandler(db *sql.DB) *RecommendationsHandler {
	return &RecommendationsHandler{db: db}
}

type RecommendationItem struct {
	ID                   int     `json:"id"`
	Type                 string  `json:"type"` // "movie" | "show"
	Title                string  `json:"title"`
	PosterURL            *string `json:"posterUrl,omitempty"`
	JellyfinID           string  `json:"jellyfinId"`
	CompletionPercentage float64 `json:"completionPercentage,omitempty"`
	Reason               string  `json:"reason"` // "similar", "watchlist", "discover"
}

func (h *RecommendationsHandler) GetRecommendations(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == 0 {
		handleError(w, r, errors.New(errors.CodeUnauthorized, "Unauthorized"))
		return
	}

	limitStr := r.URL.Query().Get("limit")
	limit := 12
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 50 {
			limit = l
		}
	}

	var items []RecommendationItem
	seen := make(map[string]bool)

	// 1. Similar to liked: unwatched items with genre overlap with highly-rated (>=8) items
	// Genre stored as JSON array e.g. ["Action","Drama"] - use LIKE for substring match
	simMovieRows, _ := h.db.QueryContext(r.Context(), `
		SELECT DISTINCT m.id, m.title, m.jellyfin_id
		FROM movies m
		INNER JOIN ratings r ON r.item_type = 'movie' AND r.rating >= 8 AND r.user_id = ?
		INNER JOIN movies rated ON rated.id = r.item_id AND rated.user_id = ? AND rated.deleted_at IS NULL
		WHERE m.user_id = ? AND m.deleted_at IS NULL
		  AND m.id != rated.id
		  AND (m.status = 'pending' OR m.first_watched_at IS NULL)
		  AND rated.genre IS NOT NULL AND rated.genre != '' AND rated.genre != '[]'
		  AND m.genre IS NOT NULL AND m.genre != ''
		  AND (
		    m.genre LIKE '%' || json_extract(rated.genre, '$[0]') || '%'
		    OR m.genre LIKE '%' || json_extract(rated.genre, '$[1]') || '%'
		    OR m.genre LIKE '%' || json_extract(rated.genre, '$[2]') || '%'
		  )
		ORDER BY RANDOM()
		LIMIT ?`, userID, userID, userID, limit)
	if simMovieRows != nil {
		defer simMovieRows.Close()
		for simMovieRows.Next() {
			var item RecommendationItem
			if simMovieRows.Scan(&item.ID, &item.Title, &item.JellyfinID) == nil {
				key := "movie-" + strconv.Itoa(item.ID)
				if seen[key] {
					continue
				}
				seen[key] = true
				item.Type = "movie"
				item.Reason = "similar"
				url := "/api/v1/images/movies/" + item.JellyfinID + "/poster"
				item.PosterURL = &url
				items = append(items, item)
			}
		}
	}

	// 2. Same for shows
	if len(items) < limit {
		simShowRows, _ := h.db.QueryContext(r.Context(), `
			SELECT DISTINCT s.id, s.title, s.jellyfin_id
			FROM shows s
			INNER JOIN ratings r ON r.item_type = 'show' AND r.rating >= 8 AND r.user_id = ?
			INNER JOIN shows rated ON rated.id = r.item_id AND rated.user_id = ? AND rated.deleted_at IS NULL
			WHERE s.user_id = ? AND s.deleted_at IS NULL
			  AND s.id != rated.id
			  AND (s.status = 'pending' OR s.first_watched_at IS NULL)
			  AND rated.genre IS NOT NULL AND rated.genre != '' AND rated.genre != '[]'
			  AND s.genre IS NOT NULL AND s.genre != ''
			  AND (
			    s.genre LIKE '%' || json_extract(rated.genre, '$[0]') || '%'
			    OR s.genre LIKE '%' || json_extract(rated.genre, '$[1]') || '%'
			    OR s.genre LIKE '%' || json_extract(rated.genre, '$[2]') || '%'
			  )
			ORDER BY RANDOM()
			LIMIT ?`, userID, userID, userID, limit-len(items))
		if simShowRows != nil {
			defer simShowRows.Close()
			for simShowRows.Next() {
				var item RecommendationItem
				if simShowRows.Scan(&item.ID, &item.Title, &item.JellyfinID) == nil {
					key := "show-" + strconv.Itoa(item.ID)
					if seen[key] {
						continue
					}
					seen[key] = true
					item.Type = "show"
					item.Reason = "similar"
					url := "/api/v1/images/shows/" + item.JellyfinID + "/poster"
					item.PosterURL = &url
					items = append(items, item)
				}
			}
		}
	}

	// 3. From watchlist (not yet started)
	if len(items) < limit {
		wlRows, _ := h.db.QueryContext(r.Context(), `
			SELECT w.item_type, w.item_id, w.title, w.jellyfin_id
			FROM watchlist w
			LEFT JOIN movies m ON w.item_type = 'movie' AND w.item_id = m.id AND m.user_id = ?
			LEFT JOIN shows s ON w.item_type = 'show' AND w.item_id = s.id AND s.user_id = ?
			WHERE w.user_id = ? AND (m.id IS NULL OR (m.status = 'pending' AND m.first_watched_at IS NULL))
			  AND (s.id IS NULL OR (s.status = 'pending' AND s.first_watched_at IS NULL))
			ORDER BY RANDOM()
			LIMIT ?`, userID, userID, userID, limit-len(items))
		if wlRows != nil {
			defer wlRows.Close()
			for wlRows.Next() {
				var wlItem RecommendationItem
				var itemType, jellyfinID string
				if wlRows.Scan(&itemType, &wlItem.ID, &wlItem.Title, &jellyfinID) == nil {
					key := itemType + "-" + strconv.Itoa(wlItem.ID)
					if seen[key] {
						continue
					}
					seen[key] = true
					wlItem.Type = itemType
					wlItem.JellyfinID = jellyfinID
					wlItem.Reason = "watchlist"
					if jellyfinID != "" {
						url := "/api/v1/images/" + itemType + "s/" + jellyfinID + "/poster"
						wlItem.PosterURL = &url
					}
					items = append(items, wlItem)
				}
			}
		}
	}

	// 4. Discover: random unwatched from library (no watchlist)
	if len(items) < limit {
		need := limit - len(items)
		discoverRows, _ := h.db.QueryContext(r.Context(), `
			(SELECT 'movie', m.id, m.title, m.jellyfin_id
			 FROM movies m
			 LEFT JOIN watchlist w ON w.item_type = 'movie' AND w.item_id = m.id AND w.user_id = ?
			 WHERE m.user_id = ? AND m.deleted_at IS NULL
			   AND (m.status = 'pending' OR m.first_watched_at IS NULL)
			   AND w.id IS NULL
			 ORDER BY RANDOM() LIMIT ?)
			UNION ALL
			(SELECT 'show', s.id, s.title, s.jellyfin_id
			 FROM shows s
			 LEFT JOIN watchlist w ON w.item_type = 'show' AND w.item_id = s.id AND w.user_id = ?
			 WHERE s.user_id = ? AND s.deleted_at IS NULL
			   AND (s.status = 'pending' OR s.first_watched_at IS NULL)
			   AND w.id IS NULL
			 ORDER BY RANDOM() LIMIT ?)`, userID, userID, need, userID, userID, need)
		if discoverRows != nil {
			defer discoverRows.Close()
			for discoverRows.Next() {
				var item RecommendationItem
				var itemType, jellyfinID string
				if discoverRows.Scan(&itemType, &item.ID, &item.Title, &jellyfinID) == nil {
					key := itemType + "-" + strconv.Itoa(item.ID)
					if seen[key] {
						continue
					}
					seen[key] = true
					item.Type = itemType
					item.JellyfinID = jellyfinID
					item.Reason = "discover"
					if jellyfinID != "" {
						url := "/api/v1/images/" + itemType + "s/" + jellyfinID + "/poster"
						item.PosterURL = &url
					}
					items = append(items, item)
					if len(items) >= limit {
						break
					}
				}
			}
		}
	}

	if items == nil {
		items = []RecommendationItem{}
	}

	writeJSON(w, r, map[string]interface{}{
		"items": items,
	})
}

func (h *RecommendationsHandler) RegisterRoutes(r chi.Router) {
	r.Get("/", h.GetRecommendations)
}
