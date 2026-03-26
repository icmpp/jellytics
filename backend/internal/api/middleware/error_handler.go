package middleware

import (
	"bytes"
	"encoding/json"
	"net/http"

	"jellytics/backend/internal/errors"

	"github.com/go-chi/chi/v5/middleware"
	"github.com/rs/zerolog/log"
)

type ErrorResponse struct {
	Error ErrorDetail `json:"error"`
}

type ErrorDetail struct {
	Code      string                 `json:"code"`
	Message   string                 `json:"message"`
	Details   map[string]interface{} `json:"details,omitempty"`
	RequestID string                 `json:"request_id,omitempty"`
}

func HandleError(w http.ResponseWriter, r *http.Request, err error) {
	reqID := middleware.GetReqID(r.Context())

	var appErr *errors.Error
	if !errors.As(err, &appErr) {
		appErr = errors.Wrap(err, errors.CodeInternalError, "Internal server error")
	}

	statusCode := getStatusCode(appErr.Code)

	log.Error().
		Err(err).
		Str("request_id", reqID).
		Str("error_code", appErr.Code).
		Int("status_code", statusCode).
		Msg("Request error")

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)

	response := ErrorResponse{
		Error: ErrorDetail{
			Code:      appErr.Code,
			Message:   appErr.Message,
			Details:   appErr.Details,
			RequestID: reqID,
		},
	}

	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(response); err != nil {
		log.Error().Err(err).Msg("Failed to encode error response")
		// Status already written; write minimal fallback body
		_, _ = w.Write([]byte(`{"error":{"code":"internal","message":"Internal server error"}}`))
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(buf.Bytes())
}

func getStatusCode(code string) int {
	switch code {
	case errors.CodeUnauthorized, errors.CodeInvalidCredentials, errors.CodeTokenExpired, errors.CodeTokenInvalid:
		return http.StatusUnauthorized
	case errors.CodeForbidden, errors.CodeAccountLocked:
		return http.StatusForbidden
	case errors.CodeNotFound, errors.CodeUserNotFound, errors.CodeShowNotFound, errors.CodeEpisodeNotFound:
		return http.StatusNotFound
	case errors.CodeConflict, errors.CodeDuplicate, errors.CodeAlreadyExists:
		return http.StatusConflict
	case errors.CodeValidationError, errors.CodeMissingField, errors.CodeInvalidFormat, errors.CodeOutOfRange:
		return http.StatusBadRequest
	case errors.CodeRateLimitExceeded:
		return http.StatusTooManyRequests
	default:
		return http.StatusInternalServerError
	}
}
