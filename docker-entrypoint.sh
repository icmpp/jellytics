#!/bin/sh
set -e

# Start backend in background
/app/server &
BACKEND_PID=$!

# Cleanup on exit
cleanup() {
  kill $BACKEND_PID 2>/dev/null || true
  exit 0
}
trap cleanup TERM INT

# Wait for backend to be ready
until wget -q -O /dev/null http://127.0.0.1:8080/health 2>/dev/null; do
  sleep 1
done

# Run frontend in foreground (keeps container alive)
exec node server.js
