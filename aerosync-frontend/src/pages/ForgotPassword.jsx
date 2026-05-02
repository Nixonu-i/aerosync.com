import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../api/api";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Enter email, 2: Enter OTP, 3: Reset password
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Step 1: Request password reset
  const handleRequestReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    try {
      const response = await API.post("auth/request-password-reset/", { identifier });
      setSuccess("Verification code sent to your email!");
      // Always use the email returned from backend (works for both username and email input)
      setEmail(response.data.email || (identifier.includes('@') ? identifier : ""));
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to send reset code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP code
  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    try {
      const response = await API.post("auth/verify-password-reset-code/", { 
        email: email || identifier, 
        code 
      });
      
      if (response.data.email) {
        setEmail(response.data.email);
      }
      
      setSuccess("Code verified! You can now reset your password.");
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid or expired code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Reset password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match!");
      setLoading(false);
      return;
    }
    
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      setLoading(false);
      return;
    }
    
    try {
      await API.post("auth/reset-password/", { 
        email, 
        password: newPassword 
      });
      
      setSuccess("Password reset successfully! Redirecting to login...");
      setTimeout(() => {
        navigate("/login", { 
          state: { 
            message: 'Password reset successful! Please login with your new password.' 
          } 
        });
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to reset password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      minHeight: "100vh",
      backgroundColor: "transparent",
      padding: "20px"
    }}>
      {/* Back Button */}
      <button
        onClick={() => navigate('/')}
        style={{
          position: "absolute",
          top: "20px",
          left: "20px",
          background: "rgba(255,255,255,0.1)",
          border: "1px solid rgba(255,255,255,0.2)",
          color: "white",
          padding: "10px 20px",
          borderRadius: "8px",
          fontSize: "14px",
          fontWeight: "600",
          cursor: "pointer",
          transition: "all 0.3s",
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.2)"}
        onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
      >
        ← Back to Flights
      </button>
      
      <div style={{
        backgroundColor: "var(--surface)",
        borderRadius: "16px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        padding: "40px",
        width: "100%",
        maxWidth: "480px"
      }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <h1 style={{
            fontSize: "28px",
            fontWeight: "700",
            color: "var(--text-primary)",
            marginBottom: "8px"
          }}>
            Reset Password
          </h1>
          <p style={{
            fontSize: "14px",
            color: "#6c757d"
          }}>
            {step === 1 && "Enter your email or username to receive a reset code"}
            {step === 2 && "Enter the verification code sent to your email"}
            {step === 3 && "Create a new password"}
          </p>
        </div>

        {/* Progress indicator */}
        <div style={{
          display: "flex",
          gap: "8px",
          marginBottom: "24px",
          justifyContent: "center"
        }}>
          {[1, 2, 3].map(s => (
            <div
              key={s}
              style={{
                width: "40px",
                height: "4px",
                borderRadius: "2px",
                background: s <= step ? "#20c997" : "#e9ecef",
                transition: "background 0.3s ease"
              }}
            />
          ))}
        </div>

        {/* Error/Success messages */}
          {error && (
            <div className="as-auth-error">
              {error}
            </div>
          )}
          
          {success && (
            <div className="as-auth-success">
              {success}
            </div>
          )}

          {/* Step 1: Enter email/username */}
          {step === 1 && (
            <form onSubmit={handleRequestReset}>
              <div style={{ marginBottom: "24px" }}>
                <label style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "var(--text-primary)",
                  marginBottom: "8px"
                }}>Email or Username</label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Enter your email or username"
                  required
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    fontSize: "15px",
                    border: "1px solid #dfe3e8",
                    borderRadius: "8px",
                    outline: "none",
                    transition: "border-color 0.2s"
                  }}
                  disabled={loading}
                  onFocus={(e) => e.target.style.borderColor = "#20c997"}
                  onBlur={(e) => e.target.style.borderColor = "#dfe3e8"}
                />
              </div>

              <button
                type="submit"
                style={{
                  width: "100%",
                  padding: "14px 24px",
                  fontSize: "15px",
                  fontWeight: "600",
                  color: "white",
                  backgroundColor: "#20c997",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  transition: "background-color 0.2s",
                  opacity: (loading || !identifier.trim()) ? 0.6 : 1,
                  pointerEvents: (loading || !identifier.trim()) ? "none" : "auto"
                }}
                onMouseEnter={(e) => {
                  if (!loading && identifier.trim()) {
                    e.target.style.backgroundColor = "#1aa179";
                  }
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = "#20c997";
                }}
              >
                {loading ? "Sending Code..." : "Send Reset Code"}
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleVerifyCode}>
              <div style={{ marginBottom: "24px" }}>
                <label style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "var(--text-primary)",
                  marginBottom: "8px"
                }}>Verification Code</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  required
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    fontSize: "20px",
                    fontWeight: "600",
                    letterSpacing: "8px",
                    textAlign: "center",
                    border: "1px solid #dfe3e8",
                    borderRadius: "8px",
                    outline: "none",
                    transition: "border-color 0.2s"
                  }}
                  disabled={loading}
                  onFocus={(e) => e.target.style.borderColor = "#20c997"}
                  onBlur={(e) => e.target.style.borderColor = "#dfe3e8"}
                />
              </div>

              <button
                type="submit"
                style={{
                  width: "100%",
                  padding: "14px 24px",
                  fontSize: "15px",
                  fontWeight: "600",
                  color: "white",
                  backgroundColor: "#20c997",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  transition: "background-color 0.2s",
                  opacity: (loading || code.length !== 6) ? 0.6 : 1,
                  pointerEvents: (loading || code.length !== 6) ? "none" : "auto"
                }}
                onMouseEnter={(e) => {
                  if (!loading && code.length === 6) {
                    e.target.style.backgroundColor = "#1aa179";
                  }
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = "#20c997";
                }}
              >
                {loading ? "Verifying..." : "Verify Code"}
              </button>
              
              <div style={{ marginTop: "16px", textAlign: "center" }}>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#20c997",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "600",
                    textDecoration: "underline",
                    padding: "8px 16px"
                  }}
                >
                  Wrong email? Go back
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={handleResetPassword}>
              <div style={{ marginBottom: "20px" }}>
                <label style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "var(--text-primary)",
                  marginBottom: "8px"
                }}>New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    fontSize: "15px",
                    border: "1px solid #dfe3e8",
                    borderRadius: "8px",
                    outline: "none",
                    transition: "border-color 0.2s"
                  }}
                  disabled={loading}
                  onFocus={(e) => e.target.style.borderColor = "#20c997"}
                  onBlur={(e) => e.target.style.borderColor = "#dfe3e8"}
                />
              </div>

              <div style={{ marginBottom: "24px" }}>
                <label style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "var(--text-primary)",
                  marginBottom: "8px"
                }}>Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    fontSize: "15px",
                    border: "1px solid #dfe3e8",
                    borderRadius: "8px",
                    outline: "none",
                    transition: "border-color 0.2s"
                  }}
                  disabled={loading}
                  onFocus={(e) => e.target.style.borderColor = "#20c997"}
                  onBlur={(e) => e.target.style.borderColor = "#dfe3e8"}
                />
              </div>

              <button
                type="submit"
                style={{
                  width: "100%",
                  padding: "14px 24px",
                  fontSize: "15px",
                  fontWeight: "600",
                  color: "white",
                  backgroundColor: "#20c997",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  transition: "background-color 0.2s",
                  opacity: (loading || newPassword.length < 6 || newPassword !== confirmPassword) ? 0.6 : 1,
                  pointerEvents: (loading || newPassword.length < 6 || newPassword !== confirmPassword) ? "none" : "auto"
                }}
                onMouseEnter={(e) => {
                  if (!loading && newPassword.length >= 6 && newPassword === confirmPassword) {
                    e.target.style.backgroundColor = "#1aa179";
                  }
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = "#20c997";
                }}
              >
                {loading ? "Resetting..." : "Reset Password"}
              </button>
            </form>
          )}

          {/* Back to login */}
          <div style={{ marginTop: "24px", textAlign: "center" }}>
            <Link to="/login" className="as-auth-link">
              ← Back to Login
            </Link>
          </div>
      </div>
    </div>
  );
}
