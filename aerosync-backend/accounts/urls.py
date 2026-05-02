from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
<<<<<<< HEAD
<<<<<<< HEAD
from .views import RegisterView, MeView, profile_view, protected_media

urlpatterns = [
    path("register/", RegisterView.as_view()),
    path("login/", TokenObtainPairView.as_view()),
    path("refresh/", TokenRefreshView.as_view()),
    path("me/", MeView.as_view()),
    path("profile/", profile_view, name="profile"),
    path("media/<path:path>", protected_media, name="protected-media"),
=======
from .views import RegisterView, MeView, profile_view, protected_media, VerifyEmailView, ResendVerificationView, oauth_callback, CustomTokenObtainPairView, RequestPasswordResetView, VerifyPasswordResetCodeView, ResetPasswordView
=======
from .views import RegisterView, MeView, profile_view, protected_media, VerifyEmailView, ResendVerificationView, oauth_callback, CustomTokenObtainPairView, RequestPasswordResetView, VerifyPasswordResetCodeView, ResetPasswordView, update_theme_preference
>>>>>>> 1f8170445e5037c8d4a27ddab2757e5b5f376943

urlpatterns = [
    path("register/", RegisterView.as_view()),
    path("login/", CustomTokenObtainPairView.as_view()),  # Custom login with email verification check
    path("refresh/", TokenRefreshView.as_view()),
    path("me/", MeView.as_view()),
    path("profile/", profile_view, name="profile"),
    path("verify-email/", VerifyEmailView.as_view(), name="verify-email"),
    path("resend-verification/", ResendVerificationView.as_view(), name="resend-verification"),
    path("oauth/callback/", oauth_callback, name="oauth-callback"),
    path("media/<path:path>", protected_media, name="protected-media"),
    
    # Password reset endpoints
    path("request-password-reset/", RequestPasswordResetView.as_view(), name="request-password-reset"),
    path("verify-password-reset-code/", VerifyPasswordResetCodeView.as_view(), name="verify-password-reset-code"),
    path("reset-password/", ResetPasswordView.as_view(), name="reset-password"),
<<<<<<< HEAD
>>>>>>> 9007297460809f07bfaa364ef37dd6359fbbe48b
=======
    
    # Theme preference endpoint
    path("update-theme/", update_theme_preference, name="update-theme"),
>>>>>>> 1f8170445e5037c8d4a27ddab2757e5b5f376943
]