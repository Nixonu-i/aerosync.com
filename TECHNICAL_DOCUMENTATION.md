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
- **Django Channels 4.2.0** - WebSocket support
- **Daphne 4.2.0** - ASGI server for WebSockets
- **Gunicorn 25.1.0** - WSGI server for HTTP requests (fast)
- **PostgreSQL** - Primary database (via psycopg 3.3.3)
- **Redis 5.2.1** - Channel layer for WebSocket scaling
- **JWT (djangorestframework-simplejwt 5.5.1)** - Token-based authentication
- **Brevo (SendInBlue)** - Email service via sib_api_v3_sdk
- **Pesapal** - Payment gateway integration (API v3)
- **QR Code (qrcode 8.2)** - Boarding pass QR generation
- **Pillow 12.1.1** - Image processing for profile photos
- **WhiteNoise 6.5.0** - Static file serving in production

**Frontend:**
- **React 19.2.0** - UI library
- **Vite 8.0.0-beta.13** - Build tool
- **React Router 7.13.1** - Client-side routing
- **Axios 1.13.5** - HTTP client
- **html5-qrcode 2.3.8** - QR code scanning for agents

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
    created_at = models.DateTimeField(auto_now_add=True)
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

class Profile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=20, choices=[('MALE', 'Male'), ('FEMALE', 'Female'), ('OTHER', 'Other')], blank=True, null=True)
    nationality = models.CharField(max_length=50, blank=True, null=True)
    phone_area_code = models.CharField(max_length=10, default='+254')
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    profile_photo = models.ImageField(upload_to=profile_photo_upload_to, blank=True, null=True)
    # Address fields for boarding passes
    address_line1, city, country, postal_code...
    initial_setup_done = models.BooleanField(default=False)
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
  └─ name, iata_code, country, is_active

Aircraft
  └─ model, total_seats, number_plate (unique)

Airport
  └─ code (IATA, unique), name, city, country

Flight
  └─ flight_number (unique), aircraft (FK→Aircraft), airline (name)
     departure_airport (FK→Airport), arrival_airport (FK→Airport)
     departure_time, arrival_time, price, status
     trip_type (ONE_WAY/ROUND_TRIP), route_type (DIRECT/VIA)
     via_cities (JSONField), stops (auto-calculated)

Seat
  └─ aircraft (FK→Aircraft), seat_number, flight_class
     is_available, price_multiplier

Booking
  └─ user (FK→User), flight (FK→Flight), confirmation_code (unique)
     total_amount, booking_status, created_by (agent/staff)
     stopover_city (for VIA flights)

Passenger
  └─ booking (FK→Booking), full_name, date_of_birth, nationality
     passenger_type (ADULT/CHILD/KID), gender, passport_number
     phone_area_code, phone_number

Payment
  └─ booking (FK→Booking), provider (MPESA/PESAPAL/PAYPAL/STRIPE/CARD/BANK_TRANSFER)
     provider_reference, payment_detail, amount, currency
     status (PENDING/SUCCESS/FAILED/CANCELLED)

BoardingPass
  └─ booking (FK→Booking), passenger (FK→Passenger), seat (FK→Seat)
     price, issued_date, qr_code_data, is_checked_in

ScanLog
  └─ scanned_by (FK→User), boarding_pass (FK→BoardingPass)
     booking_reference, passenger_name, flight_number, seat_number
     booking_status, already_onboard, scanned_at

UserActivityLog
  ├─ ACTION_CHOICES:
  │   ├─ login - User Login
  │   ├─ login_blocked - Login Blocked - IP Risk
  │   ├─ logout - User Logout
  │   ├─ profile_update - Profile Update
  │   ├─ booking_create - Booking Created
  │   ├─ booking_cancel - Booking Cancelled
  │   ├─ payment - Payment Processed
  │   ├─ api_access - API Access
  │   ├─ admin_action - Admin Action
  │   ├─ file_upload - File Upload
  │   └─ other - Other Action
  └─ Fields: user (FK→User), action, ip_address, user_agent, path, method, status_code, timestamp, additional_data (JSON)
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
    
    # Async flight generation (OPTIMIZED)
    @action(detail=False, methods=["post"], url_path="generate_flights")
    def generate_flights(self, request):
        """Returns immediately with task_id (<500ms)"""
        # 1. Quick validation (<100ms)
        airports_count = Airport.objects.count()
        if airports_count < 2:
            return Response({"error": "Need 2+ airports"}, status=400)
        
        # 2. Start background thread
        task_id = str(uuid.uuid4())
        _flight_generation_tasks[task_id] = {
            'status': 'pending',
            'task_id': task_id,
            'created_at': timezone.now().isoformat(),
            'progress': 0,
        }
        
        thread = threading.Thread(
            target=_generate_flights_background,
            args=(task_id,),
            daemon=True
        )
        thread.start()
        
        # 3. Return immediately
        return Response({
            "task_id": task_id,
            "detail": "Flight generation started"
        }, status=202)
    
    # Progress polling
    @action(detail=False, methods=["get"], url_path="generation_status/(?P<task_id>[^/.]+)")
    def generation_status(self, request, task_id=None):
        """Check async task progress"""
        if task_id not in _flight_generation_tasks:
            return Response({"detail": "Task not found."}, status=404)
        
        task_info = _flight_generation_tasks[task_id]
        return Response(task_info)

