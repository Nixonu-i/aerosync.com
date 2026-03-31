#!/usr/bin/env bash
set -e

echo "Starting AeroSync backend..."

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Activate virtual environment
source "$SCRIPT_DIR/venv/bin/activate"

# Optional Django media serving
export SERVE_MEDIA_FROM_DJANGO="${SERVE_MEDIA_FROM_DJANGO:-1}"

echo "Starting Daphne (ASGI server for WebSocket support)..."

"$SCRIPT_DIR/venv/bin/daphne" \
    --bind 127.0.0.1 \
    --port 8000 \
    aerosync.asgi:application &

DAPHNE_PID=$!

echo "Daphne running with PID $DAPHNE_PID"

echo "Starting Cloudflare tunnel..."

exec cloudflared tunnel run aerosync-backend
