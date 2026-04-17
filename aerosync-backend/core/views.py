import random
import string
import json
import time
import threading
from datetime import datetime, date, timedelta, time as dt_time
from decimal import Decimal

from django.db import transaction
from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.http import StreamingHttpResponse, HttpResponse

from .models import Airport, Seat, Flight, Booking, Passenger, Payment, BoardingPass, User, Aircraft, Airline, ScanLog
from accounts.models import User as UserAccount
from .serializers import (
    AirportSerializer, SeatSerializer, FlightSerializer, FlightAdminSerializer,
    BookingSerializer, PaymentSerializer, BoardingPassSerializer,
    CreateBookingSerializer, PaySerializer,
    AircraftSerializer, AdminBookingSerializer, AdminUserSerializer,
    AirlineSerializer,
)
from .permissions import IsAdmin, IsAgentOrAdmin, IsAgent
from .services import make_qr_png_base64, ensure_boarding_pass, build_boarding_pass_png


class FlightPagePagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100


class FlightViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Flight.objects.select_related("departure_airport", "arrival_airport").all()
    serializer_class = FlightSerializer
    permission_classes = [permissions.AllowAny]  # Public access - no auth required
    pagination_class = FlightPagePagination

    def list(self, request, *args, **kwargs):
        # Ensure past flights are marked COMPLETED before returning results
        from core.tasks import mark_completed_flights
        mark_completed_flights()
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        qs = super().get_queryset()
        
        # Exclude completed flights from public view
        qs = qs.exclude(status='COMPLETED')
        
        dep = self.request.query_params.get("departure_code")
        arr = self.request.query_params.get("arrival_code")
        date = self.request.query_params.get("date")
        
        # City filter parameters
        from_city = self.request.query_params.get("from_city")
        to_city = self.request.query_params.get("to_city")
        
        # New filter parameters
        min_price = self.request.query_params.get("min_price")
        max_price = self.request.query_params.get("max_price")
        trip_type = self.request.query_params.get("trip_type")
        route_type = self.request.query_params.get("route_type")
        via_city = self.request.query_params.get("via_city")
        airline = self.request.query_params.get("airline")

        if dep:
            qs = qs.filter(departure_airport__code__iexact=dep)
        if arr:
            qs = qs.filter(arrival_airport__code__iexact=arr)
        if from_city:
            qs = qs.filter(departure_airport__city__iexact=from_city)
        if to_city:
            qs = qs.filter(arrival_airport__city__iexact=to_city)
        if date:
            # filter by departure date (YYYY-MM-DD)
            qs = qs.filter(departure_time__date=date)
        
        # Apply new filters
        if min_price:
            qs = qs.filter(price__gte=min_price)
        if max_price:
            qs = qs.filter(price__lte=max_price)
        if trip_type:
            qs = qs.filter(trip_type=trip_type)
        if route_type:
            qs = qs.filter(route_type=route_type)
        if via_city:
            # Filter flights where via_cities contains the specified city
            qs = qs.filter(route_type='VIA', via_cities__contains=[via_city])
        if airline:
            qs = qs.filter(airline__icontains=airline)
            
        return qs.order_by("departure_time")

    @action(detail=True, methods=["get"], url_path="seats")
    def seats(self, request, pk=None):
        flight = self.get_object()
        all_seats = Seat.objects.filter(aircraft=flight.aircraft).order_by("seat_number")

        # booked seats (confirmed bookings)
        booked_seat_ids = set(
            BoardingPass.objects.filter(booking__flight=flight, booking__booking_status='CONFIRMED')
            .values_list("seat_id", flat=True)
        )

        data = []
        for s in all_seats:
            data.append({
                "seat_id": s.id,
                "seat_number": s.seat_number,
                "seat_class": s.flight_class,
                "available": s.id not in booked_seat_ids,
                "price_multiplier": str(s.price_multiplier),
                # Actual price for this seat = flight base price × multiplier
                "seat_price": str((flight.price * s.price_multiplier).quantize(Decimal('0.01'))),
            })
        return Response(data)

    @action(detail=False, methods=["get"], url_path="cities")
    def cities(self, request):
        # Get unique departure cities
        departure_cities = Flight.objects.select_related('departure_airport') \
            .values_list('departure_airport__city', flat=True).distinct().order_by('departure_airport__city')
        
        # Get unique arrival cities
        arrival_cities = Flight.objects.select_related('arrival_airport') \
            .values_list('arrival_airport__city', flat=True).distinct().order_by('arrival_airport__city')
        
        # Combine and deduplicate
        all_cities = sorted(set(list(departure_cities) + list(arrival_cities)))
        
        return Response({
            "departure_cities": sorted(set(departure_cities)),
            "arrival_cities": sorted(set(arrival_cities)),
            "all_cities": all_cities
        })

    @action(detail=False, methods=['get'], url_path='via-cities')
    def via_cities(self, request):
        """Return unique cities from all VIA flights' via_cities"""
        via_flights = Flight.objects.filter(route_type='VIA').values_list('via_cities', flat=True)
        all_cities = set()
        for cities in via_flights:
            if cities:
                all_cities.update(cities)
        return Response(sorted(list(all_cities)))


class BookingViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = BookingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Booking.objects.filter(user=self.request.user).select_related(
            "flight", "flight__departure_airport", "flight__arrival_airport"
        ).prefetch_related("passengers")

    @action(detail=False, methods=["post"], url_path="create_booking")
    def create_booking(self, request):
        ser = CreateBookingSerializer(data=request.data)
        if not ser.is_valid():
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"CreateBooking validation errors: {ser.errors}")
            logger.error(f"Request data: {request.data}")
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        flight = Flight.objects.select_related("departure_airport", "arrival_airport").get(id=data["flight_id"])
        
        # Check if flight is SCHEDULED
        if flight.status != 'SCHEDULED':
            return Response({"detail":"This flight is not available for booking. Only SCHEDULED flights can be booked."}, status=400)
        
        passenger_data = data["passengers"]
        seat_assignments = data["seat_assignments"]
        stopover_city = data.get("stopover_city", "").strip()
        
        # Validate stopover city for VIA flights
        if flight.route_type == 'VIA':
            if not stopover_city:
                return Response({
                    "detail": "Stopover city is required for VIA flights. Please select a stopover city from the available options."
                }, status=400)
            if stopover_city not in flight.via_cities:
                return Response({
                    "detail": f"Invalid stopover city '{stopover_city}'. Must be one of: {', '.join(flight.via_cities)}"
                }, status=400)
        else:
            # For DIRECT flights, ignore stopover_city if provided
            stopover_city = ""
        
        # CONSTRAINT 1: Prevent user from booking the same flight twice (unless multi-passenger)
        # Check if user already has a booking for this flight
        existing_booking_for_flight = Booking.objects.filter(
            user=request.user,
            flight=flight
        ).exclude(booking_status='CANCELLED').first()
        
        if existing_booking_for_flight:
            # Check if this is a multi-passenger booking (more than 1 passenger or not for_self)
            is_multi_passenger = len(passenger_data) > 1 or not request.data.get("for_self", False)
            
            # If it's a single passenger booking for self and user already has a booking for this flight
            if not is_multi_passenger:
                return Response({
                    "detail": "You already have a booking for this flight. You cannot book the same flight twice unless booking for multiple passengers."
                }, status=400)
        
        # CONSTRAINT 2: Prevent user from booking flights that depart at the same time
        # Skip this check for multi-passenger bookings (booking for others)
        is_multi_passenger = len(passenger_data) > 1 or not request.data.get("for_self", False)
        
        if not is_multi_passenger:
            # Get all active bookings for this user and check for conflicting departure times
            user_bookings = Booking.objects.filter(
                user=request.user
            ).exclude(
                booking_status='CANCELLED'
            ).select_related('flight')
            
            # Check if any existing booking has a flight departing at the same time (within 1 hour window)
            for existing_booking in user_bookings:
                existing_flight = existing_booking.flight
                time_diff = abs((existing_flight.departure_time - flight.departure_time).total_seconds())
                
                # If flights depart within 1 hour of each other, reject the booking
                if time_diff < 3600:  # 3600 seconds = 1 hour
                    return Response({
                        "detail": f"You already have a booking for a flight departing around the same time ({existing_flight.departure_time.strftime('%Y-%m-%d %H:%M')}). You cannot book overlapping flights."
                    }, status=400)
        
        # Validate seat assignments
        seat_assignments = data["seat_assignments"]
        passenger_data = data["passengers"]

        # --- Server-side profile field validation (tamper prevention) ---
        if request.user.role == "CUST" and request.data.get("for_self") is True:
            try:
                profile = request.user.profile
                submitted = passenger_data[0] if passenger_data else {}
                mismatches = []

                if profile.date_of_birth and str(profile.date_of_birth) != str(submitted.get("date_of_birth", "")):
                    mismatches.append("date_of_birth")
                if profile.nationality and profile.nationality != submitted.get("nationality", ""):
                    mismatches.append("nationality")
                if profile.gender and profile.gender != submitted.get("gender", ""):
                    mismatches.append("gender")
                if profile.phone_area_code and profile.phone_area_code != submitted.get("phone_area_code", ""):
                    mismatches.append("phone_area_code")
                if profile.phone_number and profile.phone_number != submitted.get("phone_number", ""):
                    mismatches.append("phone_number")

                if mismatches:
                    return Response(
                        {"detail": f"Submitted passenger data does not match your profile: {', '.join(mismatches)}"},
                        status=400,
                    )
            except Exception:
                pass
        # ----------------------------------------------------------------

        if len(seat_assignments) != len(passenger_data):
            return Response({"detail": "Number of seat assignments must match number of passengers"}, status=400)
        
        # Check if all seats belong to the flight
        seat_ids = [assignment["seat_id"] for assignment in seat_assignments]
        seats = Seat.objects.filter(id__in=seat_ids, aircraft=flight.aircraft)
        
        if seats.count() != len(seat_ids):
            return Response({"detail": "One or more selected seats do not belong to this flight"}, status=400)
        
        # Check if seats are already booked
        booked_seats = BoardingPass.objects.filter(
            booking__flight=flight,
            booking__booking_status='CONFIRMED',
            seat_id__in=seat_ids
        ).values_list("seat_id", flat=True)
        
        if booked_seats:
            return Response({"detail": f"Seat(s) {list(booked_seats)} are already booked for this flight"}, status=409)
        
        with transaction.atomic():
            # Create booking
            booking = Booking.objects.create(
                user=request.user,
                flight=flight,
                booking_status='PENDING',
                total_amount=0,  # Will be calculated after creating passengers
                stopover_city=stopover_city if stopover_city else None
            )
            
            total_price = 0
            
            # Get passenger photos from request files (if any)
            passenger_photos = request.FILES.getlist('passenger_photos')
            
            # Create passengers and boarding passes
            for i, assignment in enumerate(seat_assignments):
                passenger_info = passenger_data[i]
                seat_id = assignment["seat_id"]
                seat = seats.get(id=seat_id)
                
                # Create passenger
                passenger = Passenger.objects.create(
                    booking=booking,
                    full_name=passenger_info["full_name"],
                    passport_number=passenger_info.get("passport_number", ""),
                    date_of_birth=passenger_info["date_of_birth"],
                    nationality=passenger_info["nationality"],
                    passenger_type=passenger_info["passenger_type"],
                    phone_area_code=passenger_info.get("phone_area_code", ""),
                    phone_number=passenger_info.get("phone_number", ""),
                    gender=passenger_info.get("gender", ""),
                )
                
                # Price = flight base price × seat class multiplier × passenger-type discount
                base_price = flight.price * seat.price_multiplier
                if passenger.passenger_type == 'KID':
                    price = base_price * Decimal('0.5')   # 50% discount for kids
                elif passenger.passenger_type == 'CHILD':
                    price = base_price * Decimal('0.75')  # 25% discount for children
                else:  # ADULT
                    price = base_price
                
                total_price += price
                
                # Get passenger photo if available
                passenger_photo = None
                if i < len(passenger_photos):
                    passenger_photo = passenger_photos[i]
                
                # Create boarding pass (without QR code yet)
                BoardingPass.objects.create(
                    booking=booking,
                    seat=seat,
                    passenger=passenger,
                    qr_code_data=f"BP_{booking.id}_{passenger.id}_{seat.seat_number}",
                    price=price,
                    passenger_photo=passenger_photo
                )
            
            # Update total amount
            booking.total_amount = total_price
            booking.save()

        return Response(BookingSerializer(booking).data, status=201)

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        booking = self.get_object()
        
        if booking.user != request.user:
            return Response({"detail": "You do not have permission to cancel this booking."}, status=403)
        
        if booking.booking_status in ['CONFIRMED', 'CANCELLED']:
            return Response({"detail": "Cannot cancel a confirmed or already cancelled booking."}, status=400)
        
        booking.booking_status = 'CANCELLED'
        booking.save(update_fields=["booking_status"])
        return Response(BookingSerializer(booking).data)
    
    @action(detail=True, methods=["delete"], url_path="delete")
    def delete_booking(self, request, pk=None):
        booking = self.get_object()
        
        if booking.user != request.user:
            return Response({"detail": "You do not have permission to delete this booking."}, status=403)
        
        if booking.flight.status != 'COMPLETED':
            return Response({"detail": "Can only delete bookings for completed flights."}, status=400)
        
        booking_id = booking.id
        booking.delete()
        
        return Response({"detail": f"Booking {booking_id} deleted successfully."}, status=200)

    @action(detail=True, methods=["post"], url_path="initiate_payment")
    def initiate_payment(self, request, pk=None):
        booking = self.get_object()
        
        if booking.user != request.user:
            return Response({"detail": "You do not have permission to initiate payment for this booking."}, status=403)
        
        if booking.booking_status == 'CONFIRMED':
            return Response({"detail": "Booking is already confirmed."}, status=400)

        # --- Seat availability check ---
        boarding_pass_seat_ids = booking.boarding_passes.values_list('seat_id', flat=True)
        conflicting = (
            BoardingPass.objects
            .filter(seat_id__in=boarding_pass_seat_ids, booking__booking_status='CONFIRMED')
            .exclude(booking=booking)
            .select_related('seat')
        )
        if conflicting.exists():
            taken = ', '.join(conflicting.values_list('seat__seat_number', flat=True))
            return Response(
                {"detail": f"Seat(s) {taken} have been taken by another booking. Please cancel this booking and select a new seat."},
                status=409,
            )
        
        existing_payment = Payment.objects.filter(
            booking=booking
        ).exclude(status='FAILED').first()
        
        if existing_payment:
            if existing_payment.status == 'SUCCESS':
                return Response({
                    "detail": "This booking has already been paid.",
                    "booking_id": booking.id,
                    "booking_status": booking.booking_status,
                    "payment": {
                        "id": existing_payment.id,
                        "status": existing_payment.status,
                        "amount": str(existing_payment.amount),
                        "currency": existing_payment.currency,
                        "provider_reference": existing_payment.provider_reference
                    }
                }, status=200)
            existing_payment.delete()
        
        PROVIDER_MAP = {
            "mpesa": "MPESA",
            "paypal": "PAYPAL",
            "card": "CARD",
            "bank": "BANK_TRANSFER",
        }
        provider_key = str(request.data.get("provider", "")).lower()
        provider = PROVIDER_MAP.get(provider_key)

        if not provider:
            return Response({"detail": "Invalid payment provider. Choose mpesa, paypal, card, or bank."}, status=400)

        if provider == "MPESA":
            phone = str(request.data.get("phone_number", "")).strip()
            if not phone:
                return Response({"detail": "Phone number is required for M-Pesa."}, status=400)
            provider_reference = f"MPESA-{phone}-{booking.confirmation_code}"
            payment_detail = phone

        elif provider == "PAYPAL":
            import re
            email = str(request.data.get("email", "")).strip()
            if not email:
                return Response({"detail": "Email is required for PayPal."}, status=400)
            if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
                return Response({"detail": "Please enter a valid email address for PayPal."}, status=400)
            provider_reference = f"PAYPAL-{email}-{booking.confirmation_code}"
            payment_detail = email

        elif provider == "CARD":
            card_number = str(request.data.get("card_number", "")).strip()
            expiry_date = str(request.data.get("expiry_date", "")).strip()
            cvv = str(request.data.get("cvv", "")).strip()
            if not card_number:
                return Response({"detail": "Card number is required."}, status=400)
            if not expiry_date:
                return Response({"detail": "Card expiry date is required."}, status=400)
            if not cvv:
                return Response({"detail": "CVV is required."}, status=400)
            masked = f"****{card_number[-4:]}" if len(card_number) >= 4 else "****"
            provider_reference = f"CARD-{masked}-{booking.confirmation_code}"
            payment_detail = masked

        else:  # BANK_TRANSFER
            provider_reference = f"BANK-{booking.confirmation_code}"
            payment_detail = None

        payment = Payment.objects.create(
            booking=booking,
            provider=provider,
            status='PENDING',
            amount=booking.total_amount,
            currency="KES",
            provider_reference=provider_reference,
            payment_detail=payment_detail,
        )
        
        return Response({
            "detail": "Payment initiated successfully. Awaiting admin confirmation.",
            "booking_id": booking.id,
            "booking_status": booking.booking_status,
            "payment": {
                "id": payment.id,
                "status": payment.status,
                "amount": str(payment.amount),
                "currency": payment.currency,
                "provider_reference": payment.provider_reference
            }
        }, status=201)

    @action(detail=True, methods=["get"], url_path="payment_status")
    def payment_status(self, request, pk=None):
        booking = self.get_object()
        
        if booking.user != request.user:
            return Response({"detail": "You do not have permission to view payment status for this booking."}, status=403)
        
        latest_payment = booking.payments.order_by('-created_at').first()
        payment_success = latest_payment is not None and latest_payment.status == 'SUCCESS'

        return Response({
            "booking_id": booking.id,
            "booking_status": booking.booking_status,
            "latest_payment": PaymentSerializer(latest_payment).data if latest_payment else None,
            "boarding_pass_available": booking.booking_status in ('CONFIRMED', 'ONBOARD') and payment_success,
        })

    @action(detail=True, methods=["get"], url_path="payment")
    def payment(self, request, pk=None):
        booking = self.get_object()
        p = booking.payment
        return Response(PaymentSerializer(p).data)

    @action(detail=True, methods=["post"], url_path="pay")
    def pay(self, request, pk=None):
        booking = self.get_object()
        ser = PaySerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        p = booking.payment
        p.payment_method = data["payment_method"]
        p.status = data["payment_status"]
        p.transaction_date = timezone.now()
        p.save(update_fields=["payment_method", "status", "transaction_date"])

        return Response(PaymentSerializer(p).data)

    @action(detail=True, methods=["get"], url_path="boarding_pass")
    def boarding_pass(self, request, pk=None):
        booking = self.get_object()
        boarding_passes = booking.boarding_passes.all()
        
        if not boarding_passes.exists():
            return Response({"detail": "No boarding passes found for this booking"}, status=404)
        
        bp = boarding_passes.first()
        qr_png_base64 = make_qr_png_base64(bp.qr_code_data)
        out = BoardingPassSerializer(bp).data
        out["qr_png_base64"] = qr_png_base64
        return Response(out)
    
    @action(detail=True, methods=["get"], url_path="all_boarding_passes")
    def all_boarding_passes(self, request, pk=None):
        booking = self.get_object()
        
        latest_payment = booking.payments.order_by('-created_at').first()
        
        # Debug logging
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"Boarding pass check - Booking {booking.id}: status={booking.booking_status}, payment_exists={latest_payment is not None}, payment_status={latest_payment.status if latest_payment else 'N/A'}")
        
        if booking.booking_status not in ('CONFIRMED', 'ONBOARD') or not latest_payment or latest_payment.status != 'SUCCESS':
            logger.warning(f"Boarding pass denied - Booking status: {booking.booking_status}, Has payment: {latest_payment is not None}, Payment status: {latest_payment.status if latest_payment else 'No payment'}")
            return Response({"detail": "Payment required. Complete payment to download boarding passes."}, status=402)
        
        boarding_passes = booking.boarding_passes.all()
        
        if not boarding_passes.exists():
            return Response({"detail": "No boarding passes found for this booking"}, status=404)
        
        result = []
        for bp in boarding_passes:
            qr_png_base64 = make_qr_png_base64(bp.qr_code_data)
            bp_data = BoardingPassSerializer(bp).data
            bp_data["qr_png_base64"] = qr_png_base64
            result.append(bp_data)
        
        return Response(result)
    
    @action(detail=True, methods=["get"], url_path="all_boarding_passes_zip")
    def all_boarding_passes_zip(self, request, pk=None):
        booking = self.get_object()
        
        latest_payment = booking.payments.order_by('-created_at').first()
        if booking.booking_status not in ('CONFIRMED', 'ONBOARD') or not latest_payment or latest_payment.status != 'SUCCESS':
            return Response({"detail": "Payment required. Complete payment to download boarding passes."}, status=402)
        
        boarding_passes = booking.boarding_passes.all()
        
        if not boarding_passes.exists():
            return Response({"detail": "No boarding passes found for this booking"}, status=404)
        
        import zipfile
        from io import BytesIO
        
        zip_buffer = BytesIO()
        
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for bp in boarding_passes:
                try:
                    passenger = bp.passenger
                    png_bytes = build_boarding_pass_png(booking, passenger)
                    filename = f"boarding-pass-{booking.confirmation_code}-{passenger.full_name.replace(' ', '_')}-{passenger.id}.png"
                    zip_file.writestr(filename, png_bytes)
                except Exception as e:
                    print(f"Error generating pass for passenger {bp.passenger.id}: {e}")
                    continue
        
        zip_buffer.seek(0)
        
        response = HttpResponse(zip_buffer.getvalue(), content_type='application/zip')
        response['Content-Disposition'] = f'attachment; filename="boarding-passes-{booking.confirmation_code}.zip"'
        return response

    @action(detail=True, methods=["get"], url_path="boarding_pass_png")
    def boarding_pass_png(self, request, pk=None):
        booking = self.get_object()
        
        latest_payment = booking.payments.order_by('-created_at').first()
        if booking.booking_status not in ('CONFIRMED', 'ONBOARD') or not latest_payment or latest_payment.status != 'SUCCESS':
            return Response({"detail": "Payment required. Complete payment to download boarding pass."}, status=402)
        
        passenger_id = request.query_params.get("passenger_id")
        
        if passenger_id:
            try:
                passenger = booking.passengers.get(id=passenger_id)
                png_bytes = build_boarding_pass_png(booking, passenger)
                filename = f"boarding-pass-{booking.confirmation_code}-{passenger.full_name.replace(' ', '_')}-{passenger.id}.png"
            except Passenger.DoesNotExist:
                return Response({"detail": "Passenger not found in this booking"}, status=404)
        else:
            passenger = booking.passengers.first()
            if not passenger:
                return Response({"detail": "No passengers found in booking"}, status=404)
            png_bytes = build_boarding_pass_png(booking, passenger)
            filename = f"boarding-pass-{booking.confirmation_code}-{passenger.full_name.replace(' ', '_')}.png"

        resp = HttpResponse(png_bytes, content_type="image/png")
        resp["Content-Disposition"] = f'attachment; filename="{filename}"'
        return resp



