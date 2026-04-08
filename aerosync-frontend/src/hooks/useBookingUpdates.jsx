import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Custom hook for managing WebSocket connection to booking updates stream.
 * Handles connection lifecycle, reconnection, and message parsing.
 * 
 * @returns {Object} Connection state and latest update
 */
export const useBookingUpdates = () => {
  const { token } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [latestUpdate, setLatestUpdate] = useState(null);
  const [error, setError] = useState(null);
  
  // Use refs to track WebSocket and prevent stale closures
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 5;
  const RECONNECT_DELAY = 3000; // 3 seconds

  // Clean up connection
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    setIsConnected(false);
  }, []);

  // Connect to WebSocket stream
  const connect = useCallback(() => {
    if (!token) {
      setError('No authentication token available');
      return;
    }

    // Check if already connected or connecting
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      // In development, connect directly to backend
      const isDev = import.meta.env.DEV;
      let wsUrl;
      
      if (isDev) {
        wsUrl = `ws://localhost:8000/api/ws/bookings/?token=${encodeURIComponent(token)}`;
      } else {
        // Use wss:// in production via Cloudflare Tunnel
        const apiUrl = import.meta.env.VITE_API_URL || 'https://api.aerosync.live/api/';
        const baseUrl = apiUrl.replace(/\/api\/?$/, '').replace(/^https?:\/\//, '');
        wsUrl = `wss://${baseUrl}/api/ws/bookings/?token=${encodeURIComponent(token)}`;
      }

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      // Connection opened successfully
      ws.onopen = () => {
        setIsConnected(true);
        setError(null);
        retryCountRef.current = 0;
        console.log('🔌 WebSocket connected');
      };

      // Handle incoming messages
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLatestUpdate(data);
          
          // Heartbeat messages don't need error handling
          if (data.type === 'heartbeat') {
            return;
          }
          
          retryCountRef.current = 0;
        } catch (err) {
          setError('Failed to parse update message');
        }
      };

      // Handle connection errors
      ws.onerror = (err) => {
        console.error('❌ WebSocket error:', err);
        setIsConnected(false);
        
        // Attempt reconnection with exponential backoff
        if (retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current += 1;
          const delay = RECONNECT_DELAY * Math.pow(2, retryCountRef.current - 1);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            disconnect();
            connect();
          }, delay);
        } else {
          setError('Connection failed after multiple attempts. Please refresh the page.');
        }
      };

      // Handle connection close
      ws.onclose = (event) => {
        console.log('🔌 WebSocket closed:', event.code, event.reason);
        setIsConnected(false);
        
        // Reconnect if not a normal closure
        if (event.code !== 1000 && retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current += 1;
          const delay = RECONNECT_DELAY * Math.pow(2, retryCountRef.current - 1);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            disconnect();
            connect();
          }, delay);
        }
      };

    } catch (err) {
      setError(err.message);
    }
  }, [token, disconnect]);

  // Auto-connect on mount / when token changes
  useEffect(() => {
    if (token) {
      // Don't auto-connect - let components control connection manually
      // connect();
    } else {
      // Token was cleared (logout) — disconnect immediately
      disconnect();
    }

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [token, disconnect]);

  // Reset error state manually
  const resetError = useCallback(() => {
    setError(null);
    retryCountRef.current = 0;
    disconnect();
    connect();
  }, [disconnect, connect]);

  // Manual reconnect function for components to call
  const manualReconnect = useCallback(() => {
    if (token) {
      disconnect();
      setTimeout(() => connect(), 100); // Small delay to ensure cleanup
    }
  }, [token, disconnect, connect]);

  return {
    isConnected,
    latestUpdate,
    error,
    resetError,
    disconnect,
    reconnect: manualReconnect
  };
};