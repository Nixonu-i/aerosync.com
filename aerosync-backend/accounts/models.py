from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    GENDER_CHOICES = [
        ('MALE', 'Male'),
        ('FEMALE', 'Female'),
        ('OTHER', 'Other'),
    ]
    
    class Role(models.TextChoices):
        ADMIN = "ADMIN", "ADMIN"
        AGENT = "AGENT", "AGENT"
        CUST  = "CUST",  "CUST"

    role = models.CharField(max_length=10, choices=Role.choices, default=Role.CUST)
    staff_id = models.CharField(max_length=20, unique=True, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # Override the groups and user_permissions fields to avoid clashes
    groups = models.ManyToManyField(
        'auth.Group',
        verbose_name='groups',
        blank=True,
        help_text='The groups this user belongs to. A user will get all permissions granted to each of their groups.',
        related_name="%(app_label)s_%(class)s_groups",  # Unique related_name to avoid clash
        related_query_name="%(app_label)s_%(class)ss",  # Unique query name to avoid clash
    )
    user_permissions = models.ManyToManyField(
        'auth.Permission',
        verbose_name='user permissions',
        blank=True,
        help_text='Specific permissions for this user.',
        related_name="%(app_label)s_%(class)s_permissions",  # Unique related_name to avoid clash
        related_query_name="%(app_label)s_%(class)ss",  # Unique query name to avoid clash
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
    profile_photo = models.ImageField(upload_to='profile_photos/', blank=True, null=True)
    # track whether the user has completed all required fields during the
    # initial sign‑up flow.  once True we will stop forcing them to fill the
    # profile again.
    initial_setup_done = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.user.username}'s Profile"