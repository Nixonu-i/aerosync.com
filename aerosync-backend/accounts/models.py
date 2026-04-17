from django.contrib.auth.models import AbstractUser
from django.db import models
from django.core.exceptions import ValidationError
import os
import uuid

# Maximum profile photo size: 2MB
PROFILE_PHOTO_MAX_SIZE = 2 * 1024 * 1024  # 2MB in bytes

# Allowed image extensions
PROFILE_PHOTO_ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp']

def validate_profile_photo_size(file):
    """Validate profile photo file size"""
    if file.size > PROFILE_PHOTO_MAX_SIZE:
        raise ValidationError(
            f'File size must be under {PROFILE_PHOTO_MAX_SIZE // (1024*1024)}MB. Current size: {file.size // 1024}KB'
        )

def validate_profile_photo_extension(file):
    """Validate profile photo file extension"""
    ext = os.path.splitext(file.name)[1].lower()
    if ext not in PROFILE_PHOTO_ALLOWED_EXTENSIONS:
        raise ValidationError(
            f'Unsupported file type. Allowed: {", ".join(PROFILE_PHOTO_ALLOWED_EXTENSIONS)}'
        )

def profile_photo_upload_to(instance, filename):
    """
    Upload profile photos to organized directory structure.
    Files are stored outside the project in MEDIA_ROOT.
    Path format: profile_photos/{year}/{month}/{user_uuid}_{unique_id}.{ext}
    """
    from django.utils import timezone
    now = timezone.now()
    base, ext = os.path.splitext(filename)
    ext = ext.lower()
    # Organize by year/month for better file management
    return os.path.join(
        'profile_photos',
        f"{now.year}",
        f"{now.month:02d}",
        f"user_{instance.user.pk}_{uuid.uuid4().hex[:8]}{ext}"
    )


class User(AbstractUser):
    # Use UUID as primary key
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    GENDER_CHOICES = [
        ('MALE', 'Male'),
        ('FEMALE', 'Female'),
        ('OTHER', 'Other'),
    ]
    
    class Role(models.TextChoices):
        ADMIN = "ADMIN", "ADMIN"
        AGENT = "AGENT", "AGENT"
        CUST  = "CUST",  "CUST"
    
    THEME_CHOICES = [
        ('LIGHT', 'Light'),
        ('DARK', 'Dark'),
        ('SYSTEM', 'System Default'),
    ]

    role = models.CharField(max_length=10, choices=Role.choices, default=Role.CUST)
    theme_preference = models.CharField(max_length=10, choices=THEME_CHOICES, default='LIGHT')
    staff_id = models.CharField(max_length=20, unique=True, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    # Email verification fields
    email_verification_code = models.CharField(max_length=6, blank=True, null=True)
    email_verification_created_at = models.DateTimeField(blank=True, null=True)
    is_email_verified = models.BooleanField(default=False)
    
    # Make email unique across all users
    email = models.EmailField(unique=True, max_length=254)
    
    # Mark account as pending until email is verified
    is_pending_verification = models.BooleanField(default=True)
    
    # Password reset fields
    password_reset_code = models.CharField(max_length=6, blank=True, null=True)
    password_reset_created_at = models.DateTimeField(blank=True, null=True)
    
    # Override the groups and user_permissions fields to avoid clashes
    groups = models.ManyToManyField(
        'auth.Group',
        verbose_name='groups',
        blank=True,
        help_text='The groups this user belongs to. A user will get all permissions granted to each of their groups.',
        related_name="%(app_label)s_%(class)s_groups",
        related_query_name="%(app_label)s_%(class)ss",
    )
    user_permissions = models.ManyToManyField(
        'auth.Permission',
        verbose_name='user permissions',
        blank=True,
        help_text='Specific permissions for this user.',
        related_name="%(app_label)s_%(class)s_permissions",
        related_query_name="%(app_label)s_%(class)ss",
    )

    @property
    def full_name(self) -> str:
        name = f"{self.first_name} {self.last_name}".strip()
        return name or self.username
    
    class Meta:
        app_label = 'accounts'
        # Custom user model


class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=20, choices=User.GENDER_CHOICES, blank=True, null=True)
    nationality = models.CharField(max_length=50, blank=True, null=True)
    phone_area_code = models.CharField(max_length=10, default='+254')
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    profile_photo = models.ImageField(
        upload_to=profile_photo_upload_to,
        blank=True,
        null=True,
        validators=[validate_profile_photo_size, validate_profile_photo_extension]
    )
    # Address fields
    address_line1 = models.CharField(max_length=255, blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    postal_code = models.CharField(max_length=20, blank=True, null=True)
    country = models.CharField(max_length=100, blank=True, null=True)
    # track whether the user has completed all required fields during the
    # initial sign‑up flow.  once True we will stop forcing them to fill the
    # profile again.
    initial_setup_done = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.user.username}'s Profile"