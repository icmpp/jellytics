# ============================================
# Stage 1: Build Go backend
# ============================================
# Pinned for reproducible builds. The sqlite driver (modernc.org/sqlite) is
# pure Go, so this stage cross-compiles natively on the build host — no C
# toolchain and no QEMU emulation for multi-arch images.
FROM --platform=$BUILDPLATFORM golang:1.25-alpine AS backend-builder

ARG JELLYTICS_VERSION=dev
ARG TARGETOS
ARG TARGETARCH

WORKDIR /app

# Download deps in their own layer so they cache unless go.mod/go.sum change.
COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/ .
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build \
    -trimpath \
    -ldflags "-s -w -X main.Version=${JELLYTICS_VERSION}" \
    -o /app/server cmd/server/main.go

# ============================================
# Stage 2: Build Next.js frontend
# ============================================
# Build output is plain JS (no native deps), so this stage also runs on the
# build host regardless of target platform.
FROM --platform=$BUILDPLATFORM node:20-alpine AS frontend-builder

WORKDIR /app

ARG NEXT_PUBLIC_API_URL=/api/v1
ARG BACKEND_URL=http://127.0.0.1:8080
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV BACKEND_URL=$BACKEND_URL
ENV NEXT_TELEMETRY_DISABLED=1

# Install deps in their own layer so they cache unless package files change.
COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ .
RUN npm run build

# ============================================
# Stage 3: Runtime image (single container)
# ============================================
# node:20-alpine is the floor: Next.js standalone needs a Node runtime. The Go
# binary rides along; ca-certificates is its only runtime dep.
FROM node:20-alpine

LABEL org.opencontainers.image.title="Jellytics"
LABEL org.opencontainers.image.description="Jellyfin analytics and usage statistics"
LABEL org.opencontainers.image.url="https://github.com/icmpp/jellytics"
LABEL org.opencontainers.image.source="https://github.com/icmpp/jellytics"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.authors="icmpp"

WORKDIR /app

# Runtime deps plus the data dir, in one layer. The Go binary is static
# (pure-Go sqlite), so no sqlite-libs needed.
RUN apk add --no-cache ca-certificates \
    && mkdir -p /app/data

# Copy backend (migrations are embedded in the binary).
COPY --from=backend-builder /app/server /app/server

# Copy frontend (standalone output: server.js + minimal pruned node_modules).
COPY --from=frontend-builder /app/public ./public
COPY --from=frontend-builder /app/.next/standalone ./
COPY --from=frontend-builder /app/.next/static ./.next/static

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Frontend proxies to the backend over loopback inside this single container.
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
