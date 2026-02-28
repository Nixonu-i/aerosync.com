import { useContext, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

export default function Register() {
  const { register } = useContext(AuthContext);
  const nav = useNavigate();

  const [form, setForm] = useState({
    username: "",
    email: "",
    full_name: "",
    password: "",
    password2: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const onChange = (k) => (e) => {
    const val = k === "full_name" ? e.target.value.toUpperCase() : e.target.value;
    setForm((p) => ({ ...p, [k]: val }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await register(form);
      nav("/login");
    } catch (e2) {
      setErr(e2.normalizedMessage || "Registration failed");
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
          <div>
            <input 
              placeholder="Username"
              value={form.username}
              onChange={onChange("username")}
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
              placeholder="Email"
              type="email"
              value={form.email}
              onChange={onChange("email")}
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
              placeholder="Full name"
              value={form.full_name}
              onChange={onChange("full_name")}
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
              value={form.password}
              onChange={onChange("password")}
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
              placeholder="Confirm password"
              type="password"
              value={form.password2}
              onChange={onChange("password2")}
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