import threading
import json
import redis
from django.utils import timezone
from datetime import timedelta
from django.conf import settings


class SSEConnectionManager:
    """
    Manages active SSE connections for real-time booking updates.
    Uses Redis Pub/Sub for cross-worker communication.
    Thread-safe implementation using locks.
    """
    
    def __init__(self):
        self._connections = {}  # {user_id: {'queue': Queue, 'timestamp': datetime}}
        self._lock = threading.Lock()
        
        # Redis connection for pub/sub
        try:
            self.redis_client = redis.Redis(
                host=getattr(settings, 'REDIS_HOST', 'localhost'),
                port=getattr(settings, 'REDIS_PORT', 6379),
                db=0,
                decode_responses=True
            )
            self.redis_client.ping()
            self.redis_available = True
        except Exception as e:
            print(f"⚠️  Redis not available, falling back to in-memory: {str(e)}")
            self.redis_available = False
            self.redis_client = None
    
    def add_connection(self, user_id, send_function):
        """
        Add a new SSE connection for a user.
        
        Args:
            user_id: The user's ID
            send_function: Callable to send data to client
        """
        import logging
        logger = logging.getLogger('core.sse_manager')
        
        with self._lock:
            if user_id not in self._connections:
                self._connections[user_id] = []
            
            self._connections[user_id].append({
                'send': send_function,
                'timestamp': timezone.now(),
                'active': True
            })
            logger.info(f"✅ Added SSE connection for user {user_id}. Total connections: {len(self._connections[user_id])}")
    
    def remove_connection(self, user_id, send_function):
        """Remove an SSE connection when client disconnects."""
        import logging
        logger = logging.getLogger('core.sse_manager')
        
        with self._lock:
            if user_id in self._connections:
                before_count = len(self._connections[user_id])
                self._connections[user_id] = [
                    conn for conn in self._connections[user_id]
                    if conn['send'] != send_function
                ]
                after_count = len(self._connections[user_id])
                logger.info(f"❌ Removed SSE connection for user {user_id}. Before: {before_count}, After: {after_count}")
                
                # Clean up empty user entries
                if not self._connections[user_id]:
                    logger.info(f"🗑️ No more connections for user {user_id}, deleting entry")
                    del self._connections[user_id]
    
    def broadcast_to_user(self, user_id, data):
        """
        Send update to all active connections for a specific user.
        Uses Redis Pub/Sub for cross-worker communication.
        
        Args:
            user_id: Target user's ID
            data: Dictionary with update data
        """
        import logging
        logger = logging.getLogger('core.sse_manager')
        
        # If Redis is available, publish to Redis channel
        if self.redis_available:
            try:
                channel = f"sse_user_{user_id}"
                message = json.dumps(data)
                self.redis_client.publish(channel, message)
                logger.info(f"📤 Published to Redis channel {channel} for user {user_id}")
            except Exception as e:
                logger.error(f"Redis publish failed: {str(e)}")
                # Fallback to in-memory
                self._broadcast_in_memory(user_id, data, logger)
        else:
            # Fallback to in-memory broadcast
            self._broadcast_in_memory(user_id, data, logger)
    
    def _broadcast_in_memory(self, user_id, data, logger):
        """Fallback in-memory broadcast when Redis is unavailable."""
        with self._lock:
            if user_id not in self._connections:
                logger.warning(f"No active SSE connections for user {user_id}")
                return
            
            logger.info(f"Found {len(self._connections[user_id])} active connections for user {user_id}")
            
            active_connections = []
            for conn in self._connections[user_id]:
                try:
                    conn['send'](data)
                    conn['timestamp'] = timezone.now()
                    active_connections.append(conn)
                    logger.info(f"Successfully sent update to user {user_id}")
                except Exception as e:
                    # Connection is dead, mark for cleanup
                    logger.error(f"Failed to send to user {user_id}: {str(e)}")
                    conn['active'] = False
            
            # Remove inactive connections
            self._connections[user_id] = [
                conn for conn in self._connections[user_id]
                if conn['active']
            ]
            
            if not self._connections[user_id]:
                logger.info(f"No more active connections for user {user_id}, cleaning up")
                del self._connections[user_id]
    
    def broadcast_to_agents(self, data):
        """
        Broadcast update to all connected agents.
        Used for global booking changes that all agents should see.
        
        Args:
            data: Dictionary with update data
        """
        from accounts.models import Profile
        import logging
        logger = logging.getLogger('core.sse_manager')
        
        # Get agent user IDs BEFORE acquiring lock to avoid deadlocks
        try:
            agent_user_ids = list(Profile.objects.filter(
                user__is_staff=True
            ).values_list('user_id', flat=True))
            logger.info(f"Broadcasting to {len(agent_user_ids)} agents")
        except Exception as e:
            logger.error(f"Failed to get agent list: {str(e)}")
            return
        
        # Now broadcast to each agent (lock is acquired inside broadcast_to_user)
        for user_id in agent_user_ids:
            self.broadcast_to_user(user_id, data)
    
    def get_active_connections_count(self):
        """Return total number of active connections."""
        with self._lock:
            return sum(len(conns) for conns in self._connections.values())
    
    def cleanup_stale_connections(self, max_age_minutes=5):
        """
        Remove connections that haven't sent heartbeat recently.
        Should be called periodically (e.g., every minute).
        """
        cutoff_time = timezone.now() - timedelta(minutes=max_age_minutes)
        
        with self._lock:
            users_to_remove = []
            
            for user_id, connections in list(self._connections.items()):
                active_connections = []
                
                for conn in connections:
                    if conn['timestamp'] >= cutoff_time:
                        active_connections.append(conn)
                    else:
                        # Stale connection, try to close it
                        conn['active'] = False
                
                if active_connections:
                    self._connections[user_id] = active_connections
                else:
                    users_to_remove.append(user_id)
            
            for user_id in users_to_remove:
                del self._connections[user_id]


# Global instance
sse_manager = SSEConnectionManager()
