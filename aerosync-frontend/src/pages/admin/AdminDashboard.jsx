import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../api/api";

function StatusBadge({ status }) {
  const map = {
    CONFIRMED: { bg: "#d4edda", text: "#155724" },
    PENDING: { bg: "#fff3cd", text: "#856404" },
    PENDING_PAYMENT: { bg: "#fff3cd", text: "#856404" },
    CANCELLED: { bg: "#f8d7da", text: "#721c24" },
    FAILED: { bg: "#f8d7da", text: "#721c24" },
    SUCCESS: { bg: "#d4edda", text: "#155724" },
  };
  const c = map[status] || { bg: "#e9ecef", text: "#495057" };
  return (
    <span style={{
      backgroundColor: c.bg, color: c.text,
      padding: "3px 10px", borderRadius: "12px",
      fontSize: "12px", fontWeight: "600",
    }}>{status || "—"}</span>
  );
}

function StatCard({ label, value, color, icon }) {
  return (
    <div style={{
      backgroundColor: "white",
      borderRadius: "12px",
      padding: "24px 20px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
      borderLeft: `5px solid ${color}`,
    }}>
      <div style={{ fontSize: "32px", fontWeight: "800", color, marginBottom: "4px" }}>{value}</div>
      <div style={{ fontSize: "13px", color: "#6c757d", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState({ flights: 0, bookings: 0, confirmed: 0, users: 0, revenue: 0 });
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    async function load() {
      try {
        const [flRes, bkRes, usRes] = await Promise.all([
          API.get("admin/flights/"),
          API.get("admin/bookings/"),
          API.get("admin/users/"),
        ]);
        const bookings = Array.isArray(bkRes.data) ? bkRes.data : (bkRes.data?.results ?? []);
        const flightData = Array.isArray(flRes.data) ? flRes.data : (flRes.data?.results ?? []);
        const userData = Array.isArray(usRes.data) ? usRes.data : (usRes.data?.results ?? []);
        const confirmed = bookings.filter(b => b.booking_status === "CONFIRMED").length;
        const revenue = bookings
          .filter(b => b.payment_status === "SUCCESS")
          .reduce((s, b) => s + parseFloat(b.payment_amount || 0), 0);
        setStats({ flights: flightData.length, bookings: bookings.length, confirmed, users: userData.length, revenue });
        setRecent(bookings.slice(0, 10));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div style={{ padding: "28px", maxWidth: "1300px", margin: "0 auto" }}>
      <h2 style={{ color: "white", fontWeight: "800", fontSize: "28px", marginBottom: "28px", textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}>
        Dashboard Overview
      </h2>

      {loading ? (
        <div style={{ color: "rgba(255,255,255,0.7)", textAlign: "center", padding: "60px" }}>Loading...</div>
      ) : (
        <>
          {/* Stats row */}
          <div className="as-stats-grid">
            <StatCard label="Total Flights" value={stats.flights} color="#0b1220" />
            <StatCard label="Total Bookings" value={stats.bookings} color="#17a2b8" />
            <StatCard label="Confirmed" value={stats.confirmed} color="#28a745" />
            <StatCard label="Registered Users" value={stats.users} color="#6f42c1" />
            <StatCard label="Revenue (KES)" value={Number(stats.revenue).toLocaleString()} color="#d4af37" />
          </div>

          {/* Quick links */}
          <div className="as-btn-group" style={{ marginBottom: "28px" }}>
            {[
              { label: "Manage Flights", path: "/admin/flights", color: "#0b1220" },
              { label: "Manage Bookings", path: "/admin/bookings", color: "#17a2b8" },
              { label: "Manage Airports", path: "/admin/airports", color: "#6f42c1" },
              { label: "Manage Aircraft", path: "/admin/aircraft", color: "#d4af37" },
              { label: "View Users", path: "/admin/users", color: "#28a745" },
            ].map(q => (
              <button key={q.path} onClick={() => nav(q.path)} style={{
                backgroundColor: q.color, color: "white",
                border: "none", padding: "10px 20px", borderRadius: "6px",
                fontWeight: "600", fontSize: "14px", cursor: "pointer",
              }}>
                {q.label}
              </button>
            ))}
          </div>

          {/* Recent bookings */}
          <div style={{ backgroundColor: "white", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.12)", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", backgroundColor: "#0b1220", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, color: "#d4af37", fontSize: "16px", fontWeight: "700" }}>Recent Bookings</h3>
              <button onClick={() => nav("/admin/bookings")} style={{
                backgroundColor: "transparent", color: "#d4af37", border: "1px solid #d4af37",
                padding: "4px 12px", borderRadius: "4px", fontSize: "12px", cursor: "pointer",
              }}>View All</button>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="as-admin-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f8f9fa" }}>
                    {["Code", "User", "Route", "Date", "Booking Status", "Payment", "Amount (KES)"].map(h => (
                      <th key={h} style={{ padding: "11px 14px", textAlign: "left", color: "#495057", fontSize: "12px", fontWeight: "700", borderBottom: "2px solid #dee2e6", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recent.map(b => (
                    <tr key={b.id}
                      style={{ borderBottom: "1px solid #f0f0f0", cursor: "pointer" }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f8f9fa"}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = "white"}
                      onClick={() => nav("/admin/bookings")}
                    >
                      <td style={{ padding: "11px 14px", fontFamily: "monospace", fontWeight: "700", fontSize: "13px" }}>{b.confirmation_code}</td>
                      <td style={{ padding: "11px 14px", fontSize: "13px" }}>{b.username}</td>
                      <td style={{ padding: "11px 14px", fontSize: "13px", fontWeight: "600" }}>{b.departure_code} → {b.arrival_code}</td>
                      <td style={{ padding: "11px 14px", fontSize: "12px", color: "#6c757d" }}>{new Date(b.booking_date).toLocaleDateString()}</td>
                      <td style={{ padding: "11px 14px" }}><StatusBadge status={b.booking_status} /></td>
                      <td style={{ padding: "11px 14px" }}><StatusBadge status={b.payment_status} /></td>
                      <td style={{ padding: "11px 14px", fontSize: "13px", fontWeight: "600" }}>{Number(b.total_amount).toLocaleString()}</td>
                    </tr>
                  ))}
                  {recent.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: "24px", textAlign: "center", color: "#6c757d" }}>No bookings yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
