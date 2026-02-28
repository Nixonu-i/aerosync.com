import { useEffect, useState } from "react";
import API from "../../api/api";
import { useAdminUI } from "../../hooks/useAdminUI";

const inputStyle = { width: "100%", padding: "10px 12px", border: "1px solid #ced4da", borderRadius: "6px", fontSize: "14px", boxSizing: "border-box" };
const labelStyle = { display: "block", marginBottom: "5px", fontWeight: "600", color: "#495057", fontSize: "13px" };
const EMPTY = { model: "", total_seats: "", number_plate: "" };

const AIRCRAFT_CSV_TEMPLATE = `Model,TotalSeats,Registration
Boeing 737-800,162,5Y-KZA
Boeing 787-8 Dreamliner,254,5Y-KQA
Airbus A320neo,165,5Y-KYA`;

function parseAircraftCSV(text) {
  const lines = text.trim().split("\n").map(l => l.trim()).filter(Boolean);
  const results = [];
  for (const line of lines) {
    if (line.toLowerCase().startsWith("model,")) continue;
    // Allow commas inside model name by splitting only on last two commas
    const lastComma = line.lastIndexOf(",");
    const secondLastComma = line.lastIndexOf(",", lastComma - 1);
    if (secondLastComma === -1) { results.push({ _error: `Not enough columns: "${line}"` }); continue; }
    const model = line.slice(0, secondLastComma).trim();
    const total_seats = line.slice(secondLastComma + 1, lastComma).trim();
    const number_plate = line.slice(lastComma + 1).trim();
    if (!model) { results.push({ _error: `Missing model in: "${line}"`, model, total_seats, number_plate }); continue; }
    const seats = Number(total_seats);
    if (!seats || seats < 1 || seats > 1000) { results.push({ _error: `Invalid seats "${total_seats}" (must be 1-1000)`, model, total_seats, number_plate }); continue; }
    if (!number_plate) { results.push({ _error: `Missing registration in: "${line}"`, model, total_seats, number_plate }); continue; }
    results.push({ model, total_seats: seats, number_plate: number_plate.toUpperCase() });
  }
  return results;
}

