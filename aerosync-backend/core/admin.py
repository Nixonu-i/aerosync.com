from django.contrib import admin
from .models import Aircraft, Airport, Seat, Flight, Booking, Passenger, Payment, BoardingPass, Airline, UserActivityLog


@admin.register(Airline)
class AirlineAdmin(admin.ModelAdmin):
    list_display = ["name", "iata_code", "country", "is_active"]
    list_filter = ["is_active", "country"]
    search_fields = ["name", "iata_code", "country"]
    list_editable = ["is_active"]


@admin.register(Aircraft)
class AircraftAdmin(admin.ModelAdmin):
    list_display = ["model", "number_plate", "total_seats"]
    search_fields = ["model", "number_plate"]
    list_filter = ["model"]


@admin.register(Airport)
class AirportAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "city", "country"]
    search_fields = ["code", "name", "city", "country"]



@admin.register(Seat)
class SeatAdmin(admin.ModelAdmin):
    list_display = ["aircraft", "seat_number", "flight_class", "price_multiplier", "is_available"]
    list_filter = ["flight_class", "is_available", "aircraft__model"]
    list_editable = ["price_multiplier"]
    search_fields = ["seat_number", "aircraft__number_plate"]



@admin.register(Flight)
class FlightAdmin(admin.ModelAdmin):
    list_display = ["id", "airline", "flight_number", "departure_airport", "arrival_airport", "departure_time", "arrival_time", "price", "stops", "trip_type", "status"]
    list_filter = ["status", "trip_type", "stops", "departure_time", "airline"]
    search_fields = ["id", "flight_number", "airline", "departure_airport__code", "arrival_airport__code"]
    readonly_fields = []
    fields = ["aircraft", "airline", "flight_number", "departure_airport", "arrival_airport", "departure_time", "arrival_time", "price", "trip_type", "stops", "status"]



@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ["confirmation_code", "user", "flight", "booking_status", "total_amount", "booking_date"]
    list_filter = ["booking_status", "booking_date", "flight__departure_time"]
    search_fields = ["confirmation_code", "user__username", "user__email"]
    readonly_fields = ["total_amount", "booking_date"]
    
    def passenger_count(self, obj):
        return obj.passengers.count()
    passenger_count.short_description = "Passengers"



@admin.register(Passenger)
class PassengerAdmin(admin.ModelAdmin):
    list_display = ["full_name", "passenger_type", "passport_number", "booking", "phone_number"]
    list_filter = ["passenger_type", "gender"]
    search_fields = ["full_name", "passport_number", "booking__confirmation_code", "phone_number"]



@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ["booking", "provider", "status", "payment_detail", "amount", "currency", "created_at"]
    list_filter = ["status", "provider", "created_at"]
    search_fields = ["booking__confirmation_code", "booking__user__username", "provider_reference", "payment_detail"]
    readonly_fields = ["created_at", "updated_at"]

    def save_model(self, request, obj, form, change):
        # Bank Transfer cannot be marked SUCCESS without a bank reference in payment_detail
        if obj.provider == 'BANK_TRANSFER' and obj.status == 'SUCCESS':
            if not obj.payment_detail or not obj.payment_detail.strip():
                from django.contrib import messages
                self.message_user(
                    request,
                    "Bank Transfer payment cannot be marked as SUCCESS without a bank reference number. "
                    "Please fill in the 'Payment detail' field with the bank transfer reference first.",
                    level=messages.ERROR,
                )
                return  # abort save
        super().save_model(request, obj, form, change)



@admin.register(BoardingPass)
class BoardingPassAdmin(admin.ModelAdmin):
    list_display = ["booking", "passenger", "seat", "price", "issued_date"]
    list_filter = ["issued_date"]
    search_fields = ["booking__confirmation_code", "passenger__full_name", "seat__seat_number"]


@admin.register(UserActivityLog)
class UserActivityLogAdmin(admin.ModelAdmin):
    list_display = ["user", "action", "ip_address", "timestamp", "status_code"]
    list_filter = ["action", "timestamp", "status_code", "user"]
    search_fields = ["user__username", "ip_address", "user_agent", "path"]
    readonly_fields = ["timestamp", "additional_data"]
    date_hierarchy = "timestamp"
    
    def has_add_permission(self, request):
        return False  # Prevent manual addition of logs
    
    def has_change_permission(self, request, obj=None):
        return False  # Prevent editing of logs
    
    def has_delete_permission(self, request, obj=None):
        return False  # Prevent deletion of logs
