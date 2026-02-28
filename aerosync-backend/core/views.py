import random
import string
from datetime import datetime, date, timedelta, time as dt_time
from decimal import Decimal

from django.db import transaction
from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

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
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = FlightPagePagination

    def list(self, request, *args, **kwargs):
        # Ensure past flights are marked COMPLETED before returning results
        from core.tasks import mark_completed_flights
        mark_completed_flights()
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        qs = super().get_queryset()
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
        max_stops = self.request.query_params.get("max_stops")
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
        if max_stops:
            qs = qs.filter(stops__lte=max_stops)
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
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        flight = Flight.objects.select_related("departure_airport", "arrival_airport").get(id=data["flight_id"])
        
        # Check if flight is SCHEDULED
        if flight.status != 'SCHEDULED':
            return Response({"detail":"This flight is not available for booking. Only SCHEDULED flights can be booked."}, status=400)
        
        # Validate seat assignments
        seat_assignments = data["seat_assignments"]
        passenger_data = data["passengers"]

        # --- Server-side profile field validation (tamper prevention) ---
        # Only enforced for single-passenger bookings where the sole passenger
        # is the authenticated user themselves. Multi-passenger bookings are
        # exempt because the other passengers are companions (children, family)
        # whose details naturally differ from the booking user's profile.
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
                # No profile yet — allow the booking (profile fields were editable)
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
                total_amount=0  # Will be calculated after creating passengers
            )
            
            total_price = 0
            
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
                
                # Create boarding pass (without QR code yet)
                BoardingPass.objects.create(
                    booking=booking,
                    seat=seat,
                    passenger=passenger,
                    qr_code_data=f"BP_{booking.id}_{passenger.id}_{seat.seat_number}",
                    price=price
                )
            
            # Update total amount
            booking.total_amount = total_price
            booking.save()

        return Response(BookingSerializer(booking).data, status=201)

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        booking = self.get_object()
        
        # Ensure only the booking owner can cancel
        if booking.user != request.user:
            return Response({"detail": "You do not have permission to cancel this booking."}, status=403)
        
        # Can only cancel if not already confirmed or cancelled
        if booking.booking_status in ['CONFIRMED', 'CANCELLED']:
            return Response({"detail": "Cannot cancel a confirmed or already cancelled booking."}, status=400)
        
        booking.booking_status = 'CANCELLED'
        booking.save(update_fields=["booking_status"])
        return Response(BookingSerializer(booking).data)
    
    @action(detail=True, methods=["delete"], url_path="delete")
    def delete_booking(self, request, pk=None):
        booking = self.get_object()
        
        # Ensure only the booking owner can delete
        if booking.user != request.user:
            return Response({"detail": "You do not have permission to delete this booking."}, status=403)
        
        # Can only delete if flight has ended (status is COMPLETED)
        if booking.flight.status != 'COMPLETED':
            return Response({"detail": "Can only delete bookings for completed flights."}, status=400)
        
        # Delete the booking (this will cascade delete passengers and boarding passes)
        booking_id = booking.id
        booking.delete()
        
        return Response({"detail": f"Booking {booking_id} deleted successfully."}, status=200)

    @action(detail=True, methods=["post"], url_path="initiate_payment")
    def initiate_payment(self, request, pk=None):
        booking = self.get_object()
        
        # Ensure only the booking owner can initiate payment
        if booking.user != request.user:
            return Response({"detail": "You do not have permission to initiate payment for this booking."}, status=403)
        
        # Check if booking is already confirmed
        if booking.booking_status == 'CONFIRMED':
            return Response({"detail": "Booking is already confirmed."}, status=400)

        # --- Seat availability check ---
        # PENDING bookings don't lock seats; verify no CONFIRMED booking took them first.
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
        
        # Check if a payment already exists for this booking that is not FAILED
        existing_payment = Payment.objects.filter(
            booking=booking
        ).exclude(status='FAILED').first()
        
        if existing_payment:
            if existing_payment.status == 'SUCCESS':
                # Already successfully paid — do not allow overwrite
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
            # PENDING payment — user is switching provider; delete and re-create
            existing_payment.delete()
        
        # Create a Payment record
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

        # Per-provider validation, reference generation, and detail storage
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

        else:  # BANK_TRANSFER — detail filled by admin after verifying the transfer
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
            # Pass is available once confirmed/onboarding AND payment succeeded
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
        # Return all boarding passes for the booking
        boarding_passes = booking.boarding_passes.all()
        
        if not boarding_passes.exists():
            return Response({"detail": "No boarding passes found for this booking"}, status=404)
        
        # Return first boarding pass (backward compatibility)
        bp = boarding_passes.first()
        qr_png_base64 = make_qr_png_base64(bp.qr_code_data)
        out = BoardingPassSerializer(bp).data
        out["qr_png_base64"] = qr_png_base64
        return Response(out)
    
    @action(detail=True, methods=["get"], url_path="all_boarding_passes")
    def all_boarding_passes(self, request, pk=None):
        booking = self.get_object()
        
        latest_payment = booking.payments.order_by('-created_at').first()
        if booking.booking_status not in ('CONFIRMED', 'ONBOARD') or not latest_payment or latest_payment.status != 'SUCCESS':
            return Response({"detail": "Payment required. Complete payment to download boarding passes."}, status=402)
        
        boarding_passes = booking.boarding_passes.all()
        
        if not boarding_passes.exists():
            return Response({"detail": "No boarding passes found for this booking"}, status=404)
        
        # Return list of all boarding passes with QR codes
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
        
        # Create ZIP file containing all boarding passes
        import zipfile
        from io import BytesIO
        
        zip_buffer = BytesIO()
        
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for bp in boarding_passes:
                try:
                    # Generate boarding pass PNG for this passenger
                    passenger = bp.passenger
                    png_bytes = build_boarding_pass_png(booking, passenger)
                    filename = f"boarding-pass-{booking.confirmation_code}-{passenger.full_name.replace(' ', '_')}-{passenger.id}.png"
                    zip_file.writestr(filename, png_bytes)
                except Exception as e:
                    # Log error but continue with other passes
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
        
        # Get passenger ID from query params (optional)
        passenger_id = request.query_params.get("passenger_id")
        
        if passenger_id:
            # Generate boarding pass for specific passenger
            try:
                passenger = booking.passengers.get(id=passenger_id)
                png_bytes = build_boarding_pass_png(booking, passenger)
                filename = f"boarding-pass-{booking.confirmation_code}-{passenger.full_name.replace(' ', '_')}-{passenger.id}.png"
            except Passenger.DoesNotExist:
                return Response({"detail": "Passenger not found in this booking"}, status=404)
        else:
            # Generate boarding pass for first passenger (backward compatibility)
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
        ]
        return Response(providers)


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

        # Class distribution — roughly realistic
        # First:    rows 1-2      (12 seats)  or 10% whichever smaller
        # Business: rows 3-8      (36 seats)  or 20%
        # Economy:  rest
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
        # Auto-complete past flights on every admin flight-list request
        from core.tasks import mark_completed_flights
        mark_completed_flights()
        return super().list(request, *args, **kwargs)

    # ---- Allowed departure hours ----
    DEPART_HOURS = [6, 10, 12, 14, 16, 18, 20]

    @action(detail=False, methods=["post"], url_path="generate_flights")
    def generate_flights(self, request):
        import itertools

        DAYS  = 30
        CYCLE = 3   # all routes covered within 3 days
        HOURS = self.DEPART_HOURS

        # ---- Data checks ----
        airports     = list(Airport.objects.all())
        aircraft_list = list(Aircraft.objects.all())
        airlines_list = list(Airline.objects.filter(is_active=True))

        if len(airports) < 2:
            return Response({"detail": "Need at least 2 airports to generate flights."}, status=400)
        if not aircraft_list:
            return Response({"detail": "No aircraft available. Please add aircraft first."}, status=400)
        if not airlines_list:
            return Response({"detail": "No active airlines. Please seed or add airlines first."}, status=400)

        today = date.today()

        # ---- All directed airport pairs ----
        all_pairs = list(itertools.permutations(airports, 2))
        # Split into CYCLE buckets so each bucket is covered once per cycle
        buckets = [[] for _ in range(CYCLE)]
        for i, pair in enumerate(all_pairs):
            buckets[i % CYCLE].append(pair)

        # ---- Pre-load existing bookings to avoid aircraft double-booking ----
        #  key: (aircraft_id, date_obj, hour_int)
        existing_slots = set(
            Flight.objects.filter(
                departure_time__date__gte=today + timedelta(days=1),
                departure_time__date__lte=today + timedelta(days=DAYS),
            ).values_list("aircraft_id", "departure_time__date", "departure_time__hour")
        )

        # ---- Pre-generate unique flight numbers ----
        existing_fns: set = set(Flight.objects.values_list("flight_number", flat=True))
        pending_fns:  set = set()

        def _new_fn() -> str:
            while True:
                fn = "AS" + "".join(random.choices(string.digits, k=5))
                if fn not in existing_fns and fn not in pending_fns:
                    pending_fns.add(fn)
                    return fn

        # ---- Build flight objects ----
        flights_to_create = []
        created  = 0
        skipped  = 0
        n_ac     = len(aircraft_list)
        n_hr     = len(HOURS)
        n_al     = len(airlines_list)

        for day_offset in range(DAYS):
            current_date = today + timedelta(days=day_offset + 1)
            pairs_today  = buckets[day_offset % CYCLE]

            ac_idx  = day_offset % n_ac   # stagger starting aircraft per day
            hr_idx  = 0
            al_idx  = day_offset % n_al

            for dep_ap, arr_ap in pairs_today:
                # Find next free (aircraft, hour) slot for this day
                found = False
                for attempt in range(n_ac * n_hr):
                    ac   = aircraft_list[(ac_idx + attempt) % n_ac]
                    hour = HOURS[(hr_idx + attempt) % n_hr]
                    key  = (ac.id, current_date, hour)
                    if key not in existing_slots:
                        existing_slots.add(key)
                        ac_idx = (ac_idx + attempt + 1) % n_ac
                        hr_idx = (hr_idx + attempt + 1) % n_hr
                        found  = True
                        break

                if not found:
                    skipped += 1
                    continue

                airline = airlines_list[al_idx % n_al]
                al_idx += 1

                dep_dt = timezone.make_aware(
                    datetime.combine(current_date, dt_time(hour, 0))
                )
                # Duration: same country = 1.5 h, else = 4 h
                dur_h = 1.5 if dep_ap.country == arr_ap.country else 4.0
                arr_dt = dep_dt + timedelta(hours=dur_h)

                # Price: domestic vs international with small variance
                base   = 8_000 if dep_ap.country == arr_ap.country else 35_000
                price  = max(3_000, base + random.randint(-1_000, 5_000))

                flights_to_create.append(Flight(
                    flight_number    = _new_fn(),
                    aircraft         = ac,
                    airline          = airline.name,
                    departure_airport = dep_ap,
                    arrival_airport  = arr_ap,
                    departure_time   = dep_dt,
                    arrival_time     = arr_dt,
                    price            = price,
                    trip_type        = "ONE_WAY",
                    stops            = 0,
                    status           = "SCHEDULED",
                ))
                created += 1

        # bulk_create is safe here because flight_number is already set
        Flight.objects.bulk_create(flights_to_create, batch_size=500)

        return Response({
            "detail": f"Generated {created} flights over {DAYS} days. {skipped} skipped (aircraft fully booked).",
            "created":       created,
            "skipped":       skipped,
            "days":          DAYS,
            "route_pairs":   len(all_pairs),
            "airports":      len(airports),
            "aircraft_used": n_ac,
            "airlines_used": n_al,
        })


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
        booking = self.get_object()
        payment = booking.payments.order_by("-created_at").first()
        if not payment:
            return Response({"detail": "No payment found for this booking."}, status=404)
        payment.status = "SUCCESS"
        payment.save(update_fields=["status"])
        booking.booking_status = "CONFIRMED"
        booking.save(update_fields=["booking_status"])
        return Response({"detail": "Payment confirmed. Booking is now CONFIRMED."})

    @action(detail=True, methods=["post"], url_path="update_status")
    def update_status(self, request, pk=None):
        booking = self.get_object()
        new_status = request.data.get("booking_status")
        valid = ["PENDING", "CONFIRMED", "CANCELLED", "FAILED"]
        if new_status not in valid:
            return Response({"detail": f"Invalid status. Choose from: {valid}"}, status=400)
        booking.booking_status = new_status
        booking.save(update_fields=["booking_status"])
        return Response({"detail": f"Status updated to {new_status}."})


