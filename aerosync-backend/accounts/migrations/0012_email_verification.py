# Generated migration for email verification fields

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0005_alter_profile_profile_photo'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='email_verification_code',
            field=models.CharField(max_length=6, blank=True, null=True),
        ),
        migrations.AddField(
            model_name='user',
            name='email_verification_created_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='user',
            name='is_email_verified',
            field=models.BooleanField(default=False),  # New users start as unverified
        ),
    ]
