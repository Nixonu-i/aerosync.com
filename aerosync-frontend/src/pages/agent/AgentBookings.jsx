import { useEffect, useState } from "react";
import API from "../../api/api";
import PesapalPaymentModal from "../../components/PesapalPaymentModal";

/* ─── Theme ─────────────────────────────────────────── */
const teal  = "#20c997";
const green = "#28a745";
const amber = "#fd7e14";
const red   = "#dc3545";
const DARK  = "rgba(5, 19, 30, 0.92)";
const CARD  = {
  background: DARK,
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "12px",
  padding: "20px",
  marginBottom: "16px",
};

const STATUS_COLOR = {
  CONFIRMED: "#17a2b8",
  ONBOARD:   green,
  PENDING:   amber,
  CANCELLED: red,
  FAILED:    red,
};

const fmt = iso =>
  iso
    ? new Date(iso).toLocaleString("en-GB", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "—";

/* ─── Download helper ────────────────────────────────── */
async function downloadBoardingPass(bookingId, passengerId, passengerName, confirmationCode) {
  try {
    const url = `agent/bookings/${bookingId}/boarding_pass_png/?passenger_id=${passengerId}`;
    const res = await API.get(url, { responseType: "blob" });
    const blob = new Blob([res.data], { type: "image/png" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `boarding-pass-${confirmationCode}-${(passengerName || "passenger").replace(/\s+/g, "_")}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  } catch (e) {
    const msg = e?.response?.data?.detail || e?.normalizedMessage || "Download failed.";
    alert(msg);
  }
}

/* ─── Status badge ────────────────────────────────────── */
function StatusBadge({ status }) {
  const color = STATUS_COLOR[status] || "#6c757d";
  return (
    <span style={{
      background: `${color}22`,
      color,
      border: `1px solid ${color}66`,
      borderRadius: "20px",
      padding: "3px 12px",
      fontSize: "12px",
      fontWeight: 700,
      whiteSpace: "nowrap",
    }}>
      {status}
    </span>
  );
}

/* ─── Single booking card ─────────────────────────────── */
function BookingCard({ booking, onStatusUpdate }) {
  const [expanded, setExpanded]       = useState(false);
  const [downloading, setDownloading] = useState({});
  const [checking, setChecking]       = useState(false);
  const [checkErr, setCheckErr]       = useState("");
  const [showPesapalModal, setShowPesapalModal] = useState(false);
  const isPending   = booking.booking_status === "PENDING";
  const canDownload = booking.booking_status === "CONFIRMED" || booking.booking_status === "ONBOARD";

  const handleDownload = async (passenger) => {
    setDownloading(prev => ({ ...prev, [passenger.id]: true }));
    await downloadBoardingPass(booking.id, passenger.id, passenger.full_name, booking.confirmation_code);
    setDownloading(prev => ({ ...prev, [passenger.id]: false }));
  };

  const handleCheckStatus = async () => {
    setChecking(true);
    setCheckErr("");
    try {
      const res = await API.get(`agent/bookings/${booking.id}/`);
      onStatusUpdate(res.data);
    } catch (e) {
      setCheckErr(e?.response?.data?.detail || "Failed to refresh status.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <>
      <div style={CARD}>
        {/* Header row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px", marginBottom: "10px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <span style={{ color: "#fff", fontWeight: 800, fontSize: "15px", fontFamily: "monospace" }}>
                {booking.confirmation_code}
              </span>
              <StatusBadge status={booking.booking_status} />
            </div>
            <div style={{ color: "var(--text-secondary)", fontSize: "12px", marginTop: "4px" }}>
              {booking.flight_number ? `${booking.flight_number} ·` : ''} &nbsp;{booking.route || 'Route not specified'} &nbsp;·&nbsp; {fmt(booking.departure_time)}
            </div>
            <div style={{ color: "var(--text-secondary)", fontSize: "12px", marginTop: "2px" }}>
              Customer: <span style={{ color: "#fff", fontWeight: 700 }}>{booking.username}</span>
              &nbsp;·&nbsp; {booking.passengers?.length || 1} passenger(s)
              &nbsp;·&nbsp; KES {Number(booking.total_amount || 0).toLocaleString()}
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px", flexShrink: 0, flexWrap: "wrap", alignItems: "flex-start" }}>
            {/* Pay Button — only for PENDING or CANCELLED bookings */}
            {(isPending || booking.booking_status === 'CANCELLED') && (
              <button
                onClick={() => setShowPesapalModal(true)}
                style={{
                  background: "rgba(32,201,151,0.18)",
                  color: teal,
                  border: `1px solid rgba(32,201,151,0.5)`,
                  borderRadius: "7px",
                  padding: "6px 14px",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> Pay Now
              </button>
            )}
            {/* Check status — only for PENDING or CANCELLED bookings */}
            {(isPending || booking.booking_status === 'CANCELLED') && (
              <button
                onClick={handleCheckStatus}
                disabled={checking}
                style={{
                  background: checking ? "rgba(253,126,20,0.1)" : "rgba(253,126,20,0.18)",
                  color: amber,
                  border: `1px solid rgba(253,126,20,${checking ? "0.2" : "0.5"})`,
                  borderRadius: "7px",
                  padding: "6px 14px",
                  cursor: checking ? "default" : "pointer",
                  fontSize: "12px",
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                }}
              >
                {checking ? "Checking…" : "Check Status"}
              </button>
            )}
            <button
              onClick={() => setExpanded(e => !e)}
              style={{
                background: "var(--background)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border)",
                borderRadius: "7px",
                padding: "6px 14px",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              {expanded ? "Hide Passengers ▲" : "Passengers & Downloads ▼"}
            </button>
          </div>
        </div>

        {/* Check status error */}
        {checkErr && (
          <div style={{ background: "rgba(220,53,69,0.1)", border: "1px solid rgba(220,53,69,0.4)", borderRadius: "7px", padding: "8px 14px", fontSize: "12px", color: "#ff8891", marginBottom: "10px" }}>
            {checkErr}
          </div>
        )}

        {/* Passenger download list */}
        {expanded && (
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "14px", marginTop: "6px" }}>
            {!canDownload && (
              <div style={{
                background: "rgba(253,126,20,0.1)",
                border: "1px solid rgba(253,126,20,0.3)",
                borderRadius: "8px",
                padding: "10px 14px",
                fontSize: "13px",
                color: "var(--text-secondary)",
                marginBottom: "12px",
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg> Boarding pass available only after payment is confirmed (CONFIRMED or ONBOARD status).
              </div>
            )}

            {(booking.passengers || []).length === 0 ? (
              <div style={{ color: "var(--text-secondary)", fontSize: "13px" }}>No passenger data available.</div>
            ) : (
              (booking.passengers || []).map(p => (
                <div key={p.id} style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 14px",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  marginBottom: "6px",
                  flexWrap: "wrap",
                  gap: "8px",
                }}>
                  <div>
                    <div style={{ color: "var(--text-primary)", fontWeight: 700, fontSize: "14px" }}>{p.full_name}</div>
                    <div style={{ color: "var(--text-secondary)", fontSize: "12px", textTransform: "capitalize" }}>
                      {(p.passenger_type || "ADULT").toLowerCase()}
                    </div>
                  </div>

                  {canDownload ? (
                    <button
                      onClick={() => handleDownload(p)}
                      disabled={downloading[p.id]}
                      style={{
                        background: downloading[p.id] ? "rgba(32,201,151,0.1)" : "rgba(32,201,151,0.18)",
                        color: teal,
                        border: `1px solid rgba(32,201,151,${downloading[p.id] ? "0.2" : "0.4"})`,
                        borderRadius: "7px",
                        padding: "7px 16px",
                        cursor: downloading[p.id] ? "default" : "pointer",
                        fontSize: "13px",
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {downloading[p.id] ? "Downloading…" : "⬇ Download Pass"}
                    </button>
                  ) : (
                    <span style={{ color: "var(--text-secondary)", fontSize: "12px", opacity: 0.5 }}>Unavailable</span>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
      
      {/* Pesapal Payment Modal */}
      {showPesapalModal && (
        <PesapalPaymentModal
          booking={booking}
          onClose={() => setShowPesapalModal(false)}
          onPaymentComplete={(payment) => {
            setShowPesapalModal(false);
            // Refresh bookings list to show updated status
            const refreshBookings = async () => {
              try {
                const res = await API.get("agent/bookings/");
                // This will be handled by parent component
              } catch (err) {
                console.error('Failed to refresh bookings:', err);
              }
            };
            refreshBookings();
          }}
        />
      )}
    </>
  );
}

/* ─── Main Page ───────────────────────────────────────── */
export default function AgentBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [search, setSearch]     = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    (async () => {
      try {
        const res = await API.get("agent/bookings/");
        setBookings(res.data || []);
      } catch (e) {
        setError(e?.normalizedMessage || "Failed to load bookings.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* Update a single booking in the list (used by Check Status) */
  const handleStatusUpdate = (updated) => {
    setBookings(prev => prev.map(b => b.id === updated.id ? updated : b));
  };

  const q = search.trim().toLowerCase();
  const filtered = bookings.filter(b => {
    const matchStatus = statusFilter === "ALL" || b.booking_status === statusFilter;
    const matchSearch = !q || (
      b.confirmation_code?.toLowerCase().includes(q) ||
      b.flight_number?.toLowerCase().includes(q) ||
      b.username?.toLowerCase().includes(q) ||
      b.route?.toLowerCase().includes(q) ||
      (b.passengers || []).some(p => p.full_name?.toLowerCase().includes(q))
    );
    return matchStatus && matchSearch;
  });

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h2 style={{ color: "#0f172a", fontWeight: 800, margin: "0 0 6px", fontSize: "28px" }}>Bookings History</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px", margin: 0 }}>
          Recent and upcoming bookings — download boarding passes for confirmed passengers.
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Search ref, flight, name, route…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: "200px",
            padding: "9px 14px", borderRadius: "8px",
            border: "1px solid var(--border)",
            background: "var(--surface)", color: "var(--text-primary)",
            fontSize: "14px", outline: "none",
          }}
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{
            padding: "9px 14px", borderRadius: "8px",
            border: "1px solid var(--border)",
            background: "var(--surface)", color: "var(--text-primary)",
            fontSize: "14px", outline: "none", cursor: "pointer",
          }}
        >
          <option value="ALL">All Statuses</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="ONBOARD">On Board</option>
          <option value="PENDING">Pending</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-secondary)" }}>
          Loading bookings…
        </div>
      ) : error ? (
        <div style={{ background: "rgba(220,53,69,0.12)", border: `1px solid ${red}`, borderRadius: "10px", padding: "16px 20px", color: "#ff8891" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> {error}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ ...CARD, textAlign: "center", padding: "50px 20px" }}>
          <div style={{ fontSize: "40px", marginBottom: "10px" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 12h.01M18 12h.01"/></svg></div>
          <div style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
            {bookings.length === 0 ? "No bookings found." : "No bookings match your filters."}
          </div>
        </div>
      ) : (
        <>
          <div style={{ color: "var(--text-secondary)", fontSize: "12px", marginBottom: "14px" }}>
            Showing {filtered.length} of {bookings.length} booking(s)
          </div>
          {filtered.map(b => <BookingCard key={b.id} booking={b} onStatusUpdate={handleStatusUpdate} />)}
        </>
      )}
    </div>
  );
}
