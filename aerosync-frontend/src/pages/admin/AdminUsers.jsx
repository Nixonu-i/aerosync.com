import { useEffect, useState } from "react";
import API from "../../api/api";
import { useAdminUI } from "../../hooks/useAdminUI";

const inputStyle = {
  width: "100%", padding: "10px 12px", border: "1px solid #ced4da",
  borderRadius: "6px", fontSize: "14px", boxSizing: "border-box",
};
const labelStyle = { display: "block", marginBottom: "5px", fontWeight: "600", color: "#495057", fontSize: "13px" };

const ROLE_COLORS = {
  ADMIN: ["#f8d7da", "#721c24"],
  AGENT: ["#fff3cd", "#856404"],
  CUST:  ["#d4edda", "#155724"],
};

export default function AdminUsers() {
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [search, setSearch]       = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [modal, setModal]         = useState(null); // 'edit' | 'password'
  const [form, setForm]           = useState({});
  const [pwForm, setPwForm]       = useState({ password: "", confirm: "" });
  const [busy, setBusy]           = useState(false);
  const [formErr, setFormErr]     = useState("");
  const { confirm, notify, ModalUI } = useAdminUI();

  const load = async () => {
    setLoading(true);
    try {
      const res = await API.get("admin/users/");
      setUsers(Array.isArray(res.data) ? res.data : (res.data?.results ?? []));
    }
    catch (e) { setError(e.normalizedMessage || "Failed to load"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openEdit = (u) => {
    setForm({
      _id: u.id,
      first_name: u.first_name || "",
      last_name:  u.last_name  || "",
      email:      u.email      || "",
      role:       u.role       || "CUST",
      is_active:  u.is_active,
      is_staff:   u.is_staff,
    });
    setFormErr("");
    setModal("edit");
  };

  const openPassword = (u) => {
    setForm({ _id: u.id, username: u.username });
    setPwForm({ password: "", confirm: "" });
    setFormErr("");
    setModal("password");
  };

  const handleSave = async () => {
    setBusy(true); setFormErr("");
    try {
      const { _id, ...payload } = form;
      await API.patch(`admin/users/${_id}/`, payload);
      setModal(null);
      await load();
      notify("User updated successfully.", "success");
    } catch (e) {
      setFormErr(e.response?.data ? JSON.stringify(e.response.data) : e.normalizedMessage || "Save failed");
    } finally { setBusy(false); }
  };

  const handleSetPassword = async () => {
    if (pwForm.password.length < 6) { setFormErr("Password must be at least 6 characters."); return; }
    if (pwForm.password !== pwForm.confirm) { setFormErr("Passwords do not match."); return; }
    setBusy(true); setFormErr("");
    try {
      await API.post(`admin/users/${form._id}/set_password/`, { password: pwForm.password });
      setModal(null);
      await load();
      notify(`Password for ${form.username} updated.`, "success");
    } catch (e) {
      setFormErr(e.response?.data?.detail || e.normalizedMessage || "Failed");
    } finally { setBusy(false); }
  };

  const handleToggleActive = async (u) => {
    const action = u.is_active ? "deactivate" : "activate";
    const ok = await confirm(
      `${u.is_active ? "Deactivate" : "Activate"} user "${u.username}"?`,
      { confirmText: u.is_active ? "Deactivate" : "Activate", danger: u.is_active }
    );
    if (!ok) return;
    try {
      await API.patch(`admin/users/${u.id}/`, { is_active: !u.is_active });
      await load();
      notify(`User ${action}d successfully.`, "success");
    } catch (e) { notify(e.normalizedMessage || "Failed"); }
  };

  const filtered = users.filter(u => {
    const matchSearch = !search ||
      u.username?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.full_name?.toLowerCase().includes(search.toLowerCase());
    const matchRole = !roleFilter || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const searchInputStyle = { padding: "9px 12px", border: "1px solid #ced4da", borderRadius: "6px", fontSize: "14px", boxSizing: "border-box" };

  return (
    <>
      <div style={{ padding: "28px", maxWidth: "1200px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
          <h2 style={{ color: "white", fontWeight: "800", fontSize: "26px", margin: 0, textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}>
            User Management
          </h2>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..." style={searchInputStyle} />
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={searchInputStyle}>
              <option value="">All Roles</option>
              <option value="ADMIN">Admin</option>
              <option value="AGENT">Agent</option>
              <option value="CUST">Customer</option>
            </select>
          </div>
        </div>
        <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "13px", marginBottom: "14px" }}>
          {filtered.length} user{filtered.length !== 1 ? "s" : ""} found
        </div>

        {error && <div style={{ background: "#f8d7da", color: "#721c24", padding: "12px", borderRadius: "6px", marginBottom: "16px" }}>{error}</div>}

        {loading ? (
          <div style={{ color: "rgba(255,255,255,0.7)", textAlign: "center", padding: "60px" }}>Loading...</div>
        ) : (
          <div style={{ backgroundColor: "white", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.12)", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table className="as-admin-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "#0b1220" }}>
                    {["#", "Username", "Full Name", "Email", "Role", "Staff ID", "Staff", "Status", "Joined", "Actions"].map(h => (
                      <th key={h} style={{ padding: "12px 16px", textAlign: "left", color: "#d4af37", fontSize: "13px", fontWeight: "700", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u, i) => {
                    const [bg, text] = ROLE_COLORS[u.role] || ["#e9ecef", "#495057"];
                    return (
                      <tr key={u.id} style={{ borderBottom: "1px solid #f0f0f0" }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f8f9fa"}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = "white"}>
                        <td style={{ padding: "12px 16px", color: "#6c757d", fontSize: "13px" }}>{i + 1}</td>
                        <td style={{ padding: "12px 16px", fontWeight: "700", color: "#0b1220", fontSize: "14px", display: "flex", alignItems: "center", gap: "10px" }}>
                          <div style={{ width: "32px", height: "32px", borderRadius: "50%", overflow: "hidden", backgroundColor: "rgba(0,0,0,0.05)" }}>
                            {(u.profile_photo || u.profile_photo_url) ? (
                              <img 
                                src={u.profile_photo_url || u.profile_photo}
                                alt="Profile"
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                onError={(e) => e.target.style.visibility = 'hidden'}
                              />
                            ) : (
                              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#6c757d", fontSize: "12px" }}>
                                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                                </svg>
                              </div>
                            )}
                          </div>
                          {u.username}
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: "14px" }}>{u.full_name || "—"}
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: "13px", color: "#6c757d" }}>{u.email || "—"}</td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ backgroundColor: bg, color: text, padding: "3px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: "700" }}>{u.role}</span>
                        </td>
                        <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: "12px", color: u.staff_id ? "#856404" : "#adb5bd", whiteSpace: "nowrap" }}>
                          {u.staff_id || "—"}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ fontSize: "12px", color: u.is_staff ? "#155724" : "#6c757d", fontWeight: u.is_staff ? "700" : "400" }}>
                            {u.is_staff ? "✓ Staff" : "—"}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ backgroundColor: u.is_active ? "#d4edda" : "#f8d7da", color: u.is_active ? "#155724" : "#721c24", padding: "3px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: "600" }}>
                            {u.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: "12px", color: "#6c757d", whiteSpace: "nowrap" }}>
                          {new Date(u.date_joined).toLocaleDateString()}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                            <button onClick={() => openEdit(u)}
                              style={{ backgroundColor: "#0b1220", color: "white", border: "none", padding: "5px 12px", borderRadius: "4px", fontSize: "12px", cursor: "pointer", fontWeight: "600" }}>
                              Edit
                            </button>
                            <button onClick={() => openPassword(u)}
                              style={{ backgroundColor: "#6f42c1", color: "white", border: "none", padding: "5px 12px", borderRadius: "4px", fontSize: "12px", cursor: "pointer", fontWeight: "600" }}>
                              Password
                            </button>
                            <button onClick={() => handleToggleActive(u)}
                              style={{ backgroundColor: u.is_active ? "#dc3545" : "#28a745", color: "white", border: "none", padding: "5px 12px", borderRadius: "4px", fontSize: "12px", cursor: "pointer", fontWeight: "600" }}>
                              {u.is_active ? "Deactivate" : "Activate"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={9} style={{ padding: "28px", textAlign: "center", color: "#6c757d" }}>No users found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Edit User Modal ── */}
        {modal === "edit" && (
          <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: "20px" }}>
            <div style={{ backgroundColor: "white", borderRadius: "12px", padding: "28px", width: "100%", maxWidth: "500px", boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h3 style={{ margin: 0, color: "#0b1220", fontSize: "20px", fontWeight: "700" }}>Edit User</h3>
                <button onClick={() => setModal(null)} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#6c757d" }}>✕</button>
              </div>

              {formErr && <div style={{ background: "#f8d7da", color: "#721c24", padding: "10px", borderRadius: "6px", marginBottom: "14px", fontSize: "13px" }}>{formErr}</div>}

              <div className="as-form-grid">
                <div>
                  <label style={labelStyle}>First Name</label>
                  <input value={form.first_name} onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Last Name</label>
                  <input value={form.last_name} onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))} style={inputStyle} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>Email</label>
                  <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Role</label>
                  <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} style={inputStyle}>
                    <option value="CUST">Customer</option>
                    <option value="AGENT">Agent</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", justifyContent: "center" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "14px", fontWeight: "600", color: "#495057" }}>
                    <input type="checkbox" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
                      style={{ width: "16px", height: "16px", cursor: "pointer" }} />
                    Active account
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "14px", fontWeight: "600", color: "#495057" }}>
                    <input type="checkbox" checked={form.is_staff} onChange={e => setForm(p => ({ ...p, is_staff: e.target.checked }))}
                      style={{ width: "16px", height: "16px", cursor: "pointer" }} />
                    Staff (Django admin access)
                  </label>
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "22px", justifyContent: "flex-end" }}>
                <button onClick={() => setModal(null)} style={{ backgroundColor: "#6c757d", color: "white", border: "none", padding: "10px 20px", borderRadius: "6px", fontWeight: "600", cursor: "pointer" }}>Cancel</button>
                <button onClick={handleSave} disabled={busy}
                  style={{ backgroundColor: busy ? "#6c757d" : "#0b1220", color: "white", border: "none", padding: "10px 24px", borderRadius: "6px", fontWeight: "700", cursor: busy ? "not-allowed" : "pointer" }}>
                  {busy ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Set Password Modal ── */}
        {modal === "password" && (
          <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: "20px" }}>
            <div style={{ backgroundColor: "white", borderRadius: "12px", padding: "28px", width: "100%", maxWidth: "420px", boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <h3 style={{ margin: 0, color: "#0b1220", fontSize: "20px", fontWeight: "700" }}>Set Password</h3>
                <button onClick={() => setModal(null)} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#6c757d" }}>✕</button>
              </div>
              <p style={{ color: "#6c757d", fontSize: "13px", marginBottom: "20px" }}>Changing password for <strong>{form.username}</strong></p>

              {formErr && <div style={{ background: "#f8d7da", color: "#721c24", padding: "10px", borderRadius: "6px", marginBottom: "14px", fontSize: "13px" }}>{formErr}</div>}

              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label style={labelStyle}>New Password</label>
                  <input type="password" value={pwForm.password} onChange={e => setPwForm(p => ({ ...p, password: e.target.value }))}
                    placeholder="Min. 6 characters" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Confirm Password</label>
                  <input type="password" value={pwForm.confirm} onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))}
                    placeholder="Re-enter password" style={inputStyle} />
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "22px", justifyContent: "flex-end" }}>
                <button onClick={() => setModal(null)} style={{ backgroundColor: "#6c757d", color: "white", border: "none", padding: "10px 20px", borderRadius: "6px", fontWeight: "600", cursor: "pointer" }}>Cancel</button>
                <button onClick={handleSetPassword} disabled={busy}
                  style={{ backgroundColor: busy ? "#6c757d" : "#6f42c1", color: "white", border: "none", padding: "10px 24px", borderRadius: "6px", fontWeight: "700", cursor: busy ? "not-allowed" : "pointer" }}>
                  {busy ? "Saving..." : "Set Password"}
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
