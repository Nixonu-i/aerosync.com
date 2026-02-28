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
];

const EXTRA_LINKS = [
  { to: "/admin/activity-logs",  label: "Activity Logs"         },
];

export default function AdminNavbar() {
  const { user, logout } = useContext(AuthContext);
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const doLogout = () => { logout(); nav("/login"); };

  const toggleDropdown = () => {
    setDropdownOpen(!dropdownOpen);
  };

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
          {/* Dropdown for extra links */}
          <div className="relative ml-2">
            <div className="dropdown-container">
              <button 
                className="as-admin-link as-dropdown-trigger"
                onClick={toggleDropdown}
                onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
              >
                More <span className="ml-1">▼</span>
              </button>
              {dropdownOpen && (
                <div className="dropdown-menu absolute left-0 mt-1 w-48 bg-white shadow-lg rounded-md py-2 z-50 border border-gray-200">
                  {EXTRA_LINKS.map(l => (
                    <NavLink 
                      key={l.to} 
                      to={l.to}
                      className={({ isActive }) => `block px-4 py-2 text-sm ${isActive ? "bg-blue-100 text-blue-800" : "text-gray-700 hover:bg-gray-100"}`}
                      onClick={() => setDropdownOpen(false)}>
                      {l.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          </div>
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
        {/* Extra links for mobile */}
        <div className="border-t border-gray-200 pt-2 mt-2">
          <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">More Options</h3>
          {EXTRA_LINKS.map(l => (
            <NavLink key={l.to} to={l.to}
              className={({ isActive }) => `as-admin-link${isActive ? " active" : ""}`}
              onClick={() => setOpen(false)}>
              {l.label}
            </NavLink>
          ))}
        </div>
        <div className="as-admin-mobile-user">
          <button className="as-btn-logout" onClick={doLogout}>Logout</button>
        </div>
      </div>
    </nav>
  );
}
