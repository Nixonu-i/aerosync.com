import { useState, useEffect } from 'react';
import API from '../api/api';

const PesapalPaymentModal = ({ booking, onClose, onPaymentComplete }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [redirectUrl, setRedirectUrl] = useState('');
  const [paymentId, setPaymentId] = useState(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [userDetails, setUserDetails] = useState(null);
  const [formData, setFormData] = useState({
    phone_number: '',
    phone_area_code: '+254',
    address_line1: '',
    city: '',
    postal_code: '',
    country: ''
  });
  const [formSubmitted, setFormSubmitted] = useState(false);

  useEffect(() => {
    loadUserDetails();
  }, [booking.id]);

  const loadUserDetails = async () => {
    try {
      const response = await API.get('auth/me/');
      const data = response.data;
      setUserDetails(data);
      
      // Pre-populate form with existing user data
      if (data.profile) {
        setFormData({
          phone_number: data.profile.phone_number || '',
          phone_area_code: data.profile.phone_area_code || '+254',
          address_line1: data.profile.address_line1 || '',
          city: data.profile.city || '',
          postal_code: data.profile.postal_code || '',
          country: data.profile.country || ''
        });
      }
      setLoading(false);
    } catch (err) {
      console.error('Failed to load user details:', err);
      setError('Failed to load user details. Please try again.');
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleInitiatePayment = async () => {
    // Validate required fields
    if (!formData.phone_number) {
      setError('Phone number is required');
      return;
    }
    if (!formData.address_line1 || !formData.city || !formData.country) {
      setError('Complete address is required');
      return;
    }

    setLoading(true);
    setError(null);
    setFormSubmitted(true);

    try {
      // First, save the updated profile to backend using POST
      await API.post('auth/profile/', formData);
      
      // Then initiate payment with updated billing details
      const response = await API.post(`payments/pesapal/initiate/${booking.id}/`, {
        amount: booking.total_amount,
        currency: 'KES',
        billing_details: {
          first_name: userDetails.full_name?.split(' ')[0] || '',
          last_name: userDetails.full_name?.split(' ').slice(1).join(' ') || '',
          email: userDetails.email,
          phone_number: formData.phone_number,
          address_line1: formData.address_line1,
          city: formData.city,
          postal_code: formData.postal_code,
          country: formData.country
        }
      });
      
      const { redirect_url, order_tracking_id, payment_id } = response.data;
      
      setRedirectUrl(redirect_url);
      setPaymentId(payment_id);
      
      console.log('✅ Pesapal payment initiated:', order_tracking_id);
      
      // Start polling for payment status
      startPolling(payment_id);
      
    } catch (err) {
      console.error('❌ Payment initiation failed:', err);
      setError(err.response?.data?.detail || 'Failed to initiate payment. Please try again.');
      setLoading(false);
      setFormSubmitted(false);
    }
  };

  // Poll for payment status every 3 seconds
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
    }, 3000);
    
    // Store interval ID for cleanup
    return () => clearInterval(interval);
  };

  // Cleanup polling on unmount
  useEffect(() => {
    let cleanupFn = null;
    
    if (formSubmitted && redirectUrl) {
      cleanupFn = startPolling(paymentId);
    }
    
    return () => {
      if (cleanupFn) {
        cleanupFn();
      }
    };
  }, [formSubmitted, redirectUrl, paymentId]);

  // Auto-iframe effect
  useEffect(() => {
    if (redirectUrl && formSubmitted && !loading) {
      setIframeLoaded(true);
    }
  }, [redirectUrl, formSubmitted, loading]);

  // Mask phone number for privacy
  const maskPhoneNumber = (phone) => {
    if (!phone) return 'Not provided';
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 6) return '***';
    return `${digits.substring(0, 3)}***${digits.substring(digits.length - 5)}`;
  };

  // Mask email for privacy
  const maskEmail = (email) => {
    if (!email) return 'Not provided';
    const [username, domain] = email.split('@');
    if (!username || !domain) return '***';
    const maskedUsername = username.length > 3 
      ? `${username.substring(0, 3)}***` 
      : `${username[0]}**`;
    return `${maskedUsername}@${domain}`;
  };

  if (!userDetails) {
    return (
      <div style={modalStyles.overlay}>
        <div style={modalStyles.modal}>
          <div style={styles.loadingContainer}>
            <div style={styles.spinner}></div>
            <p style={styles.loadingText}>Loading user details...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={modalStyles.overlay}>
      <div style={modalStyles.modal}>
        {/* Header */}
        <div style={modalStyles.header}>
          <h2 style={modalStyles.title}>Complete Your Payment</h2>
          <button onClick={onClose} style={modalStyles.closeButton}>×</button>
        </div>

        {/* Content */}
        <div style={modalStyles.content}>
          {/* Booking Summary */}
          <div style={styles.bookingSummary}>
            <h3 style={styles.summaryTitle}>Booking Summary</h3>
            <div style={styles.summaryRow}>
              <span style={styles.summaryLabel}>Confirmation Code:</span>
              <span style={styles.summaryValue}>{booking.confirmation_code}</span>
            </div>
            <div style={styles.summaryRow}>
              <span style={styles.summaryLabel}>Flight:</span>
              <span style={styles.summaryValue}>
                {booking.flight_name || booking.airline_name || booking.airline || 'Flight information not available'}
              </span>
            </div>
            <div style={styles.summaryRow}>
              <span style={styles.summaryLabel}>Route:</span>
              <span style={styles.summaryValue}>
                {booking.route || 
                 (booking.departure && booking.arrival ? `${booking.departure} → ${booking.arrival}` : 'Not specified')}
              </span>
            </div>
            <div style={styles.summaryRow}>
              <span style={styles.summaryLabel}>Seats:</span>
              <span style={styles.summaryValue}>
                {booking.seat_numbers && booking.seat_numbers.length > 0 
                  ? booking.seat_numbers.join(', ') 
                  : booking.passengers && booking.passengers.length > 0
                    ? booking.passengers.map(p => p.seat_number).filter(Boolean).join(', ') || 'Not assigned'
                    : 'Not assigned'}
              </span>
            </div>
            <div style={styles.summaryRow}>
              <span style={styles.summaryLabel}>Amount:</span>
              <span style={styles.summaryValue}>KES {booking.total_amount?.toLocaleString()}</span>
            </div>
          </div>

          {/* Contact Information Form */}
          {!formSubmitted && (
            <div style={styles.contactForm}>
              <h3 style={styles.sectionTitle}>Contact Information</h3>
              <p style={styles.formInstruction}>Please verify your contact details for this booking</p>
              
              <div style={styles.detailGrid}>
                <div style={styles.detailItem}>
                  <label style={styles.detailLabel}>Full Name</label>
                  <div style={styles.detailValue}>
                    {userDetails.full_name || userDetails.username || 'Not provided'}
                  </div>
                </div>
                
                <div style={styles.detailItem}>
                  <label style={styles.detailLabel}>Email Address</label>
                  <div style={{...styles.detailValue, backgroundColor: '#f8f9fa'}}>
                    {userDetails.email}
                  </div>
                </div>
                
                <div style={styles.detailItem}>
                  <label style={styles.detailLabel}>Phone Number *</label>
                  <div style={{...styles.detailValue, backgroundColor: '#f8f9fa'}}>
                    {formData.phone_area_code} {formData.phone_number || 'Not provided'}
                  </div>
                </div>
              </div>

              <h3 style={{...styles.sectionTitle, marginTop: '24px'}}>Billing Address</h3>
              
              <div style={styles.detailGrid}>
                <div style={{...styles.detailItem, gridColumn: '1 / -1'}}>
                  <label style={styles.detailLabel}>Street Address *</label>
                  <input
                    type="text"
                    name="address_line1"
                    value={formData.address_line1}
                    onChange={handleInputChange}
                    style={styles.inputField}
                    placeholder="House No., Street Name"
                  />
                </div>
                
                <div style={styles.detailItem}>
                  <label style={styles.detailLabel}>City *</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    style={styles.inputField}
                    placeholder="Nairobi"
                  />
                </div>
                
                <div style={styles.detailItem}>
                  <label style={styles.detailLabel}>Postal Code</label>
                  <input
                    type="text"
                    name="postal_code"
                    value={formData.postal_code}
                    onChange={handleInputChange}
                    style={styles.inputField}
                    placeholder="00100"
                  />
                </div>
                
                <div style={{...styles.detailItem, gridColumn: '1 / -1'}}>
                  <label style={styles.detailLabel}>Country *</label>
                  <input
                    type="text"
                    name="country"
                    value={formData.country}
                    onChange={handleInputChange}
                    style={styles.inputField}
                    placeholder="Kenya"
                  />
                </div>
              </div>

              {error && (
                <div style={styles.errorContainer}>
                  <p style={styles.errorText}>⚠️ {error}</p>
                </div>
              )}

              <button 
                onClick={handleInitiatePayment}
                disabled={loading}
                style={styles.initiateButton}
              >
                {loading ? 'Processing...' : 'Initiate Payment'}
              </button>
            </div>
          )}

          {/* Iframe Payment */}
          {formSubmitted && !error && redirectUrl && iframeLoaded && (
            <div>
              <div style={styles.successMessage}>
                🔒 Secure payment powered by Pesapal
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

              <p style={styles.pollingText}>
                Complete your payment in the secure frame above • We'll confirm automatically...
              </p>
            </div>
          )}
        </div>

        {/* Footer with Pesapal Branding */}
        <div style={modalStyles.footer}>
          <div style={styles.pesapalBranding}>
            <span style={styles.poweredByText}>Powered by</span>
            <img 
              src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 50'%3E%3Ctext x='5' y='35' font-family='Arial' font-size='28' font-weight='bold' fill='%2328a745'%3EPESA%3C/text%3E%3Ctext x='85' y='35' font-family='Arial' font-size='28' fill='%236c757d'%3EPAL%3C/text%3E%3C/svg%3E" 
              alt="Pesapal" 
              style={{ height: '35px', width: 'auto' }}
            />
          </div>
          <p style={styles.securityNote}>
            🔒 Your payment is secured by Pesapal's encrypted payment gateway
          </p>
        </div>
      </div>
    </div>
  );
};

