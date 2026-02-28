#!/bin/bash
# Script to run AeroSync with Gunicorn

echo "Starting AeroSync with Gunicorn..."

# Activate virtual environment
source venv/bin/activate

# Run the application with Gunicorn
exec gunicorn --config gunicorn_config.py aerosync.wsgi:application