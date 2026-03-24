# Migration to set is_pending_verification=False for already verified users

from django.db import migrations

def update_verified_users(apps, schema_editor):
    """Set is_pending_verification to False for all users who are already email verified"""
    User = apps.get_model('accounts', 'User')
    User.objects.filter(is_email_verified=True).update(is_pending_verification=False)

class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0015_add_pending_verification'),
    ]

    operations = [
        migrations.RunPython(update_verified_users),
    ]
