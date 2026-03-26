package errors

const (
	CodeUnauthorized       = "UNAUTHORIZED"
	CodeForbidden          = "FORBIDDEN"
	CodeInvalidCredentials = "INVALID_CREDENTIALS"
	CodeTokenExpired       = "TOKEN_EXPIRED"
	CodeTokenInvalid       = "TOKEN_INVALID"
	CodeAccountLocked      = "ACCOUNT_LOCKED"

	CodeValidationError = "VALIDATION_ERROR"
	CodeMissingField    = "MISSING_FIELD"
	CodeInvalidFormat   = "INVALID_FORMAT"
	CodeOutOfRange      = "OUT_OF_RANGE"

	CodeNotFound        = "NOT_FOUND"
	CodeUserNotFound    = "USER_NOT_FOUND"
	CodeShowNotFound    = "SHOW_NOT_FOUND"
	CodeEpisodeNotFound = "EPISODE_NOT_FOUND"

	CodeConflict      = "CONFLICT"
	CodeDuplicate     = "DUPLICATE"
	CodeAlreadyExists = "ALREADY_EXISTS"

	CodeRateLimitExceeded = "RATE_LIMIT_EXCEEDED"

	CodeInternalError    = "INTERNAL_ERROR"
	CodeDatabaseError    = "DATABASE_ERROR"
	CodeExternalAPIError = "EXTERNAL_API_ERROR"

	CodeSyncFailed     = "SYNC_FAILED"
	CodeSyncInProgress = "SYNC_IN_PROGRESS"
)
