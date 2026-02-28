from rest_framework import serializers
from .models import Airport, Seat, Flight, Booking, Passenger, Payment, BoardingPass, Aircraft, Airline
from accounts.models import User as UserAccount


class AirlineSerializer(serializers.ModelSerializer):
    class Meta:
        model = Airline
        fields = ["id", "name", "iata_code", "country", "is_active"]


class AirportSerializer(serializers.ModelSerializer):
    class Meta:
        model = Airport
        fields = ["id", "name", "city", "country", "code"]


class PassengerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Passenger
        fields = [
            "id", "booking", "full_name", "date_of_birth", "nationality", 
            "passenger_type", "gender", "passport_number", 
            "phone_area_code", "phone_number"
        ]


class BoardingPassSerializer(serializers.ModelSerializer):
    class Meta:
        model = BoardingPass
        fields = [
            "id", "booking", "passenger", "seat", "price", 
            "issued_date", "qr_code_data"
        ]


class SeatSerializer(serializers.ModelSerializer):
    class Meta:
        model = Seat
        fields = ["id", "aircraft", "seat_number", "flight_class", "is_available", "price_multiplier"]


class FlightSerializer(serializers.ModelSerializer):
    departure_airport_name = serializers.CharField(source="departure_airport.name", read_only=True)
    arrival_airport_name = serializers.CharField(source="arrival_airport.name", read_only=True)
    departure_airport_city = serializers.CharField(source="departure_airport.city", read_only=True)
    arrival_airport_city = serializers.CharField(source="arrival_airport.city", read_only=True)
    departure_airport_code = serializers.CharField(source="departure_airport.code", read_only=True)
    arrival_airport_code = serializers.CharField(source="arrival_airport.code", read_only=True)
    
    class Meta:
        model = Flight
        fields = [
            "id", "airline", "flight_number", "departure_airport", "arrival_airport",
            "departure_time", "arrival_time", "price", "trip_type", "stops", "status",
            "departure_airport_name", "arrival_airport_name", 
            "departure_airport_city", "arrival_airport_city",
            "departure_airport_code", "arrival_airport_code"
        ]


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = [
            "id", "booking", "provider", "provider_reference", 
            "amount", "currency", "status", "created_at", "updated_at"
        ]


class BookingSerializer(serializers.ModelSerializer):
    passengers = PassengerSerializer(many=True, read_only=True)
    boarding_passes = BoardingPassSerializer(many=True, read_only=True)
    flight = FlightSerializer(read_only=True)
    
    class Meta:
        model = Booking
        fields = ["id", "user", "flight", "booking_date", "total_amount", "booking_status", "confirmation_code", "passengers", "boarding_passes"]


class CreateBookingSerializer(serializers.Serializer):
    flight_id = serializers.IntegerField()
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

    class Meta:
        model = Flight
        fields = [
            "id", "airline", "flight_number",
            "aircraft", "aircraft_model", "aircraft_plate",
            "departure_airport", "arrival_airport",
            "departure_time", "arrival_time", "price",
            "trip_type", "stops", "status",
            "departure_airport_name", "arrival_airport_name",
            "departure_airport_city", "arrival_airport_city",
            "departure_airport_code", "arrival_airport_code",
        ]
        read_only_fields = ["flight_number"]


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
            "confirmation_code", "passengers",
            "payment_status", "payment_id", "payment_amount",
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
                return profile.profile_photo.url
            return None
        except (AttributeError, ValueError, TypeError):
            # Handle any potential errors accessing the profile photo URL
            return None