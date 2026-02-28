import { useEffect, useState } from "react";
import API from "../../api/api";
import { useAdminUI } from "../../hooks/useAdminUI";

const inputStyle = { width: "100%", padding: "10px 12px", border: "1px solid #ced4da", borderRadius: "6px", fontSize: "14px", boxSizing: "border-box" };
const labelStyle = { display: "block", marginBottom: "5px", fontWeight: "600", color: "#495057", fontSize: "13px" };
const EMPTY = { name: "", iata_code: "", country: "", is_active: true };

const AIRLINE_CSV_TEMPLATE = `name,iata_code,country
Kenia Regional Air,KR,Kenya
Savanna Airways,SV,Uganda
Cape Skies,CS,South Africa`;

function parseAirlineCSV(raw) {
  const lines = raw.trim().split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return { valid: [], errors: ["No data rows found."] };
  const header = lines[0].toLowerCase().split(",").map(h => h.trim());
  const nameIdx = header.indexOf("name");
  const iataIdx = header.indexOf("iata_code");
  const countryIdx = header.indexOf("country");
  if (nameIdx === -1) return { valid: [], errors: ["CSV must have a 'name' column."] };
  const valid = [], errors = [];
  lines.slice(1).forEach((line, i) => {
    const cols = line.split(",").map(c => c.trim());
    const name = cols[nameIdx] || "";
    if (!name) { errors.push(`Row ${i + 2}: name is required.`); return; }
    valid.push({
      name,
      iata_code: (iataIdx !== -1 ? cols[iataIdx] || "" : "").toUpperCase().slice(0, 3),
      country: countryIdx !== -1 ? cols[countryIdx] || "" : "",
      is_active: true,
    });
  });
  return { valid, errors };
}

