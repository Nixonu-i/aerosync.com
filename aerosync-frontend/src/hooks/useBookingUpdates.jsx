import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Custom hook for managing SSE connection to booking updates stream.
 * Handles connection lifecycle, reconnection, and message parsing.
 * 
 * @returns {Object} Connection state and latest update
 */
export const useBookingUpdates = () => {
  const { token } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [latestUpdate, setLatestUpdate] = useState(null);
  const [error, setError] = useState(null);
  
  // Use refs to track event source and prevent stale closures
  const eventSourceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 5;
  const RECONNECT_DELAY = 3000; // 3 seconds

  // Clean up connection
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    setIsConnected(false);
  }, []);

  // Connect to SSE stream
  const connect = useCallback(() => {
    if (!token) {
      setError('No authentication token available');
      return;
    }

    // FIX: check readyState instead of just existence — a dead EventSource
    // (readyState === 2) still holds a reference but is no longer usable.
    // Previously this guard prevented reconnection after a failed connection.
    if (eventSourceRef.current) {
      const state = eventSourceRef.current.readyState;
      if (state === EventSource.OPEN || state === EventSource.CONNECTING) {
        return;
      }
      // Dead connection — close and clear before creating a new one
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    try {
      // In development, connect directly to backend to avoid Vite proxy issues with SSE
      const isDev = import.meta.env.DEV;
      let streamUrl;
      
      if (isDev) {
        // Direct connection to backend in development
        streamUrl = `http://localhost:8000/api/bookings/stream/?token=${encodeURIComponent(token)}`;
      } else {
        // Use API URL from environment in production (Cloudflare Tunnel)
        const apiUrl = import.meta.env.VITE_API_URL || 'https://api.aerosync.live/api/';
        // Ensure URL ends with /api and construct stream endpoint
        const baseUrl = apiUrl.replace(/\/api\/?$/, '/api');
        streamUrl = `${baseUrl}/bookings/stream/?token=${encodeURIComponent(token)}`;
      }

      const eventSource = new EventSource(streamUrl);
      eventSourceRef.current = eventSource;

      // Connection opened successfully
      eventSource.addEventListener('open', () => {
        setIsConnected(true);
        setError(null);
        retryCountRef.current = 0;
      });

      // Handle incoming messages
      eventSource.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Store the update
          setLatestUpdate(data);
          
          // Heartbeat messages don't need error handling
          if (data.type === 'heartbeat') {
            return;
          }
          
          // Reset retry counter on successful message
          retryCountRef.current = 0;
        } catch (err) {
          setError('Failed to parse update message');
        }
      });

      // Handle connection errors
      eventSource.addEventListener('error', (err) => {
        console.error('❌ SSE connection error:', err);
        console.error('[SSE Error] ReadyState:', eventSource.readyState);
        console.error('[SSE Error] Error type:', err.type);
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
      });

    } catch (err) {
      setError(err.message);
    }
  }, [token, disconnect]);

  // Auto-connect on mount / when token changes
  useEffect(() => {
    if (token) {
      connect();
    } else {
      // Token was cleared (logout) — disconnect immediately
      disconnect();
    }

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [token, connect, disconnect]);

  // Reset error state manually
  const resetError = useCallback(() => {
    setError(null);
    retryCountRef.current = 0;
    disconnect();
    connect();
  }, [disconnect, connect]);

  return {
    isConnected,
    latestUpdate,
    error,
    resetError,
    disconnect,
    reconnect: connect
  };
};