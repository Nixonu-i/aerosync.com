from django.db.models.signals import post_save
from django.dispatch import receiver
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .models import Payment, Booking, Flight


@receiver(post_save, sender=Payment)
def auto_confirm_booking_on_payment_success(sender, instance, **kwargs):
    """
    Automatically confirm the booking when its payment is marked SUCCESS.
    Also sends boarding pass email when booking becomes confirmed.
    """
    import logging
    logger = logging.getLogger('core.signals')
    
    if instance.status == 'SUCCESS':
        booking = instance.booking
        old_status = booking.booking_status
        
        logger.info(f"Payment {instance.id} is SUCCESS. Booking {booking.id} status: {old_status}")
        
        if booking.booking_status != 'CONFIRMED':
            booking.booking_status = 'CONFIRMED'
            booking.save(update_fields=['booking_status'])
            
            logger.info(f"Booking {booking.id} set to CONFIRMED")
            
            # Send boarding pass email only if status just changed to CONFIRMED
            if old_status != 'CONFIRMED':
                logger.info(f"Sending boarding pass email for booking {booking.id} (was {old_status})")
                try:
                    from accounts.services.email_service import EmailVerificationService
                    from core.services import ensure_boarding_pass
                    
                    # Send email for each passenger in the booking
                    for passenger in booking.passengers.all():
                        # Ensure boarding pass exists before trying to send it
                        boarding_pass = booking.boarding_passes.filter(passenger=passenger).first()
                        if not boarding_pass:
                            logger.info(f"Boarding pass missing for passenger {passenger.full_name}, generating...")
                            try:
                                # Get the seat for this passenger
                                seat = booking.seats.filter(passenger=passenger).first()
                                if seat:
                                    boarding_pass = ensure_boarding_pass(booking, seat)
                                    logger.info(f"Generated boarding pass for {passenger.full_name}")
                                else:
                                    logger.error(f"No seat found for passenger {passenger.full_name}")
                                    continue
                            except Exception as bp_error:
                                logger.error(f"Failed to generate boarding pass: {str(bp_error)}")
                                continue
                        
                        if boarding_pass:
                            logger.info(f"Sending boarding pass for passenger {passenger.full_name}")
                            EmailVerificationService.send_boarding_pass_email(booking, passenger)
                        else:
                            logger.error(f"Cannot send email - no boarding pass for {passenger.full_name}")
                except Exception as e:
                    logger.error(f"Failed to send boarding pass email for booking {booking.id}: {str(e)}", exc_info=True)


@receiver(post_save, sender=Flight)
def auto_update_bookings_on_flight_completion(sender, instance, **kwargs):
    """
    Automatically update all bookings for a flight when flight status changes to COMPLETED.
    
    This ensures:
    - Paid bookings → CONFIRMED (and sends boarding pass email)
    - Unpaid bookings → FAILED
    """
    import logging
    logger = logging.getLogger('core.signals')
    
    # Only process if flight status is now COMPLETED
    if instance.status == 'COMPLETED':
        # Get all unpaid/pending bookings for this flight
        bookings = Booking.objects.filter(
            flight=instance
        ).exclude(
            booking_status__in=['CONFIRMED', 'CANCELLED']
        )
        
        updated_count = 0
        failed_count = 0
        
        for booking in bookings:
            try:
                old_status = booking.booking_status
                changed = booking.update_status_based_on_payment_and_flight(save=True)
                if changed:
                    if booking.booking_status == 'CONFIRMED':
                        updated_count += 1
                        # Send boarding pass email for newly confirmed bookings
                        try:
                            from accounts.services.email_service import EmailVerificationService
                            # Only send if status just changed to CONFIRMED (not already confirmed)
                            if old_status != 'CONFIRMED':
                                for passenger in booking.passengers.all():
                                    boarding_pass = booking.boarding_passes.filter(passenger=passenger).first()
                                    if boarding_pass:
                                        EmailVerificationService.send_boarding_pass_email(booking, passenger)
                        except Exception as e:
                            logger.error(f"Failed to send boarding pass email for booking {booking.id}: {str(e)}")
                    elif booking.booking_status == 'FAILED':
                        failed_count += 1
                        logger.warning(f"Booking {booking.confirmation_code} marked as FAILED (flight completed, no payment)")
            except Exception as e:
                logger.error(f"Failed to update booking {booking.id}: {str(e)}")
        
        if updated_count > 0 or failed_count > 0:
            logger.info(f"Flight {instance.flight_number} completed: {updated_count} bookings confirmed, {failed_count} bookings failed")