class BookingViewSet(viewsets.ModelViewSet):
    # CRUD operations
    # Payment processing
    # Seat selection
    # Boarding pass generation
```

### 8. `core/views.py` - Flight Generation (OPTIMIZED)

**Purpose:** Async flight generation with intelligent scheduling

**How it works:**

```python
def _generate_flights_background(task_id: str):
    """Generate 9 days of flights with intelligent aircraft scheduling"""
    
    # 1. Configuration
    TARGET_FLIGHTS = 1000  # Generate exactly 1000 flights
    DAYS = 9               # Generate for next 9 days
    HOURS = [6, 10, 12, 14, 16, 18, 20]  # Departure times
    
    # 2. Load data
    airports = list(Airport.objects.all())
    aircraft_list = list(Aircraft.objects.all())
    airlines_list = list(Airline.objects.filter(is_active=True))
    
    # 3. Sequential flight number generation (no collisions)
    existing_numbers = Flight.objects.filter(
        flight_number__regex=r'^AS[0-9]+$'
    ).values_list('flight_number', flat=True)
    
    max_num = 0
    for fn in existing_numbers:
        num = int(fn[2:])  # Remove "AS" prefix
        if num > max_num:
            max_num = num
    
    fn_counter = max_num + 1  # Start from next available number
    
    # 4. Aircraft scheduling tracking
    aircraft_schedule = {}  # (aircraft_id, date, hour) -> booked
    aircraft_location = {}  # (aircraft_id, date, hour) -> airport_id
    
    # Load existing flights to avoid conflicts
    existing_flights = Flight.objects.filter(...).values_list(...)
    for ac_id, dep_date, dep_hour, dep_ap_id, arr_ap_id, arr_time in existing_flights:
        aircraft_schedule[(ac_id, dep_date, dep_hour)] = True
        aircraft_location[(ac_id, dep_date, dep_hour)] = dep_ap_id
        
        # Track aircraft movement to arrival airport
        arr_date = arr_time.date()
        arr_hour = arr_time.hour
        for h in range(24):  # Mark subsequent hours at arrival airport
            aircraft_location[(ac_id, arr_date, (arr_hour + h) % 24)] = arr_ap_id
    
    # 5. Generate flights with intelligent scheduling
    BATCH_SIZE = 100  # Commit every 100 flights
    flights_batch = []
    created = 0
    skipped = 0
    
    for day_offset in range(DAYS):
        if created >= TARGET_FLIGHTS:
            break
            
        current_date = today + timedelta(days=day_offset + 1)
        
        # Randomly shuffle airport pairs for variety
        airport_pairs = list(itertools.permutations(airports, 2))
        random.shuffle(airport_pairs)
        
        for dep_ap, arr_ap in airport_pairs:
            if created >= TARGET_FLIGHTS:
                break
                
            for hour in HOURS:
                if created >= TARGET_FLIGHTS:
                    break
                
                # Find available aircraft AT THE CORRECT AIRPORT
                ac_assigned = None
                for ac in aircraft_list:
                    slot_key = (ac.id, current_date, hour)
                    
                    # Check 1: Is aircraft available?
                    if slot_key in aircraft_schedule:
                        continue
                    
                    # Check 2: Is aircraft at the correct departure airport?
                    ac_location = aircraft_location.get(slot_key)
                    if ac_location != dep_ap.id:
                        continue
                    
                    # Both checks passed - assign this aircraft
                    ac_assigned = ac
                    aircraft_schedule[slot_key] = True
                    
                    # Update aircraft location after flight
                    dur_h = 1.5 if dep_ap.country == arr_ap.country else 4.0
                    arr_dt = dep_dt + timedelta(hours=dur_h)
                    arr_date = arr_dt.date()
                    arr_hour = arr_dt.hour
                    
                    # Mark aircraft at arrival airport
                    for h in range(24):
                        aircraft_location[(ac.id, arr_date, (arr_hour + h) % 24)] = arr_ap.id
                    
                    break
                
                if ac_assigned is None:
                    skipped += 1
                    continue
                
                # Create flight
                airline = random.choice(airlines_list)
                dep_dt = timezone.make_aware(
                    datetime.combine(current_date, dt_time(hour, 0))
                )
                dur_h = 1.5 if dep_ap.country == arr_ap.country else 4.0
                arr_dt = dep_dt + timedelta(hours=dur_h)
                
                # Pricing
                base = 8_000 if dep_ap.country == arr_ap.country else 35_000
                price = max(3_000, base + random.randint(-1_000, 5_000))
                
                # Generate unique flight number
                flight_number = f"AS{fn_counter:05d}"
                fn_counter += 1
                
                flights_batch.append(Flight(
                    flight_number=flight_number,
                    aircraft=ac_assigned,
                    airline=airline.name,
                    departure_airport=dep_ap,
                    arrival_airport=arr_ap,
                    departure_time=dep_dt,
                    arrival_time=arr_dt,
                    price=price,
                    trip_type="ONE_WAY",
                    stops=0,
                    status="SCHEDULED",
                ))
                created += 1
                
                # Commit batch to database
                if len(flights_batch) >= BATCH_SIZE:
                    with transaction.atomic():
                        Flight.objects.bulk_create(flights_batch, batch_size=100)
                    flights_batch = []
                
                # Update progress
                _flight_generation_tasks[task_id]['progress'] = created
    
    # Commit remaining flights
    if flights_batch:
        with transaction.atomic():
            Flight.objects.bulk_create(flights_batch, batch_size=100)
    
    # Mark task as completed
    _flight_generation_tasks[task_id]['status'] = 'completed'
    _flight_generation_tasks[task_id]['result'] = {
        "created": created,
        "skipped": skipped,
        "days": DAYS,
    }
