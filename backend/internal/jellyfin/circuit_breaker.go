package jellyfin

import (
	"sync"
	"time"

	"github.com/rs/zerolog/log"
)

type CircuitState int

const (
	CircuitClosed CircuitState = iota
	CircuitOpen
	CircuitHalfOpen
)

func (s CircuitState) String() string {
	switch s {
	case CircuitClosed:
		return "closed"
	case CircuitOpen:
		return "open"
	case CircuitHalfOpen:
		return "half-open"
	default:
		return "unknown"
	}
}

type CircuitBreaker struct {
	mu sync.RWMutex

	failureThreshold int           // Number of failures before opening circuit
	successThreshold int           // Number of successes needed to close circuit from half-open
	timeout          time.Duration // Time to wait before transitioning from open to half-open
	cooldown         time.Duration // Minimum time between requests in half-open state

	state             CircuitState
	failures          int
	successes         int
	lastFailureTime   time.Time
	lastAttemptTime   time.Time
	lastStateChange   time.Time
	consecutiveErrors int
}

type CircuitBreakerConfig struct {
	FailureThreshold int
	SuccessThreshold int
	Timeout          time.Duration
	Cooldown         time.Duration
}

func DefaultCircuitBreakerConfig() CircuitBreakerConfig {
	return CircuitBreakerConfig{
		FailureThreshold: 5,
		SuccessThreshold: 2,
		Timeout:          30 * time.Second,
		Cooldown:         5 * time.Second,
	}
}

func NewCircuitBreaker(config CircuitBreakerConfig) *CircuitBreaker {
	return &CircuitBreaker{
		failureThreshold: config.FailureThreshold,
		successThreshold: config.SuccessThreshold,
		timeout:          config.Timeout,
		cooldown:         config.Cooldown,
		state:            CircuitClosed,
		lastStateChange:  time.Now(),
	}
}

func (cb *CircuitBreaker) CanExecute() bool {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	now := time.Now()

	switch cb.state {
	case CircuitClosed:
		return true

	case CircuitOpen:
		if now.Sub(cb.lastStateChange) >= cb.timeout {
			cb.transitionTo(CircuitHalfOpen)
			log.Info().
				Str("previous_state", "open").
				Str("new_state", "half-open").
				Msg("Circuit breaker transitioning to half-open")
			return true
		}
		return false

	case CircuitHalfOpen:
		if now.Sub(cb.lastAttemptTime) >= cb.cooldown {
			cb.lastAttemptTime = now
			return true
		}
		return false
	}

	return false
}

func (cb *CircuitBreaker) RecordSuccess() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.consecutiveErrors = 0

	switch cb.state {
	case CircuitHalfOpen:
		cb.successes++
		if cb.successes >= cb.successThreshold {
			cb.transitionTo(CircuitClosed)
			log.Info().
				Str("previous_state", "half-open").
				Str("new_state", "closed").
				Int("successes", cb.successes).
				Msg("Circuit breaker closed after successful requests")
		}
	case CircuitClosed:
		cb.failures = 0
	}
}

func (cb *CircuitBreaker) RecordFailure() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.lastFailureTime = time.Now()
	cb.consecutiveErrors++

	switch cb.state {
	case CircuitClosed:
		cb.failures++
		if cb.failures >= cb.failureThreshold {
			cb.transitionTo(CircuitOpen)
			log.Warn().
				Str("previous_state", "closed").
				Str("new_state", "open").
				Int("failures", cb.failures).
				Dur("timeout", cb.timeout).
				Msg("Circuit breaker opened due to failures")
		}
	case CircuitHalfOpen:
		cb.transitionTo(CircuitOpen)
		log.Warn().
			Str("previous_state", "half-open").
			Str("new_state", "open").
			Msg("Circuit breaker re-opened due to failure in half-open state")
	}
}

func (cb *CircuitBreaker) transitionTo(state CircuitState) {
	cb.state = state
	cb.lastStateChange = time.Now()
	cb.failures = 0
	cb.successes = 0
}

func (cb *CircuitBreaker) State() CircuitState {
	cb.mu.RLock()
	defer cb.mu.RUnlock()
	return cb.state
}

func (cb *CircuitBreaker) Stats() map[string]interface{} {
	cb.mu.RLock()
	defer cb.mu.RUnlock()

	return map[string]interface{}{
		"state":              cb.state.String(),
		"failures":           cb.failures,
		"successes":          cb.successes,
		"consecutive_errors": cb.consecutiveErrors,
		"last_failure_time":  cb.lastFailureTime,
		"last_state_change":  cb.lastStateChange,
	}
}

func (cb *CircuitBreaker) Reset() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.state = CircuitClosed
	cb.failures = 0
	cb.successes = 0
	cb.consecutiveErrors = 0
	cb.lastStateChange = time.Now()

	log.Info().Msg("Circuit breaker manually reset to closed state")
}
