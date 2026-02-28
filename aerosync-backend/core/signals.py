from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Payment


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