```

**Key Optimizations:**

1. **Sequential Flight Numbers** - No database uniqueness checks, just increment counter
   - Old: Random generation with collision checks (slow)
   - New: Sequential AS00001, AS00002, etc. (instant)

2. **VIA Routes Support** - Flights can now have intermediate stops
   - New field: `route_type` (DIRECT or VIA)
   - New field: `via_cities` (JSON array of intermediate cities)
   - Auto-calculates `stops` field based on via_cities length
   - Booking allows selecting stopover city for VIA flights

3. **Enhanced Booking Status** - More granular status tracking
   - PENDING → Payment initiated
   - CONFIRMED → Payment successful
   - COMPLETED → Flight departed
   - CANCELLED → User/admin cancelled
   - FAILED → Payment failed
   - ONBOARD → Passenger checked in

4. **Multi-Passenger Support** - Bookings can have multiple passengers
   - Each passenger gets their own boarding pass
   - Passenger details: full_name, DOB, nationality, type, gender, passport
   - Phone area code support for international numbers

5. **Payment Provider Flexibility** - Multiple payment methods
   - M-Pesa, Pesapal, PayPal, Stripe, Credit Card, Bank Transfer
   - Payment detail field stores provider-specific info (phone, email, card)
   - Unique constraint: One active payment per booking per provider

6. **Boarding Pass Enhancements** - Per-passenger boarding passes
   - Linked to specific passenger (not just booking)
   - QR code data includes passenger info
   - Individual check-in tracking (is_checked_in)
   - PNG generation and email attachment

7. **Agent/Staff Booking Creation** - Agents can book on behalf of customers
   - New field: `created_by` (FK to User, null for customer self-bookings)
   - Tracked in admin reports and activity logs

**Performance:**
- **Startup**: 0.1-0.5 seconds (load existing flight numbers)
- **Generation**: 2-5 seconds (create 1000 flights)
- **Total**: 3-6 seconds (vs. minutes or hanging before)
- **Memory**: Minimal (batched processing)
- **CPU**: Brief spike, then done

**Business Rules Enforced:**
- ✅ Unique flight numbers (sequential, no collisions)
- ✅ No aircraft double-booking (time-slot tracking)
- ✅ Aircraft location awareness (can't depart from wrong airport)
- ✅ Realistic flight durations (1.5h domestic, 4h international)
- ✅ Proper pricing (domestic ~8K KES, international ~35K KES)
- ✅ Status: SCHEDULED for new flights
- ✅ Trip type: ONE_WAY
- ✅ Departure hours: [6, 10, 12, 14, 16, 18, 20]

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
    risk_score in ['High', 'Extreme'] or
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
│   │   └── api.js              # 🔌 Axios client with JWT interceptors
│   ├── components/             # Reusable UI components
│   │   ├── AdminNavbar.jsx     # Admin navigation
│   │   ├── AgentNavbar.jsx     # Agent navigation
│   │   ├── Navbar.jsx          # Customer navigation
│   │   ├── ThemeToggle.jsx     # Light/Dark mode toggle
│   │   ├── PesapalPaymentModal.jsx  # Payment integration
│   │   ├── MultiPassengerBooking.jsx  # Single passenger booking
│   │   ├── ImprovedMultiPassengerBooking.jsx  # Enhanced multi-passenger
│   │   ├── SearchableSelect.jsx  # Dropdown with search
│   │   ├── DateOfBirthPicker.jsx  # DOB input component
│   │   └── ProtectedImage.jsx  # Secure image loading
│   ├── context/
│   │   ├── AuthContext.jsx     # 🔐 Authentication state & hooks
│   │   └── BookingRealtimeContext.jsx  # 📡 WebSocket booking updates
│   ├── hooks/
│   │   ├── useAdminUI.jsx      # Admin feature flags
│   │   └── useBookingUpdates.jsx  # WebSocket connection hook
│   ├── pages/
│   │   ├── admin/              # 👑 Admin dashboard & management
│   │   │   ├── AdminDashboard.jsx
│   │   │   ├── AdminFlights.jsx
│   │   │   ├── AdminBookings.jsx
│   │   │   ├── AdminUsers.jsx
│   │   │   ├── AdminAirlines.jsx
│   │   │   ├── AdminAircraft.jsx
│   │   │   ├── AdminAirports.jsx
│   │   │   ├── AdminActivityLogs.jsx
│   │   │   └── AdminReports.jsx
│   │   ├── agent/              # 🎫 Agent portal
│   │   │   ├── AgentDashboard.jsx
│   │   │   ├── AgentBookings.jsx
│   │   │   ├── AgentCreateBooking.jsx
│   │   │   ├── AgentFlights.jsx
│   │   │   ├── AgentProfile.jsx
│   │   │   └── AgentVerifyQR.jsx  # QR scanner for boarding passes
│   │   ├── Dashboard.jsx       # Customer dashboard
│   │   ├── Flights.jsx         # Flight search & listing
│   │   ├── Booking.jsx         # Booking flow & management
│   │   ├── Seats.jsx           # Seat selection
│   │   ├── Profile.jsx         # User profile management
│   │   ├── Login.jsx
│   │   ├── Register.jsx
│   │   ├── VerifyEmail.jsx
│   │   └── ForgotPassword.jsx
│   ├── utils/
│   │   └── errorFormatter.js   # Error message formatting
│   ├── App.jsx                 # Main app with routing
│   ├── index.css               # Global styles (Tailwind)
│   └── responsive.css          # Responsive design utilities
│
├── public/                     # Static assets & manifest
├── dist/                       # Production build
├── package.json                # Dependencies
├── vite.config.js              # Vite configuration
└── .env                        # Environment variables
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
├─ first_name (VARCHAR)
├─ last_name (VARCHAR)
├─ role (VARCHAR: ADMIN/AGENT/CUST)
├─ theme_preference (VARCHAR: LIGHT/DARK/SYSTEM)
├─ staff_id (VARCHAR, UNIQUE, nullable)
├─ is_email_verified (BOOLEAN)
├─ is_pending_verification (BOOLEAN)
├─ email_verification_code (VARCHAR(6))
├─ password_reset_code (VARCHAR(6))
├─ created_at (TIMESTAMP)
└─ password (VARCHAR, hashed)

accounts_profile (UUID PK)
├─ id (UUID, PK)
├─ user (OneToOne → accounts_user)
├─ date_of_birth (DATE, nullable)
├─ gender (VARCHAR: MALE/FEMALE/OTHER, nullable)
├─ nationality (VARCHAR, nullable)
├─ phone_area_code (VARCHAR, default +254)
├─ phone_number (VARCHAR, nullable)
├─ profile_photo (VARCHAR, path, nullable)
├─ address_line1 (VARCHAR, nullable)
├─ city (VARCHAR, nullable)
├─ country (VARCHAR, nullable)
├─ postal_code (VARCHAR, nullable)
├─ initial_setup_done (BOOLEAN)
├─ created_at (TIMESTAMP)
└─ updated_at (TIMESTAMP)

core_airline (UUID PK)
├─ id (UUID, PK)
├─ name (VARCHAR, UNIQUE)
├─ iata_code (VARCHAR(3))
├─ country (VARCHAR)
└─ is_active (BOOLEAN)

core_aircraft (UUID PK)
├─ id (UUID, PK)
├─ model (VARCHAR)
├─ total_seats (INTEGER)
└─ number_plate (VARCHAR, UNIQUE)

core_airport (UUID PK)
├─ id (UUID, PK)
├─ code (VARCHAR(3), UNIQUE, IATA)
├─ name (VARCHAR)
├─ city (VARCHAR)
└─ country (VARCHAR)

core_flight (UUID PK)
├─ id (UUID, PK)
├─ flight_number (VARCHAR, UNIQUE)
├─ aircraft (FK → core_aircraft)
├─ airline (VARCHAR, name)
├─ departure_airport (FK → core_airport)
├─ arrival_airport (FK → core_airport)
├─ departure_time (TIMESTAMP)
├─ arrival_time (TIMESTAMP)
├─ price (DECIMAL)
├─ trip_type (VARCHAR: ONE_WAY/ROUND_TRIP)
├─ route_type (VARCHAR: DIRECT/VIA)
├─ via_cities (JSON, array of city names)
├─ stops (INTEGER, auto-calculated)
└─ status (VARCHAR: SCHEDULED/DELAYED/CANCELLED/COMPLETED)

core_seat (UUID PK)
├─ id (UUID, PK)
├─ aircraft (FK → core_aircraft)
├─ seat_number (VARCHAR)
├─ flight_class (VARCHAR: ECONOMY/BUSINESS/FIRST)
├─ is_available (BOOLEAN)
└─ price_multiplier (DECIMAL)

core_booking (UUID PK)
├─ id (UUID, PK)
├─ user (FK → accounts_user)
├─ flight (FK → core_flight)
├─ created_by (FK → accounts_user, nullable, agent/staff)
├─ confirmation_code (VARCHAR, UNIQUE)
├─ total_amount (DECIMAL)
├─ booking_status (VARCHAR: PENDING/CONFIRMED/COMPLETED/CANCELLED/FAILED/ONBOARD)
├─ stopover_city (VARCHAR, nullable, for VIA flights)
└─ booking_date (TIMESTAMP)

core_passenger (UUID PK)
├─ id (UUID, PK)
├─ booking (FK → core_booking)
├─ full_name (VARCHAR)
├─ date_of_birth (DATE)
├─ nationality (VARCHAR)
├─ passenger_type (VARCHAR: ADULT/CHILD/KID)
├─ gender (VARCHAR: MALE/FEMALE/OTHER, nullable)
├─ passport_number (VARCHAR)
├─ phone_area_code (VARCHAR, default +254)
└─ phone_number (VARCHAR)

core_payment (UUID PK)
├─ id (UUID, PK)
├─ booking (FK → core_booking)
├─ provider (VARCHAR: MPESA/PESAPAL/PAYPAL/STRIPE/CARD/BANK_TRANSFER)
├─ provider_reference (VARCHAR, indexed)
├─ payment_detail (VARCHAR, nullable, provider-specific info)
├─ amount (DECIMAL)
├─ currency (VARCHAR(3), default KES)
├─ status (VARCHAR: PENDING/SUCCESS/FAILED/CANCELLED)
├─ created_at (TIMESTAMP)
└─ updated_at (TIMESTAMP)

core_boardingpass (UUID PK)
├─ id (UUID, PK)
├─ booking (FK → core_booking)
├─ passenger (FK → core_passenger)
├─ seat (FK → core_seat)
├─ price (DECIMAL)
├─ issued_date (TIMESTAMP)
├─ qr_code_data (TEXT)
└─ is_checked_in (BOOLEAN)

core_scanlog (UUID PK)
├─ id (UUID, PK)
├─ scanned_by (FK → accounts_user, nullable)
├─ boarding_pass (FK → core_boardingpass, nullable)
├─ booking_reference (VARCHAR)
├─ passenger_name (VARCHAR)
├─ flight_number (VARCHAR)
├─ seat_number (VARCHAR)
├─ booking_status (VARCHAR)
├─ already_onboard (BOOLEAN)
└─ scanned_at (TIMESTAMP)

core_useractivitylog (UUID PK)
├─ id (UUID, PK)
├─ user (FK → accounts_user, nullable)
├─ action (VARCHAR)
├─ ip_address (INET)
├─ user_agent (TEXT)
├─ path (VARCHAR)
├─ method (VARCHAR)
├─ status_code (INTEGER)
├─ timestamp (TIMESTAMP)
├─ additional_data (JSON)
└─ Indexes: (user, -timestamp), (ip_address, -timestamp), (action, -timestamp)
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
POST   /api/admin/flights/generate_flights/        # Start generation (async)
GET    /api/admin/flights/generation_status/{task_id}/  # Check progress
```

