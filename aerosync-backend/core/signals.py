from django.db.models.signals import post_save
from django.dispatch import receiver
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .models import Payment, Booking


@receiver(post_save, sender=Payment)
def auto_confirm_booking_on_payment_success(sender, instance, **kwargs):
    """
    Automatically confirm the booking when its payment is marked SUCCESS.
    """
    if instance.status == 'SUCCESS':
        booking = instance.booking
        if booking.booking_status != 'CONFIRMED':
            booking.booking_status = 'CONFIRMED'
            booking.save(update_fields=['booking_status'])


@receiver(post_save, sender=Payment)
def broadcast_payment_update(sender, instance, created, update_fields, **kwargs):
    """
    Broadcast real-time payment status updates via WebSocket.
    Notifies:
    - Customer: About their payment status changes
    - Agents: About all payment changes (for dashboard visibility)
    
    IMPORTANT: This signal is triggered by BOTH:
    - Admin manually changing payment status
    - Pesapal IPN automatically updating payment status
    """
    import logging
    logger = logging.getLogger('core.signals')
    
    # Skip if this is a new payment creation
    if created:
        logger.info(f"Skipping broadcast for new payment {instance.id}")
        return
    
    # Prepare update payload
    from .serializers import PaymentSerializer
    try:
        serializer = PaymentSerializer(instance)
        payment_data = serializer.data
    except Exception as e:
        logger.error(f"Failed to serialize payment {instance.id}: {str(e)}")
        payment_data = {
            'id': instance.id,
            'status': instance.status,
            'amount': str(instance.amount),
        }
    
    update_data = {
        'type': 'payment_updated',
        'payment': payment_data,
        'booking_id': instance.booking.id,
        'changed_fields': list(update_fields) if update_fields else None,
    }
    
    booking = instance.booking
    
    # Get channel layer
    channel_layer = get_channel_layer()
    
    # Notify the customer who owns this booking/payment
    if booking.user_id:
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
            'id': instance.id,
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
            {'type': 'booking_update', **update_data}
        )
    
    # Notify all agents about the change (for their dashboards)
    logger.info("Sending update to all agents")
    async_to_sync(channel_layer.group_send)(
        "agents",
        {'type': 'booking_update', **update_data}
    )