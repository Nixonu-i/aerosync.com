"""
Management command: auto_complete_flights

Usage:
    python manage.py auto_complete_flights

Marks every SCHEDULED / DELAYED flight whose arrival_time is more than
1 hour in the past as COMPLETED.

Can be wired to a system cron job, e.g.:
    */10 * * * * /path/to/venv/bin/python /path/to/manage.py auto_complete_flights
"""
from django.core.management.base import BaseCommand

from core.tasks import mark_completed_flights


class Command(BaseCommand):
    help = (
        "Mark SCHEDULED/DELAYED flights as COMPLETED when their "
        "arrival_time is more than 1 hour in the past."
    )

    def handle(self, *args, **options):
        updated = mark_completed_flights()
        if updated:
            self.stdout.write(
                self.style.SUCCESS(f"Marked {updated} flight(s) as COMPLETED.")
            )
        else:
            self.stdout.write("No flights needed updating.")
