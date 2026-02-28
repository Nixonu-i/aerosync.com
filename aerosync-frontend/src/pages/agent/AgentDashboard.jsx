import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import API from "../../api/api";

const teal   = "#20c997";
const CARD = {
  background: "rgba(5, 19, 30, 0.82)",
  border: "1px solid rgba(32,201,151,0.3)",
  borderRadius: "12px",
  padding: "20px 24px",
  color: "#fff",
};

function StatCard({ label, value, color = teal }) {
  return (
    <div style={{ ...CARD, display: "flex", flexDirection: "column", gap: "6px" }}>
      <div style={{ fontSize: "28px", fontWeight: 800, color }}>{value ?? "…"}</div>
      <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.75)", fontWeight: 500 }}>{label}</div>
    </div>
  );
}

function QuickLink({ to, icon, label, desc }) {
  return (
    <Link to={to} style={{ textDecoration: "none", color: "inherit" }}>
      <div
        style={{
          ...CARD,
          cursor: "pointer",
          transition: "border-color 0.2s, background 0.2s",
          display: "flex",
          alignItems: "flex-start",
          gap: "14px",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = teal;
          e.currentTarget.style.background  = "rgba(32,201,151,0.14)";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = "rgba(32,201,151,0.3)";
          e.currentTarget.style.background  = "rgba(5, 19, 30, 0.82)";
        }}
      >
        <div style={{ color: teal, flexShrink: 0, marginTop: "2px" }}>{icon}</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: "15px", color: "#fff" }}>{label}</div>
          <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.65)", marginTop: "4px", lineHeight: 1.4 }}>{desc}</div>
        </div>
      </div>
    </Link>
  );
}

const Icons = {
  QrScan: () => (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <path d="M14 14h2v2h-2zM14 18h2v2h-2zM18 14h2v2h-2zM18 18h2v2h-2z"/>
    </svg>
  ),
  Ticket: () => (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 9a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v1a2 2 0 0 0 0 4v1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-1a2 2 0 0 0 0-4V9z"/>
      <line x1="9" y1="7" x2="9" y2="17" strokeDasharray="2 2"/>
    </svg>
  ),
  Plane: () => (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
      <path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2 1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/>
    </svg>
  ),
  ClipboardList: () => (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="2" width="8" height="4" rx="1"/>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
      <line x1="9" y1="12" x2="15" y2="12"/>
      <line x1="9" y1="16" x2="13" y2="16"/>
    </svg>
  ),
  User: () => (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
};

export default function AgentDashboard() {
  const { user } = useContext(AuthContext);
  const [stats, setStats]   = useState({ today: 0, onboard: 0, confirmed: 0 });
  const [busy, setBusy]     = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await API.get("agent/bookings/");
        const bookings = res.data || [];
        const today = new Date().toDateString();
        setStats({
          today:     bookings.filter(b => b.departure_time && new Date(b.departure_time).toDateString() === today).length,
          onboard:   bookings.filter(b => b.booking_status === "ONBOARD").length,
          confirmed: bookings.filter(b => b.booking_status === "CONFIRMED").length,
        });
      } catch { /* ignore */ }
      finally { setBusy(false); }
    })();
  }, []);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <div style={{ color: "rgba(255,255,255,0.75)", fontSize: "14px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
          Welcome back, <strong style={{ color: teal }}>{user?.username}</strong>
          {user?.staff_id && (
            <span style={{
              background: "rgba(32,201,151,0.2)",
              color: teal,
              border: "1px solid rgba(32,201,151,0.45)",
              borderRadius: "20px",
              padding: "2px 10px",
              fontSize: "12px",
              fontWeight: 700,
            }}>
              {user.staff_id}
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="as-stats-grid" style={{ marginBottom: "32px" }}>
        <StatCard label="Today's Flights"      value={busy ? "…" : stats.today}    />
        <StatCard label="Confirmed Bookings"   value={busy ? "…" : stats.confirmed} color="#17a2b8" />
        <StatCard label="Passengers On Board"  value={busy ? "…" : stats.onboard}  color="#28a745" />
      </div>

      {/* Quick actions */}
      <h3 style={{
        color: "rgba(255,255,255,0.85)",
        fontSize: "13px",
        marginBottom: "16px",
        textTransform: "uppercase",
        letterSpacing: "1.2px",
        fontWeight: 700,
      }}>
        Quick Actions
      </h3>
      <div className="as-stats-grid">
        <QuickLink
          to="/agent/verify"
          icon={<Icons.QrScan />}
          label="Scan QR Code"
          desc="Open camera, scan boarding pass QR and mark passenger on board"
        />
        <QuickLink
          to="/agent/create-booking"
          icon={<Icons.Ticket />}
          label="Create Booking"
          desc="Book a flight on behalf of a registered customer"
        />
        <QuickLink
          to="/agent/flights"
          icon={<Icons.Plane />}
          label="View Flights"
          desc="Browse available scheduled flights"
        />
        <QuickLink
          to="/agent/bookings"
          icon={<Icons.ClipboardList />}
          label="Booking History"
          desc="View all bookings and download passenger boarding passes"
        />
      </div>
      
      {/* Profile link - separate since it needs different component */}
      <div className="as-stats-grid" style={{ marginTop: "16px" }}>
        <Link to="/agent/profile" style={{ textDecoration: "none", color: "inherit" }}>
          <div
            style={{
              ...CARD,
              cursor: "pointer",
              transition: "border-color 0.2s, background 0.2s",
              display: "flex",
              alignItems: "flex-start",
              gap: "14px",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = teal;
              e.currentTarget.style.background  = "rgba(32,201,151,0.14)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = "rgba(32,201,151,0.3)";
              e.currentTarget.style.background  = "rgba(5, 19, 30, 0.82)";
            }}
          >
            <div style={{ color: teal, flexShrink: 0, marginTop: "2px" }}><Icons.User /></div>
            <div>
              <div style={{ fontWeight: 700, fontSize: "15px", color: "#fff" }}>My Profile</div>
              <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.65)", marginTop: "4px", lineHeight: 1.4 }}>Update your personal information</div>
            </div>
          </div>
        </Link>
      </div>

      {/* Permission note */}
      <div style={{
        marginTop: "32px",
        background: "rgba(5, 19, 30, 0.75)",
        border: "1px solid rgba(32,201,151,0.25)",
        borderRadius: "10px",
        padding: "16px 20px",
        fontSize: "13px",
        color: "rgba(255,255,255,0.7)",
        lineHeight: "1.6",
      }}>
        <strong style={{ color: teal }}>Agent Permissions:</strong>&nbsp;
        View flights &bull; Create bookings for customers &bull; Scan &amp; verify QR boarding passes &bull; Mark passengers as on board
      </div>
    </div>
  );
}
