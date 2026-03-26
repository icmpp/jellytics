// Package telemetry provides OpenTelemetry tracing initialization and utilities.
package telemetry

import (
	"context"
	"os"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/stdout/stdouttrace"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.27.0"
)

const serviceName = "jellytics-backend"

// InitTracer initializes the global tracer provider. When JELLYTICS_ENABLE_TRACING
// is set, exports spans to stdout. Otherwise uses a noop provider.
func InitTracer(ctx context.Context) (func(context.Context) error, error) {
	if os.Getenv("JELLYTICS_ENABLE_TRACING") != "true" {
		return func(context.Context) error { return nil }, nil
	}

	exporter, err := stdouttrace.New(stdouttrace.WithPrettyPrint())
	if err != nil {
		return nil, err
	}

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(resource.NewWithAttributes(
			semconv.SchemaURL,
			semconv.ServiceName(serviceName),
		)),
	)
	otel.SetTracerProvider(tp)

	return tp.Shutdown, nil
}
