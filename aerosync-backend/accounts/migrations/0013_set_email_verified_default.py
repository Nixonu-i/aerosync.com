# Migration to set is_email_verified=False for all users

from django.db import migrations

def set_email_verified_false(apps, schema_editor):
    """Set is_email_verified to False for all existing users"""
    User = apps.get_model('accounts', 'User')
    User.objects.update(is_email_verified=False)

class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0012_email_verification'),
    ]

    operations = [
        migrations.RunPython(set_email_verified_false),
    ]
