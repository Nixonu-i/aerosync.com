"""
Management command: auto_complete_bookings

Usage:
    python manage.py auto_complete_bookings

Marks every CONFIRMED or PENDING booking as:
- COMPLETED if the flight is COMPLETED and booking has SUCCESS payment
- FAILED if the flight is COMPLETED but no successful payment

Can be wired to a system cron job, e.g.:
    */10 * * * * /path/to/venv/bin/python /path/to/manage.py auto_complete_bookings
"""
from django.core.management.base import BaseCommand

from core.tasks import mark_completed_bookings


class Command(BaseCommand):
    help = (
        "Mark CONFIRMED/PENDING bookings as COMPLETED/FAILED when their "
        "flight is COMPLETED based on payment status."
    )

    def handle(self, *args, **options):
        updated = mark_completed_bookings()
        if updated:
            self.stdout.write(
                self.style.SUCCESS(f"Auto-completed {updated} booking(s).")
            )
        else:
            self.stdout.write("No bookings needed updating.")