**Flight Generation Response:**

```json
// POST /api/admin/flights/generate_flights/
{
    "detail": "Flight generation started. Use the task_id to check status.",
    "task_id": "63ea4ded-49d4-4119-b1ac-f49511b02fd7"
}

// GET /api/admin/flights/generation_status/{task_id}/
{
    "task_id": "63ea4ded-49d4-4119-b1ac-f49511b02fd7",
    "status": "running",  // pending, running, completed, failed
    "created_at": "2026-04-14T04:11:24.424Z",
    "started_at": "2026-04-14T04:11:24.425Z",
    "progress": 500,        // Number of flights created
    "estimated_total": 1000 // Target number of flights
}

// When completed:
{
    "task_id": "...",
    "status": "completed",
    "completed_at": "2026-04-14T04:11:29.123Z",
    "progress": 1000,
    "result": {
        "detail": "Generated 1000 flights over 9 days.",
        "created": 1000,
        "skipped": 50,
        "days": 9,
        "airports": 10,
        "aircraft_used": 5,
        "airlines_used": 3
    }
}
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
| **Extreme Risk Score** | IP flagged with extreme fraud risk | `"Extreme risk score"` |
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
✅ **Development Friendly:** Local/private IPs bypass checks  

---

## Real-time Communication

### WebSocket Architecture

```
Client Browser (React)
    ↓ connects to ws://localhost:8000/api/ws/bookings/?token={jwt}
    ↓ (dev) or wss://api.aerosync.live/api/ws/bookings/?token={jwt} (prod)