class PaymentProviderView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        providers = [
            {"id": "mpesa", "name": "M-Pesa", "icon": "📱"},
            {"id": "paypal", "name": "PayPal", "icon": "💳"},
            {"id": "card", "name": "Credit Card", "icon": "💳"},
            {
                "id": "bank",
                "name": "Bank Transfer",
                "icon": "🏦",
                "bank_details": {
                    "bank_name": "KCB (Kenya Commercial Bank)",
                    "account_name": "AEROSYNC",
                    "account_number": "13124989208",
                    "routing_number": "011000016",
                },
            },
            {"id": "pesapal", "name": "Pesapal", "icon": "💳"},
        ]
        return Response(providers)


# ------------------ PESAPAL PAYMENT GATEWAY ------------------

class PesapalInitiatePaymentView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, booking_id):
        try:
            from .pesapal_service import PesapalService
            
            ip_address = request.META.get('REMOTE_ADDR', 'unknown')
            timestamp = timezone.now().strftime('%Y-%m-%d %H:%M:%S')
            print(f"[{timestamp}] {ip_address} POST /api/payments/pesapal/initiate/{booking_id}/")
            
            booking = Booking.objects.get(id=booking_id)
            
            if booking.user != request.user and not (request.user.is_admin or request.user.is_agent):
                return Response(
                    {"detail": "You do not have permission to pay for this booking"},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            existing_payment = Payment.objects.filter(
                booking=booking,
                status='SUCCESS'
            ).first()
            
            if existing_payment:
                return Response(
                    {"detail": "Booking already paid", "payment": PaymentSerializer(existing_payment).data},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            existing_payment = Payment.objects.filter(
                booking=booking,
                provider='PESAPAL'
            ).exclude(status='CANCELLED').order_by('-created_at').first()
            
            if existing_payment:
                if existing_payment.status == 'SUCCESS':
                    print(f"✅ Booking already paid - reusing payment {existing_payment.id}")
                    return Response(
                        {"detail": "Booking already paid", "payment": PaymentSerializer(existing_payment).data},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                payment = existing_payment
                print(f"♻️ Reusing existing payment {payment.id} (status: {payment.status})")
                
                payment.status = 'PENDING'
                payment.payment_detail = ''
                old_tracking_id = payment.provider_reference
                payment.provider_reference = ''
                payment.save()
                
                print(f"🔄 Cleared old tracking ID {old_tracking_id}, ready for new submission")
            else:
                if not booking.total_amount or booking.total_amount <= 0:
                    return Response(
                        {"detail": "Invalid booking amount. Please contact support."},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                payment = Payment.objects.create(
                booking=booking,
                provider='PESAPAL',
                amount=booking.total_amount,
                currency='KES',
                status='PENDING'
            )
            
            pesapal = PesapalService()
            
            import time
            billing_details = request.data.get('billing_details', {})
            
            order_details = {
                'merchant_reference': f'AEROSYNC-{booking.id}-{int(time.time())}',
                'amount': str(booking.total_amount),
                'currency': 'KES',
                'description': f'Flight Booking - {booking.confirmation_code}',
                'billing_email': billing_details.get('email', booking.user.email),
                'billing_phone': billing_details.get('phone_number', getattr(booking.user.profile, 'phone_number', '')),
                'first_name': billing_details.get('first_name', getattr(booking.user.profile, 'first_name', booking.user.username)),
                'last_name': billing_details.get('last_name', getattr(booking.user.profile, 'last_name', '')),
                'address_line1': billing_details.get('address_line1', getattr(booking.user.profile, 'address_line1', 'N/A')),
                'address_line2': billing_details.get('address_line2', getattr(booking.user.profile, 'address_line2', '')),
                'city': billing_details.get('city', getattr(booking.user.profile, 'city', 'Nairobi')),
                'state': billing_details.get('state', getattr(booking.user.profile, 'state', '')),
                'postal_code': billing_details.get('postal_code', getattr(booking.user.profile, 'postal_code', '00100')),
                'callback_url': settings.PESAPAL_CALLBACK_URL,
                'notification_url': settings.PESAPAL_IPN_URL
            }
            
            from django.core.cache import cache
            cache.delete('pesapal_access_token')
            
            # Log the amount being sent for debugging
            import logging
            logger = logging.getLogger(__name__)
            logger.info(f"Initiating Pesapal payment for booking {booking.id} - Amount: {booking.total_amount} KES")
            
            try:
                result = pesapal.submit_order(order_details)
            except Exception as e:
                logger.error(f"Pesapal initiation error: {str(e)}")
                error_message = str(e)
                
                # Provide specific guidance based on error type
                if "amount_exceeds_default_limit" in error_message.lower() or "exceeds limit" in error_message.lower():
                    return Response(
                        {
                            "detail": "Transaction amount exceeds payment gateway limits. Please contact our support team at support@aerosync.live or call us to complete this booking.",
                            "error_code": "AMOUNT_LIMIT_EXCEEDED",
                            "amount": str(booking.total_amount),
                            "currency": "KES"
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )
                elif "authentication" in error_message.lower():
                    return Response(
                        {"detail": "Payment gateway configuration error. Please contact support."},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR
                    )
                else:
                    return Response(
                        {"detail": f"Payment initiation failed: {error_message}"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            ip_address = request.META.get('REMOTE_ADDR', 'unknown')
            timestamp = timezone.now().strftime('%Y-%m-%d %H:%M:%S')
            print(f"[{timestamp}] {ip_address} Payment initiated - Tracking: {result.get('order_tracking_id', 'N/A')}")
            
            payment.provider_reference = result['order_tracking_id']
            payment.save()
            
            return Response({
                'redirect_url': result['redirect_url'],
                'order_tracking_id': result['order_tracking_id'],
                'payment_id': payment.id,
                'amount': str(booking.total_amount),
                'currency': 'KES'
            })
            
        except Booking.DoesNotExist:
            return Response(
                {"detail": "Booking not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Pesapal initiation error: {str(e)}", exc_info=True)
            
            return Response(
                {"detail": "Cannot initiate payment. Please try again or contact support."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class PesapalCallbackView(APIView):
    permission_classes = [permissions.AllowAny]
    
    def get(self, request):
        order_tracking_id = request.GET.get('orderTrackingId')
        merchant_reference = request.GET.get('OrderMerchantReference')
        
        if not order_tracking_id:
            return HttpResponse("Invalid callback parameters")
        
        print(f"🔔 Pesapal callback received: {order_tracking_id}")
        
        try:
            from .pesapal_service import PesapalService
            pesapal = PesapalService()
            status_result = pesapal.check_transaction_status(order_tracking_id)
            
            print(f"📊 Transaction status response: {status_result}")
            
            payment_status = status_result.get('payment_status_description', '').upper()
            status_code = status_result.get('status_code', '')
            confirmation_code = status_result.get('confirmation_code', '')
            
            payment = Payment.objects.filter(provider_reference=order_tracking_id).first()
            
            if payment:
                if payment_status in ['COMPLETED', 'COMPLETE'] or str(status_code) == '1':
                    payment.status = 'SUCCESS'
                    payment.payment_detail = (
                        f"Confirmation: {confirmation_code} | "
                        f"Method: {status_result.get('payment_method', 'N/A')} | "
                        f"Amount: {status_result.get('amount', 0)} {status_result.get('currency', 'KES')}"
                    )
                    payment.booking.booking_status = 'CONFIRMED'
                    payment.booking.save()
                    print(f"✅ Payment SUCCESS for booking {payment.booking.id}")
                    
                elif payment_status == 'FAILED' or str(status_code) == '2':
                    payment.status = 'FAILED'
                    payment.payment_detail = f"Failed: {status_result.get('description', 'Payment failed')}"
                    payment.save()
                    print(f"❌ Payment FAILED")
                    
                elif payment_status in ['INVALID', 'CANCELLED'] or str(status_code) == '0':
                    payment.status = 'CANCELLED'
                    payment.payment_detail = f"Invalid transaction - {status_result.get('description', '')}"
                    payment.save()
                    print(f"⛔ Payment INVALID")
                    
                elif payment_status == 'REVERSED' or str(status_code) == '3':
                    payment.status = 'REVERSED'
                    payment.payment_detail = f"Reversed - {status_result.get('description', '')}"
                    payment.save()
                    print(f"↩️ Payment REVERSED")
                    
                payment.save()
        except Exception as e:
            print(f"⚠️ Error fetching transaction status: {e}")
        
        frontend_url = "/bookings"
        
        return HttpResponse(f'''<!DOCTYPE html>
<html>
<head>
    <title>Processing Payment...</title>
    <script>
        window.location.href = "{frontend_url}";
    </script>
</head>
<body>
    <p>Processing your payment...</p>
</body>
</html>''')


class PesapalIPNView(APIView):
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        try:
            from .pesapal_service import PesapalService
            
            notification = PesapalService.parse_ipn_notification(request.data)
            
            order_tracking_id = notification.get('order_tracking_id')
            merchant_reference = notification.get('order_merchant_reference')
            
            ip_address = request.META.get('REMOTE_ADDR', 'unknown')
            timestamp = timezone.now().strftime('%Y-%m-%d %H:%M:%S')
            print(f"[{timestamp}] {ip_address} IPN - Tracking: {order_tracking_id}")
            
            if not order_tracking_id:
                print(f"[{timestamp}] {ip_address} IPN rejected - No tracking ID")
                return Response({"status": "received"})
            
            pesapal = PesapalService()
            status_result = pesapal.check_transaction_status(order_tracking_id)
            
            payment_status = status_result.get('payment_status_description', '').upper()
            status_code = status_result.get('status_code', '')
            
            print(f"[{timestamp}] {ip_address} Status: {payment_status} (Code: {status_code})")
            
            booking_id = None
            if merchant_reference and merchant_reference.startswith('AEROSYNC-'):
                try:
                    parts = merchant_reference.split('-')
                    if len(parts) >= 2:
                        # booking_id is at index 1, but UUID has hyphens so we need to handle that
                        # Format: AEROSYNC-{uuid}-{timestamp}
                        # UUID has 5 parts separated by hyphens, so we need indices 1-5
                        booking_id = '-'.join(parts[1:-1])  # Join all parts except first (AEROSYNC) and last (timestamp)
                except (ValueError, IndexError):
                    pass
            
            if not booking_id:
                print(f"⚠️ Cannot extract booking ID from merchant reference: {merchant_reference}")
                return Response({"status": "received"})
            
            try:
                booking = Booking.objects.get(id=booking_id)
            except Booking.DoesNotExist:
                print(f"⚠️ Booking {booking_id} not found for IPN")
                return Response({"status": "received"})
            
            payment = Payment.objects.filter(
                booking=booking,
                provider='PESAPAL'
            ).exclude(status='CANCELLED').order_by('-created_at').first()
            
            if not payment:
                print(f"🆕 Creating new payment for booking {booking_id} with tracking ID: {order_tracking_id}")
                
                if Payment.objects.filter(booking=booking, status='SUCCESS').exists():
                    print(f"⚠️ Booking {booking_id} already has SUCCESS payment, ignoring IPN")
                    return Response({"status": "received"})
                
                payment = Payment.objects.create(
                    booking=booking,
                    provider='PESAPAL',
                    status='PENDING',
                    amount=booking.total_amount,
                    currency='KES',
                    provider_reference=order_tracking_id
                )
                print(f"[{timestamp}] {ip_address} Created payment {payment.id}")
            else:
                if payment.provider_reference != order_tracking_id:
                    payment.provider_reference = order_tracking_id
                    payment.save()
                print(f"[{timestamp}] {ip_address} Using payment {payment.id}")
            
            if payment_status.upper() in ['COMPLETED', 'COMPLETE'] or str(status_code) == '1':
                payment.status = 'SUCCESS'
                payment.payment_detail = f"Status: {payment_status} | Code: {status_code}"
                
                # Save payment first - this will trigger the post_save signal
                # The signal will:
                # 1. Set booking status to CONFIRMED (if not already)
                # 2. Send boarding pass email
                payment.save()
                
                print(f"[{timestamp}] {ip_address} ✅ SUCCESS - Booking {payment.booking.id} confirmed via signal")
                
            elif payment_status.upper() == 'FAILED' or str(status_code) == '2':
                payment.status = 'FAILED'
                payment.payment_detail = f"Status: {payment_status}"
                payment.save()
                print(f"[{timestamp}] {ip_address} ❌ FAILED - Booking {payment.booking.id}")
                
            elif payment_status.upper() in ['INVALID', 'CANCELLED'] or str(status_code) == '0':
                payment.status = 'CANCELLED'
                payment.payment_detail = f"Invalid transaction - {status_result.get('description', '')}"
                payment.save()
                print(f"⛔ Payment INVALID/CANCELLED for booking {payment.booking.id}")
                
            elif payment_status.upper() == 'REVERSED' or str(status_code) == '3':
                payment.status = 'REVERSED'
                payment.payment_detail = f"Reversed - {status_result.get('description', '')}"
                payment.save()
                print(f"↩️ Payment REVERSED for booking {payment.booking.id}")
            
            payment.save()
            
            print(f"✅ IPN processed successfully for {order_tracking_id}")
            return Response({
                "orderNotificationType": "IPNCHANGE",
                "orderTrackingId": order_tracking_id,
                "orderMerchantReference": merchant_reference,
                "status": 200
            })
            
        except Exception as e:
            print(f"❌ Error processing Pesapal IPN: {str(e)}")
            return Response({"status": "error", "message": str(e)})


class PesapalStatusCheckView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, payment_id):
        import logging
        logger = logging.getLogger(__name__)
        
        try:
            from .pesapal_service import PesapalService
            
            ip_address = request.META.get('REMOTE_ADDR', 'unknown')
            timestamp = timezone.now().strftime('%Y-%m-%d %H:%M:%S')
            print(f"[{timestamp}] {ip_address} GET /api/payments/pesapal/status/{payment_id}/")
            
            payment = Payment.objects.get(id=payment_id)
            
            if payment.booking.user != request.user and not (request.user.is_admin or request.user.is_agent):
                print(f"[{timestamp}] {ip_address} Permission denied - Payment {payment_id}")
                return Response(
                    {"detail": "You do not have permission to check this payment"},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            if payment.provider != 'PESAPAL':
                return Response(
                    {"detail": "Not a Pesapal payment"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if not payment.provider_reference:
                return Response(
                    {"detail": "No Pesapal tracking ID found"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            pesapal = PesapalService()
            
            from django.core.cache import cache
            cache.delete('pesapal_access_token')
            
            status_result = pesapal.check_transaction_status(payment.provider_reference)
            
            # Log full Pesapal response for debugging
            logger.info(f"Pesapal status check for payment {payment.id}: {status_result}")
            
            # Handle ERROR status from Pesapal API
            if status_result.get('status') == 'ERROR':
                logger.warning(f"Pesapal API returned error: {status_result.get('description', 'Unknown error')}")
                return Response({
                    'payment': PaymentSerializer(payment).data,
                    'pesapal_status': status_result,
                    'booking_is_confirmed': payment.booking.booking_status == 'CONFIRMED',
                    'warning': 'Unable to fetch latest status from Pesapal. Showing last known state.'
                })
            
            # IMPORTANT: Only update payment status if it has changed
            # This prevents unnecessary signal broadcasts during polling
            # CONSERVATIVE APPROACH: Only auto-update to SUCCESS, not to CANCELLED/FAILED
            # (Those should come from IPN webhook to avoid false positives)
            new_payment_status = payment.status
            needs_update = False
            
            if status_result['status'].upper() in ['COMPLETED', 'COMPLETE'] and payment.status != 'SUCCESS':
                new_payment_status = 'SUCCESS'
                needs_update = True
                logger.info(f"Payment {payment.id} marked as SUCCESS via polling")
            elif status_result['status'].upper() == 'FAILED' and payment.status != 'FAILED':
                # Don't auto-update to FAILED during polling - wait for IPN
                # This prevents premature modal closure
                logger.debug(f"Payment {payment.id} shows FAILED but waiting for IPN confirmation")
            elif status_result['status'].upper() in ['INVALID', 'CANCELLED'] and payment.status not in ['CANCELLED', 'INVALID']:
                # Don't auto-update to CANCELLED during polling - wait for IPN
                # Pesapal sandbox often returns CANCELLED prematurely
                logger.debug(f"Payment {payment.id} shows {status_result['status']} but waiting for IPN confirmation")
            
            # Only update if status actually changed
            if needs_update:
                payment.status = new_payment_status
                payment.payment_detail = f"Status: {status_result['status']}"
                
                # DO NOT manually update booking status here!
                # Let the auto_confirm_booking_on_payment_success signal handle it
                # so it can send boarding pass emails properly
                
                payment.save()  # This will trigger the signal which will update booking and send emails
                logger.info(f"Payment {payment.id} status updated to {new_payment_status}. Signal will handle booking confirmation.")
            else:
                logger.debug(f"Payment {payment.id} status unchanged ({payment.status})")
            
            return Response({
                'payment': PaymentSerializer(payment).data,
                'pesapal_status': status_result,
                'booking_is_confirmed': payment.booking.booking_status == 'CONFIRMED'
            })
            
        except Payment.DoesNotExist:
            return Response(
                {"detail": "Payment not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Pesapal status check error: {str(e)}", exc_info=True)
            
            return Response(
                {"detail": "Cannot check payment status. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# ------------------ ADMIN CRUD ------------------

class AircraftAdminViewSet(viewsets.ModelViewSet):
    queryset = Aircraft.objects.all().order_by("number_plate")
    serializer_class = AircraftSerializer
    permission_classes = [IsAdmin]

    @action(detail=True, methods=["post"], url_path="generate_seats")
    def generate_seats(self, request, pk=None):
        aircraft = self.get_object()
        total = aircraft.total_seats

        existing = set(
            Seat.objects.filter(aircraft=aircraft).values_list("seat_number", flat=True)
        )
        if len(existing) >= total:
            return Response(
                {"detail": "Seats already generated", "existing": len(existing)},
                status=400
            )

        first_count    = min(12, max(1, int(total * 0.10)))
        business_count = min(36, max(1, int(total * 0.20)))
        economy_count  = total - first_count - business_count

        class_limits = [
            ("FIRST",    first_count,    2.50),
            ("BUSINESS", business_count, 1.80),
            ("ECONOMY",  economy_count,  1.00),
        ]

        letters = ["A", "B", "C", "D", "E", "F"]
        created = 0
        row = 1
        seats_to_create = []

        for flight_class, count, multiplier in class_limits:
            class_created = 0
            while class_created < count:
                for letter in letters:
                    if class_created >= count:
                        break
                    s = f"{row}{letter}"
                    if s not in existing:
                        seats_to_create.append(
                            Seat(
                                aircraft=aircraft,
                                seat_number=s,
                                flight_class=flight_class,
                                price_multiplier=multiplier,
                            )
                        )
                        class_created += 1
                        created += 1
                row += 1

        Seat.objects.bulk_create(seats_to_create)
        return Response({
            "detail": "Seats generated successfully",
            "created": created,
            "first": first_count,
            "business": business_count,
            "economy": economy_count,
            "total": total,
        })

    @action(detail=False, methods=["post"], url_path="bulk_create")
    def bulk_create(self, request):
        data = request.data
        if not isinstance(data, list) or not data:
            return Response({"detail": "Expected a non-empty list"}, status=400)
        created, errors = [], []
        for i, item in enumerate(data):
            serializer = self.get_serializer(data=item)
            if serializer.is_valid():
                serializer.save()
                created.append(serializer.data)
            else:
                errors.append({"row": i + 1, "data": item, "errors": serializer.errors})
        status_code = 201 if created else 400
        return Response({"created": len(created), "errors": errors, "data": created}, status=status_code)


class AirportAdminViewSet(viewsets.ModelViewSet):
    queryset = Airport.objects.all().order_by("code")
    serializer_class = AirportSerializer
    permission_classes = [IsAdmin]

    @action(detail=False, methods=["post"], url_path="bulk_create")
    def bulk_create(self, request):
        data = request.data
        if not isinstance(data, list) or not data:
            return Response({"detail": "Expected a non-empty list"}, status=400)
        created, errors = [], []
        for i, item in enumerate(data):
            serializer = self.get_serializer(data=item)
            if serializer.is_valid():
                serializer.save()
                created.append(serializer.data)
            else:
                errors.append({"row": i + 1, "data": item, "errors": serializer.errors})
        status_code = 201 if created else 400
        return Response({"created": len(created), "errors": errors, "data": created}, status=status_code)


class SeatAdminViewSet(viewsets.ModelViewSet):
    queryset = Seat.objects.select_related("aircraft").all().order_by("aircraft__number_plate", "seat_number")
    serializer_class = SeatSerializer
    permission_classes = [IsAdmin]


class FlightAdminPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 500


DEPART_HOURS = [6, 10, 12, 14, 16, 18, 20]

# Dictionary to track background task status
_flight_generation_tasks = {}

def _generate_flights_background(task_id):
    """Background thread function to generate flights - simple and fast"""
    import itertools
    import logging
    import time
    from django.db import transaction, models
    from django.db.models import Max
    from django.utils import timezone
    
    logger = logging.getLogger(__name__)
    logger.info(f"Background task {task_id} starting...")
    
    try:
        _flight_generation_tasks[task_id]['status'] = 'running'
        _flight_generation_tasks[task_id]['started_at'] = timezone.now().isoformat()
        logger.info(f"Task {task_id} status set to 'running'")
        
        TARGET_FLIGHTS = 1000  # Generate exactly 1000 flights
        DAYS = 9
        HOURS = DEPART_HOURS

        airports = list(Airport.objects.all())
        aircraft_list = list(Aircraft.objects.all())
        airlines_list = list(Airline.objects.filter(is_active=True))

        if len(airports) < 2:
            _flight_generation_tasks[task_id]['status'] = 'failed'
            _flight_generation_tasks[task_id]['error'] = "Need at least 2 airports to generate flights."
            return
            
        if not aircraft_list:
            _flight_generation_tasks[task_id]['status'] = 'failed'
            _flight_generation_tasks[task_id]['error'] = "No aircraft available. Please add aircraft first."
            return
            
        if not airlines_list:
            _flight_generation_tasks[task_id]['status'] = 'failed'
            _flight_generation_tasks[task_id]['error'] = "No active airlines. Please seed or add airlines first."
            return

        today = date.today()
        logger.info(f"Task {task_id}: Starting generation of {TARGET_FLIGHTS} flights")
        logger.info(f"Task {task_id}: {len(airports)} airports, {len(aircraft_list)} aircraft, {len(airlines_list)} airlines")

        # Get the highest existing flight number to start from there
        # This ensures we never conflict with existing flights
        existing_numbers = Flight.objects.filter(
            flight_number__regex=r'^AS[0-9]+$'
        ).values_list('flight_number', flat=True)
        
        # Parse existing numbers and find max
        max_num = 0
        for fn in existing_numbers:
            try:
                num = int(fn[2:])  # Remove "AS" prefix
                if num > max_num:
                    max_num = num
            except (ValueError, IndexError):
                pass
        
        fn_counter = max_num + 1  # Start from next number
        logger.info(f"Task {task_id}: Starting flight numbers from AS{fn_counter:05d}")
        
        created = 0
        skipped = 0
        n_ac = len(aircraft_list)
        n_al = len(airlines_list)
        
        BATCH_SIZE = 100  # Commit every 100 flights
        flights_batch = []
        
        # Track aircraft time slots to prevent double-booking
        # Key: (aircraft_id, date, hour) -> True if booked
        aircraft_schedule = {}
        
        # Track aircraft location: which airport is each aircraft at on each date/hour
        # Key: (aircraft_id, date, hour) -> airport_id where aircraft is located
        aircraft_location = {}
        
        # Load existing aircraft schedules from database
        existing_flights = Flight.objects.filter(
            departure_time__date__gte=today + timedelta(days=1),
            departure_time__date__lte=today + timedelta(days=DAYS),
        ).select_related('departure_airport', 'arrival_airport').values_list(
            'aircraft_id', 
            'departure_time__date', 
            'departure_time__hour',
            'departure_airport_id',
            'arrival_airport_id',
            'arrival_time'
        )
        
        for ac_id, dep_date, dep_hour, dep_ap_id, arr_ap_id, arr_time in existing_flights:
            # Mark aircraft as busy at departure time
            aircraft_schedule[(ac_id, dep_date, dep_hour)] = True
            
            # Track aircraft movement
            # Aircraft is at departure airport before flight
            aircraft_location[(ac_id, dep_date, dep_hour)] = dep_ap_id
            
            # Calculate arrival date and hour
            arr_date = arr_time.date()
            arr_hour = arr_time.hour
            
            # After arrival, aircraft is at arrival airport
            # Mark all hours after arrival as being at arrival airport
            from datetime import timedelta as td
            current_hour = arr_hour
            current_date = arr_date
            for _ in range(24):  # Track for rest of the day and next day
                aircraft_location[(ac_id, current_date, current_hour)] = arr_ap_id
                current_hour += 1
                if current_hour >= 24:
                    current_hour = 0
                    current_date += td(days=1)
        
        logger.info(f"Task {task_id}: Loaded {len(aircraft_schedule)} existing aircraft slots")
        
        # Initialize aircraft locations - assume all aircraft start at a random airport
        # (or you could set a specific home base for each aircraft)
        import random
        for ac in aircraft_list:
            # Assign each aircraft a starting airport (random or use first airport)
            start_airport = random.choice(airports)
            for day_offset in range(DAYS + 1):
                current_date = today + timedelta(days=day_offset)
                for hour in range(24):
                    key = (ac.id, current_date, hour)
                    if key not in aircraft_location:
                        aircraft_location[key] = start_airport.id
        
        # Simple nested loop to generate flights
        for day_offset in range(DAYS):
            if created >= TARGET_FLIGHTS:
                break
                
            current_date = today + timedelta(days=day_offset + 1)
            
            # Randomly sample airport pairs instead of all permutations
            airport_pairs = list(itertools.permutations(airports, 2))
            random.shuffle(airport_pairs)
            
            for dep_ap, arr_ap in airport_pairs:
                if created >= TARGET_FLIGHTS:
                    break
                    
                for hour in HOURS:
                    if created >= TARGET_FLIGHTS:
                        break
                    
                    # Find an available aircraft for this time slot
                    # THAT IS ALSO AT THE CORRECT DEPARTURE AIRPORT
                    ac_assigned = None
                    for ac in aircraft_list:
                        slot_key = (ac.id, current_date, hour)
                        
                        # Check if aircraft is available (not booked)
                        if slot_key in aircraft_schedule:
                            continue
                        
                        # Check if aircraft is at the correct departure airport
                        ac_current_location = aircraft_location.get(slot_key)
                        if ac_current_location != dep_ap.id:
                            continue
                        
                        # This aircraft is available AND at the right airport!
                        ac_assigned = ac
                        aircraft_schedule[slot_key] = True  # Mark as booked
                        
                        # Update aircraft location for the flight duration
                        dep_dt = timezone.make_aware(
                            datetime.combine(current_date, dt_time(hour, 0))
                        )
                        dur_h = 1.5 if dep_ap.country == arr_ap.country else 4.0
                        arr_dt = dep_dt + timedelta(hours=dur_h)
                        arr_date = arr_dt.date()
                        arr_hour = arr_dt.hour
                        
                        # Mark aircraft at arrival airport after flight
                        from datetime import timedelta as td
                        current_h = arr_hour
                        current_d = arr_date
                        for _ in range(24):  # Mark for rest of day
                            aircraft_location[(ac.id, current_d, current_h)] = arr_ap.id
                            current_h += 1
                            if current_h >= 24:
                                current_h = 0
                                current_d += td(days=1)
                        
                        break
                    
                    if ac_assigned is None:
                        # No aircraft available at this airport at this time
                        skipped += 1
                        continue
                    
                    airline = random.choice(airlines_list)
                    
                    dep_dt = timezone.make_aware(
                        datetime.combine(current_date, dt_time(hour, 0))
                    )
                    dur_h = 1.5 if dep_ap.country == arr_ap.country else 4.0
                    arr_dt = dep_dt + timedelta(hours=dur_h)

                    base = 8_000 if dep_ap.country == arr_ap.country else 35_000
                    price = max(3_000, base + random.randint(-1_000, 5_000))
                    
                    # Generate unique flight number (sequential, no collisions)
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
                    
                    # Commit batch
                    if len(flights_batch) >= BATCH_SIZE:
                        logger.info(f"Task {task_id}: Committing batch ({created}/{TARGET_FLIGHTS})")
                        with transaction.atomic():
                            Flight.objects.bulk_create(flights_batch, batch_size=100)
                        flights_batch = []
                    
                    # Update progress
                    _flight_generation_tasks[task_id]['progress'] = created

        # Commit remaining flights
        if flights_batch:
            logger.info(f"Task {task_id}: Committing final batch")
            with transaction.atomic():
                Flight.objects.bulk_create(flights_batch, batch_size=100)

        _flight_generation_tasks[task_id]['status'] = 'completed'
        _flight_generation_tasks[task_id]['completed_at'] = timezone.now().isoformat()
        _flight_generation_tasks[task_id]['estimated_total'] = TARGET_FLIGHTS
        _flight_generation_tasks[task_id]['result'] = {
            "detail": f"Generated {created} flights over {DAYS} days.",
            "created": created,
            "skipped": skipped,
            "days": DAYS,
            "airports": len(airports),
            "aircraft_used": n_ac,
            "airlines_used": n_al,
        }
        logger.info(f"Task {task_id} completed: {created} flights created")
    except Exception as e:
        _flight_generation_tasks[task_id]['status'] = 'failed'
        _flight_generation_tasks[task_id]['error'] = str(e)
        logger.error(f"Flight generation task {task_id} failed: {e}", exc_info=True)


class FlightAdminViewSet(viewsets.ModelViewSet):
    queryset = Flight.objects.select_related("departure_airport", "arrival_airport", "aircraft").all().order_by("-departure_time")
    serializer_class = FlightAdminSerializer
    permission_classes = [IsAdmin]
    pagination_class = FlightAdminPagination

    def get_queryset(self):
        qs = super().get_queryset()
        flight_number = self.request.query_params.get("flight_number")
        from_code     = self.request.query_params.get("from")
        to_code       = self.request.query_params.get("to")
        airline       = self.request.query_params.get("airline")
        status        = self.request.query_params.get("status")
        
        # Exclude completed flights by default unless status filter is explicitly provided
        if not status:
            qs = qs.exclude(status='COMPLETED')
        
        if flight_number:
            qs = qs.filter(flight_number__icontains=flight_number)
        if from_code:
            qs = qs.filter(departure_airport__code__iexact=from_code)
        if to_code:
            qs = qs.filter(arrival_airport__code__iexact=to_code)
        if airline:
            qs = qs.filter(airline__iexact=airline)
        if status:
            qs = qs.filter(status__iexact=status)
        return qs

    def list(self, request, *args, **kwargs):
        from core.tasks import mark_completed_flights
        mark_completed_flights()
        return super().list(request, *args, **kwargs)

    @action(detail=False, methods=["post"], url_path="generate_flights")
    def generate_flights(self, request):
        import uuid
        import logging
        logger = logging.getLogger(__name__)
        
        # Create a new task
        task_id = str(uuid.uuid4())
        logger.info(f"Creating flight generation task: {task_id}")
        
        _flight_generation_tasks[task_id] = {
            'status': 'pending',
            'task_id': task_id,
            'created_at': timezone.now().isoformat(),
            'progress': 0,
            'estimated_total': 0,
        }
        
        # Start background thread
        thread = threading.Thread(
            target=_generate_flights_background,
            args=(task_id,),
            daemon=True
        )
        thread.start()
        
        logger.info(f"Flight generation task {task_id} started")
        
        return Response({
            "detail": "Flight generation started. Use the task_id to check status.",
            "task_id": task_id,
        }, status=202)
    
    @action(detail=False, methods=["get"], url_path="generation_status/(?P<task_id>[^/.]+)")
    def generation_status(self, request, task_id=None):
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f"Checking status for task_id: {task_id}")
        logger.info(f"Available tasks: {list(_flight_generation_tasks.keys())}")
        
        if task_id not in _flight_generation_tasks:
            logger.warning(f"Task {task_id} not found")
            return Response({"detail": "Task not found."}, status=404)
        
        task_info = _flight_generation_tasks[task_id]
        logger.info(f"Task status: {task_info.get('status')}")
        
        # Return a clean response with all necessary fields
        response_data = {
            'task_id': task_id,
            'status': task_info.get('status', 'unknown'),
            'created_at': task_info.get('created_at'),
            'started_at': task_info.get('started_at'),
            'completed_at': task_info.get('completed_at'),
            'progress': task_info.get('progress', 0),
            'estimated_total': task_info.get('estimated_total', 0),
        }
        
        # Add result or error if available
        if 'result' in task_info:
            response_data['result'] = task_info['result']
        if 'error' in task_info:
            response_data['error'] = task_info['error']
        
        return Response(response_data)


    @action(detail=True, methods=["post"], url_path="generate_seats")
    def generate_seats(self, request, pk=None):
        flight = self.get_object()
        aircraft = flight.aircraft
        total_seats = aircraft.total_seats

        first_count    = min(12, max(1, int(total_seats * 0.10)))
        business_count = min(36, max(1, int(total_seats * 0.20)))
        economy_count  = total_seats - first_count - business_count

        class_limits = [
            ("FIRST",    first_count,    2.50),
            ("BUSINESS", business_count, 1.80),
            ("ECONOMY",  economy_count,  1.00),
        ]

        letters = ["A", "B", "C", "D", "E", "F"]
        existing = set(Seat.objects.filter(aircraft=aircraft).values_list("seat_number", flat=True))
        created = 0
        row = 1
        seats_to_create = []

        for flight_class, count, multiplier in class_limits:
            class_created = 0
            while class_created < count:
                for letter in letters:
                    if class_created >= count:
                        break
                    s = f"{row}{letter}"
                    if s not in existing:
                        seats_to_create.append(
                            Seat(
                                aircraft=aircraft,
                                seat_number=s,
                                flight_class=flight_class,
                                price_multiplier=multiplier,
                            )
                        )
                        class_created += 1
                        created += 1
                row += 1

        Seat.objects.bulk_create(seats_to_create)
        return Response({"detail": "Seats generated", "created": created, "total_seats_for_flight": total_seats})


class BookingAdminViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Booking.objects.select_related(
        "user", "flight", "flight__departure_airport", "flight__arrival_airport"
    ).prefetch_related("passengers", "payments").order_by("-booking_date")
    serializer_class = AdminBookingSerializer
    permission_classes = [IsAdmin]

    @action(detail=True, methods=["post"], url_path="confirm_payment")
    def confirm_payment(self, request, pk=None):
        import logging
        logger = logging.getLogger(__name__)
        
        booking = self.get_object()
        payment = booking.payments.order_by("-created_at").first()
        if not payment:
            return Response({"detail": "No payment found for this booking."}, status=404)
        
        logger.info(f"Admin confirming payment for booking {booking.id}")
        payment.status = "SUCCESS"
        payment.save(update_fields=["status"])  # This triggers broadcast_payment_update signal
        
        booking.booking_status = "CONFIRMED"
        booking.save(update_fields=["booking_status"])  # This triggers broadcast_booking_update signal
        
        logger.info(f"Payment confirmed and booking updated. WebSocket signals should have been triggered.")
        return Response({"detail": "Payment confirmed. Booking is now CONFIRMED."})

    @action(detail=True, methods=["post"], url_path="update_status")
    def update_status(self, request, pk=None):
        import logging
        logger = logging.getLogger(__name__)
        
        booking = self.get_object()
        new_status = request.data.get("booking_status")
        valid = ["PENDING", "CONFIRMED", "CANCELLED", "FAILED"]
        if new_status not in valid:
            return Response({"detail": f"Invalid status. Choose from: {valid}"}, status=400)
        
        logger.info(f"Admin updating booking {booking.id} status from {booking.booking_status} to {new_status}")
        booking.booking_status = new_status
        booking.save(update_fields=["booking_status"])  # This triggers broadcast_booking_update signal
        
        logger.info(f"Booking status updated. WebSocket signal should have been triggered.")
        return Response({"detail": f"Status updated to {new_status}."})


class UserAdminViewSet(viewsets.ModelViewSet):
    queryset = UserAccount.objects.select_related('profile').all().order_by("-date_joined")
    serializer_class = AdminUserSerializer
    permission_classes = [IsAdmin]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def perform_update(self, serializer):
        instance = serializer.instance
        new_role = serializer.validated_data.get("role", instance.role)
        if new_role == "AGENT" and not instance.staff_id:
            while True:
                candidate = "AGT-" + "".join(random.choices(string.digits, k=6))
                if not UserAccount.objects.filter(staff_id=candidate).exists():
                    serializer.validated_data["staff_id"] = candidate
                    break
        serializer.save()

    @action(detail=True, methods=["post"], url_path="set_password")
    def set_password(self, request, pk=None):
        user = self.get_object()
        new_password = request.data.get("password", "").strip()
        if len(new_password) < 6:
            return Response({"detail": "Password must be at least 6 characters."}, status=400)
        user.set_password(new_password)
        user.save(update_fields=["password"])
        return Response({"detail": "Password updated successfully."})


# ------------------ AIRLINES ------------------

SEED_AIRLINES = [
    # East Africa
    {"name": "Kenya Airways", "iata_code": "KQ", "country": "Kenya"},
    {"name": "Jambojet", "iata_code": "JM", "country": "Kenya"},
    {"name": "Safarilink Aviation", "iata_code": "F2", "country": "Kenya"},
    {"name": "Ethiopian Airlines", "iata_code": "ET", "country": "Ethiopia"},
    {"name": "RwandAir", "iata_code": "WB", "country": "Rwanda"},
    {"name": "Uganda Airlines", "iata_code": "UR", "country": "Uganda"},
    {"name": "Precision Air", "iata_code": "PW", "country": "Tanzania"},
    {"name": "Air Tanzania", "iata_code": "TC", "country": "Tanzania"},
    {"name": "Fastjet", "iata_code": "FN", "country": "Tanzania"},
    {"name": "Fly540", "iata_code": "5H", "country": "Kenya"},
    # Africa
    {"name": "South African Airways", "iata_code": "SA", "country": "South Africa"},
    {"name": "Mango Airlines", "iata_code": "JE", "country": "South Africa"},
    {"name": "FlySafair", "iata_code": "FA", "country": "South Africa"},
    {"name": "EgyptAir", "iata_code": "MS", "country": "Egypt"},
    {"name": "Air Mauritius", "iata_code": "MK", "country": "Mauritius"},
    {"name": "Air Madagascar", "iata_code": "MD", "country": "Madagascar"},
    {"name": "Airlink", "iata_code": "4Z", "country": "South Africa"},
    {"name": "Proflight Zambia", "iata_code": "P0", "country": "Zambia"},
    # Middle East
    {"name": "Emirates", "iata_code": "EK", "country": "UAE"},
    {"name": "Qatar Airways", "iata_code": "QR", "country": "Qatar"},
    {"name": "Etihad Airways", "iata_code": "EY", "country": "UAE"},
    {"name": "Flydubai", "iata_code": "FZ", "country": "UAE"},
    {"name": "Turkish Airlines", "iata_code": "TK", "country": "Turkey"},
    # Europe
    {"name": "British Airways", "iata_code": "BA", "country": "United Kingdom"},
    {"name": "KLM Royal Dutch Airlines", "iata_code": "KL", "country": "Netherlands"},
    {"name": "Lufthansa", "iata_code": "LH", "country": "Germany"},
    {"name": "Air France", "iata_code": "AF", "country": "France"},
    {"name": "Swiss International Air Lines", "iata_code": "LX", "country": "Switzerland"},
    {"name": "Brussels Airlines", "iata_code": "SN", "country": "Belgium"},
    {"name": "Iberia", "iata_code": "IB", "country": "Spain"},
    # Asia
    {"name": "Singapore Airlines", "iata_code": "SQ", "country": "Singapore"},
    {"name": "Cathay Pacific", "iata_code": "CX", "country": "Hong Kong"},
    {"name": "China Southern Airlines", "iata_code": "CZ", "country": "China"},
    {"name": "Air India", "iata_code": "AI", "country": "India"},
    {"name": "IndiGo", "iata_code": "6E", "country": "India"},
    # Americas
    {"name": "Delta Air Lines", "iata_code": "DL", "country": "USA"},
    {"name": "American Airlines", "iata_code": "AA", "country": "USA"},
    {"name": "United Airlines", "iata_code": "UA", "country": "USA"},
]


class AirlinePublicViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Airline.objects.filter(is_active=True)
    serializer_class = AirlineSerializer
    permission_classes = [permissions.AllowAny]


class AirlineAdminViewSet(viewsets.ModelViewSet):
    queryset = Airline.objects.all().order_by("name")
    serializer_class = AirlineSerializer
    permission_classes = [IsAdmin]

    @action(detail=False, methods=["post"], url_path="seed")
    def seed(self, request):
        created, skipped = 0, 0
        for item in SEED_AIRLINES:
            _, was_created = Airline.objects.get_or_create(
                name=item["name"],
                defaults={"iata_code": item["iata_code"], "country": item["country"]}
            )
            if was_created:
                created += 1
            else:
                skipped += 1
        return Response({"detail": f"{created} airlines added, {skipped} already existed.",
                         "created": created, "skipped": skipped})

    @action(detail=False, methods=["post"], url_path="bulk_create")
    def bulk_create(self, request):
        data = request.data
        if not isinstance(data, list) or not data:
            return Response({"detail": "Expected a non-empty list."}, status=400)
        created, errors = [], []
        for i, item in enumerate(data):
            serializer = self.get_serializer(data=item)
            if serializer.is_valid():
                serializer.save()
                created.append(serializer.data)
            else:
                errors.append({"row": i + 1, "errors": serializer.errors})
        return Response({"created": len(created), "errors": errors, "data": created},
                        status=201 if created else 400)


# ------------------ REPORTS ------------------

class SummaryReportView(APIView):
    permission_classes = [IsAgentOrAdmin]

    def get(self, request):
        from_date = request.query_params.get("from")
        to_date = request.query_params.get("to")

        qs = Booking.objects.all()
        if from_date:
            qs = qs.filter(booking_date__date__gte=from_date)
        if to_date:
            qs = qs.filter(booking_date__date__lte=to_date)

        total = qs.count()
        confirmed = qs.filter(booking_status='CONFIRMED').count()
        cancelled = qs.filter(booking_status='CANCELLED').count()

        pay_qs = Payment.objects.filter(booking__in=qs, status='SUCCESS')
        revenue = sum([p.amount for p in pay_qs]) if pay_qs.exists() else 0

        return Response({
            "from": from_date,
            "to": to_date,
            "total_bookings": total,
            "confirmed": confirmed,
            "cancelled": cancelled,
            "revenue": str(revenue),
        })


class FlightsWithBookingsView(APIView):
    """Return flights that have at least one booking, with booking count"""
    permission_classes = [IsAgentOrAdmin]

    def get(self, request):
        from django.db import models
        
        # Get flight IDs that have bookings
        flight_ids = Booking.objects.values_list('flight_id', flat=True).distinct()
        
        # Get those flights with related data
        flights = Flight.objects.filter(
            id__in=flight_ids
        ).select_related(
            'departure_airport', 'arrival_airport'
        ).annotate(
            booking_count=models.Count('booking')
        ).order_by('departure_time')
        
        data = []
        for flight in flights:
            data.append({
                "id": flight.id,
                "flight_number": flight.flight_number,
                "departure_code": flight.departure_airport.code,
                "arrival_code": flight.arrival_airport.code,
                "departure_city": flight.departure_airport.city,
                "arrival_city": flight.arrival_airport.city,
                "route_type": flight.route_type,
                "via_cities": flight.via_cities,
                "departure_time": flight.departure_time,
                "booking_count": flight.booking_count,
            })
        
        return Response(data)


# ------------------ AGENT ------------------

class AgentFlightViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Flight.objects.select_related("departure_airport", "arrival_airport").filter(status="SCHEDULED").order_by("departure_time")
    serializer_class = FlightSerializer
    permission_classes = [IsAgent]
    pagination_class = FlightPagePagination

    def get_queryset(self):
        qs = super().get_queryset()
        search = self.request.query_params.get("search")
        if search:
            return (
                Flight.objects
                .select_related("departure_airport", "arrival_airport")
                .filter(flight_number__icontains=search, status="SCHEDULED")
                .order_by("departure_time")
            )
        from_city = self.request.query_params.get("from_city")
        to_city   = self.request.query_params.get("to_city")
        airline   = self.request.query_params.get("airline")
        if from_city:
            qs = qs.filter(departure_airport__city__icontains=from_city)
        if to_city:
            qs = qs.filter(arrival_airport__city__icontains=to_city)
        if airline:
            qs = qs.filter(airline__icontains=airline)
        return qs


class AgentBookingViewSet(viewsets.ViewSet):
    permission_classes = [IsAgent]

    def list(self, request):
        from datetime import date, timedelta
        today = date.today()
        bookings = (
            Booking.objects
            .select_related("flight", "flight__departure_airport", "flight__arrival_airport", "user")
            .prefetch_related("passengers", "boarding_passes")
            .filter(
                created_by=request.user,
                flight__departure_time__date__gte=today - timedelta(days=7),
            )
            .order_by("-booking_date")[:200]
        )
        data = []
        for b in bookings:
            passengers_list = [
                {"id": p.id, "full_name": p.full_name, "passenger_type": p.passenger_type}
                for p in b.passengers.all()
            ]
            seat_numbers = [bp.seat.seat_number for bp in b.boarding_passes.all() if bp.seat]
            
            data.append({
                "id":               b.id,
                "confirmation_code": b.confirmation_code,
                "booking_status":   b.booking_status,
                "passengers":       passengers_list,
                "passenger_name":   passengers_list[0]["full_name"] if passengers_list else "",
                "flight_number":    b.flight.flight_number if b.flight else "",
                "route":            f"{b.flight.departure_airport.code} → {b.flight.arrival_airport.code}" if b.flight else "",
                "departure_time":   b.flight.departure_time,
                "username":         b.user.username if b.user else "",
                "total_amount":     b.total_amount,
                "seat_numbers":     seat_numbers,
                "has_boarding_pass": b.boarding_passes.exists(),
            })
        return Response(data)

    def retrieve(self, request, pk=None):
        try:
            b = (
                Booking.objects
                .select_related("flight", "flight__departure_airport", "flight__arrival_airport", "user")
                .prefetch_related("passengers", "boarding_passes")
                .get(pk=pk, created_by=request.user)
            )
        except Booking.DoesNotExist:
            return Response({"detail": "Booking not found."}, status=404)

        passengers_list = [
            {"id": p.id, "full_name": p.full_name, "passenger_type": p.passenger_type}
            for p in b.passengers.all()
        ]
        seat_numbers = [bp.seat.seat_number for bp in b.boarding_passes.all() if bp.seat]
        
        return Response({
            "id":                b.id,
            "confirmation_code": b.confirmation_code,
            "booking_status":    b.booking_status,
            "passengers":        passengers_list,
            "passenger_name":    passengers_list[0]["full_name"] if passengers_list else "",
            "flight_number":     b.flight.flight_number if b.flight else "",
            "route":             f"{b.flight.departure_airport.code} → {b.flight.arrival_airport.code}" if b.flight else "",
            "departure_time":    b.flight.departure_time,
            "username":          b.user.username if b.user else "",
            "total_amount":      b.total_amount,
            "seat_numbers":      seat_numbers,
            "has_boarding_pass": b.boarding_passes.exists(),
        })

    @action(detail=True, methods=["get"], url_path="boarding_pass_png")
    def boarding_pass_png(self, request, pk=None):
        try:
            booking = Booking.objects.select_related("flight").prefetch_related("passengers").get(
                pk=pk, created_by=request.user
            )
        except Booking.DoesNotExist:
            return Response({"detail": "Booking not found or you do not have permission to access it."}, status=404)

        if booking.booking_status not in ("CONFIRMED", "ONBOARD"):
            return Response(
                {"detail": "Boarding pass is only available for CONFIRMED or ONBOARD bookings."},
                status=402,
            )

        passenger_id = request.query_params.get("passenger_id")
        if passenger_id:
            try:
                passenger = booking.passengers.get(id=passenger_id)
            except Passenger.DoesNotExist:
                return Response({"detail": "Passenger not found in this booking"}, status=404)
        else:
            passenger = booking.passengers.first()
            if not passenger:
                return Response({"detail": "No passengers found in booking"}, status=404)

        png_bytes = build_boarding_pass_png(booking, passenger)
        filename  = f"boarding-pass-{booking.confirmation_code}-{passenger.full_name.replace(' ', '_')}.png"
        resp = HttpResponse(png_bytes, content_type="image/png")
        resp["Content-Disposition"] = f'attachment; filename="{filename}"'
        return resp

    @action(detail=False, methods=["post"], url_path="create_for_customer")
    def create_for_customer(self, request):
        username   = request.data.get("username", "").strip()
        flight_id  = request.data.get("flight_id")
        passengers = request.data.get("passengers", [])
        seat_ids   = request.data.get("seat_ids", [])

        if not flight_id:
            return Response({"detail": "flight_id is required"}, status=400)
        if not passengers:
            return Response({"detail": "At least one passenger is required"}, status=400)

        if username:
            try:
                target_user = UserAccount.objects.get(username=username)
            except UserAccount.DoesNotExist:
                return Response({"detail": f"No user with username '{username}'"}, status=404)
        else:
            target_user = request.user

        try:
            flight = Flight.objects.select_related("departure_airport", "arrival_airport").get(id=flight_id)
        except Flight.DoesNotExist:
            return Response({"detail": "Flight not found"}, status=404)

        if flight.status != "SCHEDULED":
            return Response({"detail": "Only SCHEDULED flights can be booked"}, status=400)

        seats = []
        if seat_ids:
            for sid in seat_ids:
                try:
                    seat = Seat.objects.get(id=sid, aircraft=flight.aircraft)
                    if not seat.is_available:
                        return Response({"detail": f"Seat {seat.seat_number} is not available"}, status=400)
                    seats.append(seat)
                except Seat.DoesNotExist:
                    return Response({"detail": f"Seat {sid} not found"}, status=404)

        def calc_price(ptype, seat_multiplier):
            base = flight.price * seat_multiplier
            if ptype == "KID":   return base * Decimal("0.5")
            if ptype == "CHILD": return base * Decimal("0.75")
            return base

        total_amount = Decimal("0.00")
        for i, p in enumerate(passengers):
            multiplier = seats[i].price_multiplier if i < len(seats) else Decimal("1.00")
            total_amount += calc_price(p.get("passenger_type", "ADULT"), multiplier)

        with transaction.atomic():
            booking = Booking.objects.create(
                user=target_user,
                flight=flight,
                total_amount=total_amount,
                booking_status="PENDING",
                created_by=request.user,
            )
            for i, p in enumerate(passengers):
                seat = seats[i] if i < len(seats) else None
                passenger_obj = Passenger.objects.create(
                    booking=booking,
                    full_name=p.get("full_name", ""),
                    date_of_birth=p.get("date_of_birth"),
                    gender=p.get("gender", ""),
                    passport_number=p.get("passport_number", ""),
                    nationality=p.get("nationality", ""),
                    passenger_type=p.get("passenger_type", "ADULT"),
                    phone_area_code=p.get("phone_area_code", "+254"),
                    phone_number=p.get("phone_number", ""),
                )
                if seat:
                    BoardingPass.objects.create(
                        booking=booking,
                        passenger=passenger_obj,
                        seat=seat,
                        price=calc_price(passenger_obj.passenger_type, seat.price_multiplier),
                        qr_code_data=f"BP_{booking.id}_{passenger_obj.id}_{seat.seat_number}",
                    )
                    seat.is_available = False
                    seat.save(update_fields=["is_available"])

        return Response({
            "detail": "Booking created successfully.",
            "confirmation_code": booking.confirmation_code,
            "booking_id": booking.id,
            "passenger_count": len(passengers),
            "total_amount": str(total_amount),
        }, status=201)


# ------------------ QR VERIFY ------------------

class VerifyQRView(APIView):
    permission_classes = [IsAgentOrAdmin]

    def post(self, request):
        qr = (request.data or {}).get("qr_code_data", "")
        if not qr:
            return Response({"detail": "qr_code_data is required"}, status=400)

        bp = BoardingPass.objects.filter(qr_code_data=qr).select_related(
            "booking", "booking__flight",
            "booking__flight__departure_airport",
            "booking__flight__arrival_airport",
            "seat", "passenger",
        ).first()
        if not bp:
            return Response({"valid": False, "detail": "Invalid or unrecognised QR code."}, status=404)

        booking   = bp.booking
        passenger = bp.passenger

        already_onboard = bp.is_checked_in

        # Build passenger photo URL
        passenger_photo_url = None
        if bp.passenger_photo:
            passenger_photo_url = f"/api/auth/media/{bp.passenger_photo.name}"

        payload = {
            "valid": True,
            "already_onboard": already_onboard,
            "boarding_pass_id": str(bp.id),
            "booking_reference": booking.confirmation_code,
            "status": booking.booking_status,
            "passenger_name": passenger.full_name if passenger else None,
            "passenger_type": passenger.passenger_type if passenger else None,
            "passenger_photo_url": passenger_photo_url,
            "flight_number": booking.flight.flight_number if booking.flight else None,
            "departure": booking.flight.departure_airport.code if booking.flight else None,
            "arrival": booking.flight.arrival_airport.code if booking.flight else None,
            "departure_time": booking.flight.departure_time,
            "seat_number": bp.seat.seat_number if bp.seat else None,
            "flight_id": booking.flight_id,
        }

        return Response(payload)


class ConfirmBoardingView(APIView):
    """Confirm or cancel boarding after agent verifies passenger photo"""
    permission_classes = [IsAgentOrAdmin]

    def post(self, request):
        boarding_pass_id = (request.data or {}).get("boarding_pass_id")
        action = (request.data or {}).get("action")  # 'confirm' or 'cancel'

        if not boarding_pass_id:
            return Response({"detail": "boarding_pass_id is required"}, status=400)
        
        if action not in ['confirm', 'cancel']:
            return Response({"detail": "action must be 'confirm' or 'cancel'"}, status=400)

        try:
            bp = BoardingPass.objects.select_related(
                "booking", "booking__flight",
                "booking__flight__departure_airport",
                "booking__flight__arrival_airport",
                "seat", "passenger",
            ).get(id=boarding_pass_id)
        except BoardingPass.DoesNotExist:
            return Response({"detail": "Boarding pass not found"}, status=404)

        booking = bp.booking
        passenger = bp.passenger

        if action == 'confirm':
            # Mark as checked in
            already_onboard = bp.is_checked_in
            if not already_onboard:
                bp.is_checked_in = True
                bp.save(update_fields=["is_checked_in"])

                if booking.booking_status == "CONFIRMED":
                    booking.booking_status = "ONBOARD"
                    booking.save(update_fields=["booking_status"])

            # Log the scan
            ScanLog.objects.create(
                scanned_by=request.user,
                boarding_pass=bp,
                booking_reference=booking.confirmation_code or "",
                passenger_name=passenger.full_name if passenger else "",
                flight_number=booking.flight.flight_number if booking.flight else "",
                seat_number=bp.seat.seat_number if bp.seat else "",
                booking_status=booking.booking_status,
                already_onboard=already_onboard,
            )

            return Response({
                "success": True,
                "action": "confirmed",
                "already_onboard": already_onboard,
                "status": booking.booking_status,
                "message": "Passenger marked as ON BOARD" if not already_onboard else "Passenger was already on board"
            })
        
        else:  # action == 'cancel'
            # Log the cancellation
            ScanLog.objects.create(
                scanned_by=request.user,
                boarding_pass=bp,
                booking_reference=booking.confirmation_code or "",
                passenger_name=passenger.full_name if passenger else "",
                flight_number=booking.flight.flight_number if booking.flight else "",
                seat_number=bp.seat.seat_number if bp.seat else "",
                booking_status=booking.booking_status,
                already_onboard=bp.is_checked_in,
                additional_data={"action": "cancelled_by_agent"}
            )

            return Response({
                "success": True,
                "action": "cancelled",
                "message": "Boarding cancelled by agent"
            })


class ScanHistoryView(APIView):
    permission_classes = [IsAgentOrAdmin]

    def get(self, request):
        logs = ScanLog.objects.filter(scanned_by=request.user).select_related("boarding_pass")[:200]
        data = [
            {
                "booking_reference": log.booking_reference,
                "passenger_name":    log.passenger_name,
                "flight_number":     log.flight_number,
                "seat_number":       log.seat_number,
                "status":            log.booking_status,
                "already_onboard":   log.already_onboard,
                "scanned_at":        log.scanned_at.isoformat(),
            }
            for log in logs
        ]
        return Response(data)