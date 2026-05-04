import { useEffect, useState } from "react";
import API from "../../api/api";
import { useAdminUI } from "../../hooks/useAdminUI";

// Force light theme for all admin pages
function AdminThemeEnforcer() {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
    return () => {
      // Restore user preference on unmount
      const saved = localStorage.getItem('theme') || 'LIGHT';
      if (saved === 'DARK') {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    };
  }, []);
  return null;
}

function StatusBadge({ status }) {
  const map = {
    CONFIRMED: ["#d4edda","#155724"], PENDING: ["#fff3cd","#856404"],
    PENDING_PAYMENT: ["#fff3cd","#856404"], CANCELLED: ["#f8d7da","#721c24"],
    FAILED: ["#f8d7da","#721c24"], SUCCESS: ["#d4edda","#155724"],
  };
  const [bg, text] = map[status] || ["#e9ecef","#495057"];
  return <span style={{ backgroundColor: bg, color: text, padding: "3px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: "600" }}>{status || "—"}</span>;
}

export default function AdminBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [busy, setBusy] = useState({});
  const [seatModal, setSeatModal] = useState(null); // { bookingId, bookingPassId, passengerName, currentSeat }
  const [availableSeats, setAvailableSeats] = useState([]);
  const [selectedSeat, setSelectedSeat] = useState("");
  const [seatBusy, setSeatBusy] = useState(false);
  const { confirm, notify, ModalUI } = useAdminUI();

  const load = async () => {
    setLoading(true);
    try {
      const res = await API.get("admin/bookings/");
      setBookings(res.data);
    } catch (e) { setError(e.normalizedMessage || "Failed to load"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const confirmPayment = async (id) => {
    const ok = await confirm("Confirm payment and mark booking as CONFIRMED?", { confirmText: "Confirm Payment", danger: false });
    if (!ok) return;
    setBusy(p => ({ ...p, [id]: true }));
    try {
      await API.post(`admin/bookings/${id}/confirm_payment/`);
      await load();
      notify("Payment confirmed successfully.", "success");
    } catch (e) { notify(e.normalizedMessage || "Failed"); }
    finally { setBusy(p => ({ ...p, [id]: false })); }
  };

  const updateStatus = async (id, newStatus) => {
    setBusy(p => ({ ...p, [`s_${id}`]: true }));
    try {
      await API.post(`admin/bookings/${id}/update_status/`, { booking_status: newStatus });
      await load();
      notify(`Status updated to ${newStatus}.`, "success");
    } catch (e) { notify(e.normalizedMessage || "Failed"); }
    finally { setBusy(p => ({ ...p, [`s_${id}`]: false })); }
  };

  const openSeatModal = async (booking, boardingPassId, passengerName, currentSeat) => {
    setSeatModal({ bookingId: booking.id, boardingPassId, passengerName, currentSeat });
    setSelectedSeat("");
    setAvailableSeats([]);
    try {
      const res = await API.get(`admin/bookings/${booking.id}/available_seats/`);
      setAvailableSeats(res.data);
    } catch (e) { notify(e.normalizedMessage || "Failed to load seats", "error"); setSeatModal(null); }
  };

  const changeSeat = async () => {
    if (!selectedSeat) return;
    setSeatBusy(true);
    try {
      await API.post(`admin/bookings/${seatModal.bookingId}/change_seat/`, {
        boarding_pass_id: seatModal.boardingPassId,
        seat_id: selectedSeat,
      });
      await load();
      notify(`Seat changed to ${availableSeats.find(s => s.id == selectedSeat)?.seat_number}.`, "success");
      setSeatModal(null);
    } catch (e) { notify(e.normalizedMessage || "Failed to change seat", "error"); }
    finally { setSeatBusy(false); }
  };

  const filtered = bookings.filter(b => {
    const matchSearch = !search ||
      b.confirmation_code?.toLowerCase().includes(search.toLowerCase()) ||
      b.username?.toLowerCase().includes(search.toLowerCase()) ||
      b.flight_number?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || b.booking_status === statusFilter;
    return matchSearch && matchStatus;
  });

  const inputStyle = { padding: "9px 12px", border: "1px solid #ced4da", borderRadius: "6px", fontSize: "14px", boxSizing: "border-box" };

  return (
    <>
      <AdminThemeEnforcer />
      <div style={{ padding: "28px", maxWidth: "1400px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <h2 style={{ color: "var(--text-primary)", fontWeight: "800", fontSize: "26px", margin: 0 }}>Booking Management</h2>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search bookings..." style={inputStyle} />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={inputStyle}>
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
      </div>
      <div style={{ color: "var(--text-secondary)", fontSize: "13px", marginBottom: "14px" }}>
        {filtered.length} booking{filtered.length !== 1 ? "s" : ""} shown
      </div>

      {error && <div style={{ background: "#f8d7da", color: "#721c24", padding: "12px", borderRadius: "6px", marginBottom: "16px" }}>{error}</div>}

      {loading ? <div style={{ color: "var(--text-secondary)", textAlign: "center", padding: "60px" }}>Loading...</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {filtered.map(b => (
            <div key={b.id} style={{ backgroundColor: "var(--surface)", borderRadius: "10px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", overflow: "hidden" }}>
              {/* Row header */}
              <div
                style={{ padding: "14px 20px", display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center", cursor: "pointer", borderLeft: b.booking_status === "CONFIRMED" ? "4px solid #28a745" : b.booking_status === "CANCELLED" ? "4px solid #dc3545" : "4px solid #ffc107" }}
                onClick={() => setExpanded(expanded === b.id ? null : b.id)}
              >
                <span style={{ fontFamily: "monospace", fontWeight: "800", fontSize: "14px", color: "var(--text-primary)", minWidth: "120px" }}>{b.confirmation_code}</span>
                <span style={{ fontSize: "13px", color: "#495057", minWidth: "100px" }}>{b.username}</span>
                <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-primary)", minWidth: "100px" }}>{b.departure_code} → {b.arrival_code}</span>
                <span style={{ fontSize: "12px", color: "#6c757d", minWidth: "90px" }}>{b.flight_number}</span>
                <span style={{ fontSize: "12px", color: "#6c757d" }}>{new Date(b.booking_date).toLocaleDateString()}</span>
                <StatusBadge status={b.booking_status} />
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "12px", color: "#6c757d" }}>Payment:</span>
                  <StatusBadge status={b.payment_status} />
                </div>
                <span style={{ fontWeight: "700", fontSize: "14px", marginLeft: "auto" }}>KES {Number(b.total_amount).toLocaleString()}</span>
                <span style={{ color: "#6c757d", fontSize: "18px" }}>{expanded === b.id ? "▲" : "▼"}</span>
              </div>

              {/* Expanded details */}
              {expanded === b.id && (
                <div style={{ padding: "16px 20px", borderTop: "1px solid #f0f0f0", backgroundColor: "var(--background)" }}>
                  <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "16px" }}>
                    {/* Actions */}
                    {b.booking_status !== "CONFIRMED" && b.payment_status === "PENDING" && (
                      <button
                        onClick={() => confirmPayment(b.id)}
                        disabled={busy[b.id]}
                        style={{ backgroundColor: "#28a745", color: "white", border: "none", padding: "8px 16px", borderRadius: "6px", fontWeight: "700", cursor: "pointer", fontSize: "13px" }}
                      >
                        {busy[b.id] ? "Processing..." : "✓ Confirm Payment"}
                      </button>
                    )}
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <span style={{ fontSize: "13px", color: "#495057", fontWeight: "600" }}>Change Status:</span>
                      {["PENDING", "CONFIRMED", "CANCELLED", "FAILED"].map(s => (
                        <button key={s} onClick={() => updateStatus(b.id, s)}
                          disabled={b.booking_status === s || busy[`s_${b.id}`]}
                          style={{
                            backgroundColor: b.booking_status === s ? "#0b1220" : "#e9ecef",
                            color: b.booking_status === s ? "white" : "#495057",
                            border: "none", padding: "5px 12px", borderRadius: "4px",
                            fontSize: "12px", cursor: b.booking_status === s ? "default" : "pointer", fontWeight: "600",
                          }}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Passengers */}
                  {b.passengers?.length > 0 && (
                    <div>
                      <div style={{ fontWeight: "700", color: "var(--text-primary)", marginBottom: "8px", fontSize: "13px" }}>Passengers ({b.passengers.length})</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                        {b.passengers.map(p => {
                          const assignment = b.seat_assignments?.find(a => a.passenger_id === p.id);
                          return (
                            <div key={p.id} style={{ backgroundColor: "var(--surface)", border: "1px solid #dee2e6", borderRadius: "6px", padding: "10px 14px", fontSize: "13px", minWidth: "200px" }}>
                              <div style={{ fontWeight: "700", color: "var(--text-primary)" }}>{p.full_name}</div>
                              <div style={{ color: "#6c757d" }}>{p.passenger_type} · {p.nationality}</div>
                              <div style={{ color: "#6c757d" }}>DOB: {p.date_of_birth}</div>
                              {assignment && (
                                <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
                                  <span style={{ fontSize: "12px", background: "#e9ecef", borderRadius: "4px", padding: "2px 8px", fontWeight: "600", color: "#495057" }}>
                                    Seat {assignment.seat_number} · {assignment.seat_class}
                                  </span>
                                  <button
                                    onClick={() => openSeatModal(b, assignment.boarding_pass_id, p.full_name, assignment.seat_number)}
                                    style={{ fontSize: "11px", background: "#0b1220", color: "white", border: "none", borderRadius: "4px", padding: "3px 8px", cursor: "pointer", fontWeight: "600" }}
                                  >
                                    Change
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ backgroundColor: "var(--surface)", borderRadius: "10px", padding: "40px", textAlign: "center", color: "#6c757d" }}>No bookings found.</div>
          )}
        </div>
      )}
    </div>
      {ModalUI}

      {/* Change Seat Modal */}
      {seatModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ background: "white", borderRadius: "10px", padding: "28px", minWidth: "340px", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 6px", fontSize: "17px", fontWeight: "800", color: "#0b1220" }}>Change Seat</h3>
            <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#6c757d" }}>
              {seatModal.passengerName} · current seat: <strong>{seatModal.currentSeat}</strong>
            </p>
            {availableSeats.length === 0 ? (
              <div style={{ color: "#6c757d", fontSize: "13px", marginBottom: "16px" }}>Loading available seats…</div>
            ) : (
              <select
                value={selectedSeat}
                onChange={e => setSelectedSeat(e.target.value)}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid #ced4da", borderRadius: "6px", fontSize: "14px", marginBottom: "16px", boxSizing: "border-box" }}
              >
                <option value="">Select a seat…</option>
                {["ECONOMY", "BUSINESS", "FIRST"].map(cls => {
                  const group = availableSeats.filter(s => s.flight_class === cls);
                  return group.length ? (
                    <optgroup key={cls} label={cls}>
                      {group.map(s => <option key={s.id} value={s.id}>{s.seat_number}</option>)}
                    </optgroup>
                  ) : null;
                })}
              </select>
            )}
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button onClick={() => setSeatModal(null)} style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #ced4da", background: "white", cursor: "pointer", fontSize: "13px" }}>Cancel</button>
              <button
                onClick={changeSeat}
                disabled={!selectedSeat || seatBusy}
                style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: !selectedSeat || seatBusy ? "#adb5bd" : "#0b1220", color: "white", cursor: !selectedSeat || seatBusy ? "default" : "pointer", fontWeight: "700", fontSize: "13px" }}
              >
                {seatBusy ? "Saving…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
