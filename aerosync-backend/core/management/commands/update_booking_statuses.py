from django.core.management.base import BaseCommand
from django.utils import timezone
from core.models import Booking, Flight
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Update booking statuses based on flight completion and payment status'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be changed without actually changing it',
        )
        parser.add_argument(
            '--flight-id',
            type=int,
            help='Only process bookings for a specific flight ID',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        flight_id = options.get('flight_id')
        
        self.stdout.write('Starting booking status update...')
        
        # Get all completed flights
        completed_flights = Flight.objects.filter(status='COMPLETED')
        
        if flight_id:
            completed_flights = completed_flights.filter(id=flight_id)
            self.stdout.write(f'Filtering to flight ID {flight_id}')
        
        total_updated = 0
        total_failed = 0
        total_skipped = 0
        
        for flight in completed_flights:
            bookings = Booking.objects.filter(flight=flight).exclude(
                booking_status__in=['CONFIRMED', 'CANCELLED']
            )
            
            self.stdout.write(f'\nProcessing flight {flight.flight_number} ({flight.id}): {bookings.count()} bookings to check')
            
            for booking in bookings:
                old_status = booking.booking_status
                
                if dry_run:
                    # Just show what would happen
                    if booking.has_successful_payment():
                        new_status = 'CONFIRMED'
                    else:
                        new_status = 'FAILED'
                    
                    if new_status != old_status:
                        self.stdout.write(
                            f'  [{booking.confirmation_code}] Would change: {old_status} → {new_status}'
                            f' (Payment: {"YES" if booking.has_successful_payment() else "NO"})'
                        )
                        total_updated += 1
                else:
                    # Actually update
                    try:
                        changed = booking.update_status_based_on_payment_and_flight(save=True)
                        if changed:
                            if booking.booking_status == 'CONFIRMED':
                                total_updated += 1
                                self.stdout.write(
                                    f'  ✅ [{booking.confirmation_code}] {old_status} → CONFIRMED'
                                )
                            elif booking.booking_status == 'FAILED':
                                total_failed += 1
                                self.stdout.write(
                                    f'  ❌ [{booking.confirmation_code}] {old_status} → FAILED (unpaid)'
                                )
                        else:
                            total_skipped += 1
                    except Exception as e:
                        self.stderr.write(f'  ⚠️  Error updating {booking.confirmation_code}: {str(e)}')
                        total_skipped += 1
        
        self.stdout.write('\n' + '='*60)
        if dry_run:
            self.stdout.write(self.style.WARNING(f'DRY RUN - No changes made'))
        self.stdout.write(self.style.SUCCESS(f'✅ Updated: {total_updated} bookings'))
        if not dry_run:
            self.stdout.write(self.style.ERROR(f'❌ Failed (unpaid): {total_failed} bookings'))
            self.stdout.write(f'⏭️  Skipped: {total_skipped} bookings')
        self.stdout.write('='*60)
