"""
Fix for users stuck in profile completion loop

If users have completed their profile but are still being forced to fill it again,
run this command to fix their initial_setup_done flag:

    python manage.py shell
    
    >>> from accounts.models import Profile
    >>> # Fix all profiles that have all required fields but initial_setup_done is False
    >>> fixed = 0
    >>> for p in Profile.objects.filter(initial_setup_done=False):
    ...     if p.date_of_birth and p.gender and p.nationality and p.phone_number and p.profile_photo:
    ...         p.initial_setup_done = True
    ...         p.save(update_fields=['initial_setup_done'])
    ...         fixed += 1
    >>> print(f"Fixed {fixed} profiles")

Or run the automated fix below:
"""

from django.core.management.base import BaseCommand
from accounts.models import Profile


class Command(BaseCommand):
    help = 'Fix users stuck in profile completion loop'

    def handle(self, *args, **options):
        self.stdout.write('Finding profiles with incomplete setup flag...')
        
        fixed_count = 0
        for profile in Profile.objects.filter(initial_setup_done=False):
            # Check if all required fields are filled
            if (profile.date_of_birth and 
                profile.gender and 
                profile.nationality and 
                profile.phone_number and 
                profile.profile_photo):
                
                profile.initial_setup_done = True
                profile.save(update_fields=['initial_setup_done'])
                fixed_count += 1
                self.stdout.write(f'  Fixed: {profile.user.username}')
        
        self.stdout.write(self.style.SUCCESS(f'\nSuccessfully fixed {fixed_count} profile(s)'))
