import { useEffect, useState } from "react";
import API from "../../api/api";
import { useAdminUI } from "../../hooks/useAdminUI";
import SearchableSelect from "../../components/SearchableSelect";

const inputStyle = {
  width: "100%", padding: "10px 12px", border: "1px solid #ced4da",
  borderRadius: "6px", fontSize: "14px", boxSizing: "border-box",
};
const labelStyle = { display: "block", marginBottom: "5px", fontWeight: "600", color: "#495057", fontSize: "13px" };

function StatusBadge({ status }) {
  const map = { SCHEDULED: ["#d4edda","#155724"], DELAYED: ["#fff3cd","#856404"], CANCELLED: ["#f8d7da","#721c24"], COMPLETED: ["#e2e3e5","#383d41"] };
  const [bg, text] = map[status] || ["#e9ecef","#495057"];
  return <span style={{ backgroundColor: bg, color: text, padding: "3px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: "600" }}>{status}</span>;
}

const EMPTY = { airline: "", aircraft: "", departure_airport: "", arrival_airport: "", departure_time: "", arrival_time: "", price: "", trip_type: "ONE_WAY", stops: "0", status: "SCHEDULED" };

const TRIP_TYPE_OPTS = [
  { value: "ONE_WAY", label: "One Way" },
  { value: "ROUND_TRIP", label: "Round Trip" },
];
const STATUS_OPTS = [
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "DELAYED", label: "Delayed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "COMPLETED", label: "Completed" },
];

export default function AdminFlights() {
  const [flights, setFlights]     = useState([]);
  const [nextUrl, setNextUrl]     = useState(null);
  const [totalCount, setTotal]    = useState(0);
  const [moreBusy, setMoreBusy]   = useState(false);
  const [airports, setAirports]   = useState([]);
  const [aircraft, setAircraft]   = useState([]);
  const [airlines, setAirlines]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [modal, setModal]         = useState(null);
  const [form, setForm]           = useState(EMPTY);
  const [busy, setBusy]           = useState(false);
  const [formErr, setFormErr]     = useState("");
  const [filters, setFilters]      = useState({ flight_number: "", from: "", to: "", airline: "", status: "" });
  const [appliedFilters, setAppliedFilters] = useState(null); // null = no search yet (show all loaded)
  // generate-flights state
  const [genModal, setGenModal]   = useState(false);
  const [genBusy, setGenBusy]     = useState(false);
  const [genResult, setGenResult] = useState(null);
  const { confirm, notify, ModalUI } = useAdminUI();

  // Load first page of flights + supporting data
  const load = async () => {
    setLoading(true);
    try {
      const [fr, ar, acr, alr] = await Promise.all([
        API.get("admin/flights/"),
        API.get("admin/airports/"),
        API.get("admin/aircraft/"),
        API.get("admin/airlines/"),
      ]);
      const fd = fr.data;
      setFlights(fd.results ?? fd);
      setNextUrl(fd.next ?? null);
      setTotal(fd.count ?? (fd.results ?? fd).length);
      setAirports(ar.data);
      setAircraft(acr.data);
      setAirlines(alr.data);
    } catch (e) { setError(e.normalizedMessage || "Failed to load"); }
    finally { setLoading(false); }
  };

  // Reload flights from page 1 only (after mutations or search)
  const reloadFlights = async (params = {}) => {
    try {
      const fr = await API.get("admin/flights/", { params });
      const fd = fr.data;
      setFlights(fd.results ?? fd);
      setNextUrl(fd.next ?? null);
      setTotal(fd.count ?? (fd.results ?? fd).length);
    } catch (e) { notify(e.normalizedMessage || "Reload failed", "error"); }
  };

  // Search handler — fires when the Search button is clicked
  const handleSearch = async () => {
    const params = {};
    if (filters.flight_number) params.flight_number = filters.flight_number;
    if (filters.from)          params.from          = filters.from;
    if (filters.to)            params.to            = filters.to;
    if (filters.airline)       params.airline       = filters.airline;
    if (filters.status)        params.status        = filters.status;
    setAppliedFilters(params);
    setLoading(true);
    try {
      const fr = await API.get("admin/flights/", { params });
      const fd = fr.data;
      setFlights(fd.results ?? fd);
      setNextUrl(fd.next ?? null);
      setTotal(fd.count ?? (fd.results ?? fd).length);
    } catch (e) { notify(e.normalizedMessage || "Search failed", "error"); }
    finally { setLoading(false); }
  };

  const clearFilters = () => {
    setFilters({ flight_number: "", from: "", to: "", airline: "", status: "" });
    setAppliedFilters(null);
    reloadFlights(); // reload without params
  };

  // Append next page
  const loadMore = async () => {
    if (!nextUrl || moreBusy) return;
    setMoreBusy(true);
    try {
      const res = await API.get(nextUrl);
      const fd = res.data;
      setFlights(prev => [...prev, ...(fd.results ?? fd)]);
      setNextUrl(fd.next ?? null);
    } catch (e) { notify(e.normalizedMessage || "Failed to load more", "error"); }
    finally { setMoreBusy(false); }
  };

  useEffect(() => { load(); }, []);

  const airlineOpts      = airlines.map(a => ({ value: a.name, label: a.name, sublabel: a.iata_code || undefined }));
  const aircraftOpts     = aircraft.map(a => ({ value: String(a.id), label: `${a.model} (${a.number_plate})` }));
  const airportOpts      = airports.map(a => ({ value: String(a.id), label: `${a.code} — ${a.name}`, sublabel: a.city }));
  // Options used only in the filter bar (keyed by airport code, not id)
  const airportFilterOpts = airports.map(a => ({ value: a.code, label: `${a.code} — ${a.name}`, sublabel: a.city }));
  const airlineFilterOpts = airlines.map(a => ({ value: a.name, label: a.name, sublabel: a.iata_code || undefined }));
  const statusFilterOpts  = STATUS_OPTS;

  const hasFilters = Object.values(filters).some(v => v !== "");

  const openAdd = () => { setForm(EMPTY); setFormErr(""); setModal("add"); };
  const openEdit = (f) => {
    setForm({
      airline: f.airline,
      flight_number: f.flight_number,
      aircraft: String(f.aircraft), departure_airport: String(f.departure_airport),
      arrival_airport: String(f.arrival_airport),
      departure_time: f.departure_time?.slice(0, 16) || "",
      arrival_time: f.arrival_time?.slice(0, 16) || "",
      price: f.price, trip_type: f.trip_type, stops: f.stops, status: f.status,
      _id: f.id,
    });
    setFormErr(""); setModal("edit");
  };

  const handleSave = async () => {
    setBusy(true); setFormErr("");
    try {
      const { _id, ...rest } = form;
      const payload = { ...rest, aircraft: Number(form.aircraft), departure_airport: Number(form.departure_airport), arrival_airport: Number(form.arrival_airport), stops: Number(form.stops), price: form.price };
      if (modal === "add") await API.post("admin/flights/", payload);
      else await API.patch(`admin/flights/${form._id}/`, payload);
      setModal(null);
      await reloadFlights();
      notify(modal === "add" ? "Flight created." : "Flight updated.", "success");
    } catch (e) { setFormErr(e.normalizedMessage || "Save failed"); }
    finally { setBusy(false); }
  };

  const handleDelete = async (id) => {
    const ok = await confirm("Delete this flight? This cannot be undone.", { confirmText: "Delete", danger: true });
    if (!ok) return;
    try { await API.delete(`admin/flights/${id}/`); await reloadFlights(); notify("Flight deleted.", "success"); }
    catch (e) { notify(e.normalizedMessage || "Delete failed"); }
  };

  const handleGenerate = async () => {
    setGenBusy(true); setGenResult(null);
    try {
      const res = await API.post("admin/flights/generate_flights/");
      setGenResult({ ok: true, data: res.data });
      await reloadFlights();
    } catch (e) {
      setGenResult({ ok: false, message: e.response?.data?.detail || e.normalizedMessage || "Generation failed" });
    } finally { setGenBusy(false); }
  };

  const filtered = flights; // server already returns only matching results

  return (
    <>
      <div style={{ padding: "28px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", flexWrap: "wrap", gap: "12px" }}>
        <h2 style={{ color: "white", fontWeight: "800", fontSize: "26px", margin: 0, textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}>Flight Management</h2>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button onClick={() => { setGenResult(null); setGenModal(true); }}
            style={{ backgroundColor: "#17a2b8", color: "white", border: "none", padding: "10px 18px", borderRadius: "6px", fontWeight: "700", cursor: "pointer", fontSize: "14px" }}>
            ⚡ Auto-Generate Flights
          </button>
          <button onClick={openAdd} style={{ backgroundColor: "#d4af37", color: "#0b1220", border: "none", padding: "10px 20px", borderRadius: "6px", fontWeight: "700", cursor: "pointer", fontSize: "14px" }}>+ Add Flight</button>
        </div>
      </div>

      {/* ── Filter Bar ──────────────────────────────────────────────── */}
      <div style={{
        background: "rgba(11,18,32,0.82)",
        border: "1px solid rgba(212,175,55,0.2)",
        borderRadius: "12px",
        backdropFilter: "blur(12px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        padding: "18px 20px",
        marginBottom: "22px",
      }}>
        {/* Header row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <span style={{ color: "white", fontWeight: "700", fontSize: "13px", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Filter Flights
          </span>
          {hasFilters && (
            <button
              onClick={clearFilters}
              style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.15)", padding: "5px 14px", borderRadius: "6px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Filter controls */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "14px", alignItems: "end" }}>

          {/* Flight Number — typed */}
          <div>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "600", color: "rgba(212,175,55,0.85)", fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase" }}>Flight No.</label>
            <input
              value={filters.flight_number}
              onChange={e => setFilters(p => ({ ...p, flight_number: e.target.value }))}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder="e.g. AS1234"
              style={{
                width: "100%", padding: "9px 12px", border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: "6px", fontSize: "14px", boxSizing: "border-box",
                backgroundColor: "rgba(255,255,255,0.07)", color: "white",
              }}
            />
          </div>

          {/* From — dropdown */}
          <div>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "600", color: "rgba(212,175,55,0.85)", fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase" }}>From</label>
            <SearchableSelect
              value={filters.from}
              onChange={v => setFilters(p => ({ ...p, from: v }))}
              options={airportFilterOpts}
              placeholder="All Departures"
            />
          </div>

          {/* To — dropdown */}
          <div>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "600", color: "rgba(212,175,55,0.85)", fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase" }}>To</label>
            <SearchableSelect
              value={filters.to}
              onChange={v => setFilters(p => ({ ...p, to: v }))}
              options={airportFilterOpts}
              placeholder="All Arrivals"
            />
          </div>

          {/* Airline — dropdown */}
          <div>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "600", color: "rgba(212,175,55,0.85)", fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase" }}>Airline</label>
            <SearchableSelect
              value={filters.airline}
              onChange={v => setFilters(p => ({ ...p, airline: v }))}
              options={airlineFilterOpts}
              placeholder="All Airlines"
            />
          </div>

          {/* Status — dropdown */}
          <div>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "600", color: "rgba(212,175,55,0.85)", fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase" }}>Status</label>
            <SearchableSelect
              value={filters.status}
              onChange={v => setFilters(p => ({ ...p, status: v }))}
              options={statusFilterOpts}
              placeholder="All Statuses"
            />
          </div>

          {/* Search button — aligned to bottom of grid row */}
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
            <button
              onClick={handleSearch}
              style={{
                width: "100%",
                padding: "9px 18px",
                background: "#d4af37",
                color: "#0b1220",
                border: "none",
                borderRadius: "6px",
                fontWeight: "700",
                fontSize: "14px",
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(212,175,55,0.35)",
                letterSpacing: "0.03em",
              }}
            >
              Search
            </button>
          </div>

        </div>

        {/* Active filter summary */}
        {hasFilters && (
          <div style={{ marginTop: "12px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {filters.flight_number && (
              <span style={{ backgroundColor: "rgba(212,175,55,0.15)", border: "1px solid rgba(212,175,55,0.35)", color: "#d4af37", borderRadius: "20px", padding: "3px 12px", fontSize: "12px", fontWeight: "600" }}>
                Flight No: {filters.flight_number}
              </span>
            )}
            {filters.from && (
              <span style={{ backgroundColor: "rgba(212,175,55,0.15)", border: "1px solid rgba(212,175,55,0.35)", color: "#d4af37", borderRadius: "20px", padding: "3px 12px", fontSize: "12px", fontWeight: "600" }}>
                From: {filters.from}
              </span>
            )}
            {filters.to && (
              <span style={{ backgroundColor: "rgba(212,175,55,0.15)", border: "1px solid rgba(212,175,55,0.35)", color: "#d4af37", borderRadius: "20px", padding: "3px 12px", fontSize: "12px", fontWeight: "600" }}>
                To: {filters.to}
              </span>
            )}
            {filters.airline && (
              <span style={{ backgroundColor: "rgba(212,175,55,0.15)", border: "1px solid rgba(212,175,55,0.35)", color: "#d4af37", borderRadius: "20px", padding: "3px 12px", fontSize: "12px", fontWeight: "600" }}>
                Airline: {filters.airline}
              </span>
            )}
            {filters.status && (
              <span style={{ backgroundColor: "rgba(212,175,55,0.15)", border: "1px solid rgba(212,175,55,0.35)", color: "#d4af37", borderRadius: "20px", padding: "3px 12px", fontSize: "12px", fontWeight: "600" }}>
                Status: {filters.status}
              </span>
            )}
          </div>
        )}
      </div>

      {error && <div style={{ background: "#f8d7da", color: "#721c24", padding: "12px", borderRadius: "6px", marginBottom: "16px" }}>{error}</div>}
      {loading ? <div style={{ color: "rgba(255,255,255,0.7)", textAlign: "center", padding: "60px" }}>Loading...</div> : (
        <div style={{ backgroundColor: "white", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.12)", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table className="as-admin-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#0b1220" }}>
                  {["#", "Flight No.", "Airline", "Route", "Departure", "Arrival", "Price (KES)", "Type", "Status", "Actions"].map(h => (
                    <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: "#d4af37", fontSize: "12px", fontWeight: "700", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((f, i) => (
                  <tr key={f.id} style={{ borderBottom: "1px solid #f0f0f0" }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f8f9fa"}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = "white"}>
                    <td style={{ padding: "12px 14px", color: "#6c757d", fontSize: "13px" }}>{i + 1}</td>
                    <td style={{ padding: "12px 14px", fontWeight: "700", fontFamily: "monospace", fontSize: "13px" }}>{f.flight_number}</td>
                    <td style={{ padding: "12px 14px", fontSize: "13px" }}>{f.airline}</td>
                    <td style={{ padding: "12px 14px", fontWeight: "600", fontSize: "14px" }}>{f.departure_airport_code} → {f.arrival_airport_code}</td>
                    <td style={{ padding: "12px 14px", fontSize: "12px", color: "#495057" }}>{new Date(f.departure_time).toLocaleString()}</td>
                    <td style={{ padding: "12px 14px", fontSize: "12px", color: "#495057" }}>{new Date(f.arrival_time).toLocaleString()}</td>
                    <td style={{ padding: "12px 14px", fontWeight: "600", fontSize: "13px" }}>{Number(f.price).toLocaleString()}</td>
                    <td style={{ padding: "12px 14px", fontSize: "12px" }}>{f.trip_type}</td>
                    <td style={{ padding: "12px 14px" }}><StatusBadge status={f.status} /></td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button onClick={() => openEdit(f)} style={{ backgroundColor: "#0b1220", color: "white", border: "none", padding: "5px 12px", borderRadius: "4px", fontSize: "12px", cursor: "pointer", fontWeight: "600" }}>Edit</button>
                        <button onClick={() => handleDelete(f.id)} style={{ backgroundColor: "#dc3545", color: "white", border: "none", padding: "5px 12px", borderRadius: "4px", fontSize: "12px", cursor: "pointer", fontWeight: "600" }}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={10} style={{ padding: "28px", textAlign: "center", color: "#6c757d" }}>No flights found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: "20px" }}>
          <div style={{ backgroundColor: "white", borderRadius: "12px", padding: "28px", width: "100%", maxWidth: "680px", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, color: "#0b1220", fontSize: "20px", fontWeight: "700" }}>{modal === "add" ? "Add New Flight" : "Edit Flight"}</h3>
              <button onClick={() => setModal(null)} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#6c757d" }}>✕</button>
            </div>
            {formErr && <div style={{ background: "#f8d7da", color: "#721c24", padding: "10px", borderRadius: "6px", marginBottom: "14px", fontSize: "13px" }}>{formErr}</div>}
            <div className="as-form-grid">
              {/* Airline — searchable select from DB */}
              <div>
                <label style={labelStyle}>Airline</label>
                <SearchableSelect
                  value={form.airline}
                  onChange={v => setForm(p => ({ ...p, airline: v }))}
                  options={airlineOpts}
                  placeholder="Select airline…"
                />
              </div>
              {/* Flight Number — auto-generated on create, read-only on edit */}
              <div>
                <label style={labelStyle}>Flight Number</label>
                {modal === "add" ? (
                  <div style={{ padding: "10px 12px", border: "1px dashed #ced4da", borderRadius: "6px", fontSize: "14px", color: "#6c757d", backgroundColor: "#f8f9fa", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "16px" }}>⚙️</span>
                    <span>Auto-generated <strong style={{ color: "#d4af37" }}>AS####</strong> on save</span>
                  </div>
                ) : (
                  <div style={{ padding: "10px 12px", border: "1px solid #ced4da", borderRadius: "6px", fontSize: "14px", fontFamily: "monospace", fontWeight: "800", color: "#0b1220", backgroundColor: "#f8f9fa", letterSpacing: "1px" }}>
                    {form.flight_number || "—"}
                  </div>
                )}
              </div>
              {/* Aircraft */}
              <div>
                <label style={labelStyle}>Aircraft</label>
                <SearchableSelect
                  value={form.aircraft}
                  onChange={v => setForm(p => ({ ...p, aircraft: v }))}
                  options={aircraftOpts}
                  placeholder="Select aircraft…"
                />
              </div>
              {/* Trip Type */}
              <div>
                <label style={labelStyle}>Trip Type</label>
                <SearchableSelect
                  value={form.trip_type}
                  onChange={v => setForm(p => ({ ...p, trip_type: v }))}
                  options={TRIP_TYPE_OPTS}
                  placeholder="Select type…"
                />
              </div>
              {/* Departure Airport */}
              <div>
                <label style={labelStyle}>Departure Airport</label>
                <SearchableSelect
                  value={form.departure_airport}
                  onChange={v => setForm(p => ({ ...p, departure_airport: v }))}
                  options={airportOpts}
                  placeholder="Select departure…"
                />
              </div>
              {/* Arrival Airport */}
              <div>
                <label style={labelStyle}>Arrival Airport</label>
                <SearchableSelect
                  value={form.arrival_airport}
                  onChange={v => setForm(p => ({ ...p, arrival_airport: v }))}
                  options={airportOpts}
                  placeholder="Select arrival…"
                />
              </div>
              {/* Departure Time */}
              <div>
                <label style={labelStyle}>Departure Time</label>
                <input type="datetime-local" value={form.departure_time} onChange={e => setForm(p => ({ ...p, departure_time: e.target.value }))} style={inputStyle} />
              </div>
              {/* Arrival Time */}
              <div>
                <label style={labelStyle}>Arrival Time</label>
                <input type="datetime-local" value={form.arrival_time} onChange={e => setForm(p => ({ ...p, arrival_time: e.target.value }))} style={inputStyle} />
              </div>
              {/* Price */}
              <div>
                <label style={labelStyle}>Price (KES)</label>
                <input type="number" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} style={inputStyle} placeholder="e.g. 15000" />
              </div>
              {/* Stops */}
              <div>
                <label style={labelStyle}>Stops</label>
                <input type="number" min="0" value={form.stops} onChange={e => setForm(p => ({ ...p, stops: e.target.value }))} style={inputStyle} />
              </div>
              {/* Status (edit only) */}
              {modal === "edit" && (
                <div>
                  <label style={labelStyle}>Status</label>
                  <SearchableSelect
                    value={form.status}
                    onChange={v => setForm(p => ({ ...p, status: v }))}
                    options={STATUS_OPTS}
                    placeholder="Select status…"
                  />
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "20px", justifyContent: "flex-end" }}>
              <button onClick={() => setModal(null)} style={{ backgroundColor: "#6c757d", color: "white", border: "none", padding: "10px 20px", borderRadius: "6px", fontWeight: "600", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleSave} disabled={busy} style={{ backgroundColor: busy ? "#6c757d" : "#0b1220", color: "white", border: "none", padding: "10px 24px", borderRadius: "6px", fontWeight: "700", cursor: busy ? "not-allowed" : "pointer" }}>
                {busy ? "Saving..." : modal === "add" ? "Create Flight" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
      {ModalUI}

      {/* Load More footer */}
      {!loading && flights.length > 0 && (
        <div style={{ textAlign: "center", marginTop: "20px", paddingBottom: "8px", padding: "0 28px 20px" }}>
          <div style={{ color: "rgba(255,255,255,0.65)", fontSize: "13px", marginBottom: "12px" }}>
            Showing <strong style={{ color: "white" }}>{flights.length}</strong> of{" "}
            <strong style={{ color: "white" }}>{totalCount}</strong> flight{totalCount !== 1 ? "s" : ""}
          </div>
          {nextUrl && (
            <button
              onClick={loadMore}
              disabled={moreBusy}
              style={{
                backgroundColor: moreBusy ? "#6c757d" : "#d4af37",
                color: moreBusy ? "white" : "#0b1220",
                border: "none", padding: "11px 40px", borderRadius: "8px",
                fontSize: "14px", fontWeight: "700",
                cursor: moreBusy ? "not-allowed" : "pointer",
                boxShadow: moreBusy ? "none" : "0 4px 14px rgba(212,175,55,0.35)",
                transition: "all 0.2s",
              }}
              onMouseEnter={e => { if (!moreBusy) e.currentTarget.style.backgroundColor = "#c9a227"; }}
              onMouseLeave={e => { if (!moreBusy) e.currentTarget.style.backgroundColor = "#d4af37"; }}
            >
              {moreBusy ? "Loading…" : `Load More (${totalCount - flights.length} remaining)`}
            </button>
          )}
          {!nextUrl && (
            <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "12px", fontStyle: "italic" }}>
              All flights loaded
            </div>
          )}
        </div>
      )}

      {/* Auto-Generate Flights Modal */}
      {genModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: "20px" }}>
          <div style={{ backgroundColor: "white", borderRadius: "14px", padding: "32px", width: "100%", maxWidth: "520px", boxShadow: "0 24px 60px rgba(0,0,0,0.45)" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              <div>
                <h3 style={{ margin: 0, color: "#0b1220", fontSize: "22px", fontWeight: "800" }}>⚡ Auto-Generate Flights</h3>
                <p style={{ margin: "6px 0 0", color: "#6c757d", fontSize: "13px" }}>Creates a full 30-day schedule from all available resources</p>
              </div>
              <button onClick={() => setGenModal(false)} style={{ background: "none", border: "none", fontSize: "22px", cursor: "pointer", color: "#6c757d", marginLeft: "12px" }}>✕</button>
            </div>

            {/* Stats cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "20px" }}>
              {[
                { icon: "✈️", label: "Airports", value: airports.length, color: "#17a2b8" },
                { icon: "🛫", label: "Aircraft", value: aircraft.length, color: "#6f42c1" },
                { icon: "🏷️", label: "Airlines", value: airlines.filter(a => a.is_active !== false).length, color: "#d4af37" },
              ].map(({ icon, label, value, color }) => (
                <div key={label} style={{ background: "#f8f9fa", borderRadius: "10px", padding: "14px", textAlign: "center", border: `2px solid ${color}22` }}>
                  <div style={{ fontSize: "22px" }}>{icon}</div>
                  <div style={{ fontSize: "24px", fontWeight: "800", color }}>{value}</div>
                  <div style={{ fontSize: "12px", color: "#6c757d", fontWeight: "600" }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Schedule info */}
            <div style={{ background: "#f0f8ff", border: "1px solid #bee5f5", borderRadius: "8px", padding: "14px", marginBottom: "20px", fontSize: "13px", color: "#0c5460" }}>
              <div style={{ fontWeight: "700", marginBottom: "8px", fontSize: "14px" }}>Schedule Rules</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px" }}>
                {[
                  ["📅", "30 days from tomorrow"],
                  ["🔁", "All routes within 3 days"],
                  ["🕐", "06:00, 10:00, 12:00, 14:00"],
                  ["🕐", "16:00, 18:00, 20:00"],
                  ["🌍", "Domestic: ~1.5 h / KES 8k"],
                  ["✈️", "International: ~4 h / KES 35k"],
                ].map(([icon, text], i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "3px 0" }}>{icon} {text}</div>
                ))}
              </div>
            </div>

            {/* Result */}
            {genResult && (
              <div style={{
                background: genResult.ok ? "#d4edda" : "#f8d7da",
                color: genResult.ok ? "#155724" : "#721c24",
                border: `1px solid ${genResult.ok ? "#c3e6cb" : "#f5c6cb"}`,
                borderRadius: "8px", padding: "14px", marginBottom: "16px", fontSize: "13px",
              }}>
                {genResult.ok ? (
                  <>
                    <div style={{ fontWeight: "800", fontSize: "15px", marginBottom: "8px" }}>✓ {genResult.data.created} flights generated!</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px", fontSize: "12px" }}>
                      <span>📅 {genResult.data.days} days covered</span>
                      <span>🚩 {genResult.data.route_pairs} route pairs</span>
                      <span>✈️ {genResult.data.aircraft_used} aircraft used</span>
                      <span>⚠️ {genResult.data.skipped} skipped (capacity)</span>
                    </div>
                  </>
                ) : (
                  <>✗ {genResult.message}</>
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button onClick={() => setGenModal(false)}
                style={{ backgroundColor: "#6c757d", color: "white", border: "none", padding: "10px 22px", borderRadius: "6px", fontWeight: "600", cursor: "pointer" }}>
                {genResult?.ok ? "Close" : "Cancel"}
              </button>
              {!genResult?.ok && (
                <button onClick={handleGenerate} disabled={genBusy || airports.length < 2 || !aircraft.length || !airlines.length}
                  style={{
                    backgroundColor: (genBusy || airports.length < 2 || !aircraft.length || !airlines.length) ? "#6c757d" : "#17a2b8",
                    color: "white", border: "none", padding: "10px 28px", borderRadius: "6px", fontWeight: "700",
                    cursor: (genBusy || airports.length < 2 || !aircraft.length || !airlines.length) ? "not-allowed" : "pointer",
                    fontSize: "15px",
                  }}>
                  {genBusy ? "Generating… (may take a moment)" : "⚡ Generate Now"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