Daphne (ASGI Server, port 8001)
    ↓ routes to BookingUpdatesConsumer
Consumer joins group: "user_{user_id}"
    ↓
Django Signal triggers (booking created/updated/payment changed)
    ↓
channel_layer.group_send("user_{id}", message)  [via Redis]
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
- Auto-connects when token is available
- Exponential backoff reconnection (3s, 6s, 12s, 24s, 48s)
- Maximum 5 retry attempts before showing error
- Heartbeat messages to keep connection alive
- Disconnects on logout

**Context: `BookingRealtimeContext.jsx`**
- Centralized state for all booking updates
- Pub/sub pattern using CustomEvent
- Subscribe to specific booking or all bookings
- Payment update handling with automatic booking status sync

### Message Types

```javascript
// Booking updated
{
  type: "booking_updated",
  booking: {
    id: "uuid",
    booking_status: "CONFIRMED",
    flight: { flight_number: "AS12345" },
    ...full booking object
  },
  changed_fields: ["booking_status", "updated_at"]
}

// Payment update
{
  type: "payment_update",
  payment: {
    id: "uuid",
    status: "SUCCESS",
    provider: "PESAPAL",
    amount: 15000
  },
  booking_id: "uuid",
  booking_status: "CONFIRMED",
  changed_fields: ["status", "updated_at"]
}

// Heartbeat (keeps connection alive)
{
  type: "heartbeat",
  timestamp: "2026-04-17T10:30:00Z"
}
```

