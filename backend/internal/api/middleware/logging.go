package middleware

import (
	"fmt"
	"net/http"
	"time"

	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"go.opentelemetry.io/otel/trace"
)

func RequestLogger() func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ww := chimw.NewWrapResponseWriter(w, r.ProtoMajor)
			t1 := time.Now()

			next.ServeHTTP(ww, r)

			status := ww.Status()
			if status < 400 {
				return
			}

			msg := fmt.Sprintf("%s %s %d", r.Method, r.URL.Path, status)
			ev := log.Warn().Int("status", status).Int("bytes", ww.BytesWritten()).Dur("duration", time.Since(t1))
			if reqID := chimw.GetReqID(r.Context()); reqID != "" {
				ev = ev.Str("req_id", reqID)
			}
			if span := trace.SpanFromContext(r.Context()); span.SpanContext().IsValid() {
				ev = ev.Str("trace_id", span.SpanContext().TraceID().String())
			}
			ev.Msg(msg)
		})
	}
}

func StructuredLogger(logger zerolog.Logger) func(next http.Handler) http.Handler {
	return chimw.RequestLogger(&chimw.DefaultLogFormatter{
		Logger:  &logger,
		NoColor: true,
	})
}
