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
      
      // Validate required fields before sending
      if (!form.aircraft || !form.departure_airport || !form.arrival_airport) {
        setFormErr("Please select Aircraft, Departure Airport, and Arrival Airport.");
        setBusy(false);
        return;
      }
      
      const payload = { 
        ...rest, 
        aircraft: form.aircraft,  // UUID, keep as string
        departure_airport: form.departure_airport,  // UUID, keep as string
        arrival_airport: form.arrival_airport,  // UUID, keep as string
        stops: Number(form.stops), 
        price: form.price 
      };
      
      // Remove empty values that shouldn't be sent
      if (!payload.flight_number) {
        delete payload.flight_number;
      }
      
      if (modal === "add") await API.post("admin/flights/", payload);
      else await API.patch(`admin/flights/${form._id}/`, payload);
      setModal(null);
      await reloadFlights();
      notify(modal === "add" ? "Flight created." : "Flight updated.", "success");
    } catch (e) { 
      // Extract detailed error messages from the response
      const errorData = e.response?.data;
      if (errorData && typeof errorData === 'object') {
        const messages = Object.entries(errorData)
          .map(([field, errors]) => `${field}: ${Array.isArray(errors) ? errors.join(', ') : errors}`)
          .join('\n');
        setFormErr(messages || e.normalizedMessage || "Save failed");
      } else {
        setFormErr(e.normalizedMessage || "Save failed"); 
      }
    }
    finally { setBusy(false); }
  };

  const handleDelete = async (id) => {
    const ok = await confirm("Delete this flight? This cannot be undone.", { confirmText: "Delete", danger: true });
    if (!ok) return;
    try { await API.delete(`admin/flights/${id}/`); await reloadFlights(); notify("Flight deleted.", "success"); }
    catch (e) { notify(e.normalizedMessage || "Delete failed"); }
  };

  const handleGenerate = async () => {
    setGenBusy(true); 
    setGenResult(null);
    
    try {
      // Start the generation task
      const res = await API.post("admin/flights/generate_flights/");
      const taskId = res.data.task_id;
      
      // Poll for status updates
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await API.get(`admin/flights/generation_status/${taskId}/`);
          const taskData = statusRes.data;
          
          if (taskData.status === 'completed') {
            clearInterval(pollInterval);
            setGenResult({ ok: true, data: taskData.result });
            setGenBusy(false);
            await reloadFlights();
          } else if (taskData.status === 'failed') {
            clearInterval(pollInterval);
            setGenResult({ ok: false, message: taskData.error || "Generation failed" });
            setGenBusy(false);
          } else if (taskData.status === 'running') {
            // Update progress
            const progress = taskData.progress || 0;
            const estimatedTotal = taskData.estimated_total || 1;
            const percentage = Math.min((progress / estimatedTotal) * 100, 100);
            
            setGenResult({ 
              ok: null, 
              message: `Generating flights... (${progress} created)`,
              progress: progress,
              percentage: percentage
            });
          }
        } catch (err) {
          clearInterval(pollInterval);
          setGenResult({ ok: false, message: "Failed to check task status" });
          setGenBusy(false);
        }
      }, 1000); // Poll every second
      
    } catch (e) {
      setGenResult({ ok: false, message: e.response?.data?.detail || e.normalizedMessage || "Generation failed" });
      setGenBusy(false);
    }
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
                <h3 style={{ margin: 0, color: "#0b1220", fontSize: "22px", fontWeight: "800", display: "flex", alignItems: "center", gap: "10px" }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                  Auto-Generate Flights
                </h3>
                <p style={{ margin: "6px 0 0", color: "#6c757d", fontSize: "13px" }}>Creates a full 30-day schedule from all available resources</p>
              </div>
              <button onClick={() => setGenModal(false)} style={{ background: "none", border: "none", fontSize: "22px", cursor: "pointer", color: "#6c757d", marginLeft: "12px" }}>✕</button>
            </div>

            {/* Stats cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "20px" }}>
              {[
                { 
                  icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>, 
                  label: "Airports", 
                  value: airports.length, 
                  color: "#17a2b8" 
                },
                { 
                  icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>,</svg>, 
                  label: "Aircraft", 
                  value: aircraft.length, 
                  color: "#6f42c1" 
                },
                { 
                  icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>, 
                  label: "Airlines", 
                  value: airlines.filter(a => a.is_active !== false).length, 
                  color: "#d4af37" 
                },
              ].map(({ icon, label, value, color }) => (
                <div key={label} style={{ background: "#f8f9fa", borderRadius: "10px", padding: "14px", textAlign: "center", border: `2px solid ${color}22` }}>
                  <div style={{ color, marginBottom: "8px" }}>{icon}</div>
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
                  [<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>, "30 days from tomorrow"],
                  [<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>, "All routes within 3 days"],
                  [<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, "06:00, 10:00, 12:00, 14:00"],
                  [<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, "16:00, 18:00, 20:00"],
                  [<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>, "Domestic: ~1.5 h / KES 8k"],
                  [<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>, "International: ~4 h / KES 35k"],
                ].map(([icon, text], i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "3px 0" }}>{icon} {text}</div>
                ))}
              </div>
            </div>

            {/* Result */}
            {genResult && (
              <div style={{
                background: genResult.ok === true ? "#d4edda" : genResult.ok === false ? "#f8d7da" : "#cce5ff",
                color: genResult.ok === true ? "#155724" : genResult.ok === false ? "#721c24" : "#004085",
                border: `1px solid ${genResult.ok === true ? "#c3e6cb" : genResult.ok === false ? "#f5c6cb" : "#b8daff"}`,
                borderRadius: "8px", padding: "14px", marginBottom: "16px", fontSize: "13px",
              }}>
                {genResult.ok === true ? (
                  <>
                    <div style={{ fontWeight: "800", fontSize: "15px", marginBottom: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      {genResult.data.created} flights generated!
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px", fontSize: "12px" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        {genResult.data.days} days covered
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
                        {genResult.data.route_pairs} route pairs
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>
                        {genResult.data.aircraft_used} aircraft used
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        {genResult.data.skipped} skipped (capacity)
                      </span>
                    </div>
                  </>
                ) : genResult.ok === false ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    {genResult.message}
                  </div>
                ) : (
                  <>
                    <div style={{ fontWeight: "700", marginBottom: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      {genResult.message}
                    </div>
                    <div style={{ 
                      background: "rgba(255,255,255,0.5)", 
                      borderRadius: "4px", 
                      height: "8px", 
                      overflow: "hidden" 
                    }}>
                      <div style={{ 
                        background: "#007bff", 
                        height: "100%", 
                        width: `${genResult.percentage || 0}%`,
                        transition: "width 0.3s ease"
                      }} />
                    </div>
                  </>
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