export default function AdminAirlines() {
  const [airlines, setAirlines]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [modal, setModal]         = useState(null); // 'add' | 'edit' | 'bulk'
  const [form, setForm]           = useState(EMPTY);
  const [busy, setBusy]           = useState(false);
  const [seedBusy, setSeedBusy]   = useState(false);
  const [seedResult, setSeedResult] = useState(null);
  const [formErr, setFormErr]     = useState("");
  const [search, setSearch]       = useState("");
  // bulk state
  const [bulkRaw, setBulkRaw]     = useState("");
  const [bulkParsed, setBulkParsed] = useState(null); // { valid, errors }
  const [bulkResult, setBulkResult] = useState(null);
  const [bulkBusy, setBulkBusy]   = useState(false);
  const { confirm, notify, ModalUI } = useAdminUI();

  const load = async () => {
    setLoading(true);
    try { const res = await API.get("admin/airlines/"); setAirlines(res.data); }
    catch (e) { setError(e.normalizedMessage || "Failed to load"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openAdd  = () => { setForm(EMPTY); setFormErr(""); setModal("add"); };
  const openEdit = (a) => { setForm({ ...a, _id: a.id }); setFormErr(""); setModal("edit"); };

  const handleSave = async () => {
    if (!form.name.trim()) { setFormErr("Airline name is required."); return; }
    setBusy(true); setFormErr("");
    try {
      const { _id, ...payload } = form;
      if (modal === "add") await API.post("admin/airlines/", payload);
      else await API.patch(`admin/airlines/${_id}/`, payload);
      setModal(null);
      await load();
      notify(modal === "add" ? "Airline created." : "Airline updated.", "success");
    } catch (e) {
      setFormErr(e.response?.data ? JSON.stringify(e.response.data) : e.normalizedMessage || "Save failed");
    } finally { setBusy(false); }
  };

  const handleDelete = async (id, name) => {
    const ok = await confirm(`Delete airline "${name}"?`, { confirmText: "Delete", danger: true });
    if (!ok) return;
    try { await API.delete(`admin/airlines/${id}/`); await load(); notify("Airline deleted.", "success"); }
    catch (e) { notify(e.normalizedMessage || "Delete failed"); }
  };

  const handleToggle = async (a) => {
    try {
      await API.patch(`admin/airlines/${a.id}/`, { is_active: !a.is_active });
      await load();
      notify(`Airline ${a.is_active ? "deactivated" : "activated"}.`, "success");
    } catch (e) { notify(e.normalizedMessage || "Failed"); }
  };

  const handleSeed = async () => {
    const ok = await confirm(
      "Seed the database with 40+ pre-built airlines (East Africa, Africa, Middle East, Europe, Asia, Americas)?",
      { confirmText: "Seed Airlines", danger: false }
    );
    if (!ok) return;
    setSeedBusy(true); setSeedResult(null);
    try {
      const res = await API.post("admin/airlines/seed/");
      setSeedResult(res.data);
      await load();
      notify(res.data.detail, "success");
    } catch (e) { notify(e.normalizedMessage || "Seed failed"); }
    finally { setSeedBusy(false); }
  };

  const openBulk = () => {
    setBulkRaw(""); setBulkParsed(null); setBulkResult(null);
    setModal("bulk");
  };

  const handleBulkParse = () => {
    const result = parseAirlineCSV(bulkRaw);
    setBulkParsed(result);
    setBulkResult(null);
  };

  const handleBulkSubmit = async () => {
    if (!bulkParsed?.valid?.length) return;
    setBulkBusy(true); setBulkResult(null);
    try {
      const res = await API.post("admin/airlines/bulk_create/", bulkParsed.valid);
      setBulkResult({ success: true, created: res.data.created, errors: res.data.errors });
      await load();
      notify(`${res.data.created} airline(s) added successfully.`, "success");
    } catch (e) {
      setBulkResult({ success: false, message: e.normalizedMessage || "Bulk create failed" });
    } finally { setBulkBusy(false); }
  };

  const filtered = airlines.filter(a =>
    !search ||
    a.name?.toLowerCase().includes(search.toLowerCase()) ||
    a.iata_code?.toLowerCase().includes(search.toLowerCase()) ||
    a.country?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div style={{ padding: "28px", maxWidth: "1000px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
          <h2 style={{ color: "white", fontWeight: "800", fontSize: "26px", margin: 0, textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}>Airlines Management</h2>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search airlines…"
              style={{ padding: "9px 12px", border: "1px solid #ced4da", borderRadius: "6px", fontSize: "14px", width: "200px" }} />
            <button onClick={handleSeed} disabled={seedBusy}
              style={{ backgroundColor: seedBusy ? "#6c757d" : "#17a2b8", color: "white", border: "none", padding: "10px 18px", borderRadius: "6px", fontWeight: "700", cursor: seedBusy ? "not-allowed" : "pointer", fontSize: "14px" }}>
              {seedBusy ? "Seeding…" : "⚡ Seed Airlines"}
            </button>
            <button onClick={openBulk}
              style={{ backgroundColor: "#6f42c1", color: "white", border: "none", padding: "10px 18px", borderRadius: "6px", fontWeight: "700", cursor: "pointer", fontSize: "14px" }}>
              ⬆ Bulk Import
            </button>
            <button onClick={openAdd}
              style={{ backgroundColor: "#d4af37", color: "#0b1220", border: "none", padding: "10px 20px", borderRadius: "6px", fontWeight: "700", cursor: "pointer", fontSize: "14px" }}>
              + Add Airline
            </button>
          </div>
        </div>

        {/* Seed result banner */}
        {seedResult && (
          <div style={{ background: "#d4edda", border: "1px solid #c3e6cb", borderRadius: "8px", padding: "12px 16px", marginBottom: "16px", color: "#155724", fontSize: "14px" }}>
            ✓ {seedResult.detail} — {seedResult.created} new, {seedResult.skipped} already existed.
            <button onClick={() => setSeedResult(null)} style={{ float: "right", background: "none", border: "none", cursor: "pointer", color: "#155724", fontSize: "16px" }}>✕</button>
          </div>
        )}

        {error && <div style={{ background: "#f8d7da", color: "#721c24", padding: "12px", borderRadius: "6px", marginBottom: "16px" }}>{error}</div>}

        <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "13px", marginBottom: "14px" }}>
          {filtered.length} airline{filtered.length !== 1 ? "s" : ""} · {airlines.filter(a => a.is_active).length} active
        </div>

        {loading ? (
          <div style={{ color: "rgba(255,255,255,0.7)", textAlign: "center", padding: "60px" }}>Loading…</div>
        ) : (
          <div style={{ backgroundColor: "white", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.12)", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "#0b1220" }}>
                    {["#", "IATA", "Airline Name", "Country", "Status", "Actions"].map(h => (
                      <th key={h} style={{ padding: "12px 16px", textAlign: "left", color: "#d4af37", fontSize: "13px", fontWeight: "700", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a, i) => (
                    <tr key={a.id} style={{ borderBottom: "1px solid #f0f0f0" }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f8f9fa"}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = "white"}>
                      <td style={{ padding: "12px 16px", color: "#6c757d", fontSize: "13px" }}>{i + 1}</td>
                      <td style={{ padding: "12px 16px", fontFamily: "monospace", fontWeight: "800", fontSize: "15px", color: "#d4af37" }}>
                        {a.iata_code || "—"}
                      </td>
                      <td style={{ padding: "12px 16px", fontWeight: "600", fontSize: "14px", color: "#0b1220" }}>{a.name}</td>
                      <td style={{ padding: "12px 16px", fontSize: "13px", color: "#6c757d" }}>{a.country || "—"}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{
                          backgroundColor: a.is_active ? "#d4edda" : "#f8d7da",
                          color: a.is_active ? "#155724" : "#721c24",
                          padding: "3px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: "600"
                        }}>
                          {a.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button onClick={() => openEdit(a)}
                            style={{ backgroundColor: "#0b1220", color: "white", border: "none", padding: "5px 12px", borderRadius: "4px", fontSize: "12px", cursor: "pointer", fontWeight: "600" }}>Edit</button>
                          <button onClick={() => handleToggle(a)}
                            style={{ backgroundColor: a.is_active ? "#ffc107" : "#28a745", color: a.is_active ? "#212529" : "white", border: "none", padding: "5px 12px", borderRadius: "4px", fontSize: "12px", cursor: "pointer", fontWeight: "600" }}>
                            {a.is_active ? "Deactivate" : "Activate"}
                          </button>
                          <button onClick={() => handleDelete(a.id, a.name)}
                            style={{ backgroundColor: "#dc3545", color: "white", border: "none", padding: "5px 12px", borderRadius: "4px", fontSize: "12px", cursor: "pointer", fontWeight: "600" }}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: "28px", textAlign: "center", color: "#6c757d" }}>
                      No airlines found. Click "⚡ Seed Airlines" to populate with common carriers.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Add / Edit Modal */}
        {(modal === "add" || modal === "edit") && (
          <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: "20px" }}>
            <div style={{ backgroundColor: "white", borderRadius: "12px", padding: "28px", width: "100%", maxWidth: "460px", boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h3 style={{ margin: 0, color: "#0b1220", fontSize: "20px", fontWeight: "700" }}>
                  {modal === "add" ? "Add Airline" : "Edit Airline"}
                </h3>
                <button onClick={() => setModal(null)} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#6c757d" }}>✕</button>
              </div>
              {formErr && <div style={{ background: "#f8d7da", color: "#721c24", padding: "10px", borderRadius: "6px", marginBottom: "14px", fontSize: "13px" }}>{formErr}</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label style={labelStyle}>Airline Name <span style={{ color: "#dc3545" }}>*</span></label>
                  <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Kenya Airways" style={inputStyle} />
                </div>
                <div className="as-form-grid">
                  <div>
                    <label style={labelStyle}>IATA Code</label>
                    <input value={form.iata_code} onChange={e => setForm(p => ({ ...p, iata_code: e.target.value.toUpperCase().slice(0, 3) }))}
                      placeholder="e.g. KQ" maxLength={3} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Country</label>
                    <input value={form.country} onChange={e => setForm(p => ({ ...p, country: e.target.value }))}
                      placeholder="e.g. Kenya" style={inputStyle} />
                  </div>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "14px", fontWeight: "600", color: "#495057" }}>
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
                    style={{ width: "16px", height: "16px", cursor: "pointer" }} />
                  Active (shows in flight form dropdown)
                </label>
              </div>
              <div style={{ display: "flex", gap: "10px", marginTop: "22px", justifyContent: "flex-end" }}>
                <button onClick={() => setModal(null)}
                  style={{ backgroundColor: "#6c757d", color: "white", border: "none", padding: "10px 20px", borderRadius: "6px", fontWeight: "600", cursor: "pointer" }}>Cancel</button>
                <button onClick={handleSave} disabled={busy}
                  style={{ backgroundColor: busy ? "#6c757d" : "#0b1220", color: "white", border: "none", padding: "10px 24px", borderRadius: "6px", fontWeight: "700", cursor: busy ? "not-allowed" : "pointer" }}>
                  {busy ? "Saving…" : modal === "add" ? "Create Airline" : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Bulk Import Modal */}
        {modal === "bulk" && (
          <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: "20px" }}>
            <div style={{ backgroundColor: "white", borderRadius: "12px", padding: "28px", width: "100%", maxWidth: "680px", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
                <h3 style={{ margin: 0, color: "#0b1220", fontSize: "20px", fontWeight: "700" }}>Bulk Import Airlines</h3>
                <button onClick={() => setModal(null)} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#6c757d" }}>✕</button>
              </div>

              {/* Format hint */}
              <div style={{ background: "#f0f4ff", border: "1px solid #c7d7f9", borderRadius: "8px", padding: "12px 14px", marginBottom: "14px", fontSize: "13px", color: "#3a4a8a" }}>
                <strong>CSV format:</strong> <code>name, iata_code, country</code><br />
                <span style={{ color: "#6c757d" }}>Only <strong>name</strong> is required. IATA code is trimmed to 3 characters.</span>
              </div>

              {/* Template button */}
              <button onClick={() => { setBulkRaw(AIRLINE_CSV_TEMPLATE); setBulkParsed(null); setBulkResult(null); }}
                style={{ backgroundColor: "#e9ecef", color: "#495057", border: "1px solid #ced4da", padding: "7px 14px", borderRadius: "5px", fontSize: "13px", cursor: "pointer", marginBottom: "10px", fontWeight: "600" }}>
                Load Example
              </button>

              {/* Textarea */}
              <textarea
                value={bulkRaw}
                onChange={e => { setBulkRaw(e.target.value); setBulkParsed(null); setBulkResult(null); }}
                placeholder={`name,iata_code,country\nKenia Regional Air,KR,Kenya`}
                rows={7}
                style={{ width: "100%", padding: "10px", border: "1px solid #ced4da", borderRadius: "6px", fontSize: "13px", fontFamily: "monospace", boxSizing: "border-box", resize: "vertical", marginBottom: "10px" }}
              />
              <button onClick={handleBulkParse} disabled={!bulkRaw.trim()}
                style={{ backgroundColor: "#0b1220", color: "white", border: "none", padding: "9px 18px", borderRadius: "6px", fontWeight: "700", cursor: bulkRaw.trim() ? "pointer" : "not-allowed", fontSize: "14px", marginBottom: "14px" }}>
                Preview
              </button>

              {/* Preview */}
              {bulkParsed && (
                <div style={{ marginTop: "4px" }}>
                  {bulkParsed.errors.length > 0 && (
                    <div style={{ background: "#f8d7da", border: "1px solid #f5c6cb", borderRadius: "6px", padding: "10px 14px", marginBottom: "10px" }}>
                      <strong style={{ color: "#721c24", fontSize: "13px" }}>Parse errors:</strong>
                      <ul style={{ margin: "6px 0 0 16px", padding: 0, color: "#721c24", fontSize: "13px" }}>
                        {bulkParsed.errors.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    </div>
                  )}
                  {bulkParsed.valid.length > 0 && (
                    <>
                      <div style={{ fontSize: "13px", color: "#155724", fontWeight: "600", marginBottom: "8px" }}>
                        ✓ {bulkParsed.valid.length} valid row{bulkParsed.valid.length !== 1 ? "s" : ""} ready to import
                      </div>
                      <div style={{ maxHeight: "180px", overflowY: "auto", border: "1px solid #dee2e6", borderRadius: "6px", marginBottom: "14px" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                          <thead>
                            <tr style={{ backgroundColor: "#f8f9fa" }}>
                              {["#", "Name", "IATA", "Country"].map(h => (
                                <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: "700", color: "#495057", borderBottom: "1px solid #dee2e6" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {bulkParsed.valid.map((r, i) => (
                              <tr key={i} style={{ borderBottom: "1px solid #f0f0f0" }}>
                                <td style={{ padding: "7px 12px", color: "#6c757d" }}>{i + 1}</td>
                                <td style={{ padding: "7px 12px", fontWeight: "600" }}>{r.name}</td>
                                <td style={{ padding: "7px 12px", fontFamily: "monospace", color: "#d4af37", fontWeight: "700" }}>{r.iata_code || "—"}</td>
                                <td style={{ padding: "7px 12px", color: "#6c757d" }}>{r.country || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Submit result */}
              {bulkResult && (
                <div style={{
                  background: bulkResult.success ? "#d4edda" : "#f8d7da",
                  color: bulkResult.success ? "#155724" : "#721c24",
                  border: `1px solid ${bulkResult.success ? "#c3e6cb" : "#f5c6cb"}`,
                  borderRadius: "6px", padding: "10px 14px", marginBottom: "12px", fontSize: "13px",
                }}>
                  {bulkResult.success
                    ? <>✓ {bulkResult.created} airline(s) created.{bulkResult.errors?.length > 0 ? ` ${bulkResult.errors.length} row(s) had errors.` : ""}</>
                    : <>✗ {bulkResult.message}</>}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "4px" }}>
                <button onClick={() => setModal(null)}
                  style={{ backgroundColor: "#6c757d", color: "white", border: "none", padding: "10px 20px", borderRadius: "6px", fontWeight: "600", cursor: "pointer" }}>Close</button>
                <button onClick={handleBulkSubmit}
                  disabled={!bulkParsed?.valid?.length || bulkBusy}
                  style={{ backgroundColor: (!bulkParsed?.valid?.length || bulkBusy) ? "#6c757d" : "#6f42c1", color: "white", border: "none", padding: "10px 24px", borderRadius: "6px", fontWeight: "700", cursor: (!bulkParsed?.valid?.length || bulkBusy) ? "not-allowed" : "pointer" }}>
                  {bulkBusy ? "Importing…" : `Import ${bulkParsed?.valid?.length || 0} Airline(s)`}
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
