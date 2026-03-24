"""
Management command to delete unverified users older than specified days.
Run this periodically (e.g., daily via cron) to clean up pending accounts.

Usage:
    python manage.py cleanup_unverified_users --days 7
"""

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta

User = get_user_model()

class Command(BaseCommand):
    help = 'Delete unverified user accounts older than specified days'

    def add_arguments(self, parser):
        parser.add_argument(
            '--days',
            type=int,
            default=7,
            help='Number of days after which to delete unverified accounts (default: 7)'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be deleted without actually deleting'
        )

    def handle(self, *args, **options):
        days = options['days']
        dry_run = options['dry_run']
        
        cutoff_date = timezone.now() - timedelta(days=days)
        
        # Find unverified users created before cutoff date
        unverified_users = User.objects.filter(
            is_pending_verification=True,
            is_email_verified=False,
            date_joined__lt=cutoff_date
        )
        
        count = unverified_users.count()
        
        if count == 0:
            self.stdout.write(
                self.style.SUCCESS(f'✓ No unverified users older than {days} days found')
            )
            return
        
        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f'🔍 DRY RUN: Would delete {count} unverified user(s) older than {days} days:'
                )
            )
            for user in unverified_users[:10]:  # Show first 10
                self.stdout.write(f'  - {user.email} (created: {user.date_joined})')
            if count > 10:
                self.stdout.write(f'  ... and {count - 10} more')
        else:
            # Delete the unverified users
            for user in unverified_users:
                user.delete()
            
            self.stdout.write(
                self.style.SUCCESS(
                    f'✓ Successfully deleted {count} unverified user(s) older than {days} days'
                )
            )