### Usage Example

```javascript
import { useBookingRealtime } from '../context/BookingRealtimeContext';

function BookingCard({ bookingId }) {
  const { subscribeToBooking } = useBookingRealtime();
  
  useEffect(() => {
    const unsubscribe = subscribeToBooking(bookingId, (booking, changedFields) => {
      console.log('Booking updated:', booking);
      console.log('Changed fields:', changedFields);
      // Update local state
    });
    
    return unsubscribe; // Cleanup on unmount
  }, [bookingId, subscribeToBooking]);
  
  return <div>...</div>;
}
```

---

## Payment Processing

### Pesapal Integration (API v3)

**Service: `core/pesapal_service.py`**

```
1. User initiates payment
   POST /api/payments/initiate/
   Body: {booking_id, email, phone, first_name, last_name}
   ↓

2. Backend creates Pesapal order
   → Get/renew access token (cached for 57 minutes)
   → Register IPN URL (cached for 30 days)
   → Submit order with billing details
   ← Returns order_tracking_id + redirect_url
   ↓

3. User redirected to Pesapal payment page
   → User enters card/mobile money details
   ← Pesapal processes payment
   ↓

4. IPN Callback (Instant Payment Notification)
   Pesapal → POST /api/payments/ipn/
   Body: {
     OrderTrackingId,
     OrderMerchantReference,
     NotificationType,
     PaymentStatusDescription,
     PaymentMethod,
     ConfirmationCode
   }
   ↓

5. Backend processes IPN
   → Validates order reference
   → Updates Payment.status (PENDING/SUCCESS/FAILED/CANCELLED)
   → Updates Booking.booking_status based on payment status
   → Triggers WebSocket notification to user
   → Sends boarding pass email with PNG attachment (if SUCCESS)
   
6. User checks payment status
   GET /api/payments/{id}/status/
   → Backend queries Pesapal API for latest status
   ← Returns payment details and confirmation code
```