// Styles
const modalStyles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '20px',
    overflow: 'auto'
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: '16px',
    maxWidth: '800px',
    width: '100%',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    animation: 'slideIn 0.3s ease-out'
  },
  header: {
    padding: '24px',
    borderBottom: '1px solid #e9ecef',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f9fa'
  },
  title: {
    margin: 0,
    fontSize: '24px',
    fontWeight: '700',
    color: '#2c3e50'
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '28px',
    cursor: 'pointer',
    color: '#6c757d',
    padding: '0',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  content: {
    padding: '24px'
  },
  footer: {
    padding: '20px 24px',
    borderTop: '1px solid #e9ecef',
    backgroundColor: '#f8f9fa',
    textAlign: 'center'
  }
};

const styles = {
  bookingSummary: {
    backgroundColor: '#e3f2fd',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '24px',
    border: '1px solid #bbdefb'
  },
  summaryTitle: {
    margin: '0 0 16px 0',
    fontSize: '18px',
    fontWeight: '600',
    color: '#1976d2'
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '12px',
    fontSize: '14px'
  },
  summaryLabel: {
    color: '#546e7a',
    fontWeight: '500'
  },
  summaryValue: {
    color: '#2c3e50',
    fontWeight: '600'
  },
  contactForm: {
    // Container for form
  },
  sectionTitle: {
    margin: '0 0 16px 0',
    fontSize: '18px',
    fontWeight: '600',
    color: '#2c3e50'
  },
  formInstruction: {
    fontSize: '14px',
    color: '#6c757d',
    marginBottom: '20px'
  },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '16px',
    backgroundColor: '#f8f9fa',
    padding: '20px',
    borderRadius: '8px',
    border: '1px solid #e9ecef'
  },
  detailItem: {
    display: 'flex',
    flexDirection: 'column'
  },
  detailLabel: {
    fontSize: '12px',
    color: '#6c757d',
    marginBottom: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    fontWeight: '600'
  },
  detailValue: {
    fontSize: '14px',
    color: '#2c3e50',
    fontWeight: '500',
    padding: '8px 12px',
    backgroundColor: '#fff',
    borderRadius: '4px',
    border: '1px solid #dee2e6'
  },
  inputField: {
    fontSize: '14px',
    color: '#2c3e50',
    fontWeight: '500',
    padding: '10px 12px',
    backgroundColor: '#fff',
    borderRadius: '4px',
    border: '1px solid #dee2e6',
    outline: 'none',
    transition: 'border-color 0.2s'
  },
  loadingContainer: {
    textAlign: 'center',
    padding: '40px 20px'
  },
  spinner: {
    border: '3px solid #f3f3f3',
    borderTop: '3px solid #3498db',
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 16px'
  },
  loadingText: {
    color: '#6c757d',
    fontSize: '14px'
  },
  errorContainer: {
    backgroundColor: '#fff3cd',
    border: '1px solid #ffc107',
    borderRadius: '8px',
    padding: '16px',
    marginTop: '20px',
    textAlign: 'center'
  },
  errorText: {
    color: '#856404',
    margin: 0,
    fontSize: '14px'
  },
  initiateButton: {
    width: '100%',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    padding: '14px 24px',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '24px',
    transition: 'background-color 0.2s',
    ':hover': {
      backgroundColor: '#0056b3'
    }
  },
  successMessage: {
    backgroundColor: '#d4edda',
    border: '1px solid #c3e6cb',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '24px',
    color: '#155724',
    fontSize: '14px',
    fontWeight: '600',
    textAlign: 'center'
  },
  pollingText: {
    fontSize: '12px',
    color: '#6c757d',
    marginTop: '16px',
    textAlign: 'center'
  },
  pesapalBranding: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    marginBottom: '8px'
  },
  poweredByText: {
    fontSize: '14px',
    color: '#6c757d',
    fontWeight: '500'
  },
  securityNote: {
    fontSize: '12px',
    color: '#6c757d',
    margin: 0
  }
};

export default PesapalPaymentModal;
