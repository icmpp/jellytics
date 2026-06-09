#!/bin/sh
set -e

# Start the Go backend in the background.
/app/server &
BACKEND_PID=$!

# On SIGTERM/SIGINT (e.g. `docker stop`), tear down the backend too.
cleanup() {
  kill "$BACKEND_PID" 2>/dev/null || true
  exit 0
}
trap cleanup TERM INT

# Wait for the backend to become ready before starting the frontend, but give
# up if it dies during startup so the container exits instead of hanging.
until node -e "require('http').get('http://127.0.0.1:8080/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1));"; do
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "entrypoint: backend exited before becoming ready" >&2
    wait "$BACKEND_PID"
    exit 1
  fi
  sleep 1
done

# Start the frontend in the background too, so we can supervise both. If either
# process exits, bring the whole container down and let the restart policy
# (restart: unless-stopped) recycle it — rather than serving a dead API.
node server.js &
FRONTEND_PID=$!

# Re-trap now that both children exist.
cleanup() {
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  exit 0
}
trap cleanup TERM INT

# Poll both children (BusyBox ash has no reliable `wait -n`). As soon as either
# exits, bring the other down and exit non-zero so the container is recycled.
while kill -0 "$BACKEND_PID" 2>/dev/null && kill -0 "$FRONTEND_PID" 2>/dev/null; do
  sleep 2
done

echo "entrypoint: a managed process exited; shutting down" >&2
kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
exit 1
