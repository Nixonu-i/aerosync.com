# AeroSync - Technical Documentation

## Table of Contents
1. [System Architecture](#system-architecture)
2. [Backend Structure](#backend-structure)
3. [Frontend Structure](#frontend-structure)
4. [Database Models](#database-models)
5. [API Endpoints](#api-endpoints)
6. [Key Features](#key-features)
7. [Authentication & Authorization](#authentication--authorization)
8. [IP Risk Scoring & Security](#ip-risk-scoring--security)
9. [Real-time Communication](#real-time-communication)
10. [Payment Processing](#payment-processing)
11. [Deployment](#deployment)

---

## System Architecture

### Overview
AeroSync is a full-stack flight booking system with real-time WebSocket updates, UUID-based primary keys, externalized media storage, and async task processing.

### Technology Stack

**Backend:**
- **Django 6.0.2** - Python web framework
- **Django REST Framework 3.16.1** - RESTful API
- **Django Channels** - WebSocket support
- **Daphne** - ASGI server for WebSockets
- **Gunicorn** - WSGI server for HTTP requests (fast)
- **PostgreSQL** - Primary database
- **Celery** - Background task processing (optional)
- **JWT** - Token-based authentication
- **Brevo (SendInBlue)** - Email service
- **Fraudlogix** - IP risk scoring and threat detection

**Frontend:**
- **React 19.2.0** - UI library
- **Vite** - Build tool
- **TailwindCSS** - Styling
- **React Router** - Client-side routing

**Infrastructure:**
- **Cloudflare Tunnel** - Secure HTTPS without port forwarding
- **Systemd** - Service management
- **Nginx** - Reverse proxy (local development)

### Architecture Diagram

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

---

## Backend Structure

### `/aerosync-backend/`

```
aerosync-backend/
├── aerosync/                  # Django project configuration
│   ├── __init__.py
│   ├── settings.py           # ⚙️ Main configuration file
│   ├── urls.py               # 🌐 Root URL routing
│   ├── wsgi.py               # 🚀 WSGI application (for Gunicorn)
│   └── asgi.py               # 🔌 ASGI application (for Daphne/WebSocket)
│
├── accounts/                  # 👤 User authentication & profiles
│   ├── migrations/           # Database schema changes
│   ├── services/
│   │   └── email_service.py  # 📧 Brevo email integration
│   ├── templates/emails/     # HTML email templates
│   ├── models.py             # User & Profile models
│   ├── views.py              # Authentication endpoints
│   ├── serializers.py        # Data serialization
│   ├── urls.py               # Account routes
│   ├── middleware.py         # Request processing
│   └── admin.py              # Django admin config
│
├── core/                      # ✈️ Main business logic
│   ├── management/commands/  # Custom Django commands
│   │   ├── generate_missing_seats.py
│   │   └── create_test_data.py
│   ├── migrations/           # Core app migrations
│   ├── models.py             # All business models
│   ├── views.py              # API viewsets & endpoints
│   ├── serializers.py        # Model serializers
│   ├── urls.py               # API routes
│   ├── services.py           # Business logic services
│   ├── signals.py            # Event handlers & notifications
│   ├── permissions.py        # Custom permission classes
│   ├── tasks.py              # Celery background tasks
│   ├── websocket.py          # WebSocket consumers
│   ├── flight_generator.py   # 🔄 Async flight generation
│   └── activity_views.py     # User activity tracking
│
├── media/                     # Legacy media files (deprecated)
├── ~/aerosync-media/          # ✨ New external media storage
│
├── manage.py                  # Django CLI tool
├── start.sh                   # 🚀 Server startup script
├── gunicorn_config.py         # Gunicorn configuration
├── requirements.txt           # Python dependencies
└── .env                       # Environment variables
```

---

## Key Files Explained

### 1. `aerosync/settings.py`

**Purpose:** Main Django configuration file

**Key Sections:**

```python
# Database Configuration
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'aerosync',
        'USER': 'aerosync',
        'PASSWORD': 'aerosync',
        'HOST': '127.0.0.1',
        'PORT': '5432',
    }
}
# Uses PostgreSQL with UUID support for all primary keys

# External Media Storage
MEDIA_ROOT = os.path.expanduser("~/aerosync-media/")
# Stores files outside project directory for production safety
# Organized by date: profile_photos/2026/04/user_uuid_filename.jpg

# Authentication
AUTH_USER_MODEL = 'accounts.User'
# Custom User model with UUID primary key

# REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}
# JWT authentication required for all endpoints by default

# Channels (WebSocket)
ASGI_APPLICATION = 'aerosync.asgi.application'
# Required for real-time booking updates

# Cache Configuration
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
    }
}
# Used for async task progress tracking
```

### 2. `aerosync/asgi.py`

**Purpose:** ASGI application for WebSocket support

```python
# Initializes Django ASGI application
django_asgi_app = get_asgi_application()

# Routes WebSocket connections to consumers
application = ProtocolTypeRouter({
    "http": django_asgi_app,        # Regular HTTP (not used - Gunicorn handles this)
    "websocket": AllowedHostsOriginValidator(
        AuthMiddlewareStack(
            URLRouter(websocket_urlpatterns)  # WebSocket routes
        )
    ),
})
```

**How it works:**
1. Daphne reads this file on startup
2. Routes HTTP requests to Django (backup)
3. Routes WebSocket connections to appropriate consumers
4. Authenticates WebSocket connections using JWT tokens

### 3. `aerosync/wsgi.py`

**Purpose:** WSGI application for fast HTTP requests

```python
from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()
```

**Why separate from ASGI:**
- WSGI is synchronous → **10-20x faster** for regular API calls
- ASGI has async overhead → Slower for simple requests
- Gunicorn (WSGI) handles HTTP, Daphne (ASGI) handles WebSocket

### 4. `start.sh`

**Purpose:** Server startup script

```bash
# Starts Gunicorn on port 8000 for HTTP (FAST)
gunicorn \
    --bind 127.0.0.1:8000 \
    --workers 3 \              # 3 concurrent workers
    --worker-class sync \      # Synchronous workers (fastest for CPU-bound)
    --timeout 300 \            # 5 min timeout for long requests
    aerosync.wsgi:application

# Starts Daphne on port 8001 for WebSocket only
daphne \
    --bind 127.0.0.1:8001 \
    aerosync.asgi:application

# Starts Cloudflare tunnel
cloudflared tunnel run aerosync-backend
```

**Architecture:**
- **Port 8000**: Gunicorn handles all HTTP API requests
- **Port 8001**: Daphne handles WebSocket connections
- **Cloudflare**: Routes external traffic to both ports

### 5. `accounts/models.py`

**Purpose:** User authentication and profile management

```python
class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    phone_number = models.CharField(max_length=20)
    role = models.CharField(max_length=20, choices=[
        ('ADMIN', 'Admin'),
        ('AGENT', 'Agent'),
        ('CUSTOMER', 'Customer')
    ])
    email_verified = models.BooleanField(default=False)
    date_of_birth = models.DateField()
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'phone_number', 'role', 'date_of_birth']

class Profile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    profile_photo = models.ImageField(upload_to=profile_photo_upload_to)
    phone_number = models.CharField(max_length=20)
    initial_setup_done = models.BooleanField(default=False)
    # Address fields for boarding passes
    address_line1, city, country, postal_code...
```

**How it works:**
1. UUID primary keys → Security, distributed systems friendly
2. Custom User model → Email instead of username login
3. Profile extends User → Separate table for profile data
4. Email verification → Account security
5. Role-based access → Admin, Agent, Customer permissions

### 6. `core/models.py`

**Purpose:** All business domain models

**Models Hierarchy:**

```python
Airline
  └─ name, code, country, is_active

Aircraft
  └─ tail_number, model, airline (FK→Airline), seat_configuration

Airport
  └─ iata_code, name, city, country

Flight
  └─ flight_number, aircraft (FK→Aircraft), airline
     departure_airport (FK→Airport), arrival_airport (FK→Airport)
     departure_time, arrival_time, price, status

Seat
  └─ aircraft (FK→Aircraft), seat_number, seat_class
     is_booked, is_blocked

Booking
  └─ user (FK→User), flight (FK→Flight), confirmation_code
     total_amount, status, booking_type

Passenger
  └─ booking (FK→Booking), first_name, last_name, date_of_birth

Payment
  └─ booking (FK→Booking), provider, provider_reference
     amount, status

BoardingPass
  └─ booking (FK→Booking), seat (FK→Seat), qr_code_data
     issued_at, is_scanned

ScanLog
  └─ boarding_pass (FK→BoardingPass), scanned_by (FK→User)
     scanned_at, success

UserActivityLog
  ├─ ACTION_CHOICES:
  │   ├─ login - User Login
  │   ├─ login_blocked - Login Blocked - IP Risk (NEW)
  │   ├─ logout - User Logout
  │   ├─ profile_update - Profile Update
  │   ├─ booking_create - Booking Created
  │   ├─ booking_cancel - Booking Cancelled
  │   ├─ payment - Payment Processed
  │   ├─ api_access - API Access
  │   ├─ admin_action - Admin Action
  │   ├─ file_upload - File Upload
  │   └─ other - Other Action
  └─ Fields: user (FK→User), action, ip_address, user_agent, path, method, status_code, timestamp, additional_data
```

**UUID Primary Keys:**
```python
# Every model uses UUID
id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
```

**Benefits:**
- No sequential IDs → Harder to guess booking numbers
- Globally unique → Safe for distributed systems
- No ID collision on merges

### 7. `core/views.py`

**Purpose:** API endpoints (ViewSet-based)

**Key Endpoints:**

```python
class FlightViewSet(viewsets.ModelViewSet):
    queryset = Flight.objects.all()
    serializer_class = FlightSerializer
    
    # Async flight generation
    @action(detail=False, methods=["post"], url_path="generate_flights")
    def generate_flights(self, request):
        """Returns immediately with job_id (<500ms)"""
        # 1. Quick validation (<100ms)
        airports_count = Airport.objects.count()
        if airports_count < 2:
            return Response({"error": "Need 2+ airports"}, status=400)
        
        # 2. Start background thread
        job_id = str(uuid.uuid4())
        cache.set(f'flight_gen_{job_id}', {'status': 'starting'}, 600)
        
        thread = threading.Thread(
            target=generate_flights_async,
            args=(job_id, self.DEPART_HOURS),
            daemon=True
        )
        thread.start()
        
        # 3. Return immediately
        return Response({
            "job_id": job_id,
            "status": "started"
        }, status=202)
    
    # Progress polling
    @action(detail=False, methods=["get"], url_path="generation_status/(?P<job_id>[^/.]+)")
    def generation_status(self, request, job_id):
        """Check async task progress"""
        status = cache.get(f'flight_gen_{job_id}')
        return Response(status)

class BookingViewSet(viewsets.ModelViewSet):
    # CRUD operations
    # Payment processing
    # Seat selection
    # Boarding pass generation
```

### 8. `core/flight_generator.py`

**Purpose:** Async flight generation logic

**How it works:**

```python
def generate_flights_async(job_id: str, depart_hours: list):
    """Generate 30 days of flights in background"""
    
    # 1. Update progress
    cache.set(f'flight_gen_{job_id}', {'status': 'processing', 'progress': 0}, 300)
    
    # 2. Load data
    airports = list(Airport.objects.all())
    aircraft = list(Aircraft.objects.all())
    airlines = list(Airline.objects.filter(is_active=True))
    
    # 3. Generate route cycles
    pairs = list(permutations(airports, 2))
    CYCLE = 3
    buckets = [pairs[i::CYCLE] for i in range(CYCLE)]
    
    # 4. Loop through 30 days
    for day in range(30):
        current_date = today + timedelta(days=day+1)
        pairs_today = buckets[day % CYCLE]
        
        # 5. For each route pair
        for dep_ap, arr_ap in pairs_today:
            # Find available aircraft & hour
            ac = find_available_aircraft()
            hour = find_available_hour()
            
            # Calculate times
            dep_dt = make_aware(datetime.combine(current_date, time(hour)))
            duration = 1.5h if domestic else 4.0h
            arr_dt = dep_dt + duration
            
            # Price calculation
            base = 8000 if domestic else 35000
            price = base + random(-1000, 5000)
            
            # Add to batch
            flights.append(Flight(...))
            
            # Bulk create every 100 flights
            if len(flights) >= 100:
                Flight.objects.bulk_create(flights, batch_size=50)
                flights = []
            
            # Update progress
            progress = int((day / 30) * 100)
            cache.set(f'flight_gen_{job_id}', {
                'status': 'processing',
                'progress': progress,
                'created': count
            }, 300)
    
    # 6. Final status
    cache.set(f'flight_gen_{job_id}', {
        'status': 'completed',
        'progress': 100,
        'created': total
    }, 300)
```

**Benefits:**
- Non-blocking → Returns in <500ms
- Progress tracking → Client can poll for updates
- Batch creation → Efficient database inserts
- Conflict detection → Avoids duplicate flights

### 9. `core/signals.py`

**Purpose:** Event-driven notifications

**Key Signals:**

```python
@receiver(post_save, sender=Booking)
def booking_update_signal(sender, instance, created, **kwargs):
    """Send WebSocket update when booking changes"""
    channel_layer = get_channel_layer()
    update_data = {
        'type': 'booking_updated',  # Must match handler name!
        'booking_id': str(instance.pk),
        'status': instance.status,
    }
    async_to_sync(channel_layer.group_send)(
        f"user_{instance.user_id}",
        update_data
    )
    
    # Send boarding pass email if confirmed
    if instance.status == 'CONFIRMED':
        send_boarding_pass_email(instance)

@receiver(post_save, sender=Flight)
def check_and_complete_flights(sender, instance, **kwargs):
    """Auto-complete flights that have departed"""
    if instance.departure_time < now() and instance.status == 'SCHEDULED':
        instance.status = 'COMPLETED'
        instance.save()
```

**How it works:**
1. Django triggers `post_save` signal when model is saved
2. Signal handler executes asynchronously
3. Sends WebSocket message to user's channel
4. Optionally sends email notifications

### 10. `core/websocket.py`

**Purpose:** WebSocket consumers for real-time updates

```python
class BookingUpdatesConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        """Join user-specific group"""
        self.group_name = f"user_{self.scope['user'].pk}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
    
    async def disconnect(self, close_code):
        """Leave group"""
        await self.channel_layer.group_discard(self.group_name, self.channel_name)
    
    async def booking_updated(self, event):
        """Send booking update to client"""
        await self.send(text_data=json.dumps({
            'type': 'booking_updated',
            'data': event
        }))
    
    async def payment_completed(self, event):
        """Send payment notification"""
        await self.send(text_data=json.dumps(event))
```

**Message Flow:**
```
1. Client connects to ws://api.aerosync.live/ws/bookings/
2. Consumer joins user-specific group
3. Django signal triggers when booking changes
4. Signal sends message to group via channel_layer
5. Consumer receives message and sends to client
6. Client updates UI in real-time
```

### 12. `core/ip_risk_service.py` (NEW)

**Purpose:** IP risk assessment and threat detection using Fraudlogix API

**Key Function:**

```python
def check_ip_risk(ip_address: str) -> dict:
    """
    Check IP risk score using Fraudlogix API
    
    Returns:
        dict with:
        - ip: IP address checked
        - risk_score: 'Low', 'Medium', 'High', or 'Unknown'
        - blocked: Boolean - should access be blocked?
        - block_reason: Why it was blocked (if applicable)
        - tor: Boolean - using TOR?
        - vpn: Boolean - using VPN?
        - proxy: Boolean - using proxy?
        - country: Country name
        - isp: ISP name
        - raw_data: Full API response
    """
```

**How it works:**
1. Check cache for existing result (1 hour TTL)
2. If not cached, call Fraudlogix API
3. Parse response and determine if blocked
4. Cache result for future requests
5. Return risk assessment

**Blocking Logic:**
```python
blocked = (
    risk_score == 'High' or
    using_tor or
    using_vpn or
    using_proxy
)
```

**Integration Points:**
- Called in `accounts/views.py` during login
- Results logged to `UserActivityLog`
- Admin can view blocked attempts in Activity Logs

### 13. `core/services.py`

**Purpose:** Business logic services

```python
def ensure_boarding_pass(booking: Booking, seat) -> BoardingPass:
    """Create boarding pass if doesn't exist"""
    # Check for existing
    bp = booking.boarding_passes.filter(seat=seat).first()
    if bp:
        return bp
    
    # Create new
    passenger = booking.passengers.first()
    qr_data = f"AEROSYNC|REF={booking.confirmation_code}|FLIGHT={booking.flight_id}|SEAT={seat.seat_number}|PAX={passenger.full_name}"
    
    bp = BoardingPass.objects.create(
        booking=booking,
        seat=seat,
        qr_code_data=qr_data,
    )
    return bp

def send_boarding_pass_email(booking: Booking):
    """Send HTML email with boarding pass attachment"""
    # Generate boarding pass PDF/HTML
    # Send via Brevo API
    # Include QR code
```

### 12. `core/permissions.py`

**Purpose:** Custom access control

```python
class IsAdminOrReadOnly(permissions.BasePermission):
    """Only admins can modify, everyone can read"""
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user.role == 'ADMIN'

class IsAdminUser(permissions.BasePermission):
    """Only admins"""
    def has_permission(self, request, view):
        return request.user.role == 'ADMIN'

class IsAgentOrAdmin(permissions.BasePermission):
    """Agents and admins"""
    def has_permission(self, request, view):
        return request.user.role in ['ADMIN', 'AGENT']
```

**Usage in views:**
```python
class FlightViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrReadOnly]  # Public read, admin write
    
class BookingViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]  # Only authenticated users
```

---

## Frontend Structure

### `/aerosync-frontend/`

```
aerosync-frontend/
├── src/
│   ├── api/
│   │   └── api.js              # 🔌 API client with JWT
│   ├── components/             # Reusable UI components
│   ├── context/
│   │   ├── AuthContext.jsx     # Authentication state
│   │   └── WebSocketContext.jsx # Real-time connection
│   ├── hooks/
│   │   ├── useAuth.js          # Auth hook
│   │   └── useWebSocket.js     # WebSocket hook
│   ├── pages/
│   │   ├── auth/               # Login/Register
│   │   ├── admin/              # Admin dashboard
│   │   ├── Home.jsx            # Landing page
│   │   ├── BookFlight.jsx      # Booking flow
│   │   └── MyBookings.jsx      # User bookings
│   ├── utils/
│   │   └── helpers.js          # Utility functions
│   ├── App.jsx                 # Main app component
│   └── index.css               # Global styles (Tailwind)
│
├── public/                     # Static assets
├── dist/                       # Production build
├── package.json                # Dependencies
└── vite.config.js              # Vite configuration
```

### Key Frontend Files

#### `src/api/api.js`

```javascript
// Axios instance with JWT
const api = axios.create({
  baseURL: 'https://api.aerosync.live/api/',
  timeout: 200000,  // 200 seconds for long requests
});

// Request interceptor - attach token
api.interceptors.request.use(config => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle token refresh
api.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      // Token expired, try refresh
      await refreshToken();
    }
    return Promise.reject(error);
  }
);

export default api;
```

#### `src/context/WebSocketContext.jsx`

```javascript
// WebSocket connection management
const WebSocketProvider = ({ children }) => {
  const wsRef = useRef(null);
  
  const connect = () => {
    const ws = new WebSocket('wss://api.aerosync.live/ws/bookings/');
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'booking_updated') {
        // Update bookings in real-time
        updateBookings(data.booking_id);
      }
      
      if (data.type === 'payment_completed') {
        // Show payment success notification
        showNotification('Payment successful!');
      }
    };
    
    wsRef.current = ws;
  };
  
  return (
    <WebSocketContext.Provider value={{ connect, ws: wsRef.current }}>
      {children}
    </WebSocketContext.Provider>
  );
};
```

---

## Database Models

### Complete Schema

```
accounts_user (UUID PK)
├─ id (UUID, PK)
├─ email (VARCHAR, UNIQUE)
├─ username (VARCHAR)
├─ phone_number (VARCHAR)
├─ role (VARCHAR: ADMIN/AGENT/CUSTOMER)
├─ email_verified (BOOLEAN)
├─ date_of_birth (DATE)
└─ password (VARCHAR, hashed)

accounts_profile (UUID PK)
├─ id (UUID, PK)
├─ user (OneToOne → accounts_user)
├─ profile_photo (VARCHAR, path)
├─ initial_setup_done (BOOLEAN)
├─ address_line1 (VARCHAR)
├─ city (VARCHAR)
├─ country (VARCHAR)
└─ postal_code (VARCHAR)

core_airline (UUID PK)
├─ id (UUID, PK)
├─ name (VARCHAR)
├─ code (VARCHAR)
├─ country (VARCHAR)
└─ is_active (BOOLEAN)

core_aircraft (UUID PK)
├─ id (UUID, PK)
├─ tail_number (VARCHAR)
├─ model (VARCHAR)
├─ airline (FK → core_airline)
└─ seat_configuration (JSON)

core_airport (UUID PK)
├─ id (UUID, PK)
├─ iata_code (VARCHAR)
├─ name (VARCHAR)
├─ city (VARCHAR)
└─ country (VARCHAR)

core_flight (UUID PK)
├─ id (UUID, PK)
├─ flight_number (VARCHAR)
├─ aircraft (FK → core_aircraft)
├─ airline (VARCHAR)
├─ departure_airport (FK → core_airport)
├─ arrival_airport (FK → core_airport)
├─ departure_time (TIMESTAMP)
├─ arrival_time (TIMESTAMP)
├─ price (DECIMAL)
├─ status (VARCHAR: SCHEDULED/COMPLETED/CANCELLED)
├─ trip_type (VARCHAR: ONE_WAY/ROUND_TRIP)
└─ stops (INTEGER)

core_seat (UUID PK)
├─ id (UUID, PK)
├─ aircraft (FK → core_aircraft)
├─ seat_number (VARCHAR)
├─ seat_class (VARCHAR: FIRST/BUSINESS/ECONOMY)
├─ is_booked (BOOLEAN)
└─ is_blocked (BOOLEAN)

core_booking (UUID PK)
├─ id (UUID, PK)
├─ user (FK → accounts_user)
├─ flight (FK → core_flight)
├─ confirmation_code (VARCHAR)
├─ total_amount (DECIMAL)
├─ status (VARCHAR: PENDING/CONFIRMED/CANCELLED)
├─ booking_type (VARCHAR)
└─ created_at (TIMESTAMP)

core_passenger (UUID PK)
├─ id (UUID, PK)
├─ booking (FK → core_booking)
├─ first_name (VARCHAR)
├─ last_name (VARCHAR)
└─ date_of_birth (DATE)

core_payment (UUID PK)
├─ id (UUID, PK)
├─ booking (FK → core_booking)
├─ provider (VARCHAR: PESAPAL)
├─ provider_reference (VARCHAR)
├─ amount (DECIMAL)
└─ status (VARCHAR: PENDING/COMPLETED/FAILED)

core_boardingpass (UUID PK)
├─ id (UUID, PK)
├─ booking (FK → core_booking)
├─ seat (FK → core_seat)
├─ qr_code_data (TEXT)
├─ issued_at (TIMESTAMP)
└─ is_scanned (BOOLEAN)

core_scanlog (UUID PK)
├─ id (UUID, PK)
├─ boarding_pass (FK → core_boardingpass)
├─ scanned_by (FK → accounts_user)
├─ scanned_at (TIMESTAMP)
└─ success (BOOLEAN)

core_useractivitylog (UUID PK)
├─ id (UUID, PK)
├─ user (FK → accounts_user)
├─ action (VARCHAR)
├─ ip_address (VARCHAR)
├─ user_agent (TEXT)
└─ timestamp (TIMESTAMP)
```

---

## API Endpoints

### Authentication
```
POST   /api/auth/register/          # Create user
POST   /api/auth/login/             # Login, get JWT
POST   /api/auth/verify-email/      # Verify email
POST   /api/auth/resend-otp/        # Resend verification
POST   /api/auth/refresh/           # Refresh JWT
POST   /api/auth/forgot-password/   # Request reset
POST   /api/auth/reset-password/    # Reset with code
```

### User Profile
```
GET    /api/profile/                # Get profile
PUT    /api/profile/                # Update profile
POST   /api/profile/photo/          # Upload photo
GET    /api/profile/completion/     # Check completion %
POST   /api/profile/initial-setup/  # Complete setup
```

### Flights
```
GET    /api/flights/                # List flights
POST   /api/flights/                # Create flight (admin)
GET    /api/flights/{id}/           # Get flight
PUT    /api/flights/{id}/           # Update flight
DELETE /api/flights/{id}/           # Delete flight
POST   /api/flights/generate_flights/        # Start generation (async)
GET    /api/flights/generation_status/{job_id}/  # Check progress
```

### Bookings
```
GET    /api/bookings/               # User's bookings
POST   /api/bookings/               # Create booking
GET    /api/bookings/{id}/          # Get booking
PUT    /api/bookings/{id}/          # Update booking
POST   /api/bookings/{id}/select-seats/   # Select seats
POST   /api/bookings/{id}/cancel/   # Cancel booking
GET    /api/bookings/{id}/boarding-pass/  # Get boarding pass
```

### Payments
```
POST   /api/payments/initiate/      # Start Pesapal payment
POST   /api/payments/ipn/           # Pesapal callback
GET    /api/payments/{id}/status/   # Check payment status
```

### Admin
```
GET    /api/admin/users/            # List all users
GET    /api/admin/bookings/         # All bookings
GET    /api/admin/activity/         # Activity logs
GET    /api/admin/analytics/        # Dashboard stats
```

### WebSocket
```
WS     /ws/bookings/                # Real-time booking updates
```

---

## Authentication & Authorization

### JWT Flow

```
1. User registers
   POST /api/auth/register/
   ↓
   Returns: {access_token, refresh_token}

2. User logs in
   POST /api/auth/login/
   Body: {email/username, password}
   ↓
   CustomTokenObtainPairView.post():
   a. Extract client IP address
   b. Check IP risk via Fraudlogix API
   c. If blocked (High risk/TOR/VPN/Proxy):
      → Return 403 Forbidden
      → Log as 'login_blocked'
   d. If safe:
      → Verify email verification status
      → Generate JWT tokens
      → Log successful login with IP metadata
   ↓
   Returns: {access_token, refresh_token}

3. User makes API request
   Headers: {Authorization: "Bearer <access_token>"}
   ↓
   JWTAuthentication validates token

4. Token expires (5 minutes)
   POST /api/auth/refresh/
   Headers: {Authorization: "Bearer <refresh_token>"}
   ↓
   Returns: {new_access_token}
```

### Role-Based Access

```python
# Admin: Full access
- Manage flights, airlines, aircraft
- View all bookings
- Manage users
- Analytics

# Agent: Limited admin
- Create bookings
- View bookings
- Cannot delete flights

# Customer: Personal access
- View own bookings
- Make payments
- View boarding passes
```

---

## IP Risk Scoring & Security

### Overview
AeroSync integrates with **Fraudlogix API** to provide real-time IP risk assessment and threat detection during login attempts. This security layer protects the platform from high-risk connections, anonymization services, and potential fraud.

### Security Features

#### 1. **IP Risk Assessment**
- Every login attempt triggers an IP risk check
- Results are cached for 1 hour to reduce API calls
- Risk metadata is logged for audit purposes

#### 2. **Blocking Criteria**
Login attempts are **automatically blocked** if ANY of the following conditions are met:

| Threat Type | Description | Block Reason |
|------------|-------------|--------------|
| **High Risk Score** | IP flagged with high fraud risk | `"High risk score"` |
| **TOR Usage** | Connection through TOR network | `"TOR usage detected"` |
| **VPN Usage** | Connection through VPN service | `"VPN usage detected"` |
| **Proxy Usage** | Connection through proxy server | `"Proxy usage detected"` |

#### 3. **Implementation Architecture**

```
┌─────────────────────────────────────────────────────────┐
│                   User Login Attempt                    │
│              POST /api/accounts/login/                  │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│        CustomTokenObtainPairView.post()                 │
│  1. Extract client IP address                           │
│  2. Call check_ip_risk(ip_address)                      │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│         IP Risk Service (ip_risk_service.py)            │
│  1. Check cache for existing result                     │
│  2. If not cached:                                      │
│     → Call Fraudlogix API                               │
│     → GET https://iplist.fraudlogix.com/v5?ip={ip}      │
│     → Headers: x-api-key: {API_KEY}                     │
│  3. Parse response                                      │
│  4. Determine if blocked                                │
│  5. Cache result for 1 hour                             │
└───────────────────┬─────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
        ▼                       ▼
   BLOCKED                  ALLOWED
        │                       │
        ▼                       ▼
┌──────────────┐      ┌──────────────────┐
│ Return 403   │      │ Continue login   │
│ Log attempt  │      │ Log with IP info │
│ No details   │      │ Return tokens    │
└──────────────┘      └──────────────────┘
```

### API Integration

#### Fraudlogix API Request

```python
# core/ip_risk_service.py

def check_ip_risk(ip_address: str) -> dict:
    """Check IP risk score using Fraudlogix API"""
    
    # Check cache first
    cache_key = f'ip_risk_{ip_address}'
    cached_result = cache.get(cache_key)
    if cached_result:
        return cached_result
    
    # Make API request
    headers = {
        'x-api-key': settings.FRAUDLOGIX_API_KEY,
        'Content-Type': 'application/json'
    }
    
    response = requests.get(
        'https://iplist.fraudlogix.com/v5',
        params={'ip': ip_address},
        headers=headers,
        timeout=5
    )
    
    return parse_response(response.json())
```

#### API Response Example

```json
{
    "IP": "192.168.1.100",
    "RecentlySeen": 27,
    "RiskScore": "Low",
    "MaskedDevices": true,
    "Proxy": false,
    "TOR": false,
    "VPN": false,
    "DataCenter": false,
    "SearchEngineBot": false,
    "AbnormalTraffic": false,
    "ASN": "19281",
    "Organization": "Quad9",
    "ISP": "Quad9",
    "City": "",
    "Country": "United States",
    "CountryCode": "US",
    "Region": "",
    "Timezone": "America/Chicago",
    "ConnectionType": "Residential"
}
```

### Activity Logging

#### Blocked Login Attempts

When a login is blocked, the system creates an activity log entry:

```python
UserActivityLog.objects.create(
    user=None,  # No user yet, they're blocked
    action='login_blocked',
    ip_address=client_ip,
    user_agent=request.META.get('HTTP_USER_AGENT', ''),
    path='/api/accounts/login/',
    method='POST',
    status_code=403,
    additional_data={
        'ip_risk_score': 'High',
        'block_reason': 'High risk score',
        'tor': False,
        'vpn': False,
        'proxy': False,
        'country': 'United States',
        'isp': 'Quad9'
    }
)
```

#### Successful Logins

Successful logins also include IP risk metadata:

```python
UserActivityLog.objects.create(
    user=user,
    action='login',
    ip_address=client_ip,
    additional_data={
        'ip_risk_score': 'Low',
        'ip_country': 'United States',
        'ip_isp': 'Quad9',
        'ip_tor': False,
        'ip_vpn': False
    }
)
```

### Configuration

#### Environment Variables

```bash
# .env file
FRAUDLOGIX_API_KEY=your_api_key_here
```

**Important:** The API key is stored in environment variables, NOT in code, for security.

#### Cache Configuration

- **Cache Duration:** 1 hour (3600 seconds)
- **Cache Key Format:** `ip_risk_{ip_address}`
- **Purpose:** Reduces API calls and improves response time

### Admin Monitoring

#### Activity Logs Interface

Admins can monitor IP risk events in the Activity Logs page:

1. **Filter by Action:** Select "Login Blocked" to view blocked attempts
2. **View Details:** Click "Show" to see full IP risk metadata
3. **Export CSV:** Download logs for analysis

#### Blocked Login Badge

- **Color:** Red background (`#fee2e2`) with dark red text (`#991b1b`)
- **Label:** "login blocked"
- **Visibility:** Clearly distinguishes blocked attempts from successful logins

### Error Handling

The system gracefully handles API failures:

| Error Type | Behavior |
|-----------|----------|
| **API Timeout** | Allow login, log warning |
| **API Error** | Allow login, log error |
| **Missing API Key** | Log warning, allow login |
| **Network Error** | Allow login, log error |

**Rationale:** Fail-open approach ensures legitimate users aren't blocked if the security service is unavailable.

### Security Benefits

✅ **Fraud Prevention:** Blocks high-risk IP addresses  
✅ **Anonymization Detection:** Prevents TOR, VPN, and proxy usage  
✅ **Audit Trail:** All attempts logged with full metadata  
✅ **Real-time Protection:** Checks happen before authentication  
✅ **Performance:** Cached results reduce latency  
✅ **Resilient:** Graceful degradation on API failures  
✅ **Admin Visibility:** Full monitoring and export capabilities  

---

## Real-time Communication

### WebSocket Architecture

```
Client Browser
    ↓ connects to wss://api.aerosync.live/ws/bookings/
Daphne (ASGI Server, port 8001)
    ↓ routes to BookingUpdatesConsumer
Consumer joins group: "user_{user_id}"
    ↓
Django Signal triggers (booking created/updated)
    ↓
channel_layer.group_send("user_{id}", message)
    ↓
Consumer receives message
    ↓
Sends JSON to client via WebSocket
    ↓
Client updates UI in real-time
```

### Message Types

```javascript
// Booking updated
{
  type: "booking_updated",
  booking_id: "uuid",
  status: "CONFIRMED",
  flight: {number: "AS12345"}
}

// Payment completed
{
  type: "payment_completed",
  booking_id: "uuid",
  payment_id: "uuid",
  amount: 15000
}

// Seat availability
{
  type: "seat_availability",
  flight_id: "uuid",
  seats: [{number: "1A", class: "FIRST", booked: false}]
}
```

---

## Payment Processing

### Pesapal Integration

```
1. User initiates payment
   POST /api/payments/initiate/
   Body: {booking_id, email, phone}
   ↓

2. Backend creates Pesapal order
   → Calls Pesapal API
   ← Returns order_id + redirect_url
   ↓

3. User redirected to Pesapal
   → User enters card/mobile money
   ← Pesapal processes payment
   ↓

4. IPN Callback
   Pesapal → POST /api/payments/ipn/
   Body: {order_id, status, amount}
   ↓

5. Backend updates payment
   → Updates Payment.status = "COMPLETED"
   → Updates Booking.status = "CONFIRMED"
   → Triggers WebSocket notification
   → Sends boarding pass email
```

---

## Deployment

### Local Development

```bash
# Start backend
cd aerosync-backend
source venv/bin/activate
bash start.sh

# Start frontend
cd aerosync-frontend
npm run dev

# Access
Frontend: http://localhost:5173
Backend:  http://127.0.0.1:8000
```

### Production Deployment

```bash
# 1. Pull latest code
git pull origin main

# 2. Install dependencies
pip install -r requirements.txt
npm install

# 3. Run migrations
python manage.py migrate

# 4. Collect static files
python manage.py collectstatic --noinput

# 5. Restart service
sudo systemctl restart aerosync

# 6. Rebuild frontend
npm run build
```

### Service Management

```bash
# Start/stop/restart
sudo systemctl start aerosync
sudo systemctl stop aerosync
sudo systemctl restart aerosync

# Check status
sudo systemctl status aerosync
journalctl -u aerosync -f

# View logs
journalctl -u aerosync --since "1 hour ago"
```

---

## Environment Variables

### `.env` (Backend)

```bash
# Django
SECRET_KEY=your-secret-key
DEBUG=False
ALLOWED_HOSTS=api.aerosync.live,127.0.0.1

# Database
DB_NAME=aerosync
DB_USER=aerosync
DB_PASSWORD=aerosync
DB_HOST=127.0.0.1
DB_PORT=5432

# Email (Brevo)
BREVO_API_KEY=your-brevo-api-key
BREVO_SENDER_EMAIL=noreply@aerosync.live
BREVO_SENDER_NAME=AeroSync

# Pesapal
PESAPAL_CONSUMER_KEY=your-key
PESAPAL_CONSUMER_SECRET=your-secret
PESAPAL_CALLBACK_URL=https://api.aerosync.live/api/payments/ipn/

# JWT
JWT_SECRET_KEY=your-jwt-secret
JWT_ACCESS_TOKEN_LIFETIME=5
JWT_REFRESH_TOKEN_LIFETIME=7
```

### `.env` (Frontend)

```bash
VITE_API_URL=https://api.aerosync.live/api/
VITE_WS_URL=wss://api.aerosync.live/ws/
```

---

## Performance Optimizations

### 1. Hybrid Server Architecture
- **Gunicorn (WSGI)**: Fast HTTP responses (~50-100ms)
- **Daphne (ASGI)**: WebSocket support only
- **Result**: 10-20x faster than pure ASGI

### 2. Async Task Processing
- Flight generation runs in background thread
- Progress tracked via Django cache
- Client polls for status
- **Result**: No Cloudflare 524 timeouts

### 3. Database Optimizations
- UUID primary keys (indexed)
- `bulk_create` for batch operations
- `select_related` and `prefetch_related` for query optimization
- Database-level unique constraints

### 4. Caching
- Local memory cache for async task progress
- JWT token caching (implicit via client storage)
- Static files via Cloudflare CDN

### 5. Media Storage
- Files stored outside project directory
- Organized by date: `~/aerosync-media/profile_photos/2026/04/`
- Easy migration to cloud storage (S3, etc.)

---

## Security Features

1. **JWT Authentication**: Token-based, stateless
2. **Email Verification**: Confirms user identity
3. **Role-Based Access Control**: Admin, Agent, Customer
4. **UUID Primary Keys**: Prevents ID enumeration attacks
5. **CORS Configuration**: Restricted to frontend domain
6. **CSRF Protection**: Enabled for session auth
7. **Password Hashing**: Django's PBKDF2
8. **HTTPS Only**: Enforced via Cloudflare
9. **Input Validation**: DRF serializers
10. **Rate Limiting**: (Optional via DRF throttling)

---

## Troubleshooting

### Common Issues

**524 Timeout Error:**
```
Cause: Cloudflare timeout (100s) waiting for origin
Fix: Now using async generation with progress polling
```

**WebSocket Not Connecting:**
```bash
# Check Daphne is running on port 8001
ps aux | grep daphne

# Check firewall
sudo ufw status

# Test WebSocket
wscat -c ws://127.0.0.1:8001/ws/bookings/
```

**Database Connection Error:**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check credentials
cat .env | grep DB_

# Test connection
PGPASSWORD=aerosync psql -h 127.0.0.1 -U aerosync -d aerosync
```

**Media Files Not Found:**
```bash
# Check external storage exists
ls -la ~/aerosync-media/

# Check permissions
chmod 755 ~/aerosync-media/
```

---

## Future Enhancements

1. **Celery/RQ Integration**: More robust background tasks
2. **Redis Cache**: Distributed caching
3. **S3 Media Storage**: Cloud storage for media files
4. **Elasticsearch**: Advanced flight search
5. **Mobile App**: React Native client
6. **Multi-language Support**: i18n
7. **Advanced Analytics**: Data warehouse integration
8. **Push Notifications**: FCM integration
9. **Email Templates**: Markdown-based templates
10. **API Versioning**: `/api/v1/`, `/api/v2/`

---

## Development Guidelines

### Code Style
- Follow PEP 8 for Python
- Use ESLint for JavaScript
- Consistent naming: snake_case (Python), camelCase (JS)

### Git Workflow
```bash
# Create feature branch
git checkout -b feature/new-feature

# Commit changes
git add .
git commit -m "feat: add new feature"

# Push and create PR
git push origin feature/new-feature
```

### Testing
```bash
# Run tests
python manage.py test

# Test specific app
python manage.py test core

# With coverage
coverage run manage.py test
coverage report
```

---

## Contributors

- Backend: Django + PostgreSQL
- Frontend: React + Vite + TailwindCSS
- Infrastructure: Cloudflare + Systemd
- Documentation: This file

---

*Last Updated: April 3, 2026*  
*Version: 2.0*  
*Status: Production Ready*
