from django.utils.deprecation import MiddlewareMixin
from django.http import JsonResponse

from .models import Profile
from django.contrib.auth import get_user_model

User = get_user_model()


class ProfileCompletionMiddleware(MiddlewareMixin):
    """Enforce first-time profile completion for customers and agents.

    Requests from authenticated users whose role is CUST or AGENT will be
    blocked (HTTP 403) until their Profile.initial_setup_done flag is set.
    The flag is updated by the profile API once the required fields are
    provided.  Once it becomes True the middleware stops intervening, so
    the restriction only applies during the very first login/flow.

    We skip the check for certain safe paths (login, register, profile,
    logout, static/media files) so that the user can actually fill the
    profile.
    """

    def process_request(self, request):
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return None

        # only enforce for customers and agents
        if user.role not in (User.Role.CUST, User.Role.AGENT):
            return None

        try:
            profile = user.profile
        except Profile.DoesNotExist:
            # allow creation via profile endpoint
            return None

        if profile.initial_setup_done:
            return None

        # allow the user to hit these paths while completing their profile
        whitelist = [
            "/api/auth/login/",
            "/api/auth/register/",
            "/api/auth/profile/",
            "/api/auth/logout/",
        ]
        # also permit static/media so that the page itself can load
        if request.path.startswith("/static/") or request.path.startswith("/media/"):
            return None
        for prefix in whitelist:
            if request.path.startswith(prefix):
                return None

        # all other requests are forbidden until profile is finished
        return JsonResponse({"detail": "Please complete your profile first."}, status=403)
