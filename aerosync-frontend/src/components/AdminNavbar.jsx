import { useState, useContext } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

const LINKS = [
  { to: "/admin",          label: "Dashboard", end: true  },
  { to: "/admin/flights",  label: "Flights"               },
  { to: "/admin/bookings", label: "Bookings"              },
  { to: "/admin/airports", label: "Airports"              },
  { to: "/admin/aircraft", label: "Aircraft"              },
  { to: "/admin/airlines", label: "Airlines"              },
  { to: "/admin/users",    label: "Users"                 },
  { to: "/admin/reports",  label: "Reports"               },
  { to: "/admin/activity-logs", label: "Activity"         },
];

export default function AdminNavbar() {
  const { user, logout } = useContext(AuthContext);
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  const doLogout = () => { logout(); nav("/login"); };

  return (
    <nav className="as-admin-navbar">
      {/* ── Top bar ── */}
      <div className="as-admin-navbar-inner">
        {/* Brand */}
        <div className="as-admin-brand">
          <span className="as-admin-brand-text" style={{ color: "#d4af37" }}>AERO</span>
          <span className="as-admin-brand-text" style={{ color: "white" }}>SYNC</span>
          <span className="as-admin-badge">ADMIN</span>
        </div>

        {/* Centre links — hidden on narrow screens */}
        <div className="as-admin-links-row">
          {LINKS.map(l => (
            <NavLink key={l.to} to={l.to} end={l.end}
              className={({ isActive }) => `as-admin-link${isActive ? " active" : ""}`}>
              {l.label}
            </NavLink>
          ))}
        </div>

        {/* Right user — hidden on narrow */}
        <div className="as-admin-user-desktop">
          <button className="as-btn-logout" onClick={doLogout}>Logout</button>
        </div>

        {/* Hamburger — visible on narrow */}
        <button
          className={`as-hamburger${open ? " open" : ""}`}
          onClick={() => setOpen(o => !o)}
          aria-label="Toggle menu"
        >
          <span /><span /><span />
        </button>
      </div>

      {/* ── Mobile drawer ── */}
      <div className={`as-admin-mobile${open ? " open" : ""}`}>
        {LINKS.map(l => (
          <NavLink key={l.to} to={l.to} end={l.end}
            className={({ isActive }) => `as-admin-link${isActive ? " active" : ""}`}
            onClick={() => setOpen(false)}>
            {l.label}
          </NavLink>
        ))}
        <div className="as-admin-mobile-user">
          <button className="as-btn-logout" onClick={doLogout}>Logout</button>
        </div>
      </div>
    </nav>
  );
}
