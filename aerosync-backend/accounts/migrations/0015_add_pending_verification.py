# Migration to add is_pending_verification field

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0014_alter_user_email_unique'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='is_pending_verification',
            field=models.BooleanField(default=True),
        ),
    ]
