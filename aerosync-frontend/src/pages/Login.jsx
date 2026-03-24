import { useContext, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { formatErrorMessage } from "../utils/errorFormatter";

export default function Login() {
  const { login } = useContext(AuthContext);
  const nav = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  
  // Get flight ID from previous page if user came from flights
  const flightId = location.state?.flightId;

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const user = await login(username, password);
      
      // Redirect based on user role
      if (user?.is_admin || user?.role === 'ADMIN') {
        // Admin → Admin Dashboard
        nav('/admin');
      } else if (user?.is_agent || user?.role === 'AGENT') {
        // Agent → Check if profile is complete
        // If profile complete → Dashboard, otherwise → Profile to complete
        if (user.profile?.initial_setup_done) {
          nav('/agent');
        } else {
          nav('/agent/profile', { state: { flightId } });
        }
      } else {
        // Customer/User → Customer Dashboard (profile completion will be enforced by App.jsx if needed)
        // Pass flightId if they came from a flight booking
        nav('/dashboard', { state: { flightId } });
      }
    } catch (e2) {
      // Check if it's an email verification error
      if (e2.response?.status === 403 && e2.response?.data?.requires_verification) {
        // Redirect to verification page with email pre-filled
        nav("/verify-email", {
          state: {
            email: e2.response.data.email,
            message: 'Please verify your email to continue.',
            fromLogin: true,
            autoFillEmail: true  // This tells VerifyEmail to hide the input field
          }
        });
      } else {
        // Use nice error messages
        setErr(formatErrorMessage(e2, "Login failed. Please check your credentials and try again."));
      }
    } finally {
      setBusy(false);
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
        onClick={() => nav('/')}
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
        backgroundColor: "white",
        padding: "30px",
        borderRadius: "10px",
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
        width: "100%",
        maxWidth: "420px"
      }}>
        <h2 style={{
          textAlign: "center",
          color: "#0b1220",
          marginBottom: "25px",
          fontSize: "28px",
          fontWeight: "700"
        }}>AeroSync Login</h2>
        
        {err ? (
          <div style={{
            background: "#f8d7da",
            color: "#721c24",
            padding: "12px",
            borderRadius: "5px",
            marginBottom: "15px",
            border: "1px solid #f5c6cb",
            fontSize: "14px"
          }}>
            {err}
          </div>
        ) : null}

        <form onSubmit={submit} style={{ display: "grid", gap: 15 }}>
          <div>
            <input 
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid #ced4da",
                borderRadius: "5px",
                fontSize: "16px",
                boxSizing: "border-box"
              }}
            />
          </div>
          <div>
            <input 
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid #ced4da",
                borderRadius: "5px",
                fontSize: "16px",
                boxSizing: "border-box"
              }}
            />
          </div>
          <button 
            disabled={busy}
            style={{
              backgroundColor: busy ? "#6c757d" : "#0b1220",
              color: "white",
              border: "none",
              padding: "12px",
              borderRadius: "5px",
              fontSize: "16px",
              cursor: busy ? "not-allowed" : "pointer",
              fontWeight: "600"
            }}
          >
            {busy ? "Signing in..." : "Sign in"}
          </button>
        </form>
        
        <div style={{
          textAlign: "center",
          marginTop: "20px",
          fontSize: "14px",
          color: "#6c757d"
        }}>
          Don't have an account?{' '}
          <Link 
            to="/register"
            style={{
              color: "#0b1220",
              fontWeight: "600",
              textDecoration: "underline"
            }}
          >
            Register here
          </Link>
        </div>
        
        <div style={{
          textAlign: "center",
          marginTop: "12px",
          fontSize: "14px"
        }}>
          <Link 
            to="/forgot-password"
            style={{
              color: "#20c997",
              fontWeight: "600",
              textDecoration: "underline"
            }}
          >
            Forgot Password?
          </Link>
        </div>
      </div>
    </div>
  );
}