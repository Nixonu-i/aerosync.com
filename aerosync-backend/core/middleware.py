import logging
import json
from datetime import datetime
from django.utils.deprecation import MiddlewareMixin
from django.contrib.auth import get_user_model

logger = logging.getLogger('core.middleware')

class UserActivityMiddleware(MiddlewareMixin):
    """
    Middleware to log user activities including IP address and actions
    """
    
    def process_request(self, request):
        # Store request info for later use in process_response
        request._start_time = datetime.now()
        return None
    
    def process_response(self, request, response):
        # Skip logging for static/media files
        if (request.path.startswith('/static/') or 
            request.path.startswith('/media/') or 
            request.path.startswith('/favicon.ico')):
            return response
            
        # Get user information
        user = getattr(request, 'user', None)
        user_id = user.id if user and user.is_authenticated else None
        username = user.username if user and user.is_authenticated else 'Anonymous'
        
        # Get IP address (handle various proxy headers)
        ip_address = self.get_client_ip(request)
        
        # Get request details
        method = request.method
        path = request.path
        status_code = response.status_code
        user_agent = request.META.get('HTTP_USER_AGENT', 'Unknown')
        
        # Get request duration
        duration = None
        if hasattr(request, '_start_time'):
            duration = (datetime.now() - request._start_time).total_seconds()
        
        # Log the activity (minimal format: timestamp, IP, method, endpoint only)
        import logging
        logger = logging.getLogger(__name__)
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        ip_address = self.get_client_ip(request)
        logger.info(f"[{timestamp}] {ip_address} {request.method} {request.path}")
            
        return response
    
    def get_client_ip(self, request):
        """
        Get the client's IP address, handling various proxy headers
        """
        # Check for common proxy headers
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            # X-Forwarded-For can contain multiple IPs, get the first one
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR')
            
        return ip