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
until node -e "require('http').get('http://127.0.0.1:8080/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1));"; do
  sleep 1
done

# Run frontend in foreground (keeps container alive)
exec node server.js
