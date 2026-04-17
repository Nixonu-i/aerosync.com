# AeroSync - Technical Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [System Architecture](#system-architecture)
3. [Technology Stack](#technology-stack)
4. [Backend Architecture](#backend-architecture)
5. [Frontend Architecture](#frontend-architecture)
6. [Database Schema](#database-schema)
7. [API Endpoints](#api-endpoints)
8. [Key Features](#key-features)
9. [Security Implementation](#security-implementation)
10. [Real-time Communication](#real-time-communication)
11. [Payment Processing](#payment-processing)
12. [Theme System](#theme-system)
13. [Deployment Architecture](#deployment-architecture)
14. [Performance Optimizations](#performance-optimizations)

---

## Project Overview

AeroSync is a comprehensive, production-ready flight booking and management platform built with Django and React. The system supports three distinct user roles—Customers, Agents, and Administrators—each with dedicated interfaces and capabilities.

### Core Capabilities

**Customer Features:**
- Browse and search available flights
- Multi-passenger booking with seat selection
- Secure payment processing via Pesapal
- Real-time booking status updates via WebSocket
- Digital boarding pass generation with QR codes
- Profile management with photo upload
- Booking history and management

**Agent Features:**
- Create bookings on behalf of customers
- QR code scanning for boarding pass verification
- Duplicate scan detection and prevention
- Booking history with boarding pass downloads
- Flight availability viewing
- Agent profile management

**Administrator Features:**
- Complete flight management (CRUD operations)
- User management across all roles
- Airline, aircraft, and airport management
- Real-time analytics and reporting
- Activity logging and audit trails
- System monitoring

---

## System Architecture

### Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   Client Browser                    │
│                  (React Frontend)                   │
└───────────────────┬─────────────────────────────────┘
                    │
                    │ HTTPS
                    ▼
┌─────────────────────────────────────────────────────┐
│              Cloudflare Edge Network                │
│          (SSL, DDoS Protection, CDN)                │
└───────────────────┬─────────────────────────────────┘
                    │
                    │ Encrypted Tunnel
                    ▼
┌─────────────────────────────────────────────────────┐
│            Cloudflare Tunnel Daemon                 │
│              (cloudflared)                          │
└───────┬───────────────────────────────┬─────────────┘
        │                               │
        │ HTTP (Port 8000)              │ WebSocket (Port 8001)
        ▼                               ▼
┌──────────────────┐          ┌──────────────────┐
│   Gunicorn (3)   │          │   Daphne (ASGI)  │
│     WSGI HTTP    │          │   WebSocket      │
│   ⚡ FAST API    │          │   Real-time      │
└────────┬─────────┘          └────────┬─────────┘
         │                              │
         └──────────┬───────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│               Django Application                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ accounts │  │   core   │  │  Background      │  │
│  │   app    │  │   app    │  │  Threads         │  │
│  └────┬─────┘  └────┬─────┘  └────────┬─────────┘  │
│       │              │                 │            │
│       ▼              ▼                 ▼            │
│  ┌──────────────────────────────────────────┐       │
│  │        Django ORM + Models               │       │
│  └──────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│           PostgreSQL Database                       │
│      (Tables with UUID Primary Keys)                │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│        External Media Storage (~/aerosync-media/)   │
│           Profile Photos, Documents                 │
└─────────────────────────────────────────────────────┘
```

### Hybrid Server Architecture

The platform uses a dual-server approach for optimal performance:

- **Gunicorn (WSGI)**: Handles all HTTP API requests on port 8000 with 3 synchronous workers for fast response times
- **Daphne (ASGI)**: Manages WebSocket connections on port 8001 for real-time updates
- **Result**: 10-20x faster API responses compared to pure ASGI implementation

---

## Technology Stack

### Backend Technologies

| Technology | Version | Purpose |
|-----------|---------|---------|
| Django | 6.0.2 | Python web framework |
| Django REST Framework | 3.16.1 | RESTful API development |
| Django Channels | 4.2.0 | WebSocket support |
| Daphne | 4.2.0 | ASGI server for WebSockets |
| Gunicorn | 25.1.0 | WSGI HTTP server |
| PostgreSQL | Latest | Primary database |
| psycopg 3 | 3.3.3 | PostgreSQL adapter |
| Redis | 5.2.1 | WebSocket channel layer |
| JWT (djangorestframework-simplejwt) | 5.5.1 | Token authentication |
| Brevo (SendInBlue) | sib_api_v3_sdk | Email service |
| Pesapal | API v3 | Payment gateway |
| QR Code | qrcode 8.2 | Boarding pass generation |
| Pillow | 12.1.1 | Image processing |
| WhiteNoise | 6.5.0 | Static file serving |

### Frontend Technologies

| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 19.2.0 | UI library |
| Vite | 8.0.0-beta.13 | Build tool |
| React Router | 7.13.1 | Client-side routing |
| Axios | 1.13.5 | HTTP client |
| html5-qrcode | 2.3.8 | QR code scanning |

### Infrastructure

- **Cloudflare Tunnel**: Secure HTTPS without port forwarding
- **Systemd**: Service management
- **Nginx**: Reverse proxy (local development)

---

## Backend Architecture

### Project Structure

```
aerosync-backend/
├── aerosync/                      # Django project configuration
│   ├── settings.py               # Main configuration
│   ├── urls.py                   # Root URL routing
│   ├── wsgi.py                   # WSGI application (Gunicorn)
│   └── asgi.py                   # ASGI application (Daphne)
│
├── accounts/                      # User authentication & profiles
│   ├── models.py                 # User & Profile models
│   ├── views.py                  # Authentication endpoints
│   ├── serializers.py            # Data serialization
│   ├── urls.py                   # Account routes
│   ├── middleware.py             # Request processing
│   ├── services/
│   │   └── email_service.py      # Brevo email integration
│   ├── templates/emails/         # HTML email templates
│   ├── management/commands/
│   │   ├── cleanup_unverified_users.py
│   │   └── fix_profile_completion.py
│   └── admin.py                  # Django admin config
│
├── core/                          # Main business logic
│   ├── models.py                 # All business models
│   ├── views.py                  # API viewsets & endpoints
│   ├── serializers.py            # Model serializers
│   ├── urls.py                   # API routes
│   ├── services.py               # Business logic services
│   ├── signals.py                # Event handlers & notifications
│   ├── permissions.py            # Custom permission classes
│   ├── tasks.py                  # Background tasks
│   ├── websocket.py              # WebSocket consumers
│   ├── activity_views.py         # User activity tracking
│   ├── ip_risk_service.py        # IP risk assessment
│   ├── pesapal_service.py        # Payment processing
│   ├── db_middleware.py          # Database middleware
│   ├── middleware.py             # Custom middleware
│   └── management/commands/
│       ├── auto_complete_bookings.py
│       ├── auto_complete_flights.py
│       ├── generate_missing_seats.py
│       └── update_booking_statuses.py
│
├── media/                         # Media files
├── staticfiles/                   # Collected static files
├── manage.py                      # Django CLI tool
├── start.sh                       # Server startup script
├── gunicorn_config.py             # Gunicorn configuration
├── requirements.txt               # Python dependencies
└── .env                           # Environment variables
```

### Key Backend Components

#### 1. Custom User Model

The system uses a custom User model with UUID primary keys for enhanced security:

```python
class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=10, choices=[
        ('ADMIN', 'Admin'),
        ('AGENT', 'Agent'),
        ('CUST', 'Customer')
    ], default='CUST')
    theme_preference = models.CharField(max_length=10, choices=[
        ('LIGHT', 'Light'),
        ('DARK', 'Dark'),
        ('SYSTEM', 'System Default')
    ], default='LIGHT')
    staff_id = models.CharField(max_length=20, unique=True, blank=True, null=True)
    is_email_verified = models.BooleanField(default=False)
    is_pending_verification = models.BooleanField(default=True)
    email_verification_code = models.CharField(max_length=6, blank=True, null=True)
    password_reset_code = models.CharField(max_length=6, blank=True, null=True)
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']
```

**Features:**
- Email-based authentication instead of username
- Role-based access control (Admin, Agent, Customer)
- Theme preference storage for UI customization
- Email verification with OTP codes
- Password reset functionality
- Staff ID tracking for agents

#### 2. Profile Model

Extends User with additional personal information:

```python
class Profile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=20, choices=[...], blank=True, null=True)
    nationality = models.CharField(max_length=50, blank=True, null=True)
    phone_area_code = models.CharField(max_length=10, default='+254')
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    profile_photo = models.ImageField(upload_to=profile_photo_upload_to, blank=True, null=True)
    # Address fields for boarding passes
    address_line1, city, country, postal_code...
    initial_setup_done = models.BooleanField(default=False)
```

#### 3. Flight Model

Supports both direct and multi-stop flights:

```python
class Flight(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    flight_number = models.CharField(max_length=20, unique=True)
    aircraft = models.ForeignKey(Aircraft, on_delete=models.CASCADE)
    airline = models.CharField(max_length=100)
    departure_airport = models.ForeignKey(Airport, on_delete=models.CASCADE, related_name='departures')
    arrival_airport = models.ForeignKey(Airport, on_delete=models.CASCADE, related_name='arrivals')
    departure_time = models.DateTimeField()
    arrival_time = models.DateTimeField()
    price = models.DecimalField(max_digits=10, decimal_places=2)
    trip_type = models.CharField(max_length=20, choices=[('ONE_WAY', 'One Way'), ('ROUND_TRIP', 'Round Trip')])
    route_type = models.CharField(max_length=20, choices=[('DIRECT', 'Direct'), ('VIA', 'Via')], default='DIRECT')
    via_cities = models.JSONField(default=list, blank=True)  # Intermediate cities
    stops = models.IntegerField(default=0)
    status = models.CharField(max_length=20, choices=[...], default='SCHEDULED')
```

**Features:**
- Direct and multi-stop (VIA) route support
- JSON field for intermediate cities
- Auto-calculated stops based on via_cities
- Flight status tracking (SCHEDULED, DELAYED, CANCELLED, COMPLETED)

#### 4. Booking System

Multi-passenger booking with comprehensive tracking:

```python
class Booking(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bookings')
    flight = models.ForeignKey(Flight, on_delete=models.CASCADE)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)  # Agent/staff
    confirmation_code = models.CharField(max_length=10, unique=True)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    booking_status = models.CharField(max_length=20, choices=[
        ('PENDING', 'Pending Payment'),
        ('CONFIRMED', 'Confirmed'),
        ('ONBOARD', 'On Board'),
        ('CANCELLED', 'Cancelled'),
        ('FAILED', 'Failed')
    ], default='PENDING')
    stopover_city = models.CharField(max_length=100, blank=True, null=True)
    booking_date = models.DateTimeField(auto_now_add=True)
```

**Features:**
- Agent/staff can create bookings on behalf of customers
- Unique confirmation codes
- Granular status tracking
- Support for stopover cities on VIA flights

#### 5. Passenger Model

Individual passenger details per booking:

```python
class Passenger(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name='passengers')
    full_name = models.CharField(max_length=200)
    date_of_birth = models.DateField()
    nationality = models.CharField(max_length=50)
    passenger_type = models.CharField(max_length=10, choices=[
        ('ADULT', 'Adult'),
        ('CHILD', 'Child'),
        ('KID', 'Kid')
    ])
    gender = models.CharField(max_length=20, blank=True, null=True)
    passport_number = models.CharField(max_length=50)
    phone_area_code = models.CharField(max_length=10, default='+254')
    phone_number = models.CharField(max_length=20)
```

**Features:**
- Multiple passengers per booking
- Passenger type categorization (Adult, Child, Kid)
- International phone number support
- Passport/ID tracking

#### 6. Payment Model

Multi-provider payment tracking:

```python
class Payment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name='payments')
    provider = models.CharField(max_length=20, choices=[
        ('MPESA', 'M-Pesa'),
        ('PESAPAL', 'Pesapal'),
        ('PAYPAL', 'PayPal'),
        ('STRIPE', 'Stripe'),
        ('CARD', 'Credit Card'),
        ('BANK_TRANSFER', 'Bank Transfer')
    ])
    provider_reference = models.CharField(max_length=100, db_index=True)
    payment_detail = models.CharField(max_length=200, blank=True, null=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default='KES')
    status = models.CharField(max_length=20, choices=[
        ('PENDING', 'Pending'),
        ('SUCCESS', 'Success'),
        ('FAILED', 'Failed'),
        ('CANCELLED', 'Cancelled')
    ])
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['booking', 'provider'],
                name='unique_booking_payment',
                condition=~models.Q(status='CANCELLED')
            )
        ]
```

**Features:**
- Multiple payment providers supported
- Provider-specific details storage
- Unique constraint prevents duplicate active payments
- Comprehensive status tracking

#### 7. Boarding Pass Model

Per-passenger boarding passes with QR codes:

```python
class BoardingPass(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name='boarding_passes')
    passenger = models.ForeignKey(Passenger, on_delete=models.CASCADE)
    seat = models.ForeignKey(Seat, on_delete=models.CASCADE)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    issued_date = models.DateTimeField(auto_now_add=True)
    qr_code_data = models.TextField()
    is_checked_in = models.BooleanField(default=False)
```

**Features:**
- Individual boarding pass per passenger
- QR code data generation
- Check-in status tracking
- Linked to specific seat assignment

#### 8. Scan Log Model

Tracks all QR code scanning attempts:

```python
class ScanLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    scanned_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    boarding_pass = models.ForeignKey(BoardingPass, on_delete=models.SET_NULL, null=True)
    booking_reference = models.CharField(max_length=20)
    passenger_name = models.CharField(max_length=200)
    flight_number = models.CharField(max_length=20)
    seat_number = models.CharField(max_length=10)
    booking_status = models.CharField(max_length=20)
    already_onboard = models.BooleanField(default=False)
    action = models.CharField(max_length=20, blank=True, null=True)
    additional_data = models.JSONField(default=dict, blank=True)
    scanned_at = models.DateTimeField(auto_now_add=True)
```

**Features:**
- Complete audit trail of all scans
- Duplicate detection (already_onboard flag)
- Action tracking (confirm/cancel)
- Additional metadata storage

#### 9. User Activity Log

Comprehensive activity tracking:

```python
class UserActivityLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    action = models.CharField(max_length=50, choices=[
        ('login', 'User Login'),
        ('login_blocked', 'Login Blocked - IP Risk'),
        ('logout', 'User Logout'),
        ('profile_update', 'Profile Update'),
        ('booking_create', 'Booking Created'),
        ('booking_cancel', 'Booking Cancelled'),
        ('payment', 'Payment Processed'),
        ('api_access', 'API Access'),
        ('admin_action', 'Admin Action'),
        ('file_upload', 'File Upload'),
        ('other', 'Other Action')
    ])
    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField()
    path = models.CharField(max_length=500)
    method = models.CharField(max_length=10)
    status_code = models.IntegerField()
    timestamp = models.DateTimeField(auto_now_add=True)
    additional_data = models.JSONField(default=dict, blank=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['user', '-timestamp']),
            models.Index(fields=['ip_address', '-timestamp']),
            models.Index(fields=['action', '-timestamp']),
        ]
```

**Features:**
- All user actions logged
- IP address and user agent tracking
- Indexed for fast queries
- Additional metadata in JSON field

---

## Frontend Architecture

### Project Structure

```
aerosync-frontend/
├── src/
│   ├── api/
│   │   └── api.js                  # Axios client with JWT interceptors
│   ├── components/                 # Reusable UI components
│   │   ├── AdminNavbar.jsx        # Admin navigation
│   │   ├── AgentNavbar.jsx        # Agent navigation
│   │   ├── Navbar.jsx             # Customer navigation
│   │   ├── ThemeToggle.jsx        # Light/Dark mode toggle
│   │   ├── PesapalPaymentModal.jsx # Payment integration
│   │   ├── MultiPassengerBooking.jsx
│   │   ├── ImprovedMultiPassengerBooking.jsx
│   │   ├── SearchableSelect.jsx   # Dropdown with search
│   │   ├── DateOfBirthPicker.jsx  # DOB input component
│   │   └── ProtectedImage.jsx     # Secure image loading
│   ├── context/
│   │   ├── AuthContext.jsx        # Authentication state & hooks
│   │   └── BookingRealtimeContext.jsx  # WebSocket booking updates
│   ├── hooks/
│   │   ├── useAdminUI.jsx         # Admin feature flags
│   │   └── useBookingUpdates.jsx  # WebSocket connection hook
│   ├── pages/
│   │   ├── admin/                 # Admin dashboard & management
│   │   │   ├── AdminDashboard.jsx
│   │   │   ├── AdminFlights.jsx
│   │   │   ├── AdminBookings.jsx
│   │   │   ├── AdminUsers.jsx
│   │   │   ├── AdminAirlines.jsx
│   │   │   ├── AdminAircraft.jsx
│   │   │   ├── AdminAirports.jsx
│   │   │   ├── AdminActivityLogs.jsx
│   │   │   └── AdminReports.jsx
│   │   ├── agent/                 # Agent portal
│   │   │   ├── AgentDashboard.jsx
│   │   │   ├── AgentBookings.jsx
│   │   │   ├── AgentCreateBooking.jsx
│   │   │   ├── AgentFlights.jsx
│   │   │   ├── AgentProfile.jsx
│   │   │   └── AgentVerifyQR.jsx  # QR scanner
│   │   ├── Dashboard.jsx          # Customer dashboard
│   │   ├── Flights.jsx            # Flight search & listing
│   │   ├── Booking.jsx            # Booking flow & management
│   │   ├── Seats.jsx              # Seat selection
│   │   ├── Profile.jsx            # User profile management
│   │   ├── Login.jsx
│   │   ├── Register.jsx
│   │   ├── VerifyEmail.jsx
│   │   └── ForgotPassword.jsx
│   ├── utils/
│   │   └── errorFormatter.js      # Error message formatting
│   ├── App.jsx                    # Main app with routing
│   ├── index.css                  # Global styles with theme variables
│   ├── App.css                    # Component styles
│   └── responsive.css             # Responsive design utilities
│
├── public/                        # Static assets & manifest
├── dist/                          # Production build
├── package.json                   # Dependencies
├── vite.config.js                 # Vite configuration
└── .env                           # Environment variables
```

### Key Frontend Features

#### 1. Authentication Context

Centralized authentication state management:

```javascript
const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileComplete, setProfileComplete] = useState(false);
  
  // JWT token management
  // Auto-refresh on expiry
  // Profile completion tracking
  // Theme preference synchronization
}
```

#### 2. Real-time Booking Updates

WebSocket integration for live updates:

```javascript
const BookingRealtimeContext = createContext();

export function BookingRealtimeProvider({ children }) {
  const [ws, setWs] = useState(null);
  
  // Auto-connect with exponential backoff
  // Subscribe to specific bookings
  // Handle booking updates
  // Handle payment updates
  // Heartbeat management
}
```

#### 3. Theme System

Complete light/dark mode support with CSS variables:

```css
:root {
  --primary: #2563eb;
  --background: #f8fafc;
  --surface: #ffffff;
  --text-primary: #0f172a;
  --text-secondary: #64748b;
  --border: #e2e8f0;
}

[data-theme='dark'] {
  --primary: #3b82f6;
  --background: #0a0e17;
  --surface: #111827;
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --border: #1f2937;
}
```

**Features:**
- System-wide theme switching
- User preference persistence
- Backend synchronization
- All components theme-aware

#### 4. Protected Image Component

Secure media loading via authenticated API:

```javascript
function ProtectedImage({ src, alt, ...props }) {
  const [imageSrc, setImageSrc] = useState(null);
  
  useEffect(() => {
    // Fetch image with JWT token
    // Convert blob to object URL
    // Handle errors gracefully
  }, [src]);
  
  return <img src={imageSrc} alt={alt} {...props} />;
}
```

#### 5. QR Code Scanner

Agent boarding pass verification:

```javascript
function AgentVerifyQR() {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [scanHistory, setScanHistory] = useState([]);
  
  // Camera access via html5-qrcode
  // QR code verification API call
  // Duplicate scan detection
  // Passenger photo display
  // Scan history tracking
}
```

---

## Database Schema

### Complete Model Relationships

```
accounts_user (UUID PK)
├─ id, email, username, role, theme_preference
├─ staff_id, is_email_verified, created_at
└─ Relationships:
   └─ 1:1 → accounts_profile
   └─ 1:N → core_booking (as user)
   └─ 1:N → core_booking (as created_by)
   └─ 1:N → core_scanlog
   └─ 1:N → core_useractivitylog

core_airline (UUID PK)
├─ id, name, iata_code, country, is_active
└─ Implicit: 1:N → core_flight

core_aircraft (UUID PK)
├─ id, model, total_seats, number_plate
└─ Implicit: 1:N → core_flight, core_seat

core_airport (UUID PK)
├─ id, code (IATA), name, city, country
└─ Implicit: 1:N → core_flight (departures/arrivals)

core_flight (UUID PK)
├─ id, flight_number, airline
├─ departure_airport, arrival_airport
├─ departure_time, arrival_time
├─ price, trip_type, route_type
├─ via_cities (JSON), stops, status
└─ Relationships:
   ├─ FK → core_aircraft
   └─ 1:N → core_booking

core_seat (UUID PK)
├─ id, seat_number, flight_class
├─ is_available, price_multiplier
└─ Relationships:
   ├─ FK → core_aircraft
   └─ 1:N → core_boardingpass

core_booking (UUID PK)
├─ id, confirmation_code, total_amount
├─ booking_status, stopover_city, booking_date
└─ Relationships:
   ├─ FK → accounts_user (user)
   ├─ FK → accounts_user (created_by, nullable)
   ├─ FK → core_flight
   ├─ 1:N → core_passenger
   ├─ 1:N → core_payment
   └─ 1:N → core_boardingpass

core_passenger (UUID PK)
├─ id, full_name, date_of_birth, nationality
├─ passenger_type, gender, passport_number
├─ phone_area_code, phone_number
└─ Relationships:
   ├─ FK → core_booking
   └─ 1:N → core_boardingpass

core_payment (UUID PK)
├─ id, provider, provider_reference
├─ payment_detail, amount, currency, status
└─ Relationships:
   └─ FK → core_booking

core_boardingpass (UUID PK)
├─ id, price, issued_date
├─ qr_code_data, is_checked_in
└─ Relationships:
   ├─ FK → core_booking
   ├─ FK → core_passenger
   └─ FK → core_seat

core_scanlog (UUID PK)
├─ id, booking_reference, passenger_name
├─ flight_number, seat_number
├─ booking_status, already_onboard
├─ action, additional_data (JSON), scanned_at
└─ Relationships:
   ├─ FK → accounts_user (scanned_by, nullable)
   └─ FK → core_boardingpass (nullable)

core_useractivitylog (UUID PK)
├─ id, action, ip_address, user_agent
├─ path, method, status_code
├─ timestamp, additional_data (JSON)
└─ Relationships:
   └─ FK → accounts_user (nullable)
```

---

## API Endpoints

### Authentication
```
POST   /api/auth/register/              # Create user account
POST   /api/auth/login/                 # Login with email/username
POST   /api/auth/verify-email/          # Verify email with OTP
POST   /api/auth/resend-otp/            # Resend verification code
POST   /api/auth/refresh/               # Refresh JWT token
POST   /api/auth/forgot-password/       # Request password reset
POST   /api/auth/reset-password/        # Reset password with OTP
PATCH  /api/auth/update-theme/          # Update theme preference
```

### User Profile
```
GET    /api/profile/                    # Get user profile
PUT    /api/profile/                    # Update profile
POST   /api/profile/photo/              # Upload profile photo
GET    /api/profile/completion/         # Check completion percentage
POST   /api/profile/initial-setup/      # Complete initial setup
```

### Flights
```
GET    /api/flights/                    # List/search flights
GET    /api/flights/{id}/               # Get flight details
GET    /api/flights/{id}/seats/         # Get available seats
POST   /api/admin/flights/              # Create flight (admin)
PUT    /api/admin/flights/{id}/         # Update flight (admin)
DELETE /api/admin/flights/{id}/         # Delete flight (admin)
POST   /api/admin/flights/generate_flights/        # Generate flights (async)
GET    /api/admin/flights/generation_status/{task_id}/  # Check generation progress
```

### Bookings
```
GET    /api/bookings/                   # User's bookings
POST   /api/bookings/                   # Create booking
GET    /api/bookings/{id}/              # Get booking details
PUT    /api/bookings/{id}/              # Update booking
POST   /api/bookings/{id}/select-seats/ # Select seats
POST   /api/bookings/{id}/cancel/       # Cancel booking
GET    /api/bookings/{id}/boarding-pass/ # Get boarding pass
GET    /api/bookings/{id}/boarding-pass-png/ # Download boarding pass PNG
POST   /api/bookings/{id}/initiate_payment/ # Initiate payment
```

### Agent Portal
```
GET    /api/agent/flights/              # View available flights
GET    /api/agent/bookings/             # View all bookings
POST   /api/agent/bookings/create_for_customer/ # Create booking for customer
GET    /api/agent/bookings/{id}/        # Get booking details
GET    /api/agent/bookings/{id}/boarding-pass-png/ # Download boarding pass
GET    /api/agent/scan-history/         # Get QR scan history
POST   /api/verify/qr/                  # Verify boarding pass QR
POST   /api/verify/confirm-boarding/    # Confirm/cancel boarding
```

### Admin
```
GET    /api/admin/users/                # List all users
PUT    /api/admin/users/{id}/           # Update user
GET    /api/admin/bookings/             # All bookings
GET    /api/admin/flights/              # All flights
GET    /api/admin/airlines/             # Airlines CRUD
GET    /api/admin/aircraft/             # Aircraft CRUD
GET    /api/admin/airports/             # Airports CRUD
GET    /api/admin/activity/             # Activity logs
GET    /api/admin/analytics/            # Dashboard statistics
GET    /api/admin/reports/              # Generate reports
```

### Payments
```
GET    /api/payment-providers/          # List available providers
POST   /api/payments/initiate/          # Start Pesapal payment
POST   /api/payments/ipn/               # Pesapal IPN callback
GET    /api/payments/{id}/status/       # Check payment status
```

### WebSocket
```
WS     /ws/bookings/                    # Real-time booking updates
```

---

## Key Features

### 1. Multi-Passenger Booking

Customers and agents can book flights for multiple passengers in a single transaction:

- **Passenger Types**: Adult (18+), Child (5-17), Kid (0-4)
- **Photo Requirements**: Mandatory for passengers 4+ years old
- **Individual Boarding Passes**: Each passenger receives a unique boarding pass
- **Seat Selection**: Visual airplane seat map with real-time availability
- **Passenger Details**: Full name, DOB, nationality, passport/ID, phone

### 2. VIA Routes (Multi-Stop Flights)

Support for flights with intermediate stops:

- **Route Types**: DIRECT or VIA
- **Via Cities**: JSON array of intermediate cities
- **Auto-calculated Stops**: Based on via_cities length
- **Stopover Selection**: Passengers can select stopover city during booking
- **Pricing**: Dynamic based on route complexity

### 3. Agent Portal

Dedicated interface for travel agents:

- **Create Bookings**: Book flights on behalf of registered customers
- **QR Verification**: Camera-based boarding pass scanning
- **Duplicate Detection**: Prevents same passenger boarding twice
- **Booking Management**: View and manage all bookings
- **Boarding Pass Downloads**: Generate PNG boarding passes for passengers
- **Flight Viewing**: Browse available flights

### 4. Real-time Updates

WebSocket-powered live updates:

- **Booking Status Changes**: Instant notification when booking status changes
- **Payment Confirmations**: Real-time payment status updates
- **Auto-reconnection**: Exponential backoff (3s → 6s → 12s → 24s → 48s)
- **Heartbeat**: Keeps connections alive
- **Graceful Degradation**: Shows error after 5 failed attempts

### 5. QR Code Boarding Passes

Digital boarding passes with secure QR codes:

- **Unique QR Data**: Encodes booking reference, flight, seat, passenger
- **PNG Generation**: Server-side rendering
- **Email Delivery**: Sent as attachment via Brevo
- **Agent Scanning**: Camera-based verification with html5-qrcode
- **Scan Logging**: Complete audit trail of all scans
- **Duplicate Prevention**: Detects and prevents re-boarding

### 6. Payment Processing

Multi-provider payment gateway integration:

- **Pesapal Integration**: Primary payment provider (API v3)
- **Supported Methods**: Cards, mobile money
- **IPN Callbacks**: Instant Payment Notification handling
- **Token Caching**: Access tokens cached for 57 minutes
- **IPN ID Persistence**: Cached for 30 days
- **Status Tracking**: PENDING → SUCCESS/FAILED/CANCELLED
- **Automatic Booking Update**: Booking status changes with payment

### 7. Email Service

Transaction email via Brevo API:

- **Email Verification**: 6-digit OTP codes
- **Password Reset**: OTP-based recovery
- **Boarding Pass Delivery**: PNG attachment with HTML email
- **Template System**: Professional HTML email templates
- **Fallback Support**: Gmail OAuth if Brevo unavailable

### 8. Profile Management

Comprehensive user profile system:

- **Photo Upload**: Secure upload with validation
- **Initial Setup**: Mandatory profile completion on first login
- **Theme Preference**: Light/Dark/System mode selection
- **Address Storage**: For boarding pass information
- **Completion Tracking**: Percentage-based progress

### 9. Activity Logging

Complete audit trail:

- **All Actions Tracked**: Login, logout, bookings, payments, admin actions
- **IP Risk Logging**: Blocked login attempts with reason
- **Metadata Storage**: IP address, user agent, path, method, status code
- **JSON Additional Data**: Flexible metadata storage
- **Indexed Queries**: Fast filtering by user, IP, action, timestamp

### 10. IP Risk Assessment

Fraud prevention via Fraudlogix API:

- **Real-time Checks**: Every login attempt assessed
- **Blocking Criteria**: High risk, TOR, VPN, proxy
- **Caching**: 1-hour cache to reduce API calls
- **Fail-open**: Allows login if API unavailable
- **Activity Logging**: All blocked attempts logged
- **Admin Monitoring**: View blocked attempts in activity logs

---

## Security Implementation

### Authentication & Authorization

1. **JWT Tokens**: 60-minute access tokens, 7-day refresh tokens
2. **Email Verification**: 6-digit OTP, 15-minute expiry
3. **Password Reset**: OTP-based recovery
4. **Role-Based Access**: Admin, Agent, Customer permissions
5. **UUID Primary Keys**: Prevents ID enumeration
6. **Profile Completion Middleware**: Forces setup on first login

### Data Protection

1. **Password Hashing**: Django's PBKDF2 algorithm
2. **CORS Configuration**: Restricted to frontend domains
3. **CSRF Protection**: Enabled for session auth
4. **Input Validation**: DRF serializers with field-level validation
5. **HTTPS Enforcement**: Via Cloudflare
6. **Media Access Protection**: Custom middleware blocks direct access

### IP Risk & Fraud Prevention

1. **Fraudlogix Integration**: Real-time IP assessment
2. **Blocking Rules**: High risk, TOR, VPN, proxy
3. **Activity Logging**: Complete audit trail
4. **Admin Monitoring**: View and export blocked attempts
5. **Graceful Degradation**: Fail-open on API failure

### QR Code Security

1. **Unique Codes**: Each boarding pass has unique QR data
2. **Scan Logging**: All attempts logged
3. **Duplicate Detection**: Prevents re-boarding
4. **Agent Verification**: Dedicated portal with authentication
5. **Check-in Tracking**: Per-passenger status

### Media Security

1. **External Storage**: Files outside project directory
2. **Protected Access**: Custom middleware blocks direct URLs
3. **Authenticated Loading**: ProtectedImage component uses API
4. **File Validation**: Size and type checks on upload
5. **Organized Structure**: Date-based folder organization

---

## Real-time Communication

### WebSocket Architecture

```
Client Browser
    ↓ Connects to ws://api.aerosync.live/ws/bookings/?token={jwt}
Daphne (ASGI Server, port 8001)
    ↓ Routes to BookingUpdatesConsumer
Consumer joins group: "user_{user_id}"
    ↓
Django Signal triggers (booking/payment changes)
    ↓
channel_layer.group_send("user_{id}", message) via Redis
    ↓
Consumer receives message
    ↓
Sends JSON to client via WebSocket
    ↓
BookingRealtimeContext processes update
    ↓
Custom event dispatched: 'booking-update' or 'payment-update'
    ↓
Components update UI in real-time
```

### Connection Management

**Hook: `useBookingUpdates.jsx`**
- Auto-connects when token available
- Exponential backoff reconnection
- Maximum 5 retry attempts
- Heartbeat messages every 30 seconds
- Disconnects on logout

**Context: `BookingRealtimeContext.jsx`**
- Centralized state management
- Pub/sub pattern using CustomEvent
- Subscribe to specific booking or all
- Payment update handling
- Automatic booking status sync

### Message Types

```javascript
// Booking updated
{
  type: "booking_updated",
  booking: { id, booking_status, flight, ... },
  changed_fields: ["booking_status", "updated_at"]
}

// Payment update
{
  type: "payment_update",
  payment: { id, status, provider, amount },
  booking_id: "uuid",
  booking_status: "CONFIRMED",
  changed_fields: ["status", "updated_at"]
}

// Heartbeat
{
  type: "heartbeat",
  timestamp: "2026-04-18T10:30:00Z"
}
```

---

## Payment Processing

### Pesapal Integration Flow

1. **User Initiates Payment**
   - POST `/api/bookings/{id}/initiate_payment/`
   - Body: `{ provider, amount, currency, email, phone }`

2. **Backend Creates Order**
   - Get/renew access token (cached 57 minutes)
   - Register IPN URL (cached 30 days)
   - Submit order with billing details
   - Returns: `{ order_tracking_id, redirect_url }`

3. **User Completes Payment**
   - Redirected to Pesapal payment page
   - Enters card/mobile money details
   - Pesapal processes payment

4. **IPN Callback**
   - Pesapal POSTs to `/api/payments/ipn/`
   - Body: `{ OrderTrackingId, OrderMerchantReference, PaymentStatusDescription, ... }`

5. **Backend Processes IPN**
   - Validates order reference
   - Updates Payment.status
   - Updates Booking.booking_status
   - Triggers WebSocket notification
   - Sends boarding pass email (if SUCCESS)

### Payment Status Flow

```
PENDING → User initiated payment
   ↓
SUCCESS → Payment completed
   → Booking status → CONFIRMED
   → Boarding pass generated & emailed
   ↓
FAILED → Payment declined
   → Booking status → FAILED
   → User can retry
   ↓
CANCELLED → User cancelled
   → Booking status → CANCELLED
   → Allows retry
```

### Supported Providers

1. **PESAPAL**: Primary gateway (cards, mobile money) - Active
2. **MPESA**: Direct M-Pesa - Future
3. **PAYPAL**: PayPal payments - Future
4. **STRIPE**: Stripe payments - Future
5. **CARD**: Direct credit card - Future
6. **BANK_TRANSFER**: Bank transfer - Future

---

## Theme System

### Implementation

Complete light/dark mode support using CSS custom properties:

```css
/* Light Mode (Default) */
:root {
  --background: #f8fafc;
  --surface: #ffffff;
  --text-primary: #0f172a;
  --text-secondary: #64748b;
  --border: #e2e8f0;
  --primary: #2563eb;
}

/* Dark Mode */
[data-theme='dark'] {
  --background: #0a0e17;
  --surface: #111827;
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --border: #1f2937;
  --primary: #3b82f6;
}
```

### Theme Toggle Component

```javascript
function ThemeToggle() {
  const { user, updateUserTheme } = useContext(AuthContext);
  const [theme, setTheme] = useState('LIGHT');
  
  // Apply theme to document
  const applyTheme = (themeName) => {
    if (themeName === 'DARK') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
    }
    localStorage.setItem('theme', themeName);
  };
  
  // Save to backend
  const toggleTheme = async () => {
    const newTheme = theme === 'LIGHT' ? 'DARK' : 'LIGHT';
    await API.patch('auth/update-theme/', { theme_preference: newTheme });
    updateUserTheme(newTheme);
  };
}
```

### Features

- **System-wide Application**: All components use CSS variables
- **User Persistence**: Preference saved to backend
- **Local Storage**: Fallback for non-authenticated users
- **Dynamic Switching**: Instant theme change without reload
- **Admin Pages**: Force light mode for consistency
- **Agent Portal**: Full theme support

---

## Deployment Architecture

### Production Setup

```
User Browser
    ↓ HTTPS
Cloudflare Edge (SSL, DDoS Protection, CDN)
    ↓ Encrypted Tunnel
Cloudflare Tunnel Daemon (cloudflared)
    ↓
    ├─→ Port 8000: Gunicorn (WSGI, 3 workers)
    └─→ Port 8001: Daphne (ASGI, WebSocket)
         ↓
    Django Application
         ↓
    PostgreSQL Database
         ↓
    Redis (WebSocket channel layer)
         ↓
    External Media Storage (~/aerosync-media/)
```

### Service Management

```bash
# Systemd service
sudo systemctl start aerosync
sudo systemctl stop aerosync
sudo systemctl restart aerosync
sudo systemctl status aerosync

# View logs
journalctl -u aerosync -f
journalctl -u aerosync --since "1 hour ago"
```

### Deployment Process

```bash
# 1. Update code
git pull origin main

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run migrations
python manage.py migrate

# 4. Collect static files
python manage.py collectstatic --noinput

# 5. Restart service
sudo systemctl restart aerosync

# 6. Rebuild frontend
cd aerosync-frontend
npm install
npm run build
```

### Environment Configuration

**Backend (.env):**
```bash
DJANGO_SECRET=your-secret-key
DEBUG=False
DB_NAME=aerosync
DB_USER=aerosync
DB_PASSWORD=your-password
BREVO_API_KEY=your-brevo-key
PESAPAL_CONSUMER_KEY=your-key
PESAPAL_CONSUMER_SECRET=your-secret
FRAUDLOGIX_API_KEY=your-api-key
REDIS_URL=redis://localhost:6379/0
```

**Frontend (.env):**
```bash
VITE_API_URL=https://api.aerosync.live/api/
```

---

## Performance Optimizations

### 1. Hybrid Server Architecture
- **Gunicorn**: Fast HTTP responses (~50-100ms)
- **Daphne**: WebSocket support only
- **Result**: 10-20x faster than pure ASGI

### 2. Background Task Processing
- Flight generation in background threads
- Progress tracked via Django cache
- Client polls for status
- Prevents Cloudflare 524 timeouts

### 3. Database Optimizations
- UUID primary keys (indexed)
- `bulk_create` for batch operations
- `select_related` and `prefetch_related`
- Database-level unique constraints
- Partial indexes on UserActivityLog

### 4. Caching Strategy
- **Redis**: WebSocket channel layer
- **Local Memory**: Pesapal tokens (57 min), IPN IDs (30 days)
- **JWT**: Client-side localStorage
- **Static Files**: WhiteNoise + Cloudflare CDN

### 5. Media Storage
- External directory (`~/aerosync-media/`)
- Date-based organization
- Custom middleware blocks direct access
- ProtectedImage component for authenticated loading
- Easy migration to cloud storage (S3)

### 6. WebSocket Optimization
- Redis channel layer for horizontal scaling
- Exponential backoff reconnection (3s → 48s)
- Heartbeat messages (30-second intervals)
- Maximum 5 retries before error
- Automatic disconnect on logout

### 7. Email Service
- Brevo API for fast delivery
- Server-side HTML template rendering
- In-memory boarding pass generation
- Base64 encoding for attachments
- Fallback to Gmail OAuth

### 8. Frontend Optimizations
- **React 19**: Latest with concurrent features
- **Vite 8**: Fast HMR and optimized builds
- **Axios Interceptors**: Automatic JWT refresh
- **Context API**: Centralized state management
- **Custom Events**: Pub/sub for booking updates
- **Code Splitting**: Lazy loading for routes

---

*Last Updated: April 18, 2026*  
*Version: 5.0 - Production Ready with Complete Theme Support*  
*Status: Active Development*
