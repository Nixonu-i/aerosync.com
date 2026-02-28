import { useEffect, useState, useCallback } from "react";
import API from "../../api/api";

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(dt) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString();
}

function fmtDateOnly(dt) {
  if (!dt) return "—";
  return new Date(dt).toLocaleDateString();
}

function downloadCSV(filename, headers, rows) {
  const escape = (v) => {
    const s = v == null ? "" : String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [
    headers.map(escape).join(","),
    ...rows.map((r) => r.map(escape).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ label, value, color }) {
  return (
    <div style={{
      backgroundColor: "white",
      borderRadius: "12px",
      padding: "20px 24px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
      borderLeft: `5px solid ${color}`,
    }}>
      <div style={{ fontSize: "28px", fontWeight: "800", color, marginBottom: "4px" }}>{value}</div>
      <div style={{ fontSize: "12px", color: "#6c757d", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    CONFIRMED: ["#d4edda","#155724"], PENDING: ["#fff3cd","#856404"],
    PENDING_PAYMENT: ["#fff3cd","#856404"], CANCELLED: ["#f8d7da","#721c24"],
    FAILED: ["#f8d7da","#721c24"], SUCCESS: ["#d4edda","#155724"],
    SCHEDULED: ["#cce5ff","#004085"], ACTIVE: ["#d4edda","#155724"],
    DELAYED: ["#fff3cd","#856404"], CANCELLED_F: ["#f8d7da","#721c24"],
  };
  const [bg, text] = map[status] || ["#e9ecef","#495057"];
  return (
    <span style={{ backgroundColor: bg, color: text, padding: "2px 9px", borderRadius: "12px", fontSize: "11px", fontWeight: "700", whiteSpace: "nowrap" }}>
      {status || "—"}
    </span>
  );
}

const TH = ({ children, right }) => (
  <th style={{ padding: "10px 12px", textAlign: right ? "right" : "left", color: "#495057", fontSize: "12px", fontWeight: "700", borderBottom: "2px solid #dee2e6", whiteSpace: "nowrap", backgroundColor: "#f8f9fa" }}>
    {children}
  </th>
);
const TD = ({ children, right, mono }) => (
  <td style={{ padding: "10px 12px", fontSize: "13px", color: "#212529", textAlign: right ? "right" : "left", fontFamily: mono ? "monospace" : "inherit", borderBottom: "1px solid #f0f0f0", verticalAlign: "middle" }}>
    {children}
  </td>
);

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function BookingsTable({ data }) {
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState("");

  const filtered = data.filter((b) => {
    const q = search.toLowerCase();
    const matchQ = !q || b.confirmation_code?.toLowerCase().includes(q) || b.username?.toLowerCase().includes(q) || b.flight_number?.toLowerCase().includes(q);
    return matchQ && (!statusF || b.booking_status === statusF);
  });

  const handleCSV = () => {
    downloadCSV("bookings_report.csv",
      ["Confirmation Code","Username","Flight","Route","Booking Date","Booking Status","Payment Status","Amount (KES)","Passengers"],
      filtered.map((b) => [
        b.confirmation_code, b.username, b.flight_number,
        `${b.departure_code} → ${b.arrival_code}`,
        fmtDateOnly(b.booking_date), b.booking_status,
        b.payment_status || "—", b.total_amount,
        b.passengers?.length || 0,
      ])
    );
  };

  return (
    <div>
      <div style={{ display: "flex", gap: "10px", marginBottom: "14px", flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by code, user, flight..."
          style={{ padding: "8px 12px", border: "1px solid #ced4da", borderRadius: "6px", fontSize: "13px", minWidth: "220px" }}
        />
        <select value={statusF} onChange={(e) => setStatusF(e.target.value)}
          style={{ padding: "8px 12px", border: "1px solid #ced4da", borderRadius: "6px", fontSize: "13px" }}>
          <option value="">All Statuses</option>
          {["PENDING","CONFIRMED","CANCELLED","FAILED"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "13px", marginRight: "auto" }}>
          {filtered.length} record{filtered.length !== 1 ? "s" : ""}
        </span>
        <button onClick={handleCSV} style={csvBtnStyle}>⬇ Export CSV</button>
      </div>
      <div style={{ overflowX: "auto", borderRadius: "10px", boxShadow: "0 2px 10px rgba(0,0,0,0.1)", backgroundColor: "white" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "860px" }}>
          <thead>
            <tr>
              <TH>#</TH>
              <TH>Confirmation</TH>
              <TH>User</TH>
              <TH>Flight</TH>
              <TH>Route</TH>
              <TH>Booking Date</TH>
              <TH>Booking Status</TH>
              <TH>Payment</TH>
              <TH right>Amount (KES)</TH>
              <TH right>Pax</TH>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b, i) => (
              <tr key={b.id}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f8f9fa"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "white"}
              >
                <TD>{i + 1}</TD>
                <TD mono>{b.confirmation_code}</TD>
                <TD>{b.username}</TD>
                <TD>{b.flight_number}</TD>
                <TD><strong>{b.departure_code} → {b.arrival_code}</strong></TD>
                <TD>{fmtDateOnly(b.booking_date)}</TD>
                <TD><StatusBadge status={b.booking_status} /></TD>
                <TD><StatusBadge status={b.payment_status} /></TD>
                <TD right><strong>{Number(b.total_amount).toLocaleString()}</strong></TD>
                <TD right>{b.passengers?.length || 0}</TD>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={10} style={{ padding: "32px", textAlign: "center", color: "#6c757d" }}>No bookings found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FlightsTable({ data }) {
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState("");

  const filtered = data.filter((f) => {
    const q = search.toLowerCase();
    const matchQ = !q || f.flight_number?.toLowerCase().includes(q) || f.airline?.toLowerCase().includes(q) || f.departure_airport_code?.toLowerCase().includes(q) || f.arrival_airport_code?.toLowerCase().includes(q);
    return matchQ && (!statusF || f.status === statusF);
  });

  const handleCSV = () => {
    downloadCSV("flights_report.csv",
      ["Flight Number","Airline","Route","Aircraft","Departure","Arrival","Price (KES)","Trip Type","Stops","Status"],
      filtered.map((f) => [
        f.flight_number, f.airline,
        `${f.departure_airport_code} → ${f.arrival_airport_code}`,
        `${f.aircraft_model} (${f.aircraft_plate})`,
        fmtDate(f.departure_time), fmtDate(f.arrival_time),
        f.price, f.trip_type, f.stops, f.status,
      ])
    );
  };

  return (
    <div>
      <div style={{ display: "flex", gap: "10px", marginBottom: "14px", flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by flight #, airline, code..."
          style={{ padding: "8px 12px", border: "1px solid #ced4da", borderRadius: "6px", fontSize: "13px", minWidth: "220px" }}
        />
        <select value={statusF} onChange={(e) => setStatusF(e.target.value)}
          style={{ padding: "8px 12px", border: "1px solid #ced4da", borderRadius: "6px", fontSize: "13px" }}>
          <option value="">All Statuses</option>
          {["SCHEDULED","ACTIVE","DELAYED","CANCELLED"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "13px", marginRight: "auto" }}>
          {filtered.length} record{filtered.length !== 1 ? "s" : ""}
        </span>
        <button onClick={handleCSV} style={csvBtnStyle}>⬇ Export CSV</button>
      </div>
      <div style={{ overflowX: "auto", borderRadius: "10px", boxShadow: "0 2px 10px rgba(0,0,0,0.1)", backgroundColor: "white" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "900px" }}>
          <thead>
            <tr>
              <TH>#</TH>
              <TH>Flight #</TH>
              <TH>Airline</TH>
              <TH>Route</TH>
              <TH>Aircraft</TH>
              <TH>Departure</TH>
              <TH>Arrival</TH>
              <TH right>Price (KES)</TH>
              <TH>Type</TH>
              <TH>Stops</TH>
              <TH>Status</TH>
            </tr>
          </thead>
          <tbody>
            {filtered.map((f, i) => (
              <tr key={f.id}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f8f9fa"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "white"}
              >
                <TD>{i + 1}</TD>
                <TD mono>{f.flight_number}</TD>
                <TD>{f.airline}</TD>
                <TD><strong>{f.departure_airport_code} → {f.arrival_airport_code}</strong></TD>
                <TD>{f.aircraft_model} <span style={{ color: "#6c757d", fontSize: "11px" }}>({f.aircraft_plate})</span></TD>
                <TD>{fmtDate(f.departure_time)}</TD>
                <TD>{fmtDate(f.arrival_time)}</TD>
                <TD right><strong>{Number(f.price).toLocaleString()}</strong></TD>
                <TD>{f.trip_type}</TD>
                <TD right>{f.stops}</TD>
                <TD><StatusBadge status={f.status} /></TD>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={11} style={{ padding: "32px", textAlign: "center", color: "#6c757d" }}>No flights found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UsersTable({ data }) {
  const [search, setSearch] = useState("");

  const filtered = data.filter((u) => {
    const q = search.toLowerCase();
    return !q || u.username?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.full_name?.toLowerCase().includes(q);
  });

  const handleCSV = () => {
    downloadCSV("users_report.csv",
      ["ID","Username","Email","Full Name","Role","Active","Joined"],
      filtered.map((u) => [u.id, u.username, u.email, u.full_name || "", u.role, u.is_active ? "Yes" : "No", fmtDateOnly(u.date_joined)])
    );
  };

  return (
    <div>
      <div style={{ display: "flex", gap: "10px", marginBottom: "14px", flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by username, email, name..."
          style={{ padding: "8px 12px", border: "1px solid #ced4da", borderRadius: "6px", fontSize: "13px", minWidth: "220px" }}
        />
        <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "13px", marginRight: "auto" }}>
          {filtered.length} record{filtered.length !== 1 ? "s" : ""}
        </span>
        <button onClick={handleCSV} style={csvBtnStyle}>⬇ Export CSV</button>
      </div>
      <div style={{ overflowX: "auto", borderRadius: "10px", boxShadow: "0 2px 10px rgba(0,0,0,0.1)", backgroundColor: "white" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "700px" }}>
          <thead>
            <tr>
              <TH>#</TH>
              <TH>Username</TH>
              <TH>Email</TH>
              <TH>Full Name</TH>
              <TH>Role</TH>
              <TH>Active</TH>
              <TH>Joined</TH>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u, i) => (
              <tr key={u.id}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f8f9fa"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "white"}
              >
                <TD>{i + 1}</TD>
                <TD mono>{u.username}</TD>
                <TD>{u.email}</TD>
                <TD>{u.full_name || "—"}</TD>
                <TD>
                  <span style={{
                    backgroundColor: u.role === "ADMIN" ? "#d4af37" : "#cce5ff",
                    color: u.role === "ADMIN" ? "#0b1220" : "#004085",
                    padding: "2px 9px", borderRadius: "12px", fontSize: "11px", fontWeight: "700",
                  }}>{u.role}</span>
                </TD>
                <TD>
                  <span style={{ color: u.is_active ? "#28a745" : "#dc3545", fontWeight: "700", fontSize: "12px" }}>
                    {u.is_active ? "✓ Active" : "✗ Inactive"}
                  </span>
                </TD>
                <TD>{fmtDateOnly(u.date_joined)}</TD>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ padding: "32px", textAlign: "center", color: "#6c757d" }}>No users found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const csvBtnStyle = {
  backgroundColor: "#28a745", color: "white", border: "none",
  padding: "8px 18px", borderRadius: "6px", fontWeight: "700",
  fontSize: "13px", cursor: "pointer", whiteSpace: "nowrap",
};

const TABS = ["Bookings", "Flights", "Users"];
const TAB_COLORS = { Bookings: "#17a2b8", Flights: "#0b1220", Users: "#6f42c1" };

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminReports() {
  const today = new Date().toISOString().split("T")[0];
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [fromDate, setFromDate] = useState(monthAgo);
  const [toDate, setToDate] = useState(today);
  const [summary, setSummary] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [flights, setFlights] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("Bookings");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, bkRes, flRes, usRes] = await Promise.all([
        API.get(`reports/summary/?from=${fromDate}&to=${toDate}`),
        API.get("admin/bookings/"),
        API.get("admin/flights/?page_size=500"),
        API.get("admin/users/"),
      ]);
      setSummary(sumRes.data);
      // admin/flights/ is paginated — unwrap results
      const flightList = Array.isArray(flRes.data) ? flRes.data : (flRes.data?.results ?? []);
      setBookings(Array.isArray(bkRes.data) ? bkRes.data : (bkRes.data?.results ?? []));
      setFlights(flightList);
      setUsers(Array.isArray(usRes.data) ? usRes.data : (usRes.data?.results ?? []));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => { load(); }, [load]);

  // Full CSV export (all tabs at once)
  const handleExportAll = () => {
    downloadCSV("aerosync_full_report.csv",
      ["Type","Confirmation/Flight/Username","User/Airline","Route","Date","Status","Payment/Role","Amount(KES)/Active"],
      [
        ...bookings.map((b) => ["BOOKING", b.confirmation_code, b.username, `${b.departure_code}→${b.arrival_code}`, fmtDateOnly(b.booking_date), b.booking_status, b.payment_status || "—", b.total_amount]),
        ...flights.map((f) => ["FLIGHT", f.flight_number, f.airline, `${f.departure_airport_code}→${f.arrival_airport_code}`, fmtDate(f.departure_time), f.status, f.trip_type, f.price]),
        ...users.map((u) => ["USER", u.username, u.email, "—", fmtDateOnly(u.date_joined), u.role, u.is_active ? "Active" : "Inactive", "—"]),
      ]
    );
  };

  const inputStyle = { padding: "8px 12px", border: "1px solid rgba(255,255,255,0.3)", borderRadius: "6px", fontSize: "14px", backgroundColor: "rgba(255,255,255,0.12)", color: "white" };

  return (
    <div style={{ padding: "28px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h2 style={{ color: "white", fontWeight: "800", fontSize: "28px", margin: 0, textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}>
            Reports &amp; Analytics
          </h2>
          <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "13px", margin: "4px 0 0" }}>
            Export data as CSV or view in table format
          </p>
        </div>
        <button onClick={handleExportAll} style={{ ...csvBtnStyle, backgroundColor: "#d4af37", color: "#0b1220", padding: "10px 22px", fontSize: "14px" }}>
          ⬇ Export Full Report (CSV)
        </button>
      </div>

      {/* Date Range */}
      <div style={{ backgroundColor: "rgba(255,255,255,0.08)", backdropFilter: "blur(8px)", borderRadius: "12px", padding: "16px 20px", marginBottom: "24px", display: "flex", gap: "14px", flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ color: "rgba(255,255,255,0.8)", fontSize: "13px", fontWeight: "600" }}>Summary Period:</span>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label style={{ color: "rgba(255,255,255,0.6)", fontSize: "13px" }}>From</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label style={{ color: "rgba(255,255,255,0.6)", fontSize: "13px" }}>To</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={inputStyle} />
        </div>
        <button onClick={load} style={{ backgroundColor: "#0b1220", color: "white", border: "1px solid rgba(255,255,255,0.2)", padding: "8px 18px", borderRadius: "6px", fontWeight: "700", fontSize: "13px", cursor: "pointer" }}>
          Apply
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="as-stats-grid">
          <StatCard label="Total Bookings (Period)" value={summary.total_bookings} color="#17a2b8" />
          <StatCard label="Confirmed" value={summary.confirmed} color="#28a745" />
          <StatCard label="Cancelled" value={summary.cancelled} color="#dc3545" />
          <StatCard label="Revenue KES (Period)" value={Number(summary.revenue).toLocaleString()} color="#d4af37" />
          <StatCard label="All Flights" value={flights.length} color="#0b1220" />
          <StatCard label="Registered Users" value={users.length} color="#6f42c1" />
        </div>
      )}

      {loading ? (
        <div style={{ color: "rgba(255,255,255,0.7)", textAlign: "center", padding: "60px", fontSize: "16px" }}>Loading data...</div>
      ) : (
        <>
          {/* Tab bar */}
          <div style={{ display: "flex", gap: "4px", marginBottom: "20px", borderBottom: "2px solid rgba(255,255,255,0.15)", paddingBottom: "0" }}>
            {TABS.map((t) => (
              <button key={t} onClick={() => setTab(t)} style={{
                backgroundColor: tab === t ? "white" : "transparent",
                color: tab === t ? TAB_COLORS[t] : "rgba(255,255,255,0.6)",
                border: "none",
                padding: "10px 22px",
                fontWeight: tab === t ? "700" : "500",
                fontSize: "14px",
                cursor: "pointer",
                borderRadius: "8px 8px 0 0",
                borderBottom: tab === t ? `3px solid ${TAB_COLORS[t]}` : "3px solid transparent",
                transition: "all 0.15s",
              }}>
                {t}
                <span style={{
                  marginLeft: "8px",
                  backgroundColor: tab === t ? TAB_COLORS[t] : "rgba(255,255,255,0.2)",
                  color: tab === t ? "white" : "rgba(255,255,255,0.7)",
                  padding: "1px 7px",
                  borderRadius: "10px",
                  fontSize: "11px",
                  fontWeight: "700",
                }}>
                  {t === "Bookings" ? bookings.length : t === "Flights" ? flights.length : users.length}
                </span>
              </button>
            ))}
          </div>

          {/* Table content */}
          {tab === "Bookings" && <BookingsTable data={bookings} />}
          {tab === "Flights" && <FlightsTable data={flights} />}
          {tab === "Users" && <UsersTable data={users} />}
        </>
      )}
    </div>
  );
}
