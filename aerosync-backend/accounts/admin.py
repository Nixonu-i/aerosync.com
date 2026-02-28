from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, Profile


class ProfileInline(admin.StackedInline):
    model = Profile
    can_delete = False
    verbose_name_plural = "Profile"
    fields = ["date_of_birth", "gender", "nationality", "phone_area_code", "phone_number"]


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    inlines = [ProfileInline]
    list_display = ("id", "username", "email", "full_name", "role", "is_staff", "is_superuser", "is_active", "created_at")
    list_filter = ("role", "is_staff", "is_superuser", "is_active")
    search_fields = ("username", "email", "first_name", "last_name")
    ordering = ("-created_at",)
    # Add role to the fieldsets
    fieldsets = BaseUserAdmin.fieldsets + (
        ("AeroSync", {"fields": ("role",)}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ("AeroSync", {"fields": ("role",)}),
    )
    readonly_fields = ("created_at",)


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "gender", "nationality", "phone_number")
    search_fields = ("user__username", "user__email")
    list_filter = ("gender", "nationality")
