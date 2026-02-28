import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import API from "../api/api";

/* ─── Inline SVG Icon Library ────────────────────────────────────────────── */
const Icon = {
  Plane: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
      <path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2 1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/>
    </svg>
  ),
  PlaneTakeoff: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
      <path d="M2 22h20"/>
      <path d="M6.36 17.4 4 17l-2-4 1.1-.55a2 2 0 0 1 1.8 0l.17.1A2 2 0 0 0 6.8 12.8l.07-.35A4 4 0 0 1 10.66 9h.01a4 4 0 0 1 .98.12L18 11l3 3-1 1-6-2-2 3.3"/>
    </svg>
  ),
  Ticket: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/>
      <line x1="9" y1="9" x2="9" y2="15"/>
    </svg>
  ),
  CheckCircle: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="9 12 11 14 15 10"/>
    </svg>
  ),
  Clock: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  Calendar: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  User: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  ArrowRight: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <line x1="5" y1="12" x2="19" y2="12"/>
      <polyline points="12 5 19 12 12 19"/>
    </svg>
  ),
  MapPin: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  ),
  Search: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  BookOpen: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
    </svg>
  ),
  XCircle: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
      <circle cx="12" cy="12" r="10"/>
      <line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
    </svg>
  ),
};

/* ─── Status badge ────────────────────────────────────────────────────────── */
const STATUS_CONFIG = {
  CONFIRMED:  { color: "#28a745", bg: "rgba(40,167,69,0.15)",  label: "Confirmed" },
  PENDING:    { color: "#ffc107", bg: "rgba(255,193,7,0.15)",  label: "Pending Payment" },
  ONBOARD:    { color: "#17a2b8", bg: "rgba(23,162,184,0.15)", label: "Onboard" },
  CANCELLED:  { color: "#dc3545", bg: "rgba(220,53,69,0.15)",  label: "Cancelled" },
  FAILED:     { color: "#dc3545", bg: "rgba(220,53,69,0.15)",  label: "Failed" },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { color: "#6c757d", bg: "rgba(108,117,125,0.15)", label: status };
  return (
    <span style={{
      fontSize: "11px", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase",
      color: cfg.color, backgroundColor: cfg.bg, padding: "3px 10px",
      borderRadius: "20px", border: `1px solid ${cfg.color}40`,
      whiteSpace: "nowrap"
    }}>
      {cfg.label}
    </span>
  );
}

/* ─── Glassy card ─────────────────────────────────────────────────────────── */
const card = {
  background: "rgba(11, 18, 32, 0.82)",
  border: "1px solid rgba(212,175,55,0.18)",
  borderRadius: "14px",
  backdropFilter: "blur(12px)",
  boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
};

