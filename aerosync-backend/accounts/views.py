from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import api_view
from django.shortcuts import get_object_or_404
from django.db.models import Q

from .models import Profile
from .serializers import RegisterSerializer, MeSerializer, ProfileSerializer, ProfileDetailSerializer

# media serving helpers
from django.conf import settings
from django.http import FileResponse, Http404
import os
from django.utils._os import safe_join

from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.views import TokenObtainPairView

# Email verification service
from .services.email_service import EmailVerificationService

# IP Risk checking service
from core.ip_risk_service import check_ip_risk


@api_view(["GET"])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def protected_media(request, path):
    """Serve user-uploaded media only to authenticated clients.

    This replaces Django's standard static view which would return files to
    anyone with the URL.  We restrict access so that ordinary users can only
    fetch their own profile photo (or any media if they are staff).

    The frontend must include the JWT in the ``Authorization`` header when
    requesting the URL returned by ``ProfileSerializer``.  e.g.
    ``Authorization: Bearer <token>``.
    """
    # prevent path traversal
    try:
        final_path = safe_join(settings.MEDIA_ROOT, path)
    except Exception:
        raise Http404()

    if not os.path.isfile(final_path):
        raise Http404()

    # if the media is in the profile_photos directory, enforce ownership
    rel = os.path.relpath(final_path, settings.MEDIA_ROOT)
    if rel.startswith("profile_photos") and not (
        request.user.is_staff or request.user.is_superuser
    ):
        filename = os.path.basename(final_path)
        # Check if file belongs to current user (supports both old and new naming)
        user_uuid_str = str(request.user.pk)
        if not (filename.startswith(f"user{request.user.pk}-") or 
                filename.startswith(f"user_{user_uuid_str}_")):
            # users may only see their own uploads
            raise Http404()

    return FileResponse(open(final_path, "rb"))


