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

# Start Daphne with optimized settings for faster startup
"$SCRIPT_DIR/venv/bin/daphne" \
    --bind 127.0.0.1 \
    --port 8000 \
    --verbosity 0 \
    --websocket_timeout 60 \
    aerosync.asgi:application &

DAPHNE_PID=$!

# Wait for Daphne to be ready (max 10 seconds)
echo "Waiting for Daphne to start..."
for i in {1..20}; do
    if curl -s http://127.0.0.1:8000/admin/login/ > /dev/null 2>&1; then
        echo "✓ Daphne is ready"
        break
    fi
    sleep 0.5
done

echo "Daphne running with PID $DAPHNE_PID"

echo "Starting Cloudflare tunnel..."

exec cloudflared tunnel run aerosync-backend
