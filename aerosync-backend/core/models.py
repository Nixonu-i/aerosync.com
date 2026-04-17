from django.conf import settings
from django.db import models
from accounts.models import User
from django.core.validators import RegexValidator
from django.core.exceptions import ValidationError
import uuid
import os

# Constants for passenger photo validation
PASSENGER_PHOTO_MAX_SIZE = 2 * 1024 * 1024  # 2MB
PASSENGER_PHOTO_ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp']

def passenger_photo_upload_to(instance, filename):
    """Upload passenger photos for boarding verification"""
    from django.utils import timezone
    now = timezone.now()
    base, ext = os.path.splitext(filename)
    ext = ext.lower()
    
    # Use booking ID and passenger ID if available
    booking_id = instance.booking.pk if instance.booking else 'unknown'
    passenger_id = instance.passenger.pk if instance.passenger else 'unknown'
    
    return os.path.join(
        'passenger_photos',
        f"{now.year}",
        f"{now.month:02d}",
        f"booking_{booking_id}_passenger_{passenger_id}_{uuid.uuid4().hex[:8]}{ext}"
    )

def validate_passenger_photo_size(file):
    """Validate passenger photo file size"""
    if file.size > PASSENGER_PHOTO_MAX_SIZE:
        raise ValidationError(
            f'File size must be under {PASSENGER_PHOTO_MAX_SIZE // (1024*1024)}MB'
        )

def validate_passenger_photo_extension(file):
    """Validate passenger photo file extension"""
    ext = os.path.splitext(file.name)[1].lower()
    if ext not in PASSENGER_PHOTO_ALLOWED_EXTENSIONS:
        raise ValidationError(
            f'Unsupported file type. Allowed: {", ".join(PASSENGER_PHOTO_ALLOWED_EXTENSIONS)}'
        )


class Airline(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150, unique=True)
    iata_code = models.CharField(max_length=3, blank=True, default="")
    country = models.CharField(max_length=100, blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.iata_code})" if self.iata_code else self.name


