import { useEffect, useState } from "react";
import API from "../../api/api";
import { useAdminUI } from "../../hooks/useAdminUI";

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
      <div style={{ padding: "28px", maxWidth: "1400px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <h2 style={{ color: "white", fontWeight: "800", fontSize: "26px", margin: 0, textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}>Booking Management</h2>
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
      <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "13px", marginBottom: "14px" }}>
        {filtered.length} booking{filtered.length !== 1 ? "s" : ""} shown
      </div>

      {error && <div style={{ background: "#f8d7da", color: "#721c24", padding: "12px", borderRadius: "6px", marginBottom: "16px" }}>{error}</div>}

      {loading ? <div style={{ color: "rgba(255,255,255,0.7)", textAlign: "center", padding: "60px" }}>Loading...</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {filtered.map(b => (
            <div key={b.id} style={{ backgroundColor: "white", borderRadius: "10px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", overflow: "hidden" }}>
              {/* Row header */}
              <div
                style={{ padding: "14px 20px", display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center", cursor: "pointer", borderLeft: b.booking_status === "CONFIRMED" ? "4px solid #28a745" : b.booking_status === "CANCELLED" ? "4px solid #dc3545" : "4px solid #ffc107" }}
                onClick={() => setExpanded(expanded === b.id ? null : b.id)}
              >
                <span style={{ fontFamily: "monospace", fontWeight: "800", fontSize: "14px", color: "#0b1220", minWidth: "120px" }}>{b.confirmation_code}</span>
                <span style={{ fontSize: "13px", color: "#495057", minWidth: "100px" }}>{b.username}</span>
                <span style={{ fontSize: "14px", fontWeight: "700", color: "#0b1220", minWidth: "100px" }}>{b.departure_code} → {b.arrival_code}</span>
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
                <div style={{ padding: "16px 20px", borderTop: "1px solid #f0f0f0", backgroundColor: "#f8f9fa" }}>
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
                      <div style={{ fontWeight: "700", color: "#0b1220", marginBottom: "8px", fontSize: "13px" }}>Passengers ({b.passengers.length})</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                        {b.passengers.map(p => (
                          <div key={p.id} style={{ backgroundColor: "white", border: "1px solid #dee2e6", borderRadius: "6px", padding: "10px 14px", fontSize: "13px", minWidth: "200px" }}>
                            <div style={{ fontWeight: "700", color: "#0b1220" }}>{p.full_name}</div>
                            <div style={{ color: "#6c757d" }}>{p.passenger_type} · {p.nationality}</div>
                            <div style={{ color: "#6c757d" }}>DOB: {p.date_of_birth}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ backgroundColor: "white", borderRadius: "10px", padding: "40px", textAlign: "center", color: "#6c757d" }}>No bookings found.</div>
          )}
        </div>
      )}
    </div>
      {ModalUI}
    </>
  );
}
