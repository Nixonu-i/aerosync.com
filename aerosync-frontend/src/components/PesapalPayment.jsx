import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/api';

const PesapalPayment = ({ booking, onPaymentComplete, onCancel }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [redirectUrl, setRedirectUrl] = useState('');
  const [paymentId, setPaymentId] = useState(null);
  const [pollingInterval, setPollingInterval] = useState(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  // Initialize payment
  useEffect(() => {
    const initiatePayment = async () => {
      try {
        setLoading(true);
        setError('');
        
        const response = await API.post(`payments/pesapal/initiate/${booking.id}/`);
        
        const { redirect_url, order_tracking_id, payment_id } = response.data;
        
        setRedirectUrl(redirect_url);
        setPaymentId(payment_id);
        
        console.log('✅ Pesapal payment initiated:', order_tracking_id);
        
        // Start polling for payment status
        startPolling(payment_id);
        
        // Stop loading and show iframe
        setLoading(false);
        
      } catch (err) {
        console.error('❌ Payment initiation failed:', err);
        setError(err.response?.data?.detail || 'Failed to initiate payment. Please try again.');
        setLoading(false);
      }
    };

    initiatePayment();

    // Cleanup on unmount
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [booking.id]);

  // Auto-redirect to Pesapal when URL is received - NOW USING IFRAME
  useEffect(() => {
    console.log('🔍 [Auto-iframe Effect] redirectUrl:', redirectUrl);
    console.log('🔍 [Auto-iframe Effect] loading:', loading);
    
    if (redirectUrl && !loading) {
      console.log('✅ Iframe URL ready, showing embedded payment');
      setIframeLoaded(true);
    }
  }, [redirectUrl, loading]);

  // Poll for payment status
  const startPolling = (id) => {
    const interval = setInterval(async () => {
      try {
        const response = await API.get(`payments/pesapal/status/${id}/`);
        const { payment, booking_is_confirmed } = response.data;
        
        console.log('💳 Payment status:', payment.status);
        console.log('🏠 Booking confirmed:', booking_is_confirmed);
        
        if (payment.status === 'SUCCESS' || booking_is_confirmed) {
          clearInterval(interval);
          onPaymentComplete(payment);
        } else if (payment.status === 'FAILED' || payment.status === 'CANCELLED') {
          clearInterval(interval);
          setError(`Payment ${payment.status.toLowerCase()}. Please try again or choose another payment method.`);
          setLoading(false);
        }
      } catch (err) {
        console.error('❌ Status check failed:', err);
        // Don't stop polling on network errors - user might still be paying
      }
    }, 3000); // Check every 3 seconds

    setPollingInterval(interval);
  };

  const handleOpenPesapal = () => {
    if (redirectUrl) {
      // Open Pesapal in a new window
      window.open(redirectUrl, '_blank');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 9999,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '40px',
        maxWidth: '500px',
        width: '100%',
        textAlign: 'center'
      }}>
        {/* Header */}
        <div style={{ marginBottom: '30px' }}>
          <h2 style={{
            fontSize: '24px',
            fontWeight: '700',
            color: '#0b1220',
            marginBottom: '8px'
          }}>
            Secure Payment
          </h2>
          <p style={{
            fontSize: '14px',
            color: '#6c757d'
          }}>
            Complete your payment via Pesapal
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{ padding: '40px 0' }}>
            <div style={{
              width: '60px',
              height: '60px',
              border: '4px solid #e9ecef',
              borderTop: '4px solid #20c997',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 20px'
            }}></div>
            <p style={{ color: '#6c757d', fontSize: '14px' }}>
              Initializing secure payment...
            </p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div style={{
            backgroundColor: '#f8d7da',
            border: '1px solid #f5c6cb',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '24px',
            color: '#721c24',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        {/* Iframe Payment */}
        {!loading && !error && redirectUrl && iframeLoaded && (
          <div>
            <div style={{
              backgroundColor: '#d4edda',
              border: '1px solid #c3e6cb',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '24px',
              color: '#155724',
              fontSize: '14px'
            }}>
              🔒 Secure payment loaded in iframe below
            </div>

            <iframe
              src={redirectUrl}
              title="Pesapal Payment"
              style={{
                width: '100%',
                height: '600px',
                border: '1px solid #e9ecef',
                borderRadius: '8px'
              }}
              sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-top-navigation"
            />

            <p style={{
              fontSize: '12px',
              color: '#6c757d',
              marginTop: '16px',
              textAlign: 'center'
            }}>
              Complete your payment in the secure frame above • Polling for status...
            </p>
          </div>
        )}

        {/* Action Buttons */}
        {!loading && (
          <div style={{ marginTop: '20px' }}>
            <button
              onClick={onCancel}
              style={{
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: '600',
                color: '#6c757d',
                backgroundColor: 'transparent',
                border: '1px solid #dee2e6',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#f8f9fa';
                e.target.style.borderColor = '#adb5bd';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'transparent';
                e.target.style.borderColor = '#dee2e6';
              }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Spin Animation */}
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
};

export default PesapalPayment;
