#!/bin/bash
# Deployment script for AeroSync application

set -e  # Exit on any error

echo "Starting AeroSync deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/home/nixii/projectsem2"
BACKEND_DIR="$PROJECT_DIR/aerosync-backend"
FRONTEND_DIR="$PROJECT_DIR/aerosync-frontend"
DOMAIN="localhost"  # For local development with ngrok

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}!${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root"
   exit 1
fi

# Update system packages
print_status "Updating system packages..."
sudo apt update

# Install required packages
print_status "Installing required packages..."
sudo apt install -y nginx python3-pip python3-venv nodejs npm certbot python3-certbot-nginx

# Setup backend
print_status "Setting up backend..."
cd "$BACKEND_DIR"

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    print_status "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment and install dependencies
source venv/bin/activate
pip install --upgrade pip
            # install from requirements.txt so new dependencies (whitenoise)
            # are picked up automatically
            pip install -r requirements.txt
# Run migrations
print_status "Running database migrations..."
python manage.py migrate

# Collect static files
print_status "Collecting static files..."
python manage.py collectstatic --noinput

# Deactivate virtual environment
deactivate

# Setup frontend
print_status "Setting up frontend..."
cd "$FRONTEND_DIR"

# Install npm dependencies
if [ ! -d "node_modules" ]; then
    print_status "Installing npm dependencies..."
    npm install
fi

# Build frontend
print_status "Building frontend..."
npm run build

# Configure Nginx
print_status "Configuring Nginx..."

# Backup existing nginx config
if [ -f "/etc/nginx/sites-available/aerosync" ]; then
    sudo cp /etc/nginx/sites-available/aerosync /etc/nginx/sites-available/aerosync.backup.$(date +%Y%m%d_%H%M%S)
    print_warning "Backed up existing nginx configuration"
fi

# Copy nginx configuration
sudo cp "$PROJECT_DIR/nginx.conf" /etc/nginx/sites-available/aerosync

# Replace placeholder domain with actual domain
sudo sed -i "s/your-domain.com/$DOMAIN/g" /etc/nginx/sites-available/aerosync

# Enable the site
sudo ln -sf /etc/nginx/sites-available/aerosync /etc/nginx/sites-enabled/

# Remove default site
sudo rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
print_status "Testing nginx configuration..."
sudo nginx -t

if [ $? -eq 0 ]; then
    print_status "Nginx configuration is valid"
else
    print_error "Nginx configuration test failed"
    exit 1
fi

# Setup systemd service
print_status "Setting up systemd service..."

# Copy service file
sudo cp "$PROJECT_DIR/aerosync.service" /etc/systemd/system/aerosync.service

# Replace placeholder paths
sudo sed -i "s|/home/nixii/projectsem2|$PROJECT_DIR|g" /etc/systemd/system/aerosync.service

# Reload systemd and enable service
sudo systemctl daemon-reload
sudo systemctl enable aerosync

# Start services
print_status "Starting services..."

# Start Django application
sudo systemctl start aerosync

# Restart nginx
sudo systemctl restart nginx

# Check service status
print_status "Checking service status..."
if sudo systemctl is-active --quiet aerosync; then
    print_status "AeroSync service is running"
else
    print_error "AeroSync service failed to start"
    sudo systemctl status aerosync
    exit 1
fi

if sudo systemctl is-active --quiet nginx; then
    print_status "Nginx is running"
else
    print_error "Nginx failed to start"
    sudo systemctl status nginx
    exit 1
fi

# For local development with ngrok, SSL is typically handled by ngrok
print_warning "For ngrok, SSL will be handled by ngrok automatically"
print_warning "Your ngrok tunnel will provide HTTPS access"

print_status "Deployment completed successfully!"
print_status "Your application should be accessible at http://$DOMAIN"
print_status "Backend API: http://$DOMAIN/api/"
print_status "Admin interface: http://$DOMAIN/admin/"
print_status "After starting ngrok, access via your ngrok URL"