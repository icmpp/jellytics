package middleware

import (
	"context"
	"net/http"

	chimw "github.com/go-chi/chi/v5/middleware"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

const tracerName = "jellytics/backend"

// Tracing creates a span for each request and propagates trace context.
func Tracing() func(next http.Handler) http.Handler {
	tracer := otel.Tracer(tracerName)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context()
			spanName := r.Method + " " + r.URL.Path
			if spanName == " " {
				spanName = r.Method + " /"
			}
			ctx, span := tracer.Start(ctx, spanName)
			defer span.End()

			span.SetAttributes(
				attribute.String("http.method", r.Method),
				attribute.String("http.url", r.URL.String()),
			)
			if reqID := chimw.GetReqID(ctx); reqID != "" {
				span.SetAttributes(attribute.String("req.id", reqID))
			}

			wrapWriter := &responseWriterWithStatus{ResponseWriter: w, status: 200}
			next.ServeHTTP(wrapWriter, r.WithContext(ctx))
			status := wrapWriter.status
			span.SetAttributes(attribute.Int("http.status_code", status))
			if status >= 400 {
				span.SetStatus(codes.Error, http.StatusText(status))
			}
		})
	}
}

// TraceID returns the trace ID from the context if a span exists.
func TraceID(ctx context.Context) string {
	span := trace.SpanFromContext(ctx)
	if span.SpanContext().IsValid() {
		return span.SpanContext().TraceID().String()
	}
	return ""
}

type responseWriterWithStatus struct {
	http.ResponseWriter
	status int
}

func (w *responseWriterWithStatus) WriteHeader(code int) {
	w.status = code
	w.ResponseWriter.WriteHeader(code)
}
