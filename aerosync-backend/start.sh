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

echo "Starting Gunicorn..."

"$SCRIPT_DIR/venv/bin/gunicorn" \
    --bind 127.0.0.1:8000 \
    --config "$SCRIPT_DIR/gunicorn_config.py" \
    aerosync.wsgi:application &

GUNICORN_PID=$!

echo "Gunicorn running with PID $GUNICORN_PID"

echo "Starting Cloudflare tunnel..."

exec cloudflared tunnel run aerosync-backend
