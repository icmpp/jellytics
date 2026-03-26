package middleware

import (
	"bytes"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5/middleware"
	"github.com/rs/zerolog/log"
)

func Recovery(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				reqID := middleware.GetReqID(r.Context())

				log.Error().
					Interface("error", err).
					Str("request_id", reqID).
					Str("method", r.Method).
					Str("path", r.URL.Path).
					Msg("Panic recovered")

				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				body := map[string]interface{}{
					"error": map[string]interface{}{
						"code":       "INTERNAL_ERROR",
						"message":    "An internal error occurred",
						"request_id": reqID,
					},
				}
				var buf bytes.Buffer
				if encErr := json.NewEncoder(&buf).Encode(body); encErr != nil {
					log.Error().Err(encErr).Msg("Failed to encode recovery response")
					_, _ = w.Write([]byte(`{"error":{"code":"INTERNAL_ERROR","message":"An internal error occurred"}}`))
				} else {
					_, _ = w.Write(buf.Bytes())
				}
			}
		}()

		next.ServeHTTP(w, r)
	})
}
