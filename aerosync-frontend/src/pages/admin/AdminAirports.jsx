import { useEffect, useState } from "react";
import API from "../../api/api";
import { useAdminUI } from "../../hooks/useAdminUI";

const inputStyle = { width: "100%", padding: "10px 12px", border: "1px solid #ced4da", borderRadius: "6px", fontSize: "14px", boxSizing: "border-box" };
const labelStyle = { display: "block", marginBottom: "5px", fontWeight: "600", color: "#495057", fontSize: "13px" };
const EMPTY = { code: "", name: "", city: "", country: "" };

const AIRPORT_CSV_TEMPLATE = `CODE,Name,City,Country
NBO,Jomo Kenyatta International,Nairobi,Kenya
MBA,Moi International,Mombasa,Kenya
ENBB,Entebbe International,Entebbe,Uganda`;

function parseAirportCSV(text) {
  const lines = text.trim().split("\n").map(l => l.trim()).filter(Boolean);
  const results = [];
  for (const line of lines) {
    // skip header
    if (line.toLowerCase().startsWith("code,")) continue;
    const parts = line.split(",").map(p => p.trim());
    if (parts.length < 4) { results.push({ _error: `Not enough columns: "${line}"` }); continue; }
    const [code, name, city, country] = parts;
    if (!code || code.length !== 3) { results.push({ _error: `Invalid IATA code: "${code}" (must be 3 letters)`, code, name, city, country }); continue; }
    results.push({ code: code.toUpperCase(), name, city, country });
  }
  return results;
}