class Aircraft(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    model = models.CharField(max_length=120)
    total_seats = models.PositiveIntegerField()
    number_plate = models.CharField(max_length=50, unique=True)
    
    def __str__(self):
        return f"{self.model} ({self.number_plate})"


class Airport(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=3, unique=True)
    name = models.CharField(max_length=200)
    city = models.CharField(max_length=100)
    country = models.CharField(max_length=100)
    
    def __str__(self):
        return f"{self.code} - {self.name}, {self.city}, {self.country}"


class Flight(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    TRIP_TYPE_CHOICES = [
        ('ONE_WAY', 'One Way'),
        ('ROUND_TRIP', 'Round Trip'),
    ]
    
    ROUTE_TYPE_CHOICES = [
        ('DIRECT', 'Direct'),
        ('VIA', 'Via'),
    ]
    
    STATUS_CHOICES = [
        ('SCHEDULED', 'Scheduled'),
        ('DELAYED', 'Delayed'),
        ('CANCELLED', 'Cancelled'),
        ('COMPLETED', 'Completed'),
    ]
    
    aircraft = models.ForeignKey(Aircraft, on_delete=models.PROTECT, related_name='flights')
    airline = models.CharField(max_length=100)
    flight_number = models.CharField(max_length=20, unique=True, blank=True)
    departure_airport = models.ForeignKey(Airport, on_delete=models.CASCADE, related_name='departures')
    arrival_airport = models.ForeignKey(Airport, on_delete=models.CASCADE, related_name='arrivals')
    departure_time = models.DateTimeField()
    arrival_time = models.DateTimeField()
    price = models.DecimalField(max_digits=10, decimal_places=2)
    trip_type = models.CharField(max_length=20, choices=TRIP_TYPE_CHOICES, default='ONE_WAY')
    route_type = models.CharField(max_length=20, choices=ROUTE_TYPE_CHOICES, default='DIRECT')
    via_cities = models.JSONField(default=list, blank=True, help_text="Ordered list of intermediate cities for VIA flights")
    stops = models.IntegerField(default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='SCHEDULED')

    @property
    def flight_path(self):
        """Returns complete ordered list: [origin] + via_cities + [destination]"""
        return [self.departure_airport.city] + self.via_cities + [self.arrival_airport.city]
    
    @property
    def intermediate_cities(self):
        """Returns only the intermediate cities (for stopover selection)"""
        return self.via_cities if self.route_type == 'VIA' else []

    def _generate_flight_number(self):
        import random, string
        while True:
            candidate = "AS" + "".join(random.choices(string.digits, k=4))
            if not Flight.objects.filter(flight_number=candidate).exists():
                return candidate

    def save(self, *args, **kwargs):
        if not self.flight_number:
            self.flight_number = self._generate_flight_number()
        
        # Auto-update stops field based on via_cities for backward compatibility
        if self.route_type == 'VIA':
            self.stops = len(self.via_cities)
        else:
            self.stops = 0
            self.via_cities = []
        
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.flight_number}: {self.departure_airport.code} → {self.arrival_airport.code}"


class Seat(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    FLIGHT_CLASS_CHOICES = [
        ('ECONOMY', 'Economy'),
        ('BUSINESS', 'Business'),
        ('FIRST', 'First'),
    ]
    
    aircraft = models.ForeignKey(Aircraft, on_delete=models.CASCADE, related_name='seats')
    seat_number = models.CharField(max_length=10)  # e.g., '1A', '2B'
    flight_class = models.CharField(max_length=20, choices=FLIGHT_CLASS_CHOICES, default='ECONOMY')
    is_available = models.BooleanField(default=True)
    price_multiplier = models.DecimalField(max_digits=3, decimal_places=2, default=1.00)
    
    class Meta:
        unique_together = ('aircraft', 'seat_number')  # Each seat number is unique per aircraft
    
    def __str__(self):
        return f"{self.aircraft.number_plate} - {self.seat_number}"


class Booking(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    BOOKING_STATUS_CHOICES = [
        ('PENDING', 'Pending Payment'),
        ('CONFIRMED', 'Confirmed'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
        ('FAILED', 'Failed'),
        ('ONBOARD', 'On Board'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    flight = models.ForeignKey(Flight, on_delete=models.CASCADE)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="agent_bookings",
        help_text="Agent or staff who created this booking on behalf of the customer.",
    )
    booking_date = models.DateTimeField(auto_now_add=True)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    booking_status = models.CharField(max_length=20, choices=BOOKING_STATUS_CHOICES, default='PENDING')
    confirmation_code = models.CharField(max_length=20, unique=True)
    stopover_city = models.CharField(max_length=100, blank=True, null=True, help_text="Selected stopover city for VIA flights")
    
    def save(self, *args, **kwargs):
        # Generate confirmation code if not set
        if not self.confirmation_code:
            import random
            import string
            self.confirmation_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=10))
        
        # Auto-calculate total_amount from flight price if not provided
        if not self.total_amount and self.flight:
            self.total_amount = self.flight.price
        
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"Booking {self.confirmation_code} - {self.user.username}"
    
    def has_successful_payment(self):
        """Check if booking has at least one successful payment"""
        return self.payments.filter(status='SUCCESS').exists()
    
    def update_status_based_on_payment_and_flight(self, save=True):
        """
        Automatically update booking status based on payment status and flight status.
        
        Rules:
        1. If flight is COMPLETED and booking has SUCCESS payment → booking status = CONFIRMED
        2. If flight is COMPLETED and NO successful payment → booking status = FAILED
        3. If flight is not COMPLETED, keep current status (don't downgrade)
        
        Returns True if status was changed, False otherwise.
        """
        from django.utils import timezone
        
        old_status = self.booking_status
        new_status = old_status
        
        # Only process if flight status is COMPLETED
        if self.flight.status == 'COMPLETED':
            if self.has_successful_payment():
                # Flight completed + paid = confirmed booking
                new_status = 'CONFIRMED'
            else:
                # Flight completed but not paid = failed booking
                new_status = 'FAILED'
        
        # Don't change status if it's already correct or if we'd be downgrading unnecessarily
        if new_status != old_status:
            # Prevent downgrading from better statuses
            status_priority = {
                'ONBOARD': 5,
                'CONFIRMED': 4,
                'PENDING': 3,
                'CANCELLED': 2,
                'FAILED': 1,
            }
            
            # Only update if new status is equal or better than current
            if status_priority.get(new_status, 0) >= status_priority.get(old_status, 0):
                self.booking_status = new_status
                if save:
                    self.save(update_fields=['booking_status'])
                return True
        
        return False


class Passenger(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    PASSENGER_TYPE_CHOICES = [
        ('ADULT', 'Adult'),
        ('CHILD', 'Child'),
        ('KID', 'Kid'),
    ]
    
    GENDER_CHOICES = [
        ('MALE', 'Male'),
        ('FEMALE', 'Female'),
        ('OTHER', 'Other'),
    ]
    
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name='passengers')
    full_name = models.CharField(max_length=200)
    date_of_birth = models.DateField()
    nationality = models.CharField(max_length=50)
    passenger_type = models.CharField(max_length=20, choices=PASSENGER_TYPE_CHOICES, default='ADULT')
    gender = models.CharField(max_length=20, choices=GENDER_CHOICES, blank=True, null=True)
    passport_number = models.CharField(max_length=50, blank=True, default="")
    phone_area_code = models.CharField(max_length=10, default="+254")
    phone_number = models.CharField(max_length=20)
    
    def __str__(self):
        return f"{self.full_name} - {self.passenger_type}"


class Payment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    PAYMENT_STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('SUCCESS', 'Success'),
        ('FAILED', 'Failed'),
        ('CANCELLED', 'Cancelled'),
    ]
    
    PAYMENT_PROVIDER_CHOICES = [
        ('MPESA', 'M-Pesa'),
        ('PAYPAL', 'PayPal'),
        ('STRIPE', 'Stripe'),
        ('CARD', 'Credit Card'),
        ('BANK_TRANSFER', 'Bank Transfer'),
        ('PESAPAL', 'Pesapal'),
    ]
    
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name='payments')
    provider = models.CharField(max_length=20, choices=PAYMENT_PROVIDER_CHOICES)
    provider_reference = models.CharField(max_length=100, blank=True, db_index=True)
    payment_detail = models.CharField(
        max_length=255, blank=True, null=True,
        help_text="Phone (M-Pesa), email (PayPal), masked card (Card), bank ref (Bank Transfer)"
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default='KES')
    status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='PENDING')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        # Each booking can only have ONE active Pesapal payment at a time
        # (excludes CANCELLED payments to allow retries after cancellation)
        constraints = [
            models.UniqueConstraint(
                fields=['booking', 'provider'],
                name='unique_booking_payment',
                condition=~models.Q(status='CANCELLED')
            )
        ]
    
    def __str__(self):
        return f"Payment {self.provider} - {self.amount} ({self.status})"