### Token & IPN Caching

```python
# Access token cached for 57 minutes (expires in 1 hour)
cache.set('pesapal_access_token', token, 3400)

# IPN ID cached for 30 days (persistent across restarts)
cache.set('pesapal_ipn_id', ipn_id, 86400 * 30)
```

### Payment Status Flow

```
PENDING → User initiated payment
   ↓
SUCCESS → Payment completed (Pesapal confirms)
   → Booking status → CONFIRMED
   → Boarding pass generated & emailed
   ↓
FAILED → Payment declined/expired
   → Booking status → FAILED
   → User can retry with new payment
   ↓
CANCELLED → User cancelled payment
   → Booking status → CANCELLED
   → Allows retry (unique constraint excludes CANCELLED)
```

### Error Handling

| Error Type | Behavior |
|-----------|----------|
| **Amount exceeds limit** | User-friendly message to contact support |
| **Authentication failed (401)** | Refresh token and retry |
| **Authorization failed (403)** | Log error, notify user |
| **Network timeout** | Return safe default, log error |
| **Invalid order ID** | Query Pesapal API for status |

### Supported Payment Providers

1. **PESAPAL** - Primary payment gateway (cards, mobile money)
2. **MPESA** - Direct M-Pesa integration (future)
3. **PAYPAL** - PayPal payments (future)
4. **STRIPE** - Stripe payments (future)
5. **CARD** - Direct credit card (future)
6. **BANK_TRANSFER** - Bank transfer (future)

**Unique Constraint:** One active payment per booking per provider
```python
models.UniqueConstraint(
    fields=['booking', 'provider'],
    name='unique_booking_payment',
    condition=~models.Q(status='CANCELLED')
)
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
# Django Core
DJANGO_SECRET=your-secret-key
DEBUG=False
DJANGO_ALLOWED_HOSTS=api.aerosync.live,127.0.0.1,localhost

# Database
DB_NAME=aerosync
DB_USER=aerosync
DB_PASSWORD=aerosync
DB_HOST=127.0.0.1
DB_PORT=5432

# Email (Brevo)
BREVO_API_KEY=xkeysib-your-api-key-here
DEFAULT_FROM_EMAIL=AeroSync <noreply@aerosync.live>

# Pesapal Payment Gateway
PESAPAL_CONSUMER_KEY=your-consumer-key
PESAPAL_CONSUMER_SECRET=your-consumer-secret
PESAPAL_ENVIRONMENT=sandbox  # or production
PESAPAL_API_URLS={"sandbox": "https://cybqa.pesapal.com/pesapalv3", "production": "https://pay.pesapal.com/v3"}
PESAPAL_CALLBACK_URL=https://api.aerosync.live/api/payments/callback/
PESAPAL_IPN_URL=https://api.aerosync.live/api/payments/ipn/

# JWT Authentication
SIMPLE_JWT_ACCESS_TOKEN_LIFETIME=timedelta(minutes=60)
SIMPLE_JWT_REFRESH_TOKEN_LIFETIME=timedelta(days=7)

# Redis (for WebSocket channel layer)
REDIS_URL=redis://localhost:6379/0

# Email Verification
EMAIL_VERIFICATION_EXPIRY_MINUTES=15
```

### `.env` (Frontend)

```bash
# Development
VITE_API_URL=http://localhost:8000/api/

# Production
VITE_API_URL=https://api.aerosync.live/api/
```

---

## Performance Optimizations

### 1. Hybrid Server Architecture
- **Gunicorn (WSGI)**: Fast HTTP responses (~50-100ms)
- **Daphne (ASGI)**: WebSocket support only
- **Result**: 10-20x faster than pure ASGI

### 2. Background Task Processing
- Flight generation runs in background thread
- Progress tracked via Django cache
- Client polls for status
- **Result**: No Cloudflare 524 timeouts

### 3. Database Optimizations
- UUID primary keys (indexed)
- `bulk_create` for batch operations
- `select_related` and `prefetch_related` for query optimization
- Database-level unique constraints
- Partial indexes on UserActivityLog for faster queries

### 4. Caching Strategy
- **Redis Cache**: WebSocket channel layer for real-time updates
- **Local Memory Cache**: Pesapal tokens (57 min), IPN IDs (30 days)
- **JWT Token Caching**: Client-side localStorage
- **Static Files**: WhiteNoise with Cloudflare CDN