export default function AdminAirports() {
  const [airports, setAirports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);  // 'add' | 'edit' | 'bulk'
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [search, setSearch] = useState("");
  const { confirm, notify, ModalUI } = useAdminUI();

  // Bulk import state
  const [csvText, setCsvText] = useState("");
  const [csvPreview, setCsvPreview] = useState([]);
  const [bulkResult, setBulkResult] = useState(null);

  const load = async () => {
    setLoading(true);
    try { const res = await API.get("admin/airports/"); setAirports(res.data); }
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
      if (modal === "add") await API.post("admin/airports/", form);
      else await API.patch(`admin/airports/${form._id}/`, form);
      setModal(null); await load();
    } catch (e) { setFormErr(e.normalizedMessage || "Save failed"); }
    finally { setBusy(false); }
  };

  const handleDelete = async (id) => {
    const ok = await confirm("Delete this airport?", { confirmText: "Delete", danger: true });
    if (!ok) return;
    try { await API.delete(`admin/airports/${id}/`); await load(); notify("Airport deleted.", "success"); }
    catch (e) { notify(e.normalizedMessage || "Delete failed"); }
  };

  const handleCsvChange = (e) => {
    const val = e.target.value;
    setCsvText(val);
    setBulkResult(null);
    if (val.trim()) setCsvPreview(parseAirportCSV(val));
    else setCsvPreview([]);
  };

  const handleBulkSubmit = async () => {
    const valid = csvPreview.filter(r => !r._error);
    if (!valid.length) return;
    setBusy(true); setBulkResult(null);
    try {
      const res = await API.post("admin/airports/bulk_create/", valid);
      setBulkResult(res.data);
      await load();
    } catch (e) {
      setBulkResult({ created: 0, errors: [{ row: 0, errors: { detail: e.normalizedMessage || "Failed" } }] });
    } finally { setBusy(false); }
  };

  const filtered = airports.filter(a =>
    !search ||
    a.code?.toLowerCase().includes(search.toLowerCase()) ||
    a.name?.toLowerCase().includes(search.toLowerCase()) ||
    a.city?.toLowerCase().includes(search.toLowerCase()) ||
    a.country?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div style={{ padding: "28px", maxWidth: "1100px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <h2 style={{ color: "white", fontWeight: "800", fontSize: "26px", margin: 0, textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}>Airport Management</h2>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search airports..." style={{ ...inputStyle, width: "200px" }} />
          <button onClick={openBulk} style={{ backgroundColor: "#17a2b8", color: "white", border: "none", padding: "10px 18px", borderRadius: "6px", fontWeight: "700", cursor: "pointer", fontSize: "14px" }}>⬆ Bulk Import</button>
          <button onClick={openAdd} style={{ backgroundColor: "#d4af37", color: "#0b1220", border: "none", padding: "10px 20px", borderRadius: "6px", fontWeight: "700", cursor: "pointer", fontSize: "14px" }}>+ Add Airport</button>
        </div>
      </div>

      {error && <div style={{ background: "#f8d7da", color: "#721c24", padding: "12px", borderRadius: "6px", marginBottom: "16px" }}>{error}</div>}

      {loading ? <div style={{ color: "rgba(255,255,255,0.7)", textAlign: "center", padding: "60px" }}>Loading...</div> : (
        <div style={{ backgroundColor: "white", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.12)", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table className="as-admin-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#0b1220" }}>
                  {["Code", "Name", "City", "Country", "Actions"].map(h => (
                    <th key={h} style={{ padding: "12px 16px", textAlign: "left", color: "#d4af37", fontSize: "13px", fontWeight: "700" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => (
                  <tr key={a.id} style={{ borderBottom: "1px solid #f0f0f0" }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f8f9fa"}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = "white"}>
                    <td style={{ padding: "12px 16px", fontWeight: "800", fontFamily: "monospace", fontSize: "16px", color: "#d4af37" }}>{a.code}</td>
                    <td style={{ padding: "12px 16px", fontSize: "14px", fontWeight: "600" }}>{a.name}</td>
                    <td style={{ padding: "12px 16px", fontSize: "14px" }}>{a.city}</td>
                    <td style={{ padding: "12px 16px", fontSize: "14px" }}>{a.country}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button onClick={() => openEdit(a)} style={{ backgroundColor: "#0b1220", color: "white", border: "none", padding: "5px 12px", borderRadius: "4px", fontSize: "12px", cursor: "pointer", fontWeight: "600" }}>Edit</button>
                        <button onClick={() => handleDelete(a.id)} style={{ backgroundColor: "#dc3545", color: "white", border: "none", padding: "5px 12px", borderRadius: "4px", fontSize: "12px", cursor: "pointer", fontWeight: "600" }}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={5} style={{ padding: "28px", textAlign: "center", color: "#6c757d" }}>No airports found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Single add/edit modal */}
      {(modal === "add" || modal === "edit") && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: "20px" }}>
          <div style={{ backgroundColor: "white", borderRadius: "12px", padding: "28px", width: "100%", maxWidth: "480px", boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, color: "#0b1220", fontSize: "20px", fontWeight: "700" }}>{modal === "add" ? "Add Airport" : "Edit Airport"}</h3>
              <button onClick={() => setModal(null)} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#6c757d" }}>✕</button>
            </div>
            {formErr && <div style={{ background: "#f8d7da", color: "#721c24", padding: "10px", borderRadius: "6px", marginBottom: "14px", fontSize: "13px" }}>{formErr}</div>}
            <div className="as-form-grid">
              {[
                { key: "code", label: "IATA Code (3 letters)", placeholder: "e.g. NBO" },
                { key: "name", label: "Airport Name", placeholder: "e.g. Jomo Kenyatta International" },
                { key: "city", label: "City", placeholder: "e.g. Nairobi" },
                { key: "country", label: "Country", placeholder: "e.g. Kenya" },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label style={labelStyle}>{label}</label>
                  <input value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder} style={inputStyle} />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "20px", justifyContent: "flex-end" }}>
              <button onClick={() => setModal(null)} style={{ backgroundColor: "#6c757d", color: "white", border: "none", padding: "10px 20px", borderRadius: "6px", fontWeight: "600", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleSave} disabled={busy} style={{ backgroundColor: busy ? "#6c757d" : "#0b1220", color: "white", border: "none", padding: "10px 24px", borderRadius: "6px", fontWeight: "700", cursor: busy ? "not-allowed" : "pointer" }}>
                {busy ? "Saving..." : modal === "add" ? "Create Airport" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk import modal */}
      {modal === "bulk" && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: "20px" }}>
          <div style={{ backgroundColor: "white", borderRadius: "12px", padding: "28px", width: "100%", maxWidth: "720px", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, color: "#0b1220", fontSize: "20px", fontWeight: "700" }}>Bulk Import Airports</h3>
              <button onClick={() => setModal(null)} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#6c757d" }}>✕</button>
            </div>

            {/* Format guide */}
            <div style={{ backgroundColor: "#f8f9fa", borderRadius: "8px", padding: "12px 16px", marginBottom: "16px", fontSize: "13px", borderLeft: "4px solid #17a2b8" }}>
              <strong>CSV Format:</strong> <code>CODE,Name,City,Country</code> &nbsp;(header row optional, one airport per line)
              <br />
              <span style={{ color: "#6c757d" }}>CODE must be exactly 3 letters (IATA code). Commas inside values are not supported.</span>
              <button
                onClick={() => { setCsvText(AIRPORT_CSV_TEMPLATE); setCsvPreview(parseAirportCSV(AIRPORT_CSV_TEMPLATE)); }}
                style={{ marginLeft: "12px", backgroundColor: "#0b1220", color: "white", border: "none", padding: "3px 10px", borderRadius: "4px", fontSize: "12px", cursor: "pointer", fontWeight: "600" }}
              >Load Example</button>
            </div>

            <textarea
              value={csvText}
              onChange={handleCsvChange}
              placeholder={"CODE,Name,City,Country\nNBO,Jomo Kenyatta International,Nairobi,Kenya\nMBA,Moi International,Mombasa,Kenya"}
              rows={7}
              style={{ width: "100%", padding: "12px", border: "1px solid #ced4da", borderRadius: "6px", fontSize: "13px", fontFamily: "monospace", boxSizing: "border-box", resize: "vertical" }}
            />

            {/* Preview */}
            {csvPreview.length > 0 && (
              <div style={{ marginTop: "14px" }}>
                <div style={{ fontSize: "13px", fontWeight: "700", color: "#0b1220", marginBottom: "8px" }}>
                  Preview — {csvPreview.filter(r => !r._error).length} valid / {csvPreview.filter(r => r._error).length} errors
                </div>
                <div style={{ overflowX: "auto", borderRadius: "8px", border: "1px solid #dee2e6" }}>
                  <table className="as-admin-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                    <thead>
                      <tr style={{ backgroundColor: "#f8f9fa" }}>
                        {["Row", "Code", "Name", "City", "Country", "Status"].map(h => (
                          <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: "700", color: "#495057", borderBottom: "2px solid #dee2e6" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.map((r, i) => (
                        <tr key={i} style={{ backgroundColor: r._error ? "#fff3f3" : "white", borderBottom: "1px solid #f0f0f0" }}>
                          <td style={{ padding: "7px 12px", color: "#6c757d" }}>{i + 1}</td>
                          <td style={{ padding: "7px 12px", fontFamily: "monospace", fontWeight: "700", color: "#d4af37" }}>{r.code || "—"}</td>
                          <td style={{ padding: "7px 12px" }}>{r.name || "—"}</td>
                          <td style={{ padding: "7px 12px" }}>{r.city || "—"}</td>
                          <td style={{ padding: "7px 12px" }}>{r.country || "—"}</td>
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

            {/* Result after submit */}
            {bulkResult && (
              <div style={{ marginTop: "14px", padding: "12px 16px", borderRadius: "8px", backgroundColor: bulkResult.created > 0 ? "#d4edda" : "#f8d7da", border: `1px solid ${bulkResult.created > 0 ? "#c3e6cb" : "#f5c6cb"}` }}>
                <div style={{ fontWeight: "700", color: bulkResult.created > 0 ? "#155724" : "#721c24", marginBottom: "4px" }}>
                  {bulkResult.created > 0 ? `✓ ${bulkResult.created} airport${bulkResult.created !== 1 ? "s" : ""} created successfully` : "No airports were created"}
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
                {busy ? "Importing..." : `Import ${csvPreview.filter(r => !r._error).length} Airport${csvPreview.filter(r => !r._error).length !== 1 ? "s" : ""}`}
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
