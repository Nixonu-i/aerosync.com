import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import API from '../api/api';

export default function VerifyEmail() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState('');
  const [showEmailField, setShowEmailField] = useState(false); // Always hidden by default
  const navigate = useNavigate();
  const location = useLocation(); // Use useLocation hook to get location state

  // Get email from location state OR from authenticated user
  useEffect(() => {
    const state = location.state; // Use location.state instead of navigate.location
    
    // First check if email came from registration or login redirect
    if (state?.email) {
      setEmail(state.email);
      setShowEmailField(false); // Always hide when email comes from state
      
      // Auto-send verification code when arriving at the page
      if (!state.codeSent) { // Only send if not already sent
        API.post('/auth/resend-verification/', { email: state.email })
          .then(() => {
            setMessage('Verification code sent! Please check your inbox.');
            
            // Auto-hide success message after 3 seconds
            setTimeout(() => {
              setMessage('');
            }, 3000);
          })
          .catch(err => {
          });
      }
    } else {
      // No email in state - fetch from authenticated user
      const token = localStorage.getItem('token');
      
      if (token) {
        // User is logged in, fetch their email from /auth/me/
        API.get('auth/me/')
          .then(res => {
            if (res.data && res.data.email) {
              setEmail(res.data.email);
              setShowEmailField(false); // Always show as read-only
              
              // Auto-send verification code for authenticated users too
              API.post('/auth/resend-verification/', { email: res.data.email })
                .then(() => {
                  setMessage('Verification code sent! Please check your inbox.');
                  
                  // Auto-hide success message after 3 seconds
                  setTimeout(() => {
                    setMessage('');
                  }, 3000);
                })
                .catch(err => {
                });
            }
          })
          .catch(err => {
            // If fetch fails, still try to show field for manual entry
            setShowEmailField(true);
          });
      } else {
        // No token, no state - user must enter email manually
        setShowEmailField(true);
      }
    }
    
    if (state?.message) {
      setMessage(state.message);
    }
  }, [location]); // Re-run when location changes

  // Handle code input change
  const handleCodeChange = (index, value) => {
    if (value.length > 1) return; // Only allow single digits
    
    // Only allow numbers (0-9)
    if (!/^\d*$/.test(value)) {
      return; // Ignore non-numeric input
    }
    
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    
    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`code-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
    
    // Auto-submit when all 6 fields are filled
    if (value && index === 5) {
      // All fields filled, wait a tiny bit then submit
      setTimeout(() => {
        // Check if we have a complete 6-digit numeric code
        const completeCode = newCode.join('');
        
        if (completeCode.length === 6 && /^\d{6}$/.test(completeCode)) {
          // Call the actual verification function directly instead of form submit
          verifyCode(completeCode);
        }
      }, 300); // Slightly longer delay to ensure state update
    }
  };

  // Handle key press (backspace navigation)
  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      const prevInput = document.getElementById(`code-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  // Verify the code (extracted function for auto-submit)
  const verifyCode = async (verificationCode) => {
    setLoading(true);
    setError('');

    try {
      if (verificationCode.length !== 6) {
        setError('Please enter the complete 6-digit code');
        setLoading(false);
        return;
      }

      const response = await API.post('/auth/verify-email/', {
        email,
        code: verificationCode
      });

      setSuccess(true);
      // No redirect - stay on page with success modal
      
    } catch (err) {
      setError(err.response?.data?.detail || 'Verification failed. Please check your code and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const verificationCode = code.join('');
    await verifyCode(verificationCode);
  };

  const handleResend = async () => {
    if (!email) {
      setError('Please enter your email address first');
      return;
    }

    setResending(true);
    setError('');

    try {
      await API.post('/auth/resend-verification/', { email });
      setMessage('Verification email sent! Please check your inbox.');
      setError('');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to resend verification email');
      setMessage('');
    } finally {
      setResending(false);
    }
  };

  // Success Modal Component
  const SuccessModal = () => (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(11, 18, 32, 0.85)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      animation: 'fadeIn 0.3s ease-in'
    }}>
      <div style={{
        background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
        borderRadius: '20px',
        padding: '50px 40px',
        maxWidth: '420px',
        width: '90%',
        textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        border: '1px solid rgba(212,175,55,0.3)',
        animation: 'slideUp 0.4s ease-out'
      }}>
        {/* Animated Checkmark */}
        <div style={{
          width: '100px',
          height: '100px',
          margin: '0 auto 25px',
          background: 'linear-gradient(135deg, #d4af37 0%, #f4d03f 100%)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '60px',
          color: '#0b1220',
          fontWeight: 'bold',
          boxShadow: '0 8px 20px rgba(212,175,55,0.4)',
          animation: 'scaleIn 0.5s ease-out 0.2s both'
        }}>
          ✓
        </div>
        
        <h2 style={{
          color: '#d4af37',
          margin: '0 0 15px 0',
          fontSize: '32px',
          fontWeight: '700',
          letterSpacing: '1px'
        }}>
          Email Verified!
        </h2>
        
        <p style={{
          color: 'rgba(255,255,255,0.8)',
          fontSize: '16px',
          margin: '0 0 30px 0',
          lineHeight: '1.6'
        }}>
          Your email has been successfully verified.<br />
          You can now access your account.
        </p>
        
        <button
          onClick={() => navigate('/login')}
          style={{
            background: 'linear-gradient(135deg, #d4af37 0%, #f4d03f 100%)',
            color: '#0b1220',
            border: 'none',
            padding: '14px 40px',
            borderRadius: '10px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 15px rgba(212,175,55,0.3)'
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'translateY(-2px)';
            e.target.style.boxShadow = '0 6px 20px rgba(212,175,55,0.5)';
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 4px 15px rgba(212,175,55,0.3)';
          }}
        >
          Continue to Login
        </button>
      </div>
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(30px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.5);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );

  if (success) {
    return <SuccessModal />;
  }

  return (
    <div className="verify-email-page">
      <div className="verify-card">
        <h2>Verify Your Email</h2>
        <p className="subtitle">Enter the 6-digit code sent to your email</p>

        {message && (
          <div className="success-message">
            ✓ {message}
          </div>
        )}

        {error && (
          <div className="error-message">
            ✕ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {showEmailField ? (
            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          ) : (
            <div className="form-group">
              <label>Verifying Email</label>
              <div className="email-display">
                <span className="email-text">{email}</span>
                <button 
                  type="button" 
                  onClick={() => setShowEmailField(true)}
                  className="btn-link-small"
                >
                  Change
                </button>
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Verification Code</label>
            <div className="code-inputs">
              {code.map((digit, index) => (
                <input
                  key={index}
                  id={`code-${index}`}
                  type="text"
                  maxLength="1"
                  value={digit}
                  onChange={(e) => handleCodeChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  disabled={loading}
                  className="code-digit"
                />
              ))}
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Verifying...' : 'Verify Email'}
          </button>

          <div className="resend-section">
            <p>Didn't receive the code?</p>
            <button 
              type="button" 
              onClick={handleResend}
              disabled={resending}
              className="btn-link"
            >
              {resending ? 'Sending...' : 'Resend Code'}
            </button>
          </div>
        </form>

        <div className="back-to-login">
          <Link to="/login">Back to Login</Link>
        </div>
      </div>

      <style jsx>{`
        .verify-email-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
          padding: 20px;
        }

        .verify-card {
          background: white;
          padding: 40px;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
          width: 100%;
          max-width: 450px;
        }

        .verify-card.success {
          text-align: center;
        }

        h2 {
          color: #0b1220;
          margin-bottom: 10px;
          font-size: 28px;
        }

        .subtitle {
          color: #666;
          margin-bottom: 30px;
          font-size: 14px;
        }

        .success-icon {
          width: 80px;
          height: 80px;
          margin: 0 auto 20px;
          background: #28a745;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 48px;
          font-weight: bold;
        }

        .form-group {
          margin-bottom: 20px;
        }

        label {
          display: block;
          margin-bottom: 8px;
          color: #333;
          font-weight: 500;
        }

        input[type="email"] {
          width: 100%;
          padding: 12px;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          font-size: 16px;
          transition: border-color 0.3s;
        }

        input[type="email"]:focus {
          outline: none;
          border-color: #d4af37;
        }

        .code-inputs {
          display: flex;
          gap: 10px;
          justify-content: space-between;
        }

        .code-digit {
          width: 50px;
          height: 60px;
          text-align: center;
          font-size: 28px;
          font-weight: bold;
          color: #0b1220; /* Dark text color for visibility */
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          transition: all 0.3s;
          background: white; /* White background for contrast */
          caret-color: #d4af37; /* Gold cursor color */
        }

        .code-digit:focus {
          outline: none;
          border-color: #d4af37;
          background: #fff9e6; /* Light gold background on focus */
          caret-color: #d4af37; /* Keep gold cursor */
        }

        .error-message {
          background: #fee;
          color: #c33;
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 20px;
          font-size: 14px;
        }

        .success-message {
          background: #efe;
          color: #2a7;
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 20px;
          font-size: 14px;
          border: 1px solid #d4edda;
        }

        .btn-primary {
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, #d4af37 0%, #b8941f 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s;
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .email-display {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          background: #f8f9fa;
          border-radius: 8px;
          border: 2px solid #e0e0e0;
        }

        .email-text {
          font-size: 16px;
          color: #0b1220;
          font-weight: 500;
        }

        .btn-link-small {
          background: none;
          border: none;
          color: #d4af37;
          font-size: 13px;
          cursor: pointer;
          text-decoration: underline;
          padding: 4px 8px;
        }

        .btn-link-small:hover {
          color: #b8941f;
        }

        .resend-section {
          text-align: center;
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid #e0e0e0;
        }

        .resend-section p {
          color: #666;
          margin-bottom: 10px;
          font-size: 14px;
        }

        .btn-link {
          background: none;
          border: none;
          color: #d4af37;
          font-size: 14px;
          cursor: pointer;
          text-decoration: underline;
        }

        .btn-link:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .back-to-login {
          text-align: center;
          margin-top: 20px;
        }

        .back-to-login a {
          color: #666;
          text-decoration: none;
          font-size: 14px;
        }

        .back-to-login a:hover {
          color: #d4af37;
        }

        .redirect-text {
          color: #666;
          margin-top: 20px;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
}
