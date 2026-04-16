import { useState, useContext } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import ThemeToggle from './ThemeToggle';

export default function Navbar() {
  const { user, logout, loading } = useContext(AuthContext);
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  const doLogout = () => { logout(); nav("/login"); };

  if (!user) return null;

  return (
    <nav className="as-navbar">
      {/* ── Desktop / top bar ── */}
      <div className="as-navbar-inner">
        {/* Brand */}
        <Link to="/" className="as-navbar-brand">
          <span style={{ color: "var(--accent)" }}>AERO</span>SYNC
        </Link>

        {/* Centre nav links — hidden on mobile */}
        <div className="as-nav-links">
          <NavLink 
            to={(() => {
              // Admin users go to admin dashboard
              if (user.is_admin || user.role === 'ADMIN') return '/admin';
              // Agent users go to agent dashboard
              if (user.is_agent || user.role === 'AGENT') return '/agent';
              // Regular customers go to customer dashboard
              return '/dashboard';
            })()} 
            end 
            className={({ isActive }) => `as-nav-link${isActive ? " active" : ""}`}
          >
            Dashboard
          </NavLink>
          <NavLink to="/flights" className={({ isActive }) => `as-nav-link${isActive ? " active" : ""}`}>
            Flights
          </NavLink>
          <NavLink to="/bookings" className={({ isActive }) => `as-nav-link${isActive ? " active" : ""}`}>
            My Bookings
          </NavLink>
          <NavLink to="/profile" className={({ isActive }) => `as-nav-link${isActive ? " active" : ""}`}>
            Profile
          </NavLink>
        </div>

        {/* Right user section — hidden on mobile */}
        <div className="as-navbar-user">
          {loading ? (
            <span style={{ color: "var(--text-primary)", fontSize: "14px" }}>Loading...</span>
          ) : (
            <>
              <ThemeToggle />
              <button className="as-btn-logout" onClick={doLogout}>Logout</button>
            </>
          )}
        </div>

        {/* Hamburger — visible on mobile */}
        <button
          className={`as-hamburger${open ? " open" : ""}`}
          onClick={() => setOpen(o => !o)}
          aria-label="Toggle menu"
        >
          <span /><span /><span />
        </button>
      </div>

      {/* ── Mobile drawer ── */}
      <div className={`as-navbar-mobile${open ? " open" : ""}`}>
        <NavLink 
          to={(() => {
            // Admin users go to admin dashboard
            if (user.is_admin || user.role === 'ADMIN') return '/admin';
            // Agent users go to agent dashboard
            if (user.is_agent || user.role === 'AGENT') return '/agent';
            // Regular customers go to customer dashboard
            return '/dashboard';
          })()} 
          end 
          className={({ isActive }) => `as-nav-link${isActive ? " active" : ""}`} 
          onClick={() => setOpen(false)}
        >
          Dashboard
        </NavLink>
        <NavLink to="/flights" className={({ isActive }) => `as-nav-link${isActive ? " active" : ""}`} onClick={() => setOpen(false)}>
          Flights
        </NavLink>
        <NavLink to="/bookings" className={({ isActive }) => `as-nav-link${isActive ? " active" : ""}`} onClick={() => setOpen(false)}>
          My Bookings
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => `as-nav-link${isActive ? " active" : ""}`} onClick={() => setOpen(false)}>
          Profile
        </NavLink>
        <div className="as-mobile-user-row">
          <span className="as-navbar-username">{user.username}</span>
          <ThemeToggle />
          <button className="as-btn-logout" onClick={doLogout}>Logout</button>
        </div>
      </div>
    </nav>
  );
}
