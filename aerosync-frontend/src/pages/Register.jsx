import { useContext, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { formatErrorMessage } from "../utils/errorFormatter";

export default function Register() {
  const { register } = useContext(AuthContext);
  const nav = useNavigate();

  const [form, setForm] = useState({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    password: "",
    password2: "",
  });
  
  // Error states for each field
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const onChange = (k) => (e) => {
    const val = k === "first_name" || k === "last_name" ? e.target.value.toUpperCase() : e.target.value;
    setForm((p) => ({ ...p, [k]: val }));
    
    // Clear error for this field when user starts typing
    if (errors[k]) {
      setErrors(prev => ({ ...prev, [k]: '' }));
    }
    
    // Real-time validation
    if (k === 'email') {
      // Email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (val && !emailRegex.test(val)) {
        setErrors(prev => ({ ...prev, email: 'Please enter a valid email address.' }));
      } else {
        setErrors(prev => ({ ...prev, email: '' }));
      }
    }
    
    if (k === 'first_name' || k === 'last_name') {
      // Name validation (letters and spaces only)
      if (val && !/^[a-zA-Z\s]+$/.test(val)) {
        setErrors(prev => ({ ...prev, [k]: 'Name should contain only letters and spaces.' }));
      } else {
        setErrors(prev => ({ ...prev, [k]: '' }));
      }
    }
    
    if (k === 'password') {
      // Password length validation
      if (val && val.length < 8) {
        setErrors(prev => ({ ...prev, password: 'Password must be at least 8 characters long.' }));
      } else {
        setErrors(prev => ({ ...prev, password: '' }));
      }
    }
    
    if (k === 'password2') {
      // Password match validation
      if (val && val !== form.password) {
        setErrors(prev => ({ ...prev, password2: 'Passwords do not match.' }));
      } else {
        setErrors(prev => ({ ...prev, password2: '' }));
      }
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    
    // Final validation check before submit
    const newErrors = {};
    
    if (!form.first_name || !/^[a-zA-Z\s]+$/.test(form.first_name)) {
      newErrors.first_name = 'First name should contain only letters and spaces.';
    }
    
    if (!form.last_name || !/^[a-zA-Z\s]+$/.test(form.last_name)) {
      newErrors.last_name = 'Last name should contain only letters and spaces.';
    }
    
    if (!form.password || form.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters long.';
    }
    
    if (form.password !== form.password2) {
      newErrors.password2 = 'Passwords do not match.';
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!form.email || !emailRegex.test(form.email)) {
      newErrors.email = 'Please enter a valid email address.';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    setBusy(true);
    try {
      const response = await register(form);
      // Redirect to email verification page with email pre-filled
      nav("/verify-email", { 
        state: { 
          email: form.email,
          message: 'Registration successful! A verification code has been sent to your email.',
          autoFillEmail: true  // Flag to auto-fill email in verification page
        } 
      });
    } catch (e2) {
      // Use nice error messages
      setErr(formatErrorMessage(e2, "Registration failed. Please check your information and try again."));
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
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.1)",
        width: "100%",
        maxWidth: "520px"
      }}>
        <h2 style={{
          textAlign: "center",
          color: "#0b1220",
          marginBottom: "25px",
          fontSize: "28px",
          fontWeight: "700"
        }}>AeroSync Registration</h2>
        
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
          {/* Username Field */}
          <div>
            <input 
              placeholder="Username"
              value={form.username}
              onChange={onChange("username")}
              required
              style={{
                width: "100%",
                padding: "12px",
                border: `1px solid ${errors.username ? '#dc3545' : '#ced4da'}`,
                borderRadius: "5px",
                fontSize: "16px",
                boxSizing: "border-box"
              }}
            />
            {errors.username && (
              <div style={{ color: '#dc3545', fontSize: '12px', marginTop: '4px' }}>
                {errors.username}
              </div>
            )}
          </div>
                  
          {/* Email Field */}
          <div>
            <input 
              placeholder="Email"
              type="email"
              value={form.email}
              onChange={onChange("email")}
              required
              style={{
                width: "100%",
                padding: "12px",
                border: `1px solid ${errors.email ? '#dc3545' : '#ced4da'}`,
                borderRadius: "5px",
                fontSize: "16px",
                boxSizing: "border-box"
              }}
            />
            {errors.email && (
              <div style={{ color: '#dc3545', fontSize: '12px', marginTop: '4px' }}>
                {errors.email}
              </div>
            )}
          </div>
                  
          {/* First Name and Last Name - Side by Side */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
            <div>
              <input 
                placeholder="First Name"
                value={form.first_name}
                onChange={onChange("first_name")}
                required
                style={{
                  width: "100%",
                  padding: "12px",
                  border: `1px solid ${errors.first_name ? '#dc3545' : '#ced4da'}`,
                  borderRadius: "5px",
                  fontSize: "16px",
                  boxSizing: "border-box"
                }}
              />
              {errors.first_name && (
                <div style={{ color: '#dc3545', fontSize: '12px', marginTop: '4px' }}>
                  {errors.first_name}
                </div>
              )}
            </div>
                    
            <div>
              <input 
                placeholder="Last Name"
                value={form.last_name}
                onChange={onChange("last_name")}
                required
                style={{
                  width: "100%",
                  padding: "12px",
                  border: `1px solid ${errors.last_name ? '#dc3545' : '#ced4da'}`,
                  borderRadius: "5px",
                  fontSize: "16px",
                  boxSizing: "border-box"
                }}
              />
              {errors.last_name && (
                <div style={{ color: '#dc3545', fontSize: '12px', marginTop: '4px' }}>
                  {errors.last_name}
                </div>
              )}
            </div>
          </div>
                  
          {/* Password Field */}
          <div>
            <input 
              placeholder="Password"
              type="password"
              value={form.password}
              onChange={onChange("password")}
              required
              style={{
                width: "100%",
                padding: "12px",
                border: `1px solid ${errors.password ? '#dc3545' : '#ced4da'}`,
                borderRadius: "5px",
                fontSize: "16px",
                boxSizing: "border-box"
              }}
            />
            {errors.password && (
              <div style={{ color: '#dc3545', fontSize: '12px', marginTop: '4px' }}>
                {errors.password}
              </div>
            )}
          </div>
                  
          {/* Confirm Password Field */}
          <div>
            <input 
              placeholder="Confirm Password"
              type="password"
              value={form.password2}
              onChange={onChange("password2")}
              required
              style={{
                width: "100%",
                padding: "12px",
                border: `1px solid ${errors.password2 ? '#dc3545' : '#ced4da'}`,
                borderRadius: "5px",
                fontSize: "16px",
                boxSizing: "border-box"
              }}
            />
            {errors.password2 && (
              <div style={{ color: '#dc3545', fontSize: '12px', marginTop: '4px' }}>
                {errors.password2}
              </div>
            )}
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
              fontWeight: "600",
              marginTop: "10px"
            }}
          >
            {busy ? "Creating..." : "Create account"}
          </button>
        </form>
        
        <div style={{
          textAlign: "center",
          marginTop: "20px",
          fontSize: "14px",
          color: "#6c757d"
        }}>
          Already have an account?{' '}
          <Link 
            to="/login"
            style={{
              color: "#0b1220",
              fontWeight: "600",
              textDecoration: "underline"
            }}
          >
            Login here
          </Link>
        </div>
      </div>
    </div>
  );
}