class BoardingPass(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name='boarding_passes')
    passenger = models.ForeignKey(Passenger, on_delete=models.CASCADE, related_name='boarding_passes')
    seat = models.ForeignKey(Seat, on_delete=models.CASCADE, related_name='boarding_passes')
    price = models.DecimalField(max_digits=10, decimal_places=2)
    issued_date = models.DateTimeField(auto_now_add=True)
    qr_code_data = models.TextField(blank=True)
    is_checked_in = models.BooleanField(default=False)  # per-passenger check-in status
    passenger_photo = models.ImageField(
        upload_to=passenger_photo_upload_to,
        blank=True,
        null=True,
        validators=[validate_passenger_photo_size, validate_passenger_photo_extension],
        help_text="Passenger photo for boarding verification (required for adults & children 4+)"
    )
    
    def __str__(self):
        return f"Boarding Pass - {self.passenger.full_name} - {self.booking.confirmation_code}"


class ScanLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    """Persistent record of every QR scan attempt by an agent/admin."""
    scanned_by   = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="scan_logs",
    )
    boarding_pass = models.ForeignKey(
        BoardingPass,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="scan_logs",
    )
    booking_reference = models.CharField(max_length=50, blank=True)
    passenger_name    = models.CharField(max_length=255, blank=True)
    flight_number     = models.CharField(max_length=20, blank=True)
    seat_number       = models.CharField(max_length=10, blank=True)
    booking_status    = models.CharField(max_length=20, blank=True)
    already_onboard   = models.BooleanField(default=False)
    scanned_at        = models.DateTimeField(auto_now_add=True)
    additional_data   = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-scanned_at"]

    def __str__(self):
        return f"ScanLog [{self.scanned_at}] {self.passenger_name} by {self.scanned_by}"


class UserActivityLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    """Model to store user activity logs in database"""
    
    ACTION_CHOICES = [
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
        ('other', 'Other Action'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    action = models.CharField(max_length=50, choices=ACTION_CHOICES)
    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField(blank=True)
    path = models.CharField(max_length=500)
    method = models.CharField(max_length=10)
    status_code = models.IntegerField()
    timestamp = models.DateTimeField(auto_now_add=True)
    additional_data = models.JSONField(default=dict, blank=True)
    
    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['user', '-timestamp']),
            models.Index(fields=['ip_address', '-timestamp']),
            models.Index(fields=['action', '-timestamp']),
        ]
    
    def __str__(self):
        user_display = self.user.username if self.user else 'Anonymous'
        return f"{user_display} - {self.action} - {self.timestamp}"