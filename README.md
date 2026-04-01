# AeroSync - Flight Booking System

A modern, full-stack flight booking platform with real-time updates, secure payments, and multi-role access control.

![Technology Stack](https://img.shields.io/badge/Stack-Django%20%7C%20React%20%7C%20PostgreSQL-blue)
![License](https://img.shields.io/badge/License-Proprietary-red)

## 🌟 Features

### For Customers
- ✈️ **Flight Search & Booking** - Browse flights, select seats, and book tickets
- 💳 **Secure Payments** - Pesapal integration for card/mobile money payments
- 🎫 **Boarding Passes** - Download QR-coded boarding passes instantly
- 📱 **Real-Time Updates** - WebSocket-powered live booking status updates
- 👤 **Profile Management** - Manage personal details with age validation (18+)
- 🔐 **Email Verification** - Secure account verification system

### For Agents
- 📊 **Booking Management** - Create and manage bookings on behalf of customers
- 🔍 **Customer Lookup** - Search customers by username
- 💺 **Seat Selection** - Visual seat selection with class-based pricing
- 📋 **Multi-Passenger Bookings** - Book for multiple passengers in one go

### For Admins
- 🛠️ **Full System Control** - Manage flights, aircraft, airports, airlines
- 👥 **User Management** - Oversee customer and agent accounts
- 📈 **Analytics Dashboard** - View booking statistics and revenue reports
- 🎫 **Booking Administration** - Override booking statuses when needed
- 🔍 **Audit Logs** - Track user activity and system changes

## 🏗️ Architecture

### Backend
- **Framework**: Django 5.x with Django REST Framework
- **Database**: PostgreSQL
- **WebSocket**: Django Channels for real-time updates
- **Message Broker**: Redis (for channel layer)
- **Payment Gateway**: Pesapal (Kenya)
- **Email Service**: Brevo (SendGrid) / Gmail OAuth
- **Authentication**: JWT (Simple JWT)
- **Server**: Daphne (ASGI)

### Frontend
- **Framework**: React 19.2.0
- **Build Tool**: Vite 8.x
- **Routing**: React Router v7
- **HTTP Client**: Axios
- **State Management**: React Context API
- **UI**: Custom CSS with responsive design

### Infrastructure
- **Web Server**: Nginx
- **Tunnel**: Cloudflare Tunnel (cloudflared)
- **Static Files**: WhiteNoise
- **Media Storage**: Local filesystem with protected access

## 📋 Prerequisites

### System Requirements
- Python 3.13+
- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- Nginx

### External Services
- **Pesapal Account** - Payment gateway credentials
- **Brevo Account** (optional) - Email service
- **Cloudflare Tunnel** - Public exposure

## 🚀 Installation

### 1. Clone the Repository

```bash
cd /home/nixii/Documents/aerosync
```

### 2. Backend Setup

```bash
cd aerosync-backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Edit .env with your configuration
```

#### Environment Variables (.env)

```ini
# Django Security
DJANGO_SECRET=your-secret-key-here
DJANGO_ALLOWED_HOSTS=aerosync.live,www.aerosync.live
DEBUG=False

# Database
DB_NAME=aerosync_db
DB_USER=aerosync_user
DB_PASSWORD=your-db-password
DB_HOST=localhost
DB_PORT=5432

# JWT Configuration
JWT_ACCESS_MIN=480
JWT_REFRESH_DAYS=30

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# Pesapal Payment Gateway
PESAPAL_CONSUMER_KEY=your-pesapal-key
PESAPAL_CONSUMER_SECRET=your-pesapal-secret
PESAPAL_ENVIRONMENT=sandbox  # or 'production'
PESAPAL_CALLBACK_URL=https://api.aerosync.live/api/payments/pesapal/callback/
PESAPAL_IPN_URL=https://api.aerosync.live/api/payments/pesapal/ipn/

# Email Service (Choose one)
# Option 1: Brevo (Recommended)
BREVO_API_KEY=xkeysib-your-brevo-api-key

# Option 2: Gmail OAuth
GMAIL_OAUTH_CLIENT_ID=your-client-id
GMAIL_OAUTH_CLIENT_SECRET=your-client-secret
GMAIL_OAUTH_REFRESH_TOKEN=your-refresh-token
GMAIL_SENDER_EMAIL=noreply@aerosync.live

# Cloudflare Tunnel
CLOUDFLARE_DOMAIN=aerosync.live
```

#### Run Migrations

```bash
python manage.py migrate
python manage.py collectstatic --noinput
```

#### Create Superuser

```bash
python manage.py createsuperuser
```

### 3. Frontend Setup

```bash
cd ../aerosync-frontend

# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env with your configuration
```

#### Environment Variables (.env)

```ini
VITE_API_URL=http://localhost:8000/api/
```

#### Build for Production

```bash
npm run build
```

### 4. Start Services

#### Backend (Development)

```bash
cd aerosync-backend
source venv/bin/activate
./start.sh
```

This starts:
- Daphne ASGI server on port 8000
- Cloudflare Tunnel for public access

#### Frontend (Development)

```bash
cd aerosync-frontend
npm run dev
```

Access at: `http://localhost:5173`

### 5. Production Deployment

Use the deployment script:

```bash
chmod +x deploy.sh
./deploy.sh
```

This will:
1. Update system packages
2. Install required software
3. Setup backend with virtual environment
4. Build frontend production bundle
5. Configure Nginx
6. Setup systemd service
7. Start all services

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register/` - Register new user
- `POST /api/auth/login/` - Login (returns JWT tokens)
- `POST /api/auth/logout/` - Logout
- `POST /api/auth/verify-email/` - Verify email address
- `POST /api/auth/resend-verification/` - Resend verification code
- `POST /api/auth/forgot-password/` - Request password reset
- `POST /api/auth/reset-password/` - Reset password with OTP

### Public Endpoints
- `GET /api/flights/` - List available flights
- `GET /api/airlines/` - List airlines
- `GET /api/flights/cities/` - List departure/arrival cities

### Customer Endpoints
- `GET /api/bookings/` - List user's bookings
- `GET /api/bookings/{id}/` - Get booking details
- `POST /api/bookings/create_booking/` - Create new booking
- `GET /api/bookings/{id}/boarding_pass_png/` - Download boarding pass
- `GET /api/bookings/{id}/payment_status/` - Check payment status
- `POST /api/payments/pesapal/initiate/{booking_id}/` - Initiate Pesapal payment

### Agent Endpoints
- `GET /api/agent/flights/` - List flights (agent view)
- `GET /api/agent/bookings/` - List agent's bookings
- `POST /api/agent/bookings/create_for_customer/` - Create booking for customer
- `POST /api/agent/scan-history/` - Log QR scan

### Admin Endpoints
- `GET /api/admin/users/` - List all users
- `GET /api/admin/bookings/` - List all bookings
- `POST /api/admin/bookings/{id}/update_status/` - Update booking status
- `GET /api/admin/user-activities/` - View user activity logs
- `GET /api/admin/user-activity-stats/` - Activity statistics

### WebSocket
- `WS /api/ws/bookings/?token={jwt_token}` - Real-time booking updates

## 🔌 WebSocket Integration

### Connection

Frontend connects to WebSocket stream for real-time updates:

```javascript
const ws = new WebSocket(
  `ws://localhost:8000/api/ws/bookings/?token=${encodeURIComponent(jwtToken)}`
);
```

### Message Types

#### Payment Updates
Sent when Pesapal IPN updates payment status:

```json
{
  "type": "payment_updated",
  "payment": {
    "id": 123,
    "status": "SUCCESS",
    "amount": "5000.00",
    ...
  },
  "booking_id": 456,
  "changed_fields": ["status"]
}
```

#### Booking Updates
Sent when booking status changes:

```json
{
  "type": "booking_updated",
  "booking": {
    "id": 456,
    "booking_status": "CONFIRMED",
    "confirmation_code": "ABC123",
    ...
  },
  "changed_fields": ["booking_status"]
}
```

### Frontend Subscription

Components subscribe to updates via context:

```javascript
const { subscribeToPaymentUpdates } = useBookingRealtime();

useEffect(() => {
  const unsubscribe = subscribeToPaymentUpdates((payment, bookingId) => {
    if (bookingId === booking.id) {
      loadPaymentStatus(); // Auto-refresh UI
    }
  });
  
  return () => unsubscribe();
}, []);
```

## 💳 Payment Flow

### Pesapal Integration

1. **Initiation**: User clicks "Pay Now" → Backend creates Pesapal order
2. **Redirect**: User redirected to Pesapal payment page
3. **Payment**: User enters card/mobile money details
4. **Callback**: Pesapal redirects back to callback URL
5. **IPN**: Pesapal sends Instant Payment Notification to backend
6. **Update**: Backend updates payment status → Triggers WebSocket broadcast
7. **Confirmation**: Frontend receives update → UI auto-refreshes

### Payment Statuses
- `PENDING` - Payment initiated, awaiting confirmation
- `SUCCESS` - Payment completed successfully
- `FAILED` - Payment failed
- `CANCELLED` - Payment cancelled by user
- `REVERSED` - Payment reversed (refund)

## 🔐 Security Features

### Authentication
- JWT token-based authentication
- Access token expiry: 8 hours
- Refresh token expiry: 30 days
- Token rotation on refresh

### Authorization
- Role-based access control (Customer, Agent, Admin)
- Middleware enforces profile completion
- Protected media endpoints require authentication

### Data Protection
- CSRF protection enabled
- CORS configured for allowed origins only
- Profile photos served through authenticated endpoints
- Sensitive fields locked after initial setup

### Age Validation
- Users must be 18+ to register
- Enforced at serializer level
- Clear error messages with current age display

## 📊 Database Schema

### Core Models

**User** (Custom User Model)
- username, email, first_name, last_name
- role (CUSTOMER, AGENT, ADMIN)
- is_email_verified
- staff_id (for agents/admins)

**Profile**
- user (OneToOne)
- date_of_birth, gender, nationality
- phone_area_code, phone_number
- profile_photo
- initial_setup_done

**Flight**
- flight_number, airline, aircraft
- departure_airport, arrival_airport
- departure_time, arrival_time
- price, trip_type, stops
- status (SCHEDULED, DELAYED, CANCELLED, COMPLETED)

**Booking**
- user, flight
- booking_status (PENDING, CONFIRMED, ONBOARD, CANCELLED)
- total_amount, confirmation_code
- created_by (for agent bookings)

**Passenger**
- booking (ForeignKey)
- full_name, date_of_birth, gender
- passport_number, nationality
- passenger_type (ADULT, CHILD, INFANT)

**Payment**
- booking (ForeignKey)
- provider (PESAPAL)
- status (PENDING, SUCCESS, FAILED, CANCELLED, REVERSED)
- amount, currency, provider_reference

**BoardingPass**
- booking, passenger, seat
- qr_code_data, price
- is_scanned, scanned_at

## 🛠️ Development

### Running Tests

```bash
# Backend
cd aerosync-backend
source venv/bin/activate
python manage.py test

# Frontend
cd aerosync-frontend
npm test
```

### Code Style

```bash
# Backend (Python)
black .
flake8

# Frontend (JavaScript)
npm run lint
```

### Debugging

Enable debug mode in `.env`:

```ini
DEBUG=True
```

Check logs:

```bash
# Backend logs
tail -f aerosync-backend/logs/django.log

# User activity logs
tail -f aerosync-backend/user_activity.log

# Error logs
tail -f aerosync-backend/user_activity_errors.log
```

## 🚨 Troubleshooting

### WebSocket Not Connecting
1. Check Redis is running: `redis-cli ping`
2. Verify Daphne is running: `ps aux | grep daphne`
3. Check browser console for connection errors

### Payment Not Updating
1. Check Pesapal IPN logs in backend
2. Verify webhook URLs are publicly accessible
3. Ensure Cloudflare Tunnel is running

### Email Not Sending
1. Check Brevo API key in `.env`
2. Verify IP is authorized in Brevo dashboard
3. Check logs for email errors

### Static Files Not Loading
```bash
cd aerosync-backend
python manage.py collectstatic --clear
python manage.py collectstatic
```

## 📝 License

This is a proprietary software. All rights reserved.

## 👥 Team

Built with ❤️ by the AeroSync Team

---

**Support**: support@aerosync.live  
**Documentation**: https://docs.aerosync.live  
**API Status**: https://status.aerosync.live
