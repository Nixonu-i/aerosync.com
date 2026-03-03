from django.utils.deprecation import MiddlewareMixin
from django.http import HttpResponseForbidden


class BlockDirectMediaAccessMiddleware(MiddlewareMixin):
    """Block direct access to /media/profile_photos/ to prevent unauthorized access.
    
    This middleware ensures that profile photos cannot be accessed directly via
    /media/profile_photos/... URLs. All media access must go through the 
    authenticated endpoint at /api/auth/media/<path>.
    
    Other media files (not in profile_photos/) are allowed for backward compatibility.
    """
    
    def process_request(self, request):
        path = request.path
        
        # Check if accessing profile_photos directory directly
        if path.startswith('/media/profile_photos/') or path.startswith('media/profile_photos/'):
            return HttpResponseForbidden(
                "Direct access to profile photos is not allowed. "
                "Please use the authenticated endpoint: /api/auth/media/<path>"
            )
        
        return None
