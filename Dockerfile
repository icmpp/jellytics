# ============================================
# Stage 1: Build Go backend
# ============================================
FROM golang:alpine AS backend-builder

ARG JELLYTICS_VERSION=dev

WORKDIR /app

RUN apk add --no-cache gcc musl-dev sqlite-dev

COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/ .
RUN CGO_ENABLED=1 GOOS=linux go build \
    -trimpath \
    -ldflags "-s -w -X main.Version=${JELLYTICS_VERSION}" \
    -o /app/server cmd/server/main.go

# ============================================
# Stage 2: Build Next.js frontend
# ============================================
FROM node:alpine AS frontend-builder

WORKDIR /app

ARG NEXT_PUBLIC_API_URL=/api/v1
ARG BACKEND_URL=http://127.0.0.1:8080
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV BACKEND_URL=$BACKEND_URL

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ============================================
# Stage 3: Runtime image (single container)
# ============================================
FROM node:alpine

LABEL org.opencontainers.image.title="Jellytics"
LABEL org.opencontainers.image.description="Jellyfin analytics and usage statistics"
LABEL org.opencontainers.image.url="https://github.com/icmpp/jellytics"
LABEL org.opencontainers.image.source="https://github.com/icmpp/jellytics"
LABEL org.opencontainers.image.licenses="GPL-3.0"
LABEL org.opencontainers.image.authors="icmpp"

WORKDIR /app

# Install only required runtime deps for backend
RUN apk add --no-cache ca-certificates sqlite-libs

# Create data directory
RUN mkdir -p /app/data

# Copy backend (migrations are embedded in the binary)
COPY --from=backend-builder /app/server /app/server

# Copy frontend (standalone output)
COPY --from=frontend-builder /app/public ./public
COPY --from=frontend-builder /app/.next/standalone ./
COPY --from=frontend-builder /app/.next/static ./.next/static

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Backend connects to itself via localhost when frontend proxies
ENV BACKEND_URL=http://127.0.0.1:8080
ENV JELLYTICS_SERVER_PORT=8080
ENV JELLYTICS_SERVER_HOST=0.0.0.0
ENV JELLYTICS_DATABASE_PATH=/app/data/jellytics.db
ENV JELLYTICS_LOG_LEVEL=info
ENV JELLYTICS_CORS_ALLOWED_ORIGINS=http://localhost,http://localhost:3000,http://localhost:3001
ENV JELLYTICS_SYNC_INTERVAL_SECONDS=60

EXPOSE 3000

COPY --chmod=755 docker-entrypoint.sh /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]
