from django.contrib.auth import get_user_model
from rest_framework import serializers
from .models import User, Profile

class RegisterSerializer(serializers.ModelSerializer):
    password2 = serializers.CharField(write_only=True)
    first_name = serializers.CharField(required=True, max_length=30)
    last_name = serializers.CharField(required=True, max_length=30)

    class Meta:
        model = User
        fields = ["username", "email", "first_name", "last_name", "password", "password2"]
        extra_kwargs = {"password": {"write_only": True}}

    def validate(self, attrs):
        if attrs["password"] != attrs["password2"]:
            raise serializers.ValidationError({"password": "Passwords do not match."})
        
        # Validate password length (minimum 8 characters)
        if len(attrs["password"]) < 8:
            raise serializers.ValidationError({
                "password": "Password must be at least 8 characters long."
            })
        
        # Validate first name (letters and spaces only)
        first_name = attrs.get("first_name", "").strip()
        if not first_name or not first_name.replace(" ", "").isalpha():
            raise serializers.ValidationError({
                "first_name": "First name should contain only letters and spaces."
            })
        
        # Validate last name (letters and spaces only)
        last_name = attrs.get("last_name", "").strip()
        if not last_name or not last_name.replace(" ", "").isalpha():
            raise serializers.ValidationError({
                "last_name": "Last name should contain only letters and spaces."
            })
        
        # Check if email already exists
        email = attrs.get("email", "").strip().lower()
        if email:
            User = get_user_model()
            if User.objects.filter(email=email).exists():
                raise serializers.ValidationError({"email": "This email is already registered. Please use a different email or login."})
            attrs["email"] = email  # Ensure email is stored lowercase
        
        return attrs

    def create(self, validated_data):
        validated_data.pop("password2")
        # Convert names to uppercase for consistency
        validated_data["first_name"] = validated_data.get("first_name", "").strip().upper()
        validated_data["last_name"] = validated_data.get("last_name", "").strip().upper()
        
        user = User(
            username=validated_data["username"],
            email=validated_data.get("email", ""),
            first_name=validated_data["first_name"],
            last_name=validated_data["last_name"],
            role=User.Role.CUST,
        )
        user.set_password(validated_data["password"])
        user.save()
        return user

class MeSerializer(serializers.ModelSerializer):
    is_admin = serializers.SerializerMethodField()
    is_agent = serializers.SerializerMethodField()
    profile = serializers.SerializerMethodField()
    theme_preference = serializers.CharField(read_only=True)
    
    def get_is_admin(self, obj):
        return obj.role == 'ADMIN' or obj.is_staff or obj.is_superuser
    
    def get_is_agent(self, obj):
        return obj.role == 'AGENT'
    
    def get_profile(self, obj):
        try:
            profile = obj.profile
            return {
                'phone_number': profile.phone_number,
                'phone_area_code': profile.phone_area_code,
                'address_line1': profile.address_line1,
                'city': profile.city,
                'postal_code': profile.postal_code,
                'country': profile.country
            }
        except (AttributeError, ValueError, TypeError):
            return None

    class Meta:
        model = User
        fields = [
            "id", "username", "email", "full_name", "role", "is_admin", 
            "is_agent", "staff_id", "created_at", "profile", "theme_preference"
        ]


class ProfileSerializer(serializers.ModelSerializer):
    profile_photo_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Profile
        fields = ["date_of_birth", "gender", "nationality", "phone_area_code", "phone_number", "profile_photo", "profile_photo_url", "initial_setup_done"]
    
    def validate_date_of_birth(self, value):
        """
        Validate that the user is at least 18 years old.
        """
        if value:
            from datetime import date
            today = date.today()
            # Calculate age
            age = today.year - value.year - ((today.month, today.day) < (value.month, value.day))
            
            if age < 18:
                raise serializers.ValidationError(
                    f'You must be at least 18 years old to register. Your current age: {age} years.'
                )
        return value
    
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


class ThemePreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['theme_preference']
        
        
class ProfileDetailSerializer(serializers.ModelSerializer):
    profile_photo = serializers.ImageField(required=False, allow_null=True)
    profile_photo_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Profile
        fields = ["date_of_birth", "gender", "nationality", "phone_area_code", "phone_number", "profile_photo", "profile_photo_url", "initial_setup_done"]
    
    def validate_date_of_birth(self, value):
        """
        Validate that the user is at least 18 years old.
        """
        if value:
            from datetime import date
            today = date.today()
            # Calculate age
            age = today.year - value.year - ((today.month, today.day) < (value.month, value.day))
            
            if age < 18:
                raise serializers.ValidationError(
                    f'You must be at least 18 years old. Your current age: {age} years.'
                )
        return value
    
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