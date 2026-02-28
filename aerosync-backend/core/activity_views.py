from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.core.paginator import Paginator
from django.db.models import Q
from django.apps import apps
import json
import datetime


from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_activities(request):
    """
    API endpoint to get user activity logs
    Requires authentication and admin permissions
    """
    # Check if user has admin privileges
    # Replicate the same logic as in MeSerializer.get_is_admin
    is_admin = (
        hasattr(request.user, 'role') and request.user.role == 'ADMIN' or
        request.user.is_staff or 
        request.user.is_superuser
    )
    
    if not is_admin:
        return Response({'error': 'Permission denied'}, status=403)
    
    # Get query parameters
    page = request.GET.get('page', 1)
    limit = request.GET.get('limit', 50)
    user_id = request.GET.get('user_id')
    action = request.GET.get('action')
    ip_address = request.GET.get('ip_address')
    search = request.GET.get('search', '')
    
    # Debug logging
    print(f'DEBUG: Received filters - user_id: {user_id}, action: {action}, ip_address: {ip_address}, search: {search}')
    
    # Validate limits
    try:
        limit = min(int(limit), 100)  # Max 100 per page
    except ValueError:
        limit = 50
    
    # Build queryset
    UserActivityLog = apps.get_model('core', 'UserActivityLog')
    queryset = UserActivityLog.objects.all()
    initial_count = queryset.count()
    print(f'DEBUG: Initial queryset count: {initial_count}')
    
    # Apply filters
    if user_id:
        # Check if user_id is numeric (ID) or string (username)
        if user_id.isdigit():
            queryset = queryset.filter(user_id=user_id)
        else:
            # Assume it's a username
            queryset = queryset.filter(user__username__iexact=user_id)
        print(f'DEBUG: After user_id filter ({user_id}): {queryset.count()}')
    
    if action:
        queryset = queryset.filter(action=action)
        print(f'DEBUG: After action filter ({action}): {queryset.count()}')
    
    if ip_address:
        queryset = queryset.filter(ip_address=ip_address)
        print(f'DEBUG: After ip_address filter ({ip_address}): {queryset.count()}')
    
    if search:
        queryset = queryset.filter(
            Q(user__username__icontains=search) |
            Q(ip_address__icontains=search) |
            Q(path__icontains=search) |
            Q(user_agent__icontains=search)
        )
        print(f'DEBUG: After search filter ({search}): {queryset.count()}')
    
    print(f'DEBUG: Final queryset count: {queryset.count()}')
    
    # Order by timestamp descending
    queryset = queryset.order_by('-timestamp')
    
    # Paginate
    paginator = Paginator(queryset, limit)
    activities_page = paginator.get_page(page)
    
    # Serialize data
    activities_data = []
    for activity in activities_page:
        activities_data.append({
            'id': activity.id,
            'user_id': activity.user.id if activity.user else None,
            'username': activity.user.username if activity.user else 'Anonymous',
            'action': activity.action,
            'ip_address': activity.ip_address,
            'user_agent': activity.user_agent[:100] + '...' if len(activity.user_agent) > 100 else activity.user_agent,
            'path': activity.path,
            'method': activity.method,
            'status_code': activity.status_code,
            'timestamp': activity.timestamp.isoformat(),
            'additional_data': activity.additional_data
        })
    
    return JsonResponse({
        'activities': activities_data,
        'pagination': {
            'current_page': activities_page.number,
            'total_pages': paginator.num_pages,
            'total_items': paginator.count,
            'items_per_page': limit,
            'has_next': activities_page.has_next(),
            'has_previous': activities_page.has_previous(),
        }
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_activity_stats(request):
    """
    Get statistics about user activities
    Requires authentication and admin permissions
    """
    # Check if user has admin privileges
    # Replicate the same logic as in MeSerializer.get_is_admin
    is_admin = (
        hasattr(request.user, 'role') and request.user.role == 'ADMIN' or
        request.user.is_staff or 
        request.user.is_superuser
    )
    
    if not is_admin:
        return Response({'error': 'Permission denied'}, status=403)
    
    UserActivityLog = apps.get_model('core', 'UserActivityLog')
    stats = {
        'total_activities': UserActivityLog.objects.count(),
        'today_activities': UserActivityLog.objects.filter(timestamp__date=datetime.date.today()).count(),
        'unique_users': UserActivityLog.objects.filter(user__isnull=False).distinct('user').count(),
        'unique_ips': UserActivityLog.objects.distinct('ip_address').count(),
        'recent_activities': []
    }
    
    # Get recent activities
    recent = UserActivityLog.objects.order_by('-timestamp')[:10]
    for activity in recent:
        stats['recent_activities'].append({
            'username': activity.user.username if activity.user else 'Anonymous',
            'action': activity.action,
            'ip_address': activity.ip_address,
            'timestamp': activity.timestamp.isoformat()
        })
    
    return JsonResponse(stats)