class RegisterView(generics.CreateAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = RegisterSerializer
    
    def create(self, request, *args, **kwargs):
        # Create user account (marked as pending verification)
        response = super().create(request, *args, **kwargs)
        
        # Send verification email IMMEDIATELY after registration
        try:
            user = self.get_queryset().get(email=response.data.get('email'))
            print(f"📧 Sending verification email to: {user.email}")
            code = EmailVerificationService.send_verification_email(user)
            print(f"✅ Verification email sent! Code: {code}")  # For testing only
        except Exception as e:
            # Log error but don't fail registration
            import logging
            logger = logging.getLogger('accounts')
            import traceback
            logger.error(f"❌ Failed to send verification email: {e}")
            logger.debug(f"Traceback: {traceback.format_exc()}")
            
            # Check if it's a Brevo IP authorization error - log it for admin attention
            error_message = str(e)
            if 'unrecognised IP address' in error_message or 'authorised_ips' in error_message:
                logger.critical('🚨 Brevo IP authorization error - Admin must add 105.160.78.41 to Brevo security settings')
        
        return Response({
            **response.data,
            'message': 'Registration successful! Please check your email for verification code.',
            'requires_email_verification': True
        })


class CustomTokenObtainPairView(TokenObtainPairView):
    """
    Custom login view that checks if email is verified before allowing login.
    Supports login with either username OR email.
    Includes IP risk score checking for security.
    """
    def post(self, request, *args, **kwargs):
        # Get client IP address
        client_ip = self.get_client_ip(request)
        
        # Check IP risk score
        ip_risk = check_ip_risk(client_ip)
        
        # Block access if IP is high risk, using TOR, VPN, or Proxy
        if ip_risk.get('blocked'):
            print(f'🚨 BLOCKED LOGIN - IP: {client_ip}, Risk: {ip_risk.get("risk_score")}, Reason: {ip_risk.get("block_reason")}')
            
            # Determine specific user-friendly error message
            block_reason = ip_risk.get('block_reason', '')
            if 'High risk score' in block_reason:
                error_message = 'Access denied. Your IP address has been flagged as high risk. Please contact support if you believe this is an error.'
            elif 'TOR usage' in block_reason:
                error_message = 'Access denied. TOR connections are not allowed. Please disable TOR and try again.'
            elif 'VPN usage' in block_reason:
                error_message = 'Access denied. VPN connections are not allowed. Please disable your VPN and try again.'
            elif 'Proxy usage' in block_reason:
                error_message = 'Access denied. Proxy connections are not allowed. Please disable your proxy and try again.'
            elif 'Unsupported country' in block_reason:
                country = ip_risk.get('country', 'your location')
                error_message = f'Access denied. Service is only available in Kenya. Detected location: {country}.'
            else:
                error_message = 'Access denied. Your connection has been flagged for security reasons.'
            
            # Log the blocked attempt
            from core.models import UserActivityLog
            try:
                UserActivityLog.objects.create(
                    user=None,  # No user yet, they're blocked
                    action='login_blocked',
                    ip_address=client_ip,
                    user_agent=request.META.get('HTTP_USER_AGENT', ''),
                    path='/api/accounts/login/',
                    method='POST',
                    status_code=403,
                    additional_data={
                        'ip_risk_score': ip_risk.get('risk_score'),
                        'block_reason': ip_risk.get('block_reason'),
                        'tor': ip_risk.get('tor'),
                        'vpn': ip_risk.get('vpn'),
                        'proxy': ip_risk.get('proxy'),
                        'country': ip_risk.get('country'),
                        'isp': ip_risk.get('isp')
                    }
                )
            except Exception as e:
                print(f'Failed to log blocked login: {e}')
            
            return Response(
                {
                    'detail': error_message,
                    'blocked': True,
                    'reason': ip_risk.get('block_reason', 'High risk connection')
                },
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Support both 'email' and 'username' fields for flexibility
        email = request.data.get('email', '').strip().lower() if request.data.get('email') else ''
        username = request.data.get('username', '').strip() if request.data.get('username') else ''
        
        # Determine which identifier to use
        identifier = email or username
        
        if not identifier:
            return Response(
                {'detail': 'Email or username is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            
            # Try to find user by email first (since email is unique)
            # If identifier contains @, assume it's an email
            if '@' in identifier:
                user = User.objects.get(email=identifier)
            else:
                # Otherwise try username
                try:
                    user = User.objects.get(username=identifier)
                except User.DoesNotExist:
                    # Fall back to email if username not found
                    user = User.objects.get(email=identifier)
            
            # Check if account needs email verification
            # Only block if BOTH conditions are true:
            # 1. Still pending verification AND
            # 2. Email NOT verified
            if user.is_pending_verification and not user.is_email_verified:
                print(f'🚫 User {user.username} ({user.email}) blocked - requires verification')
                return Response(
                    {
                        'detail': 'Please verify your email before logging in. Check your inbox for the verification code.',
                        'requires_verification': True,
                        'email': user.email
                    },
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # User is verified or not pending - allow login
            # We need to modify the request data to use username for JWT
            from django.http import QueryDict
            
            # Create a mutable copy of request data with username set
            mutable_data = QueryDict('', mutable=True)
            
            # Copy all existing fields
            if hasattr(request.data, 'dict'):
                # If it's a QueryDict, use .dict()
                mutable_data.update(request.data.dict())
            else:
                # If it's already a dict, copy directly
                mutable_data.update(request.data)
            
            # Set the correct username
            mutable_data['username'] = user.username
            
            # Replace request._full_data (DRF uses this internally)
            request._full_data = mutable_data
            
            # Log successful login with IP risk info
            response = super().post(request, *args, **kwargs)
            
            if response.status_code == 200:
                from core.models import UserActivityLog
                try:
                    UserActivityLog.objects.create(
                        user=user,
                        action='login',
                        ip_address=client_ip,
                        user_agent=request.META.get('HTTP_USER_AGENT', ''),
                        path='/api/accounts/login/',
                        method='POST',
                        status_code=200,
                        additional_data={
                            'ip_risk_score': ip_risk.get('risk_score'),
                            'ip_country': ip_risk.get('country'),
                            'ip_isp': ip_risk.get('isp'),
                            'ip_tor': ip_risk.get('tor', False),
                            'ip_vpn': ip_risk.get('vpn', False)
                        }
                    )
                except Exception as e:
                    print(f'Failed to log login: {e}')
            
            return response
            
        except User.DoesNotExist:
            # Return generic error (don't reveal if user exists or which field failed)
            return Response(
                {'detail': 'Invalid email/username or password'},
                status=status.HTTP_401_UNAUTHORIZED
            )
    
    def get_client_ip(self, request):
        """Get client IP address from request"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


class MeView(APIView):
    def get(self, request):
        return Response(MeSerializer(request.user).data)


@api_view(['GET', 'POST'])
def profile_view(request):
    profile, created = Profile.objects.get_or_create(user=request.user)
    
    if request.method == 'GET':
        serializer = ProfileDetailSerializer(profile, context={'request': request})
        return Response(serializer.data)
    
    elif request.method == 'POST':
        # SECURITY: Prevent updates to locked fields after initial setup
        # Only phone_number, phone_area_code, and profile_photo can be updated after setup
        # Use QueryDict copy instead of deep copy to handle file uploads properly
        mutable_data = request.data.dict() if hasattr(request.data, 'dict') else dict(request.data)
        
        if profile.initial_setup_done:
            # User has completed initial setup - lock sensitive fields
            locked_fields = ['date_of_birth', 'gender', 'nationality']
            
            # Check if any locked fields are being modified
            for field in locked_fields:
                if field in mutable_data:
                    # Reject the entire request if trying to modify locked fields
                    return Response(
                        {'detail': f'{field.replace("_", " ").title()} cannot be updated after initial profile setup'},
                        status=status.HTTP_403_FORBIDDEN
                    )
            
            # Only allow these fields to be updated
            allowed_fields = ['phone_area_code', 'phone_number', 'profile_photo']
            filtered_data = {k: v for k, v in mutable_data.items() if k in allowed_fields}
            
            # Use filtered data for validation
            serializer = ProfileSerializer(profile, data=filtered_data, partial=True, context={'request': request})
        else:
            # First-time setup - allow all fields
            serializer = ProfileSerializer(profile, data=mutable_data, partial=True, context={'request': request})
        
        if serializer.is_valid():
            serializer.save()
            # mark initial_setup_done for first-time customer/agent users
            if not profile.initial_setup_done and request.user.role in (
                request.user.Role.CUST,
                request.user.Role.AGENT,
            ):
                # Re-fetch the profile to get the updated data including profile_photo_url
                profile.refresh_from_db()
                data = ProfileDetailSerializer(profile, context={'request': request}).data
                # Required fields for profile completion (photo is optional)
                required = [
                    'date_of_birth',
                    'gender',
                    'nationality',
                    'phone_number',
                ]
                if all(data.get(f) for f in required):
                    profile.initial_setup_done = True
                    profile.save(update_fields=['initial_setup_done'])
            return Response(serializer.data)
        return Response(serializer.errors, status=400)


class VerifyEmailView(APIView):
    """
    Verify email with OTP code sent during registration
    """
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        email = request.data.get('email')
        code = request.data.get('code')
        
        if not email or not code:
            return Response(
                {'detail': 'Email and verification code are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            user = User.objects.get(email=email)
            
            # Verify the code
            is_valid = EmailVerificationService.verify_code(user, code)
            
            if is_valid:
                # Clear pending verification flag
                user.is_pending_verification = False
                user.save(update_fields=['is_pending_verification'])
                
                return Response({
                    'detail': 'Email verified successfully!',
                    'is_email_verified': True
                })
            else:
                return Response({
                    'detail': 'Invalid or expired verification code'
                }, status=status.HTTP_400_BAD_REQUEST)
                
        except User.DoesNotExist:
            return Response({
                'detail': 'User not found'
            }, status=status.HTTP_404_NOT_FOUND)


class RequestPasswordResetView(APIView):
    """
    Request password reset - sends OTP to user's email
    """
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        identifier = request.data.get('identifier', '').strip()  # Can be email or username
        
        if not identifier:
            return Response(
                {'detail': 'Email or username is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            
            # Try to find user by email first
            if '@' in identifier:
                user = User.objects.get(email=identifier)
            else:
                # Try username
                try:
                    user = User.objects.get(username=identifier)
                except User.DoesNotExist:
                    # Fall back to email
                    user = User.objects.get(email=identifier)
            
            # Send password reset email
            EmailVerificationService.send_password_reset_email(user)
            
            return Response({
                'detail': 'Password reset code sent to your email',
                'email': user.email
            })
            
        except User.DoesNotExist:
            return Response(
                {'detail': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
        )


class VerifyPasswordResetCodeView(APIView):
    """
    Verify password reset OTP code
    """
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        email = request.data.get('email')
        code = request.data.get('code')
        
        if not email or not code:
            return Response(
                {'detail': 'Email and verification code are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            user = User.objects.get(email=email)
            
            # Verify the code
            is_valid = EmailVerificationService.verify_password_reset_code(user, code)
            
            if is_valid:
                return Response({
                    'detail': 'Code verified successfully. You can now reset your password.',
                    'email': user.email
                })
            else:
                return Response({
                    'detail': 'Invalid or expired verification code'
                }, status=status.HTTP_400_BAD_REQUEST)
                
        except User.DoesNotExist:
            return Response({
                'detail': 'User not found'
            }, status=status.HTTP_404_NOT_FOUND)


class ResetPasswordView(APIView):
    """
    Reset password after OTP verification
    """
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        email = request.data.get('email')
        new_password = request.data.get('password')
        
        if not email or not new_password:
            return Response(
                {'detail': 'Email and new password are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if len(new_password) < 6:
            return Response(
                {'detail': 'Password must be at least 6 characters long'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            user = User.objects.get(email=email)
            
            # Set new password
            user.set_password(new_password)
            user.save()
            
            return Response({
                'detail': 'Password reset successfully! You can now login with your new password.'
            })
            
        except User.DoesNotExist:
            return Response({
                'detail': 'User not found'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({
                'detail': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
def oauth_callback(request):
    """
    OAuth 2.0 callback endpoint for Gmail API authorization
    This is used by the oauth_setup.py script to capture credentials
    """
    from django.http import HttpResponse
    
    # Get the authorization code from the request
    code = request.GET.get('code')
    
    if not code:
        return HttpResponse("""
        <html>
            <head><title>OAuth Callback Failed</title></head>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
                <h1 style="color: #dc3545;">❌ Authorization Failed</h1>
                <p>No authorization code received.</p>
                <p>Please try again.</p>
                <script>window.close();</script>
            </body>
        </html>
        """)
    
    # The code will be captured by the oauth_setup.py script's local server
    # This endpoint just confirms success to the user
    return HttpResponse("""
    <html>
        <head><title>Gmail OAuth Authorized</title></head>
        <body style="font-family: Arial; text-align: center; padding: 50px; background: linear-gradient(135deg, #0b1220 0%, #1a2744 100%); color: white; min-height: 100vh;">
            <div style="background: white; color: #333; padding: 40px; border-radius: 12px; max-width: 500px; margin: 0 auto; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
                <h1 style="color: #28a745;">✅ Authorization Successful!</h1>
                <p>Your Gmail account has been successfully authorized.</p>
                <p>You can close this window and return to the terminal.</p>
                <div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
                    <p style="color: #666; font-size: 14px;">AeroSync Email Service</p>
                </div>
            </div>
            <script>
                // Close window after 3 seconds
                setTimeout(() => window.close(), 3000);
            </script>
        </body>
    </html>
    """)


class ResendVerificationView(APIView):
    """
    Resend verification email with new code
    Rate limited to prevent spam
    """
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        email = request.data.get('email')
        
        if not email:
            return Response(
                {'detail': 'Email is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            user = User.objects.get(email=email)
            
            # Check if already verified
            if user.is_email_verified:
                return Response({
                    'detail': 'Email is already verified'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Rate limiting: check if last code was sent less than 1 minute ago
            if user.email_verification_created_at:
                from django.utils import timezone
                from datetime import timedelta
                time_since_last = timezone.now() - user.email_verification_created_at
                if time_since_last < timedelta(minutes=1):
                    return Response({
                        'detail': 'Please wait 1 minute before requesting another code'
                    }, status=status.HTTP_429_TOO_MANY_REQUESTS)
            
            # Send new verification code
            try:
                EmailVerificationService.resend_verification(user)
                return Response({
                    'detail': 'Verification email sent successfully',
                    'message': 'Please check your email for the new verification code'
                })
            except Exception as e:
                import logging
                logger = logging.getLogger('accounts')
                logger.error(f'Failed to send verification email: {str(e)}')
                
                # Check if it's a Brevo IP authorization error
                error_message = str(e)
                if 'unrecognised IP address' in error_message or 'authorised_ips' in error_message:
                    # Log the specific error but don't expose technical details to user
                    logger.error('Brevo IP authorization error - please add IP to Brevo security settings')
                    # Return success anyway to avoid blocking users
                    return Response({
                        'detail': 'Verification email queued (email service temporarily unavailable)',
                        'message': 'Please try again in a few minutes or contact support'
                    })
                else:
                    # Generic email failure - still allow user to try again
                    return Response({
                        'detail': 'Unable to send verification email at this time',
                        'message': 'Please try again later or contact support'
                    }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
            
        except User.DoesNotExist:
            # Don't reveal if user exists or not (security best practice)
            return Response({
                'detail': 'If this email exists, a verification code has been sent'
            })
        except Exception as e:
            return Response({
                'detail': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)