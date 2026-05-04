import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aerosync.settings')
os.environ['USE_SQLITE'] = '1'
os.environ['DJANGO_DEBUG'] = '1'
django.setup()
from accounts.models import User
from accounts.services.email_service import EmailVerificationService
user = User.objects.create_user(
    username='emailtest2',
    email='test2@example.com',
    password='Test123!',
    first_name='Test',
    last_name='User'
)
code = EmailVerificationService.send_verification_email(user)
print('Verification code:', code)