import { useContext, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

export default function Login() {
  const { login } = useContext(AuthContext);
  const nav = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await login(username, password);
      nav("/"); // PrivateContent will redirect admin → /admin automatically
    } catch (e2) {
      setErr(e2.normalizedMessage || "Login failed");
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
      </div>
    </div>
  );
}