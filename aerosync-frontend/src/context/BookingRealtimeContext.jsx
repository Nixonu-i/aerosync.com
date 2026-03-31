import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useBookingUpdates } from '../hooks/useBookingUpdates';

/**
 * Context for managing real-time booking updates across the application.
 * Provides a centralized way to subscribe to and handle booking changes.
 */
const BookingRealtimeContext = createContext(null);

/**
 * Provider component that wraps the application or specific sections
 * needing real-time booking update functionality.
 */
export const BookingRealtimeProvider = ({ children }) => {
  const { isConnected, latestUpdate, error, resetError, disconnect, reconnect } = useBookingUpdates();
  
  // Store all active bookings and their real-time state
  const [bookingUpdates, setBookingUpdates] = useState({});
  const [subscribers, setSubscribers] = useState(new Set());
  
  // Process incoming updates
  useEffect(() => {
    if (latestUpdate) {
      if (latestUpdate.type === 'booking_updated') {
        const { booking, changed_fields } = latestUpdate;
        
        console.log('🔄 Processing booking update:', booking.booking_reference, changed_fields);
        
        // Update the booking in our state
        setBookingUpdates(prev => ({
          ...prev,
          [booking.id]: {
            booking,
            changed_fields,
            timestamp: new Date().toISOString()
          }
        }));
        
        // Notify all subscribers
        notifySubscribers(booking, changed_fields);
      } else if (latestUpdate.type === 'payment_updated') {
        const { payment, booking_id, changed_fields } = latestUpdate;
        
        console.log('💰 Processing payment update for booking', booking_id, payment.status, changed_fields);
        
        // Dispatch custom event for payment updates
        const event = new CustomEvent('payment-update', {
          detail: { payment, bookingId: booking_id, changedFields: changed_fields }
        });
        window.dispatchEvent(event);
      }
    }
  }, [latestUpdate]);

  // Simple pub/sub mechanism
  const notifySubscribers = useCallback((booking, changedFields) => {
    // Dispatch custom event that components can listen to
    const event = new CustomEvent('booking-update', {
      detail: { booking, changedFields }
    });
    window.dispatchEvent(event);
  }, []);

  // Subscribe to updates for specific booking
  const subscribeToBooking = useCallback((bookingId, callback) => {
    const handler = (event) => {
      const { booking, changedFields } = event.detail;
      if (booking.id === bookingId) {
        callback(booking, changedFields);
      }
    };

    window.addEventListener('booking-update', handler);
    
    return () => {
      window.removeEventListener('booking-update', handler);
    };
  }, []);

  // Subscribe to ALL booking updates (for dashboards)
  const subscribeToAll = useCallback((callback) => {
    const handler = (event) => {
      const { booking, changedFields } = event.detail;
      callback(booking, changedFields);
    };

    window.addEventListener('booking-update', handler);
    
    return () => {
      window.removeEventListener('booking-update', handler);
    };
  }, []);

  // Subscribe to payment updates
  const subscribeToPaymentUpdates = useCallback((callback) => {
    const handler = (event) => {
      const { payment, bookingId, changedFields } = event.detail;
      callback(payment, bookingId, changedFields);
    };

    window.addEventListener('payment-update', handler);
    
    return () => {
      window.removeEventListener('payment-update', handler);
    };
  }, []);

  // Get latest update for a specific booking
  const getBookingUpdate = useCallback((bookingId) => {
    return bookingUpdates[bookingId] || null;
  }, [bookingUpdates]);

  // Clear update history
  const clearUpdates = useCallback(() => {
    setBookingUpdates({});
  }, []);

  const value = useMemo(() => ({
    isConnected,
    error,
    resetError,
    disconnect,
    reconnect,
    subscribeToBooking,
    subscribeToAll,
    subscribeToPaymentUpdates,
    getBookingUpdate,
    clearUpdates,
    hasActiveConnection: isConnected && !error
  }), [isConnected, error, resetError, disconnect, reconnect, subscribeToBooking, subscribeToAll, subscribeToPaymentUpdates, getBookingUpdate, clearUpdates]);

  return (
    <BookingRealtimeContext.Provider value={value}>
      {children}
    </BookingRealtimeContext.Provider>
  );
};

/**
 * Hook to access booking realtime context
 */
export const useBookingRealtime = () => {
  const context = useContext(BookingRealtimeContext);
  
  if (!context) {
    throw new Error('useBookingRealtime must be used within a BookingRealtimeProvider');
  }
  
  return context;
};
