from django.core.management.base import BaseCommand
from core.models import Aircraft, Seat


class Command(BaseCommand):
    help = 'Generate seats for aircrafts that do not have any seats yet'

    def add_arguments(self, parser):
        parser.add_argument(
            '--aircraft-id',
            type=str,
            help='Specific aircraft ID (UUID) to generate seats for. If not provided, all aircrafts without seats will be processed.'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without actually creating seats'
        )

    def handle(self, *args, **options):
        aircraft_id = options.get('aircraft_id')
        dry_run = options.get('dry_run')
        
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN - No changes will be made\n'))
        
        # Get aircrafts to process
        if aircraft_id:
            try:
                from uuid import UUID
                aircrafts = Aircraft.objects.filter(id=UUID(aircraft_id))
                if not aircrafts.exists():
                    self.stdout.write(self.style.ERROR(f'Aircraft with ID {aircraft_id} not found'))
                    return
            except ValueError:
                self.stdout.write(self.style.ERROR(f'Invalid UUID format: {aircraft_id}'))
                return
        else:
            # Get all aircrafts and filter those without seats
            all_aircrafts = Aircraft.objects.all()
            aircrafts_with_seats = set(
                Seat.objects.values_list('aircraft_id', flat=True).distinct()
            )
            aircrafts = [a for a in all_aircrafts if a.id not in aircrafts_with_seats]
        
        if not aircrafts:
            self.stdout.write(self.style.SUCCESS('All aircrafts already have seats!'))
            return
        
        self.stdout.write(f'Processing {len(aircrafts) if isinstance(aircrafts, list) else aircrafts.count()} aircraft(s)...\n')
        
        total_created = 0
        
        for aircraft in aircrafts:
            self.generate_seats_for_aircraft(aircraft, dry_run)
            
            if not dry_run:
                total_created += aircraft.total_seats
        
        if dry_run:
            self.stdout.write(self.style.WARNING('\nDRY RUN COMPLETE - No seats were created'))
        else:
            self.stdout.write(self.style.SUCCESS(
                f'\n✓ Successfully generated {total_created} seats for {len(aircrafts)} aircraft(s)'
            ))

    def generate_seats_for_aircraft(self, aircraft, dry_run=False):
        """Generate seats for a single aircraft using the same logic as the admin view"""
        total = aircraft.total_seats
        
        # Check if seats already exist
        existing_count = Seat.objects.filter(aircraft=aircraft).count()
        if existing_count > 0:
            self.stdout.write(f'⚠️  Skipping {aircraft.number_plate} - already has {existing_count} seats')
            return
        
        # Calculate seat distribution
        first_count = min(12, max(1, int(total * 0.10)))
        business_count = min(36, max(1, int(total * 0.20)))
        economy_count = total - first_count - business_count
        
        class_limits = [
            ("FIRST", first_count, 2.50),
            ("BUSINESS", business_count, 1.80),
            ("ECONOMY", economy_count, 1.00),
        ]
        
        letters = ["A", "B", "C", "D", "E", "F"]
        row = 1
        seats_to_create = []
        
        for flight_class, count, multiplier in class_limits:
            class_created = 0
            while class_created < count:
                for letter in letters:
                    if class_created >= count:
                        break
                    seat_number = f"{row}{letter}"
                    seats_to_create.append(
                        Seat(
                            aircraft=aircraft,
                            seat_number=seat_number,
                            flight_class=flight_class,
                            price_multiplier=multiplier,
                        )
                    )
                    class_created += 1
                row += 1
        
        if dry_run:
            self.stdout.write(f'  Would create {len(seats_to_create)} seats for {aircraft.number_plate}:')
            self.stdout.write(f'    - FIRST: {first_count} seats')
            self.stdout.write(f'    - BUSINESS: {business_count} seats')
            self.stdout.write(f'    - ECONOMY: {economy_count} seats')
        else:
            Seat.objects.bulk_create(seats_to_create)
            self.stdout.write(self.style.SUCCESS(
                f'✓ Created {len(seats_to_create)} seats for {aircraft.number_plate} '
                f'(First: {first_count}, Business: {business_count}, Economy: {economy_count})'
            ))
