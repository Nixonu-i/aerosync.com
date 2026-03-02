from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse

def api_root(request):
    return JsonResponse({"message": "AeroSync API", "version": "1.0"})

urlpatterns = [
    path("", api_root),
    path("admin/", admin.site.urls),

    path("api/auth/", include("accounts.urls")),
    path("api/", include("core.urls")),
]

# Serve static and media files during development
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
