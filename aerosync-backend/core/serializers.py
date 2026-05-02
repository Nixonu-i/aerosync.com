from rest_framework import serializers
from .models import Airport, Seat, Flight, Booking, Passenger, Payment, BoardingPass, Aircraft, Airline
from accounts.models import User as UserAccount


class AirlineSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(read_only=True)
    
    class Meta:
        model = Airline
        fields = ["id", "name", "iata_code", "country", "is_active"]


class AirportSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(read_only=True)
    
    class Meta:
        model = Airport
        fields = ["id", "name", "city", "country", "code"]


class PassengerSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(read_only=True)
    booking = serializers.PrimaryKeyRelatedField(read_only=True)
    
    class Meta:
        model = Passenger
        fields = [
            "id", "booking", "full_name", "date_of_birth", "nationality", 
            "passenger_type", "gender", "passport_number", 
            "phone_area_code", "phone_number"
        ]


class BoardingPassSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(read_only=True)
    booking = serializers.PrimaryKeyRelatedField(read_only=True)
    passenger = serializers.PrimaryKeyRelatedField(read_only=True)
    seat = serializers.PrimaryKeyRelatedField(read_only=True)
    passenger_photo_url = serializers.SerializerMethodField()
    
    class Meta:
        model = BoardingPass
        fields = [
            "id", "booking", "passenger", "seat", "price", 
            "issued_date", "qr_code_data", "is_checked_in", 
            "passenger_photo", "passenger_photo_url"
        ]
        extra_kwargs = {
            'passenger_photo': {'required': False, 'allow_null': True}
        }
    
    def get_passenger_photo_url(self, obj):
        """Return the URL for the passenger photo"""
        try:
            if obj.passenger_photo:
                request = self.context.get('request')
                url = f"/api/auth/media/{obj.passenger_photo.name}"
                if request:
                    return request.build_absolute_uri(url)
                return url
        except (AttributeError, ValueError, TypeError):
            pass
        return None


class SeatSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(read_only=True)
    aircraft = serializers.PrimaryKeyRelatedField(read_only=True)
    
    class Meta:
        model = Seat
        fields = ["id", "aircraft", "seat_number", "flight_class", "is_available", "price_multiplier"]


class FlightSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(read_only=True)
    aircraft = serializers.PrimaryKeyRelatedField(read_only=True)
    departure_airport = serializers.PrimaryKeyRelatedField(read_only=True)
    arrival_airport = serializers.PrimaryKeyRelatedField(read_only=True)
    departure_airport_name = serializers.CharField(source="departure_airport.name", read_only=True)
    arrival_airport_name = serializers.CharField(source="arrival_airport.name", read_only=True)
    departure_airport_city = serializers.CharField(source="departure_airport.city", read_only=True)
    arrival_airport_city = serializers.CharField(source="arrival_airport.city", read_only=True)
    departure_airport_code = serializers.CharField(source="departure_airport.code", read_only=True)
    arrival_airport_code = serializers.CharField(source="arrival_airport.code", read_only=True)
    flight_path = serializers.ReadOnlyField()
    intermediate_cities = serializers.ReadOnlyField()
    
    class Meta:
        model = Flight
        fields = [
            "id", "aircraft", "airline", "flight_number", "departure_airport", "arrival_airport",
            "departure_time", "arrival_time", "price", "trip_type", "route_type", "via_cities", "stops", "status",
            "departure_airport_name", "arrival_airport_name", 
            "departure_airport_city", "arrival_airport_city",
            "departure_airport_code", "arrival_airport_code",
            "flight_path", "intermediate_cities"
        ]


class PaymentSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(read_only=True)
    booking = serializers.SerializerMethodField()
    
    def get_booking(self, obj):
        return str(obj.booking.id) if obj.booking else None
    
    class Meta:
        model = Payment
        fields = [
            "id", "booking", "provider", "provider_reference", 
            "amount", "currency", "status", "created_at", "updated_at"
        ]


class BookingSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(read_only=True)
    user = serializers.PrimaryKeyRelatedField(read_only=True)
    passengers = PassengerSerializer(many=True, read_only=True)
    boarding_passes = BoardingPassSerializer(many=True, read_only=True)
    flight = FlightSerializer(read_only=True)
    
