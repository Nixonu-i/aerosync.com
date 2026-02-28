import { useContext, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

const LINKS = [
  { to: "/agent",               label: "Dashboard",      end: true },
  { to: "/agent/flights",       label: "Flights",        end: false },
  { to: "/agent/bookings",      label: "Bookings",       end: false },
  { to: "/agent/verify",        label: "Verify QR",      end: false },
  { to: "/agent/create-booking",label: "Create Booking", end: false },
  { to: "/agent/profile",       label: "My Profile",     end: false },
];

export default function AgentNavbar() {
  const { user, logout } = useContext(AuthContext);
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  const doLogout = () => { logout(); nav("/login"); };

  if (!user) return null;

  return (
    <nav className="as-agent-navbar">
      <div className="as-agent-navbar-inner">
        {/* Brand */}
        <NavLink to="/agent" className="as-agent-brand">
          <span style={{ color: "#20c997" }}>AERO</span>SYNC
          <span style={{
            marginLeft: "8px",
            background: "rgba(32,201,151,0.18)",
            color: "#20c997",
            border: "1px solid rgba(32,201,151,0.4)",
            padding: "2px 8px",
            borderRadius: "12px",
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "1px",
            verticalAlign: "middle",
          }}>AGENT</span>
        </NavLink>

        {/* Desktop links */}
        <div className="as-agent-links-row">
          {LINKS.map(l => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) => `as-agent-link${isActive ? " active" : ""}`}
            >
              {l.label}
            </NavLink>
          ))}
        </div>

        {/* Desktop user area */}
        <div className="as-agent-user-desktop">
          <span className="as-agent-badge">{user.staff_id || "AGENT"}</span>
          <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "13px" }}>
            {user.username}
          </span>
          <button
            onClick={doLogout}
            style={{
              background: "rgba(32,201,151,0.15)",
              color: "#20c997",
              border: "1px solid rgba(32,201,151,0.35)",
              borderRadius: "6px",
              padding: "5px 14px",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            Logout
          </button>
        </div>

        {/* Hamburger */}
        <button
          className={`as-hamburger${open ? " open" : ""}`}
          onClick={() => setOpen(o => !o)}
          aria-label="Toggle menu"
        >
          <span /><span /><span />
        </button>
      </div>

      {/* Mobile drawer */}
      <div className={`as-agent-mobile${open ? " open" : ""}`}>
        {LINKS.map(l => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) => `as-agent-mobile-link${isActive ? " active" : ""}`}
            onClick={() => setOpen(false)}
          >
            {l.label}
          </NavLink>
        ))}
        <div style={{
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          marginTop: "4px",
        }}>
          <span className="as-agent-badge">{user.staff_id || "AGENT"}</span>
          <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "13px", flex: 1 }}>
            {user.username}
          </span>
          <button
            onClick={doLogout}
            style={{
              background: "rgba(32,201,151,0.15)",
              color: "#20c997",
              border: "1px solid rgba(32,201,151,0.35)",
              borderRadius: "6px",
              padding: "5px 12px",
              cursor: "pointer",
              fontSize: "13px",
            }}
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
