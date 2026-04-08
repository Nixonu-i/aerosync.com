"""
core/tasks.py
Lightweight periodic task helpers — no external scheduler needed.
"""
import logging
from datetime import timedelta

from django.utils import timezone

logger = logging.getLogger(__name__)


def mark_completed_flights():
    """
    Finds every SCHEDULED or DELAYED flight whose arrival_time is more than
    1 hour in the past and marks it as COMPLETED.

    Safe to call from multiple threads / workers — Django's .update() is atomic.
    Returns the number of rows updated.
    """
    # Import here to avoid AppRegistry-not-ready errors when called early
    from core.models import Flight
<<<<<<< HEAD

=======
    from django.utils import timezone
    from datetime import timedelta
    import logging
    
    logger = logging.getLogger(__name__)
    
>>>>>>> 9007297460809f07bfaa364ef37dd6359fbbe48b
    cutoff = timezone.now() - timedelta(hours=1)
    updated = Flight.objects.filter(
        status__in=["SCHEDULED", "DELAYED"],
        arrival_time__lte=cutoff,
    ).update(status="COMPLETED")

    if updated:
        logger.info("[AeroSync] Auto-completed %d flight(s).", updated)

    return updated
<<<<<<< HEAD
=======


def mark_completed_bookings():
    """
    Finds every CONFIRMED or PENDING booking whose flight is COMPLETED and:
    - Marks bookings with SUCCESS payment as COMPLETED
    - Marks bookings without payment as FAILED
    
    Safe to call from multiple threads / workers — Django's .update() is atomic.
    Returns the number of rows updated.
    """
    from core.models import Booking, Payment
    from django.utils import timezone
    from django.db.models import Q
    import logging
    
    logger = logging.getLogger(__name__)
    
    # Get all bookings for COMPLETED flights that are still CONFIRMED or PENDING
    bookings_to_update = Booking.objects.filter(
        flight__status='COMPLETED',
        booking_status__in=['CONFIRMED', 'PENDING']
    )
    
    confirmed_count = 0
    failed_count = 0
    
    for booking in bookings_to_update:
        # Check if booking has successful payment
        has_payment = booking.payments.filter(status='SUCCESS').exists()
        
        if has_payment:
            # Paid booking → COMPLETED
            Booking.objects.filter(id=booking.id).update(booking_status='COMPLETED')
            confirmed_count += 1
            logger.info(f"[AeroSync] Booking {booking.confirmation_code} marked as COMPLETED (paid)")
        else:
            # Unpaid booking → FAILED
            Booking.objects.filter(id=booking.id).update(booking_status='FAILED')
            failed_count += 1
            logger.warning(f"[AeroSync] Booking {booking.confirmation_code} marked as FAILED (unpaid)")
    
    total = confirmed_count + failed_count
    if total > 0:
        logger.info(f"[AeroSync] Auto-completed {total} booking(s): {confirmed_count} confirmed, {failed_count} failed")
    
    return total
>>>>>>> 9007297460809f07bfaa364ef37dd6359fbbe48b
