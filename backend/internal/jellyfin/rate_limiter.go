package jellyfin

import (
	"context"
	"os"
	"strconv"
	"time"

	"golang.org/x/time/rate"
)

func initImageRequestLimiter() *rate.Limiter {
	rpm := 12
	if v := os.Getenv("JELLYTICS_JELLYFIN_IMAGE_RATE_LIMIT"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			rpm = n
		}
	}
	burst := 3
	if v := os.Getenv("JELLYTICS_JELLYFIN_IMAGE_RATE_BURST"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			burst = n
		}
	}
	if burst < 1 {
		burst = 1
	}
	return rate.NewLimiter(rate.Limit(float64(rpm)/60.0), burst)
}

var ImageRequestLimiter = initImageRequestLimiter()

func WaitForImageRequest(ctx context.Context) error {
	return ImageRequestLimiter.Wait(ctx)
}

type RateLimiter struct {
	limiter *rate.Limiter
}

func NewRateLimiter(requestsPerMinute, burstSize int) *RateLimiter {
	return &RateLimiter{
		limiter: rate.NewLimiter(rate.Limit(float64(requestsPerMinute)/60.0), burstSize),
	}
}

func (rl *RateLimiter) Wait(ctx context.Context) error {
	return rl.limiter.Wait(ctx)
}

func (rl *RateLimiter) Allow() bool {
	return rl.limiter.Allow()
}

func (rl *RateLimiter) Reserve() *rate.Reservation {
	return rl.limiter.Reserve()
}

func (rl *RateLimiter) ReserveN(now time.Time, n int) *rate.Reservation {
	return rl.limiter.ReserveN(now, n)
}