class UserAdminViewSet(viewsets.ModelViewSet):
    queryset = UserAccount.objects.select_related('profile').all().order_by("-date_joined")
    serializer_class = AdminUserSerializer
    permission_classes = [IsAdmin]
    # Prevent deletion — deactivate instead ("post" is required for the set_password action)
    http_method_names = ["get", "post", "patch", "head", "options"]

    def perform_update(self, serializer):
        """Auto-generate staff_id when a user is promoted to AGENT role."""
        instance = serializer.instance
        new_role = serializer.validated_data.get("role", instance.role)
        if new_role == "AGENT" and not instance.staff_id:
            # Generate unique AGT-XXXXXX id
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
    """Public read-only endpoint — lists active airlines for dropdowns."""
    queryset = Airline.objects.filter(is_active=True)
    serializer_class = AirlineSerializer
    permission_classes = [permissions.IsAuthenticated]


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

        # revenue: sum of successful payments
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


# ------------------ AGENT ------------------

class AgentFlightViewSet(viewsets.ReadOnlyModelViewSet):
    """Agents can browse flights but cannot edit them."""
    queryset = Flight.objects.select_related("departure_airport", "arrival_airport").filter(status="SCHEDULED").order_by("departure_time")
    serializer_class = FlightSerializer
    permission_classes = [IsAgent]
    pagination_class = FlightPagePagination

    def get_queryset(self):
        qs = super().get_queryset()
        # When a flight-number search is provided, bypass the SCHEDULED status filter
        # and search across ALL flights so agents can find any flight by number.
        search = self.request.query_params.get("search")
        if search:
            return (
                Flight.objects
                .select_related("departure_airport", "arrival_airport")
                .filter(flight_number__icontains=search)
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
    """Agent-specific booking operations."""
    permission_classes = [IsAgent]

    def list(self, request):
        """Return bookings created by this agent (last 7 days + upcoming)."""
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
                "has_boarding_pass": b.boarding_passes.exists(),
            })
        return Response(data)

    def retrieve(self, request, pk=None):
        """Return the latest status for a single booking created by this agent."""
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
            "has_boarding_pass": b.boarding_passes.exists(),
        })

    @action(detail=True, methods=["get"], url_path="boarding_pass_png")
    def boarding_pass_png(self, request, pk=None):
        """Download a boarding pass PNG — only for bookings this agent created."""
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
        """Create a booking for a named customer."""
        username   = request.data.get("username", "").strip()
        flight_id  = request.data.get("flight_id")
        passengers = request.data.get("passengers", [])
        seat_ids   = request.data.get("seat_ids", [])

        if not flight_id:
            return Response({"detail": "flight_id is required"}, status=400)
        if not passengers:
            return Response({"detail": "At least one passenger is required"}, status=400)

        # Username is optional — use agent's own account if not provided
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

        # Validate seats if provided
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
            """Price = flight base × seat class multiplier × passenger-type discount."""
            base = flight.price * seat_multiplier
            if ptype == "KID":   return base * Decimal("0.5")
            if ptype == "CHILD": return base * Decimal("0.75")
            return base

        # Pre-compute total using per-seat multipliers (seats list matches passengers by index)
        total_amount = Decimal("0.00")
        for i, p in enumerate(passengers):
            multiplier = seats[i].price_multiplier if i < len(seats) else Decimal("1.00")
            total_amount += calc_price(p.get("passenger_type", "ADULT"), multiplier)

        with transaction.atomic():
            booking = Booking.objects.create(
                user=target_user,
                flight=flight,
                total_amount=total_amount,
                booking_status="PENDING",   # Requires payment to confirm
                created_by=request.user,    # Track which agent created this
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
        passenger = bp.passenger   # the specific passenger for THIS boarding pass

        # ── Per-boarding-pass duplicate detection ──────────────────────────
        # Each passenger has their own boarding pass with their own is_checked_in flag.
        # This prevents a false "duplicate" when other passengers in the same
        # multi-passenger booking are scanned for the first time.
        already_onboard = bp.is_checked_in

        if not already_onboard:
            # Mark this individual boarding pass as checked in
            bp.is_checked_in = True
            bp.save(update_fields=["is_checked_in"])

            # Update booking-level status to ONBOARD when the first passenger boards
            if booking.booking_status == "CONFIRMED":
                booking.booking_status = "ONBOARD"
                booking.save(update_fields=["booking_status"])

        payload = {
            "valid": True,
            "already_onboard": already_onboard,
            "booking_reference": booking.confirmation_code,
            "status": booking.booking_status,
            "passenger_name": passenger.full_name if passenger else None,
            "flight_number": booking.flight.flight_number if booking.flight else None,
            "departure": booking.flight.departure_airport.code if booking.flight else None,
            "arrival": booking.flight.arrival_airport.code if booking.flight else None,
            "departure_time": booking.flight.departure_time,
            "seat_number": bp.seat.seat_number if bp.seat else None,
            "flight_id": booking.flight_id,
        }

        # Persist scan log
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

        return Response(payload)


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