<<<<<<< HEAD
    class Meta:
        model = Booking
        fields = ["id", "user", "flight", "booking_date", "total_amount", "booking_status", "confirmation_code", "passengers", "boarding_passes"]
=======
    # Additional computed fields
    flight_name = serializers.CharField(source="flight.flight_number", read_only=True)
    airline_name = serializers.CharField(source="flight.airline.name", read_only=True)
    route = serializers.SerializerMethodField()
    departure = serializers.CharField(source="flight.departure_airport.code", read_only=True)
    arrival = serializers.CharField(source="flight.arrival_airport.code", read_only=True)
    flight_date = serializers.DateTimeField(source="flight.departure_time", read_only=True)
    seat_numbers = serializers.SerializerMethodField()
    
    def get_route(self, obj):
        if obj.flight:
            dep_code = obj.flight.departure_airport.code if obj.flight.departure_airport else ""
            arr_code = obj.flight.arrival_airport.code if obj.flight.arrival_airport else ""
            return f"{dep_code} → {arr_code}"
        return None
    
    def get_seat_numbers(self, obj):
        # Collect all seat numbers from boarding passes
        seats = []
        for bp in obj.boarding_passes.all():
            if bp.seat and bp.seat.seat_number:
                seats.append(bp.seat.seat_number)
        return seats if seats else []
    
    class Meta:
        model = Booking
        fields = [
            "id", "user", "flight", "booking_date", "total_amount", 
            "booking_status", "confirmation_code", "passengers", "boarding_passes",
            "flight_name", "airline_name", "route", "departure", "arrival", 
            "flight_date", "seat_numbers", "stopover_city"
        ]
>>>>>>> 9007297460809f07bfaa364ef37dd6359fbbe48b


class CreateBookingSerializer(serializers.Serializer):
    flight_id = serializers.UUIDField()
    seat_assignments = serializers.ListField(
        child=serializers.DictField(
            child=serializers.CharField()
        )
    )
    passengers = serializers.ListField(
        child=serializers.DictField(
            child=serializers.CharField(allow_blank=True)
        )
    )
    stopover_city = serializers.CharField(required=False, allow_blank=True)
    
    def validate(self, data):
        """Validate passenger data including date of birth"""
        from datetime import date
        
        passengers = data.get('passengers', [])
        
        for i, passenger in enumerate(passengers):
            dob = passenger.get('date_of_birth')
            if not dob:
                raise serializers.ValidationError({
                    "passengers": f"Passenger {i+1}: Date of birth is required."
                })
            try:
                birth_date = date.fromisoformat(dob)
                today = date.today()
                if birth_date >= today:
                    raise serializers.ValidationError({
                        "passengers": f"Passenger {i+1}: Date of birth cannot be today or in the future."
                    })
            except ValueError:
                raise serializers.ValidationError({
                    "passengers": f"Passenger {i+1}: Invalid date format."
                })
        
        return data
    
    def create(self, validated_data):
        # This method won't be used since we handle creation in the view
        pass
    
    def update(self, instance, validated_data):
        # This method won't be used since we handle creation in the view
        pass


class PaySerializer(serializers.Serializer):
    provider = serializers.ChoiceField(choices=['MPESA', 'PAYPAL', 'STRIPE', 'CARD'])
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    currency = serializers.CharField(default='KES')


# ─── Admin Serializers ─────────────────────────────────────────────────────────

class AircraftSerializer(serializers.ModelSerializer):
    class Meta:
        model = Aircraft
        fields = ["id", "model", "total_seats", "number_plate"]


