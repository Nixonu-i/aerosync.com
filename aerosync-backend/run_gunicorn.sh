#!/bin/bash
# Script to run AeroSync with Gunicorn

echo "Starting AeroSync with Gunicorn..."

# Ensure script runs from the repository root so relative paths work
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Activate virtual environment
source venv/bin/activate

# If not using an external static/media server (nginx), enable Django to
# serve media files. This can be overridden by setting the environment
# variable `SERVE_MEDIA_FROM_DJANGO` to "0"/"false".
export SERVE_MEDIA_FROM_DJANGO=${SERVE_MEDIA_FROM_DJANGO:-1}

# Run the application with Gunicorn
exec gunicorn --config gunicorn_config.py aerosync.wsgi:application