export default function AdminAircraft() {
  const [aircraft, setAircraft] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);  // 'add' | 'edit' | 'bulk'
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [search, setSearch] = useState("");
  const { confirm, notify, ModalUI } = useAdminUI();

  const [genBusy, setGenBusy] = useState({});
  const [genResult, setGenResult] = useState({});

  // Bulk import state
  const [csvText, setCsvText] = useState("");
  const [csvPreview, setCsvPreview] = useState([]);
  const [bulkResult, setBulkResult] = useState(null);

  const load = async () => {
    setLoading(true);
    try { const res = await API.get("admin/aircraft/"); setAircraft(res.data); }
    catch (e) { setError(e.normalizedMessage || "Failed to load"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm(EMPTY); setFormErr(""); setModal("add"); };
  const openEdit = (a) => { setForm({ ...a, _id: a.id }); setFormErr(""); setModal("edit"); };
  const openBulk = () => { setCsvText(""); setCsvPreview([]); setBulkResult(null); setModal("bulk"); };

  const handleSave = async () => {
    setBusy(true); setFormErr("");
    try {
      const payload = { ...form, total_seats: Number(form.total_seats) };
      if (modal === "add") await API.post("admin/aircraft/", payload);
      else await API.patch(`admin/aircraft/${form._id}/`, payload);
      setModal(null); await load();
    } catch (e) { setFormErr(e.normalizedMessage || "Save failed"); }
    finally { setBusy(false); }
  };

  const handleDelete = async (id) => {
    const ok = await confirm("Delete this aircraft? All linked flights will be affected.", { confirmText: "Delete", danger: true });
    if (!ok) return;
    try { await API.delete(`admin/aircraft/${id}/`); await load(); notify("Aircraft deleted.", "success"); }
    catch (e) { notify(e.normalizedMessage || "Delete failed"); }
  };

  const handleGenerateSeats = async (a) => {
    const ok = await confirm(`Generate ${a.total_seats} seats for ${a.model} (${a.number_plate})?`, { confirmText: "Generate", danger: false });
    if (!ok) return;
    setGenBusy(p => ({ ...p, [a.id]: true }));
    setGenResult(p => ({ ...p, [a.id]: null }));
    try {
      const res = await API.post(`admin/aircraft/${a.id}/generate_seats/`);
      setGenResult(p => ({ ...p, [a.id]: { ok: true, msg: `✓ Created ${res.data.created} seats (${res.data.first} First · ${res.data.business} Business · ${res.data.economy} Economy)` } }));
    } catch (e) {
      setGenResult(p => ({ ...p, [a.id]: { ok: false, msg: e.normalizedMessage || "Failed" } }));
    } finally {
      setGenBusy(p => ({ ...p, [a.id]: false }));
    }
  };

  const handleCsvChange = (e) => {
    const val = e.target.value;
    setCsvText(val);
    setBulkResult(null);
    if (val.trim()) setCsvPreview(parseAircraftCSV(val));
    else setCsvPreview([]);
  };

  const handleBulkSubmit = async () => {
    const valid = csvPreview.filter(r => !r._error);
    if (!valid.length) return;
    setBusy(true); setBulkResult(null);
    try {
      const res = await API.post("admin/aircraft/bulk_create/", valid);
      setBulkResult(res.data);
      await load();
    } catch (e) {
      setBulkResult({ created: 0, errors: [{ row: 0, errors: { detail: e.normalizedMessage || "Failed" } }] });
    } finally { setBusy(false); }
  };

  const filtered = aircraft.filter(a =>
    !search ||
    a.model?.toLowerCase().includes(search.toLowerCase()) ||
    a.number_plate?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div style={{ padding: "28px", maxWidth: "1000px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <h2 style={{ color: "white", fontWeight: "800", fontSize: "26px", margin: 0, textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}>Aircraft Management</h2>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search aircraft..." style={{ ...inputStyle, width: "200px" }} />
          <button onClick={openBulk} style={{ backgroundColor: "#17a2b8", color: "white", border: "none", padding: "10px 18px", borderRadius: "6px", fontWeight: "700", cursor: "pointer", fontSize: "14px" }}>⬆ Bulk Import</button>
          <button onClick={openAdd} style={{ backgroundColor: "#d4af37", color: "#0b1220", border: "none", padding: "10px 20px", borderRadius: "6px", fontWeight: "700", cursor: "pointer", fontSize: "14px" }}>+ Add Aircraft</button>
        </div>
      </div>

      {error && <div style={{ background: "#f8d7da", color: "#721c24", padding: "12px", borderRadius: "6px", marginBottom: "16px" }}>{error}</div>}

      {loading ? <div style={{ color: "rgba(255,255,255,0.7)", textAlign: "center", padding: "60px" }}>Loading...</div> : (
        <div style={{ backgroundColor: "white", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.12)", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table className="as-admin-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#0b1220" }}>
                  {["#", "Model", "Registration (Plate)", "Total Seats", "Actions"].map(h => (
                    <th key={h} style={{ padding: "12px 16px", textAlign: "left", color: "#d4af37", fontSize: "13px", fontWeight: "700" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((a, i) => (
                  <tr key={a.id} style={{ borderBottom: "1px solid #f0f0f0" }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f8f9fa"}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = "white"}>
                    <td style={{ padding: "12px 16px", color: "#6c757d", fontSize: "13px" }}>{i + 1}</td>
                    <td style={{ padding: "12px 16px", fontSize: "15px", fontWeight: "700", color: "#0b1220" }}>{a.model}</td>
                    <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: "14px", color: "#d4af37", fontWeight: "700" }}>{a.number_plate}</td>
                    <td style={{ padding: "12px 16px", fontSize: "14px", fontWeight: "600" }}>{a.total_seats} seats</td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        <button onClick={() => openEdit(a)} style={{ backgroundColor: "#0b1220", color: "white", border: "none", padding: "5px 12px", borderRadius: "4px", fontSize: "12px", cursor: "pointer", fontWeight: "600" }}>Edit</button>
                        <button
                          onClick={() => handleGenerateSeats(a)}
                          disabled={genBusy[a.id]}
                          style={{ backgroundColor: genBusy[a.id] ? "#6c757d" : "#17a2b8", color: "white", border: "none", padding: "5px 12px", borderRadius: "4px", fontSize: "12px", cursor: genBusy[a.id] ? "not-allowed" : "pointer", fontWeight: "600", whiteSpace: "nowrap" }}
                        >
                          {genBusy[a.id] ? "Generating..." : "⚙ Gen Seats"}
                        </button>
                        <button onClick={() => handleDelete(a.id)} style={{ backgroundColor: "#dc3545", color: "white", border: "none", padding: "5px 12px", borderRadius: "4px", fontSize: "12px", cursor: "pointer", fontWeight: "600" }}>Delete</button>
                      </div>
                      {genResult[a.id] && (
                        <div style={{ marginTop: "6px", fontSize: "11px", color: genResult[a.id].ok ? "#155724" : "#721c24", backgroundColor: genResult[a.id].ok ? "#d4edda" : "#f8d7da", padding: "4px 8px", borderRadius: "4px" }}>
                          {genResult[a.id].msg}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={5} style={{ padding: "28px", textAlign: "center", color: "#6c757d" }}>No aircraft found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Single add/edit modal */}
      {(modal === "add" || modal === "edit") && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: "20px" }}>
          <div style={{ backgroundColor: "white", borderRadius: "12px", padding: "28px", width: "100%", maxWidth: "440px", boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, color: "#0b1220", fontSize: "20px", fontWeight: "700" }}>{modal === "add" ? "Add Aircraft" : "Edit Aircraft"}</h3>
              <button onClick={() => setModal(null)} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#6c757d" }}>✕</button>
            </div>
            {formErr && <div style={{ background: "#f8d7da", color: "#721c24", padding: "10px", borderRadius: "6px", marginBottom: "14px", fontSize: "13px" }}>{formErr}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {[
                { key: "model", label: "Aircraft Model", placeholder: "e.g. Boeing 737-800" },
                { key: "number_plate", label: "Registration Number", placeholder: "e.g. 5Y-KZA" },
                { key: "total_seats", label: "Total Seats", placeholder: "e.g. 150", type: "number" },
              ].map(({ key, label, placeholder, type }) => (
                <div key={key}>
                  <label style={labelStyle}>{label}</label>
                  <input type={type || "text"} value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder} style={inputStyle} />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "20px", justifyContent: "flex-end" }}>
              <button onClick={() => setModal(null)} style={{ backgroundColor: "#6c757d", color: "white", border: "none", padding: "10px 20px", borderRadius: "6px", fontWeight: "600", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleSave} disabled={busy} style={{ backgroundColor: busy ? "#6c757d" : "#0b1220", color: "white", border: "none", padding: "10px 24px", borderRadius: "6px", fontWeight: "700", cursor: busy ? "not-allowed" : "pointer" }}>
                {busy ? "Saving..." : modal === "add" ? "Create Aircraft" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk import modal */}
      {modal === "bulk" && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: "20px" }}>
          <div style={{ backgroundColor: "white", borderRadius: "12px", padding: "28px", width: "100%", maxWidth: "700px", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, color: "#0b1220", fontSize: "20px", fontWeight: "700" }}>Bulk Import Aircraft</h3>
              <button onClick={() => setModal(null)} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#6c757d" }}>✕</button>
            </div>

            <div style={{ backgroundColor: "#f8f9fa", borderRadius: "8px", padding: "12px 16px", marginBottom: "16px", fontSize: "13px", borderLeft: "4px solid #17a2b8" }}>
              <strong>CSV Format:</strong> <code>Model,TotalSeats,Registration</code> &nbsp;(header row optional, one aircraft per line)
              <br />
              <span style={{ color: "#6c757d" }}>Model can contain commas. TotalSeats must be 1–1000. Registration is auto-uppercased.</span>
              <button
                onClick={() => { setCsvText(AIRCRAFT_CSV_TEMPLATE); setCsvPreview(parseAircraftCSV(AIRCRAFT_CSV_TEMPLATE)); }}
                style={{ marginLeft: "12px", backgroundColor: "#0b1220", color: "white", border: "none", padding: "3px 10px", borderRadius: "4px", fontSize: "12px", cursor: "pointer", fontWeight: "600" }}
              >Load Example</button>
            </div>

            <textarea
              value={csvText}
              onChange={handleCsvChange}
              placeholder={"Model,TotalSeats,Registration\nBoeing 737-800,162,5Y-KZA\nAirbus A320neo,165,5Y-KYA"}
              rows={7}
              style={{ width: "100%", padding: "12px", border: "1px solid #ced4da", borderRadius: "6px", fontSize: "13px", fontFamily: "monospace", boxSizing: "border-box", resize: "vertical" }}
            />

            {csvPreview.length > 0 && (
              <div style={{ marginTop: "14px" }}>
                <div style={{ fontSize: "13px", fontWeight: "700", color: "#0b1220", marginBottom: "8px" }}>
                  Preview — {csvPreview.filter(r => !r._error).length} valid / {csvPreview.filter(r => r._error).length} errors
                </div>
                <div style={{ overflowX: "auto", borderRadius: "8px", border: "1px solid #dee2e6" }}>
                  <table className="as-admin-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                    <thead>
                      <tr style={{ backgroundColor: "#f8f9fa" }}>
                        {["Row", "Model", "Seats", "Registration", "Status"].map(h => (
                          <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: "700", color: "#495057", borderBottom: "2px solid #dee2e6" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.map((r, i) => (
                        <tr key={i} style={{ backgroundColor: r._error ? "#fff3f3" : "white", borderBottom: "1px solid #f0f0f0" }}>
                          <td style={{ padding: "7px 12px", color: "#6c757d" }}>{i + 1}</td>
                          <td style={{ padding: "7px 12px", fontWeight: "600" }}>{r.model || "—"}</td>
                          <td style={{ padding: "7px 12px" }}>{r.total_seats || "—"}</td>
                          <td style={{ padding: "7px 12px", fontFamily: "monospace", color: "#d4af37", fontWeight: "700" }}>{r.number_plate || "—"}</td>
                          <td style={{ padding: "7px 12px" }}>
                            {r._error
                              ? <span style={{ color: "#dc3545", fontSize: "11px", fontWeight: "600" }}>✗ {r._error}</span>
                              : <span style={{ color: "#28a745", fontWeight: "700", fontSize: "12px" }}>✓ Valid</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {bulkResult && (
              <div style={{ marginTop: "14px", padding: "12px 16px", borderRadius: "8px", backgroundColor: bulkResult.created > 0 ? "#d4edda" : "#f8d7da", border: `1px solid ${bulkResult.created > 0 ? "#c3e6cb" : "#f5c6cb"}` }}>
                <div style={{ fontWeight: "700", color: bulkResult.created > 0 ? "#155724" : "#721c24", marginBottom: "4px" }}>
                  {bulkResult.created > 0 ? `✓ ${bulkResult.created} aircraft created successfully` : "No aircraft were created"}
                </div>
                {bulkResult.errors?.length > 0 && (
                  <div style={{ fontSize: "12px", color: "#721c24", marginTop: "6px" }}>
                    {bulkResult.errors.map((e, i) => (
                      <div key={i}>Row {e.row}: {JSON.stringify(e.errors)}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: "10px", marginTop: "20px", justifyContent: "flex-end" }}>
              <button onClick={() => setModal(null)} style={{ backgroundColor: "#6c757d", color: "white", border: "none", padding: "10px 20px", borderRadius: "6px", fontWeight: "600", cursor: "pointer" }}>Close</button>
              <button
                onClick={handleBulkSubmit}
                disabled={busy || csvPreview.filter(r => !r._error).length === 0}
                style={{
                  backgroundColor: busy || csvPreview.filter(r => !r._error).length === 0 ? "#6c757d" : "#17a2b8",
                  color: "white", border: "none", padding: "10px 24px", borderRadius: "6px",
                  fontWeight: "700", cursor: busy || csvPreview.filter(r => !r._error).length === 0 ? "not-allowed" : "pointer"
                }}
              >
                {busy ? "Importing..." : `Import ${csvPreview.filter(r => !r._error).length} Aircraft`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
      {ModalUI}
    </>
  );
}
