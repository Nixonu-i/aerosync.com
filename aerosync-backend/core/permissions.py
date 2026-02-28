from rest_framework.permissions import BasePermission


def _is_admin(user):
    """True if user has admin access via role, is_staff, or is_superuser."""
    return (
        user and
        user.is_authenticated and
        (getattr(user, "role", "") == "ADMIN" or user.is_staff or user.is_superuser)
    )


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(_is_admin(request.user))


class IsAgent(BasePermission):
    """Allows access only to users with role=AGENT (or admins)."""
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        return _is_admin(request.user) or getattr(request.user, "role", "") == "AGENT"


class IsAgentOrAdmin(BasePermission):
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        return _is_admin(request.user) or getattr(request.user, "role", "") == "AGENT"