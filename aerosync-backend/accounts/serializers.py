from django.contrib.auth import get_user_model
from rest_framework import serializers
from .models import User, Profile

class RegisterSerializer(serializers.ModelSerializer):
    password2 = serializers.CharField(write_only=True)
    full_name = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ["username", "email", "full_name", "password", "password2"]
        extra_kwargs = {"password": {"write_only": True}}

    def validate(self, attrs):
        if attrs["password"] != attrs["password2"]:
            raise serializers.ValidationError({"password": "Passwords do not match."})
        return attrs

    def create(self, validated_data):
        validated_data.pop("password2")
        full_name = validated_data.pop("full_name", "").strip().upper()

        first, last = "", ""
        if full_name:
            parts = full_name.split()
            first = parts[0]
            last = " ".join(parts[1:]) if len(parts) > 1 else ""

        user = User(
            username=validated_data["username"],
            email=validated_data.get("email", ""),
            first_name=first,
            last_name=last,
            role=User.Role.CUST,
        )
        user.set_password(validated_data["password"])
        user.save()
        return user

class MeSerializer(serializers.ModelSerializer):
    is_admin = serializers.SerializerMethodField()
    is_agent = serializers.SerializerMethodField()

    def get_is_admin(self, obj):
        return obj.role == 'ADMIN' or obj.is_staff or obj.is_superuser

    def get_is_agent(self, obj):
        return obj.role == 'AGENT'

    class Meta:
        model = User
        fields = ["id", "username", "email", "full_name", "role", "is_admin", "is_agent", "staff_id", "created_at"]


class ProfileSerializer(serializers.ModelSerializer):
    profile_photo_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Profile
        fields = ["date_of_birth", "gender", "nationality", "phone_area_code", "phone_number", "profile_photo", "profile_photo_url", "initial_setup_done"]
    
    def get_profile_photo_url(self, obj):
        try:
            if obj.profile_photo:
                # Return the protected media URL that requires authentication
                # The frontend will include the JWT token when requesting this URL
                request = self.context.get('request')
                # Build the relative path to the protected media endpoint
                protected_url = f"/api/auth/media/{obj.profile_photo.name}"
                if request:
                    return request.build_absolute_uri(protected_url)
                return protected_url
        except (AttributeError, ValueError, TypeError):
            # Handle any potential errors accessing the profile photo URL
            pass
        return None
        
        
class ProfileDetailSerializer(serializers.ModelSerializer):
    profile_photo = serializers.ImageField(required=False, allow_null=True)
    profile_photo_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Profile
        fields = ["date_of_birth", "gender", "nationality", "phone_area_code", "phone_number", "profile_photo", "profile_photo_url", "initial_setup_done"]
    
    def get_profile_photo_url(self, obj):
        try:
            if obj.profile_photo:
                # Return the protected media URL that requires authentication
                # The frontend will include the JWT token when requesting this URL
                request = self.context.get("request")
                # Build the relative path to the protected media endpoint
                protected_url = f"/api/auth/media/{obj.profile_photo.name}"
                if request:
                    return request.build_absolute_uri(protected_url)
                return protected_url
        except (AttributeError, ValueError, TypeError):
            # Handle any potential errors accessing the profile photo URL
            pass
        return None