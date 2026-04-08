"""
ASGI config for aerosync project.

<<<<<<< HEAD
It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/4.2/howto/deployment/asgi/
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aerosync.settings')

application = get_asgi_application()
=======
Exposes the ASGI callable used to serve the application with Daphne.
Supports both HTTP and WebSocket protocols.
"""

import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from channels.security.websocket import AllowedHostsOriginValidator

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aerosync.settings')

# Initialize Django ASGI application early
django_asgi_app = get_asgi_application()

# Import your websocket URLs
from core.websocket import websocket_urlpatterns

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AllowedHostsOriginValidator(
        AuthMiddlewareStack(
            URLRouter(websocket_urlpatterns)
        )
    ),
})
>>>>>>> 9007297460809f07bfaa364ef37dd6359fbbe48b