/* ─── Main Dashboard ──────────────────────────────────────────────────────── */
export default function Dashboard() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get("bookings/")
      .then(r => setBookings(r.data?.results ?? r.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  /* ── Derived stats ── */
  const stats = {
    total:     bookings.length,
    confirmed: bookings.filter(b => b.booking_status === "CONFIRMED").length,
    pending:   bookings.filter(b => b.booking_status === "PENDING").length,
    upcoming:  bookings.filter(b => {
      if (b.booking_status !== "CONFIRMED") return false;
      try { return new Date(b.flight?.departure_time) > new Date(); } catch { return false; }
    }).length,
  };

  const recent = [...bookings]
    .sort((a, b) => new Date(b.booking_date) - new Date(a.booking_date))
    .slice(0, 5);

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div style={{ padding: "24px 20px", maxWidth: "1100px", margin: "0 auto" }}>

      {/* ── Hero welcome ────────────────────────────────────────────────────── */}
      <div style={{
        ...card,
        padding: "32px 36px",
        marginBottom: "24px",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Decorative flight path line */}
        <svg style={{ position: "absolute", right: 0, top: 0, bottom: 0, height: "100%", opacity: 0.06, pointerEvents: "none" }}
          viewBox="0 0 300 200" preserveAspectRatio="none">
          <path d="M300 0 Q200 100 300 200" stroke="#d4af37" strokeWidth="60" fill="none"/>
        </svg>
        {/* Decorative plane watermark */}
        <div style={{ position: "absolute", right: 32, top: "50%", transform: "translateY(-50%)", opacity: 0.06, color: "#d4af37" }}>
          <svg viewBox="0 0 24 24" fill="currentColor" width="140" height="140">
            <path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2 1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/>
          </svg>
        </div>

        <h1 style={{ color: "white", fontSize: "32px", fontWeight: 700, margin: "0 0 6px", letterSpacing: "-0.02em" }}>
          Welcome back, <span style={{ color: "#d4af37" }}>{user?.full_name || user?.username}</span>
        </h1>
        <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "14px", margin: 0 }}>{dateStr}</p>
      </div>

      {/* ── Stats row ──────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        {[
          { label: "Total Bookings",   value: stats.total,     icon: <Icon.Ticket />,      color: "#d4af37" },
          { label: "Confirmed",        value: stats.confirmed, icon: <Icon.CheckCircle />, color: "#28a745" },
          { label: "Pending Payment",  value: stats.pending,   icon: <Icon.Clock />,       color: "#ffc107" },
          { label: "Upcoming Flights", value: stats.upcoming,  icon: <Icon.Calendar />,    color: "#17a2b8" },
        ].map(stat => (
          <div key={stat.label} style={{
            ...card,
            padding: "20px 22px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}>
            <div style={{
              width: 46, height: 46, borderRadius: "12px", flexShrink: 0,
              backgroundColor: `${stat.color}18`,
              border: `1px solid ${stat.color}30`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: stat.color,
            }}>
              {stat.icon}
            </div>
            <div>
              <div style={{ fontSize: "28px", fontWeight: 700, color: "white", lineHeight: 1 }}>
                {loading ? <span style={{ fontSize: "18px", color: "rgba(255,255,255,0.3)" }}>—</span> : stat.value}
              </div>
              <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", marginTop: "4px", fontWeight: 500 }}>
                {stat.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main 2-column area ────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px", alignItems: "start" }}>

        {/* ── Recent Bookings ───────────────────────────────────────────── */}
        <div style={{ ...card, padding: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h2 style={{ color: "white", fontSize: "17px", fontWeight: 700, margin: 0, letterSpacing: "-0.01em" }}>
              Recent Bookings
            </h2>
            <button
              onClick={() => navigate("/bookings")}
              style={{
                background: "transparent", border: "1px solid rgba(212,175,55,0.3)",
                color: "#d4af37", padding: "6px 14px", borderRadius: "8px", cursor: "pointer",
                fontSize: "12px", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px",
                transition: "all 0.2s"
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(212,175,55,0.1)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            >
              View All <Icon.ArrowRight />
            </button>
          </div>

          {loading ? (
            <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "14px", textAlign: "center", padding: "40px 0" }}>
              Loading bookings...
            </div>
          ) : recent.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ color: "rgba(255,255,255,0.15)", marginBottom: "12px" }}>
                <Icon.Ticket />
              </div>
              <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "14px", margin: "0 0 16px" }}>
                No bookings yet
              </p>
              <button
                onClick={() => navigate("/flights")}
                style={{
                  background: "#d4af37", border: "none", color: "#0b1220",
                  padding: "10px 22px", borderRadius: "8px", cursor: "pointer",
                  fontSize: "13px", fontWeight: 700
                }}
              >
                Book Your First Flight
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
              {recent.map((b, idx) => (
                <div
                  key={b.id}
                  style={{
                    padding: "14px 16px",
                    borderRadius: "10px",
                    background: idx % 2 === 0 ? "rgba(255,255,255,0.03)" : "transparent",
                    display: "flex", alignItems: "center", gap: "14px",
                    transition: "background 0.15s",
                    cursor: "pointer",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(212,175,55,0.07)"}
                  onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? "rgba(255,255,255,0.03)" : "transparent"}
                  onClick={() => navigate("/bookings")}
                >
                  {/* Route pill */}
                  <div style={{
                    background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.2)",
                    borderRadius: "8px", padding: "8px 12px", flexShrink: 0, minWidth: "110px",
                    textAlign: "center"
                  }}>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "white", letterSpacing: "0.05em" }}>
                      {b.flight?.departure_airport_code || "???"} → {b.flight?.arrival_airport_code || "???"}
                    </div>
                    <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", marginTop: "2px" }}>
                      {b.flight?.airline || "—"}
                    </div>
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.85)", fontWeight: 600, display: "flex", alignItems: "center", gap: "5px" }}>
                      <span style={{ color: "rgba(255,255,255,0.35)", flexShrink: 0 }}><Icon.MapPin /></span>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {b.flight?.departure_airport_city || b.confirmation_code}
                      </span>
                    </div>
                    <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", marginTop: "3px" }}>
                      {b.flight?.departure_time
                        ? new Date(b.flight.departure_time).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })
                        : "—"
                      }
                      {" · "}
                      <span style={{ color: "#d4af37", fontWeight: 600 }}>
                        KES {parseFloat(b.total_amount || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Status */}
                  <StatusBadge status={b.booking_status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Quick Actions ─────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <h2 style={{ color: "rgba(255,255,255,0.6)", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 2px 4px" }}>
            Quick Actions
          </h2>

          {[
            {
              label: "Search Flights",
              sub:   "Find & book a new flight",
              icon:  <Icon.Search />,
              gold:  true,
              path:  "/flights",
            },
            {
              label: "My Bookings",
              sub:   "View all your bookings",
              icon:  <Icon.BookOpen />,
              gold:  false,
              path:  "/bookings",
            },
            {
              label: "My Profile",
              sub:   "Update personal details",
              icon:  <Icon.User />,
              gold:  false,
              path:  "/profile",
            },
          ].map(action => (
            <button
              key={action.path}
              onClick={() => navigate(action.path)}
              style={{
                ...card,
                width: "100%", padding: "16px 18px", cursor: "pointer",
                border: action.gold ? "1px solid rgba(212,175,55,0.45)" : "1px solid rgba(255,255,255,0.08)",
                display: "flex", alignItems: "center", gap: "14px",
                textAlign: "left", transition: "all 0.2s",
                background: action.gold ? "rgba(212,175,55,0.08)" : "rgba(11,18,32,0.82)",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = action.gold ? "rgba(212,175,55,0.16)" : "rgba(255,255,255,0.06)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = action.gold ? "rgba(212,175,55,0.08)" : "rgba(11,18,32,0.82)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: "10px", flexShrink: 0,
                background: action.gold ? "rgba(212,175,55,0.2)" : "rgba(255,255,255,0.07)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: action.gold ? "#d4af37" : "rgba(255,255,255,0.6)",
              }}>
                {action.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "14px", fontWeight: 700, color: action.gold ? "#d4af37" : "rgba(255,255,255,0.9)" }}>
                  {action.label}
                </div>
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", marginTop: "2px" }}>
                  {action.sub}
                </div>
              </div>
              <div style={{ color: "rgba(255,255,255,0.25)", flexShrink: 0 }}>
                <Icon.ArrowRight />
              </div>
            </button>
          ))}

          {/* Trip summary mini card */}
          {stats.upcoming > 0 && (
            <div style={{
              ...card,
              padding: "16px 18px",
              border: "1px solid rgba(23,162,184,0.25)",
              background: "rgba(23,162,184,0.06)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <span style={{ color: "#17a2b8" }}><Icon.PlaneTakeoff /></span>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#17a2b8" }}>
                  {stats.upcoming} Upcoming {stats.upcoming === 1 ? "Flight" : "Flights"}
                </span>
              </div>
              <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", margin: "0 0 10px" }}>
                You have confirmed flights coming up.
              </p>
              <button
                onClick={() => navigate("/bookings")}
                style={{
                  background: "rgba(23,162,184,0.2)", border: "1px solid rgba(23,162,184,0.3)",
                  color: "#17a2b8", padding: "7px 14px", borderRadius: "7px",
                  cursor: "pointer", fontSize: "12px", fontWeight: 600, width: "100%"
                }}
              >
                View Details
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
