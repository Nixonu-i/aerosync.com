from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
import os
from django.http import JsonResponse

def api_root(request):
    return JsonResponse({"message": "AeroSync API", "version": "1.0"})

urlpatterns = [
    path("", api_root),
    path("admin/", admin.site.urls),

    path("api/auth/", include("accounts.urls")),
    path("api/", include("core.urls")),
]

# Serve static files only - media files are served through authenticated endpoints
# We DO NOT serve media files directly to prevent unauthorized access to profile photos
if settings.DEBUG or os.getenv("SERVE_MEDIA_FROM_DJANGO", "").lower() in ("1", "true", "yes"):
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    # Note: Media files are ONLY served via /api/auth/media/<path> endpoint
    # which requires authentication and authorization
