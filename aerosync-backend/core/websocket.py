import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from rest_framework_simplejwt.tokens import AccessToken
from django.contrib.auth import get_user_model
from django.urls import path

logger = logging.getLogger('core')

User = get_user_model()


class BookingUpdatesConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for real-time booking updates.
    Clients connect with: ws://host/api/ws/bookings/?token=<jwt_token>
    """
    
    async def connect(self):
        # Get token from query parameters
        token = self.scope['query_string'].decode()
        token_value = None
        
        # Parse token from query string
        for param in token.split('&'):
            if param.startswith('token='):
                token_value = param.split('=', 1)[1]
                break
        
        if not token_value:
            logger.warning("WebSocket connection rejected - no token")
            await self.close()
            return
        
        # Validate JWT token
        try:
            access_token = AccessToken(token_value)
            user_id = access_token.payload.get('user_id')
            
            if not user_id:
                raise Exception('Invalid token payload')
                
        except Exception as e:
            logger.error(f"WebSocket token validation failed: {str(e)}")
            await self.close()
            return
        
        # Store user info
        self.user_id = user_id
        self.group_name = f"user_{user_id}"
        
        # Accept the connection
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        await self.accept()
        
        logger.info(f"✅ WebSocket connected for user {user_id}")
        
        # Send connected confirmation
        await self.send(text_data=json.dumps({
            'type': 'connected',
            'message': 'Connected to booking updates'
        }))

    async def disconnect(self, close_code):
        # Leave room group
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )
            logger.info(f"🔌 WebSocket disconnected for user {self.user_id}")

    async def receive(self, text_data):
        """Handle incoming messages from client"""
        try:
            data = json.loads(text_data)
            logger.info(f"Received from client: {data}")
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON received: {text_data}")

    async def booking_updated(self, event):
        """
        Handler for booking update events.
        Receives events from channel layer group.
        """
        # Send booking update to WebSocket
        await self.send(text_data=json.dumps({
            'type': 'booking_updated',
            'booking': event['booking'],
            'changed_fields': event.get('changed_fields', [])
        }))
        logger.info(f"📤 Sent booking update to user {self.user_id}")

    async def payment_update(self, event):
        """
        Handler for payment update events.
        Receives events from channel layer group.
        """
        # Send payment update to WebSocket
        await self.send(text_data=json.dumps({
            'type': 'payment_updated',
            'payment': event['payment'],
            'booking_id': event['booking_id'],
            'changed_fields': event.get('changed_fields', [])
        }))
        logger.info(f"💰 Sent payment update to user {self.user_id}")


# WebSocket URL patterns
websocket_urlpatterns = [
    path('api/ws/bookings/', BookingUpdatesConsumer.as_asgi()),
]
