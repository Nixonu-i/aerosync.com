import { useEffect, useState } from "react";
import API from "../../api/api";

const teal = "#20c997";
const DARK = "rgba(5, 19, 30, 0.85)";

export default function AgentFlights() {
  const [items, setItems]       = useState([]);
  const [busy, setBusy]         = useState(true);
  const [moreBusy, setMoreBusy] = useState(false);
  const [err, setErr]           = useState("");
  const [nextUrl, setNextUrl]   = useState(null);
  const [totalCount, setTotal]  = useState(0);
  const [search, setSearch]     = useState({ from: "", to: "", airline: "" });

  const load = async (params = {}) => {
    setBusy(true);
    setErr("");
    try {
      const res = await API.get("agent/flights/", { params });
      const d = res.data;
      setItems(d.results ?? d);
      setNextUrl(d.next ?? null);
      setTotal(d.count ?? (d.results ?? d).length);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Failed to load flights");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { load(); }, []);

  const applySearch = () => {
    const p = {};
    if (search.from)    p.from_city = search.from;
    if (search.to)      p.to_city   = search.to;
    if (search.airline) p.airline   = search.airline;
    load(p);
  };

  const loadMore = async () => {
    if (!nextUrl || moreBusy) return;
    setMoreBusy(true);
    try {
      const res = await API.get(nextUrl);
      const d = res.data;
      setItems(prev => [...prev, ...(d.results ?? d)]);
      setNextUrl(d.next ?? null);
    } catch { /* ignore */ }
    finally { setMoreBusy(false); }
  };

  const fmt = iso => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div>
      <h2 style={{ color: "#fff", marginBottom: "20px" }}>Available Flights</h2>

      {/* Search bar */}
      <div style={{
        background: DARK,
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "12px",
        padding: "16px 20px",
        marginBottom: "24px",
        display: "flex",
        flexWrap: "wrap",
        gap: "12px",
        alignItems: "flex-end",
      }}>
        {[
          { key: "from", placeholder: "From city…" },
          { key: "to",   placeholder: "To city…" },
          { key: "airline", placeholder: "Airline…" },
        ].map(f => (
          <input
            key={f.key}
            placeholder={f.placeholder}
            value={search[f.key]}
            onChange={e => setSearch(p => ({ ...p, [f.key]: e.target.value }))}
            onKeyDown={e => e.key === "Enter" && applySearch()}
            style={{
              flex: "1 1 150px",
              padding: "9px 14px",
              borderRadius: "7px",
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.08)",
              color: "#fff",
              fontSize: "14px",
              outline: "none",
            }}
          />
        ))}
        <button
          onClick={applySearch}
          style={{
            background: teal,
            color: "#fff",
            border: "none",
            borderRadius: "7px",
            padding: "9px 22px",
            fontWeight: 700,
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          Search
        </button>
        <button
          onClick={() => { setSearch({ from: "", to: "", airline: "" }); load(); }}
          style={{
            background: "rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.7)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: "7px",
            padding: "9px 16px",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          Clear
        </button>
      </div>

      {err && (
        <div style={{ background: "rgba(220,53,69,0.15)", border: "1px solid #dc3545", color: "#ff6b75", borderRadius: "8px", padding: "12px 16px", marginBottom: "16px" }}>
          {err}
        </div>
      )}

      {busy ? (
        <div style={{ textAlign: "center", color: "rgba(255,255,255,0.5)", padding: "40px" }}>Loading flights…</div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", padding: "40px" }}>No flights found.</div>
      ) : (
        <>
          <div style={{ overflowX: "auto", borderRadius: "12px", background: DARK }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ background: "rgba(32,201,151,0.1)", borderBottom: "1px solid rgba(32,201,151,0.3)" }}>
                  {["Flight #", "Route", "Departure", "Airline", "Duration", "Price", "Status"].map(h => (
                    <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: teal, fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((f, i) => (
                  <tr
                    key={f.id}
                    style={{ background: i % 2 === 0 ? "rgba(255,255,255,0.03)" : "transparent", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <td style={{ padding: "10px 14px", color: "#fff", fontFamily: "monospace", fontWeight: 700 }}>{f.flight_number}</td>
                    <td style={{ padding: "10px 14px", color: "#fff", whiteSpace: "nowrap" }}>
                      {f.departure_airport_code || f.departure_airport?.code || "—"}
                      <span style={{ color: teal, margin: "0 6px" }}>→</span>
                      {f.arrival_airport_code || f.arrival_airport?.code || "—"}
                    </td>
                    <td style={{ padding: "10px 14px", color: "rgba(255,255,255,0.8)", whiteSpace: "nowrap" }}>{fmt(f.departure_time)}</td>
                    <td style={{ padding: "10px 14px", color: "rgba(255,255,255,0.8)" }}>{f.airline || "—"}</td>
                    <td style={{ padding: "10px 14px", color: "rgba(255,255,255,0.8)" }}>{f.duration_minutes ? `${f.duration_minutes}m` : "—"}</td>
                    <td style={{ padding: "10px 14px", color: teal, fontWeight: 700 }}>
                      {f.price != null ? `$${Number(f.price).toFixed(2)}` : "—"}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{
                        background: "rgba(40,167,69,0.18)",
                        color: "#28a745",
                        border: "1px solid rgba(40,167,69,0.35)",
                        borderRadius: "20px",
                        padding: "3px 10px",
                        fontSize: "12px",
                        fontWeight: 600,
                      }}>{f.status || "SCHEDULED"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div style={{ textAlign: "center", marginTop: "24px", color: "rgba(255,255,255,0.5)", fontSize: "13px" }}>
            Showing <strong style={{ color: "#fff" }}>{items.length}</strong> of <strong style={{ color: "#fff" }}>{totalCount}</strong> flights
            {nextUrl && (
              <button
                onClick={loadMore}
                disabled={moreBusy}
                style={{
                  display: "block",
                  margin: "14px auto 0",
                  background: "rgba(32,201,151,0.15)",
                  color: teal,
                  border: `1px solid rgba(32,201,151,0.4)`,
                  borderRadius: "8px",
                  padding: "9px 28px",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "14px",
                }}
              >
                {moreBusy ? "Loading…" : `Load More (${totalCount - items.length} remaining)`}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
