# Build stage
FROM golang:1.24-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache gcc musl-dev sqlite-dev

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=1 GOOS=linux go build -o /app/server cmd/server/main.go

# Runtime stage
FROM alpine:3.19

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache ca-certificates sqlite-libs tzdata

# Create data directory
RUN mkdir -p /app/data

# Copy binary from builder
COPY --from=builder /app/server /app/server

# Copy migrations
COPY --from=builder /app/internal/database/migrations /app/internal/database/migrations

# Expose port
EXPOSE 8080

# Set environment variables
ENV JELLYTICS_SERVER_PORT=8080
ENV JELLYTICS_SERVER_HOST=0.0.0.0
ENV JELLYTICS_DATABASE_PATH=/app/data/jellytics.db

# Run the application
CMD ["/app/server"]
