package middleware

import (
	"context"
	"database/sql"
	"net/http"
	"strings"

	"jellytics/backend/internal/config"
	"jellytics/backend/internal/errors"
	"jellytics/backend/pkg/jwt"
)

type contextKey string

const UserIDKey contextKey = "user_id"

func AuthMiddleware(cfg *config.Config, db *sql.DB) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				HandleError(w, r, errors.New(errors.CodeUnauthorized, "Missing authorization header"))
				return
			}

			parts := strings.Split(authHeader, " ")
			if len(parts) != 2 || parts[0] != "Bearer" {
				HandleError(w, r, errors.New(errors.CodeUnauthorized, "Invalid authorization header format"))
				return
			}

			token := parts[1]
			claims, err := jwt.ValidateToken(token, cfg.JWT.Secret)
			if err != nil {
				if err == jwt.ErrExpiredToken {
					HandleError(w, r, errors.New(errors.CodeTokenExpired, "Token expired"))
				} else {
					HandleError(w, r, errors.Wrap(err, errors.CodeTokenInvalid, "Invalid token"))
				}
				return
			}

			ctx := context.WithValue(r.Context(), UserIDKey, claims.UserID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func GetUserID(r *http.Request) int {
	userID, ok := r.Context().Value(UserIDKey).(int)
	if !ok {
		return 0
	}
	return userID
}