@receiver(post_save, sender=Payment)
def broadcast_payment_update(sender, instance, created, update_fields, **kwargs):
    """
    Broadcast real-time payment status updates via WebSocket.
    Notifies:
    - Customer: About their payment status changes (includes booking status)
    - Agents: About all payment changes (for dashboard visibility)
    
    IMPORTANT: This signal is triggered by BOTH:
    - Admin manually changing payment status
    - Pesapal IPN automatically updating payment status
    
    Skip broadcast if only metadata fields changed (not status).
    """
    import logging
    logger = logging.getLogger('core.signals')
    
    # Skip if this is a new payment creation
    if created:
        logger.info(f"Skipping broadcast for new payment {instance.id}")
        return
    
    # Skip broadcast if only non-status fields changed
    # Only broadcast when payment STATUS actually changes
    if update_fields and 'status' not in update_fields:
        logger.debug(f"Skipping broadcast for payment {instance.id} - status unchanged")
        return
    
    # Get booking reference early to avoid scope issues
    booking = instance.booking if hasattr(instance, 'booking') else None
    
    # Prepare update payload
    from .serializers import PaymentSerializer
    try:
        serializer = PaymentSerializer(instance)
        payment_data = serializer.data
    except Exception as e:
        logger.error(f"Failed to serialize payment {instance.id}: {str(e)}")
        payment_data = {
            'id': str(instance.id),
            'status': instance.status,
            'amount': str(instance.amount),
        }
    
    # Get current booking status to include in broadcast
    booking_status = booking.booking_status if booking else None
    
    update_data = {
        'type': 'payment_update',  # Must match the handler method name in websocket.py
        'payment': payment_data,
        'booking_id': str(instance.booking.id) if instance.booking else None,
        'booking_status': booking_status,  # Include booking status for frontend
        'changed_fields': list(update_fields) if update_fields else None,
    }
    
    booking = instance.booking
    
    # Get channel layer
    channel_layer = get_channel_layer()
    
    # Notify the customer who owns this booking/payment
    if booking.user_id:
        logger.info(f"💰 Sent payment update to user {booking.user_id} (Payment: {instance.status}, Booking: {booking_status})")
        async_to_sync(channel_layer.group_send)(
            f"user_{booking.user_id}",
            {'type': 'payment_update', **update_data}
        )
    
    # Notify all agents about the change
    async_to_sync(channel_layer.group_send)(
        "agents",
        {'type': 'payment_update', **update_data}
    )


@receiver(post_save, sender=Booking)
def broadcast_booking_update(sender, instance, created, update_fields, **kwargs):
    """
    Broadcast real-time updates when booking changes via WebSocket.
    Notifies:
    - Customer: Always notified about their booking changes
    - Agents: Notified about all booking changes (for dashboard visibility)
    """
    import logging
    logger = logging.getLogger('core.signals')
    
    # Skip if this is a new booking creation (handled separately if needed)
    if created:
        logger.info(f"Skipping broadcast for new booking {instance.id}")
        return
    
    # Prepare update payload
    from .serializers import BookingSerializer
    try:
        serializer = BookingSerializer(instance)
        booking_data = serializer.data
    except Exception as e:
        logger.error(f"Failed to serialize booking {instance.id}: {str(e)}")
        booking_data = {
            'id': str(instance.id),
            'booking_status': instance.booking_status,
            'confirmation_code': instance.confirmation_code,
        }
    
    update_data = {
        'type': 'booking_updated',
        'booking': booking_data,
        'changed_fields': list(update_fields) if update_fields else None,
    }
    
    logger.info(f"Broadcasting update for booking {instance.id} (user {instance.user_id}, status {instance.booking_status})")
    
    # Get channel layer
    channel_layer = get_channel_layer()
    
    # Notify the customer who owns this booking
    if instance.user_id:
        logger.info(f"Sending update to user {instance.user_id}")
        async_to_sync(channel_layer.group_send)(
            f"user_{instance.user_id}",
            {'type': 'booking_updated', **update_data}
        )
    
    # Notify all agents about the change (for their dashboards)
    logger.info("Sending update to all agents")
    async_to_sync(channel_layer.group_send)(
        "agents",
        {'type': 'booking_updated', **update_data}
    )