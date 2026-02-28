import json
from datetime import datetime
from django.utils.deprecation import MiddlewareMixin
from django.contrib.auth import get_user_model

User = get_user_model()

class DatabaseActivityMiddleware(MiddlewareMixin):
    """
    Middleware to log user activities to database
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
        user_obj = user if user and user.is_authenticated else None
        
        # Get IP address
        ip_address = self.get_client_ip(request)
        
        # Get request details
        method = request.method
        path = request.path
        status_code = response.status_code
        user_agent = request.META.get('HTTP_USER_AGENT', '')[:500]  # Limit length
        
        # Determine action type based on path and method
        action = self.determine_action(path, method, status_code)
        
        # Additional data
        additional_data = {
            'query_params': dict(request.GET) if request.GET else {},
            'duration': None
        }
        
        # Add request duration
        if hasattr(request, '_start_time'):
            additional_data['duration'] = (datetime.now() - request._start_time).total_seconds()
        
        # Save to database
        try:
            from django.apps import apps
            UserActivityLog = apps.get_model('core', 'UserActivityLog')
            UserActivityLog.objects.create(
                user=user_obj,
                action=action,
                ip_address=ip_address,
                user_agent=user_agent,
                path=path,
                method=method,
                status_code=status_code,
                additional_data=additional_data
            )
        except Exception as e:
            # Log the error but don't break the request
            import logging
            logger = logging.getLogger('user_activity')
            logger.error(f"Failed to log user activity to database: {e}")
            
        return response
    
    def get_client_ip(self, request):
        """Get the client's IP address, handling various proxy headers"""
        # Try to get the real IP from various headers in order of preference
        forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if forwarded_for:
            # X-Forwarded-For can contain multiple IPs, get the first (original) one
            ip = forwarded_for.split(',')[0].strip()
        else:
            forwarded_host = request.META.get('HTTP_X_FORWARDED_HOST')
            if forwarded_host:
                ip = forwarded_host.split(':')[0] if ':' in forwarded_host else forwarded_host
            else:
                forwarded_server = request.META.get('HTTP_X_FORWARDED_SERVER')
                if forwarded_server:
                    ip = forwarded_server.split(':')[0] if ':' in forwarded_server else forwarded_server
                else:
                    real_ip = request.META.get('HTTP_X_REAL_IP')
                    if real_ip:
                        ip = real_ip
                    else:
                        forwarded_proto = request.META.get('HTTP_X_FORWARDED_PROTO')
                        if forwarded_proto:
                            # If it's behind a proxy, use REMOTE_ADDR as it might be the proxy's IP
                            ip = request.META.get('REMOTE_ADDR')
                        else:
                            ip = request.META.get('REMOTE_ADDR')
        
        # If we still have localhost-like IPs, try to get from other headers
        if ip in ['127.0.0.1', '::1', 'localhost']:
            # Check for Cloudflare headers
            cf_connecting_ip = request.META.get('HTTP_CF_CONNECTING_IP')
            if cf_connecting_ip:
                ip = cf_connecting_ip
            else:
                # For ngrok, try to get from CF-Connecting-IP if available
                forwarded_for_alt = request.META.get('HTTP_X_ORIGINAL_FORWARDED_FOR')
                if forwarded_for_alt:
                    ip = forwarded_for_alt.split(',')[0].strip()
                else:
                    # Last resort - return the original remote addr
                    ip = request.META.get('REMOTE_ADDR')
        
        return ip
    
    def determine_action(self, path, method, status_code):
        """Determine the action type based on request details"""
        # Login/Logout actions
        if '/auth/login/' in path and method == 'POST':
            return 'login'
        elif '/auth/logout/' in path and method == 'POST':
            return 'logout'
            
        # Profile actions
        elif '/auth/profile/' in path:
            if method == 'POST':
                return 'profile_update'
            else:
                return 'api_access'
                
        # Booking actions
        elif '/bookings/' in path:
            if method == 'POST':
                return 'booking_create'
            elif method == 'DELETE':
                return 'booking_cancel'
            else:
                return 'api_access'
                
        # Payment actions
        elif '/payments/' in path:
            return 'payment'
            
        # Admin actions
        elif path.startswith('/admin/') or path.startswith('/api/admin/'):
            return 'admin_action'
            
        # File uploads
        elif method == 'POST' and ('profile_photo' in path or 'upload' in path):
            return 'file_upload'
            
        # API access
        elif path.startswith('/api/'):
            return 'api_access'
            
        # Default
        else:
            return 'other'