### 5. Media Storage
- Files stored outside project directory (`~/aerosync-media/`)
- Organized by date: `profile_photos/2026/04/user_uuid_filename.jpg`
- Custom middleware blocks direct access (security)
- ProtectedImage component loads via authenticated API
- Easy migration to cloud storage (S3, etc.)

### 6. WebSocket Optimization
- Redis channel layer for horizontal scaling
- Exponential backoff reconnection (3s → 48s)
- Heartbeat messages to keep connections alive
- Maximum 5 retries before showing error
- Automatic disconnect on logout

### 7. Email Service Optimization
- Brevo API for fast transactional email delivery
- HTML templates rendered server-side
- Boarding pass PNG generation in-memory (no disk I/O)
- Base64 encoding for attachments
- Fallback to Gmail OAuth if Brevo unavailable

### 8. Frontend Optimizations
- **React 19**: Latest React with concurrent features
- **Vite 8**: Fast HMR and optimized builds
- **Code Splitting**: Lazy loading for admin/agent pages
- **Axios Interceptors**: Automatic JWT token refresh
- **Context API**: Centralized state for auth and real-time updates
- **Custom Events**: Pub/sub pattern for booking updates

---

## Security Features

1. **JWT Authentication**: Token-based, stateless (60-minute access tokens)
2. **Email Verification**: 6-digit OTP code, 15-minute expiry
3. **Password Reset**: OTP-based password recovery via email
4. **Role-Based Access Control**: Admin, Agent, Customer (CUST)
5. **UUID Primary Keys**: Prevents ID enumeration attacks
6. **CORS Configuration**: Restricted to frontend domains
7. **CSRF Protection**: Enabled for session auth
8. **Password Hashing**: Django's PBKDF2
9. **HTTPS Only**: Enforced via Cloudflare
10. **Input Validation**: DRF serializers with field-level validation
11. **Media Access Protection**: Custom middleware blocks direct access to profile photos
12. **Profile Completion Middleware**: Forces users to complete profile on first login
13. **Activity Logging**: All actions logged with IP, user agent, and metadata
14. **WhiteNoise**: Secure static file serving in production
15. **Protected Image Component**: Frontend component loads images via authenticated API

### Email Service Security

- **Brevo API Integration**: Transactional email via authenticated API
- **IP Authorization**: Brevo requires whitelisted server IPs
- **Fallback Support**: Can fallback to Gmail OAuth if Brevo unavailable
- **Template-Based Emails**: HTML templates for verification and boarding passes
- **Attachment Support**: Boarding passes sent as PNG attachments

### QR Code & Boarding Pass Security

- **Unique QR Data**: Each boarding pass has unique QR code with booking reference
- **Scan Logging**: Every QR scan attempt logged (successful or failed)
- **Agent Verification**: Dedicated agent portal with camera-based QR scanner
- **Check-in Tracking**: Per-passenger check-in status (is_checked_in)
- **Duplicate Detection**: Prevents same boarding pass from being scanned twice

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

1. **Mobile Push Notifications**: FCM integration for booking updates
2. **Advanced Analytics Dashboard**: Revenue tracking, popular routes, user behavior
3. **Multi-Currency Support**: Automatic currency conversion based on user location
4. **Loyalty Program**: Points system for frequent flyers
5. **Seat Preferences**: Save seat preferences for future bookings
6. **Flight Notifications**: Email/SMS alerts for flight status changes
7. **Mobile App**: React Native client for iOS and Android
8. **Advanced Search**: Filter by price range, departure time, airlines, stops
9. **Group Bookings**: Discount for booking 10+ passengers
10. **API Versioning**: `/api/v1/`, `/api/v2/` for backward compatibility
11. **Rate Limiting**: DRF throttling to prevent abuse
12. **Two-Factor Authentication**: SMS/email OTP for login
13. **Dark Mode Optimization**: Full dark mode support across all pages
14. **Internationalization**: Multi-language support (i18n)
15. **S3 Media Storage**: Cloud storage for scalability

---

## Development Guidelines

### Code Style
- Follow PEP 8 for Python
- Use ESLint for JavaScript/React
- Consistent naming: snake_case (Python), camelCase (JS/React)
- Component names: PascalCase
- Custom hooks: use prefixed with `use` (e.g., `useBookingUpdates`)

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
# Run backend tests
cd aerosync-backend
python manage.py test

# Test specific app
python manage.py test core

# Run frontend linting
cd aerosync-frontend
npm run lint

# Build frontend for production
npm run build
```

---

*Last Updated: April 17, 2026*  
*Version: 4.0 - Multi-Passenger, VIA Routes & Agent Portal*  
*Status: Production Ready*