class FlightAdminSerializer(serializers.ModelSerializer):
    departure_airport_name = serializers.CharField(source="departure_airport.name", read_only=True)
    arrival_airport_name = serializers.CharField(source="arrival_airport.name", read_only=True)
    departure_airport_code = serializers.CharField(source="departure_airport.code", read_only=True)
    arrival_airport_code = serializers.CharField(source="arrival_airport.code", read_only=True)
    departure_airport_city = serializers.CharField(source="departure_airport.city", read_only=True)
    arrival_airport_city = serializers.CharField(source="arrival_airport.city", read_only=True)
    aircraft_model = serializers.CharField(source="aircraft.model", read_only=True)
    aircraft_plate = serializers.CharField(source="aircraft.number_plate", read_only=True)
    flight_path = serializers.ReadOnlyField()

    class Meta:
        model = Flight
        fields = [
            "id", "airline", "flight_number",
            "aircraft", "aircraft_model", "aircraft_plate",
            "departure_airport", "arrival_airport",
            "departure_time", "arrival_time", "price",
            "trip_type", "route_type", "via_cities", "stops", "status",
            "departure_airport_name", "arrival_airport_name",
            "departure_airport_city", "arrival_airport_city",
            "departure_airport_code", "arrival_airport_code",
            "flight_path",
        ]
        read_only_fields = ["flight_number"]
    
    def validate(self, data):
        """Validate flight dates and times"""
        from django.utils import timezone
        
        departure_time = data.get('departure_time')
        arrival_time = data.get('arrival_time')
        
        # If updating, get existing values for fields not in data
        if self.instance:
            departure_time = departure_time or self.instance.departure_time
            arrival_time = arrival_time or self.instance.arrival_time
        
        # Validate departure time is in the future
        if departure_time:
            now = timezone.now()
            if departure_time <= now:
                raise serializers.ValidationError({
                    "departure_time": "Departure date and time must be in the future."
                })
        
        # Validate arrival time is after departure time
        if departure_time and arrival_time:
            if arrival_time <= departure_time:
                raise serializers.ValidationError({
                    "arrival_time": "Arrival date and time must be after departure date and time."
                })
        
        return data


class AdminBookingSerializer(serializers.ModelSerializer):
    passengers = PassengerSerializer(many=True, read_only=True)
    flight_number = serializers.CharField(source="flight.flight_number", read_only=True)
    departure_code = serializers.CharField(source="flight.departure_airport.code", read_only=True)
    arrival_code = serializers.CharField(source="flight.arrival_airport.code", read_only=True)
    flight_departure_time = serializers.DateTimeField(source="flight.departure_time", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    payment_status = serializers.SerializerMethodField()
    payment_id = serializers.SerializerMethodField()
    payment_amount = serializers.SerializerMethodField()
    flight_route_type = serializers.CharField(source="flight.route_type", read_only=True)
    flight_via_cities = serializers.JSONField(source="flight.via_cities", read_only=True)

    def get_payment_status(self, obj):
        p = obj.payments.order_by("-created_at").first()
        return p.status if p else None

    def get_payment_id(self, obj):
        p = obj.payments.order_by("-created_at").first()
        return p.id if p else None

    def get_payment_amount(self, obj):
        p = obj.payments.order_by("-created_at").first()
        return str(p.amount) if p else None

    class Meta:
        model = Booking
        fields = [
            "id", "user", "username", "flight", "flight_number",
            "departure_code", "arrival_code", "flight_departure_time",
            "booking_date", "total_amount", "booking_status",
            "confirmation_code", "passengers", "stopover_city",
            "payment_status", "payment_id", "payment_amount",
            "flight_route_type", "flight_via_cities",
        ]


class AdminUserSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    profile_photo_url = serializers.SerializerMethodField()
    
    class Meta:
        model = UserAccount
        fields = ["id", "username", "email", "full_name", "first_name", "last_name",
                  "role", "is_active", "is_staff", "is_superuser", "date_joined", "staff_id", "profile_photo_url"]
        read_only_fields = ["id", "username", "date_joined", "is_superuser", "staff_id"]
    
    def get_profile_photo_url(self, obj):
        try:
            profile = obj.profile
            if profile.profile_photo:
                # Return the protected media URL that requires authentication
                request = self.context.get("request")
                # Build the relative path to the protected media endpoint
                protected_url = f"/api/auth/media/{profile.profile_photo.name}"
                if request:
                    return request.build_absolute_uri(protected_url)
                return protected_url
            return None
        except (AttributeError, ValueError, TypeError):
            # Handle any potential errors accessing the profile photo URL
            return None