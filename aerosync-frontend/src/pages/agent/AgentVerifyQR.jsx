import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import API from "../../api/api";

const teal   = "#20c997";
const green  = "#28a745";
const red    = "#dc3545";
const amber  = "#fd7e14";
const DARK   = "rgba(5, 19, 30, 0.92)";
const CARD   = { background: DARK, border: "1px solid rgba(255,255,255,0.12)", borderRadius: "12px", padding: "20px" };

const Icons = {
  Warning: ({ size = 36, color = amber }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  Camera: ({ size = 28 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  ),
  StopSquare: ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
    </svg>
  ),
  XCircle: ({ size = 32, color = "#ff6b78" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10"/>
      <line x1="15" y1="9" x2="9" y2="15"/>
      <line x1="9" y1="9" x2="15" y2="15"/>
    </svg>
  ),
  CheckCircle: ({ size = 40, color = green }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10"/>
      <polyline points="9 12 11 14 15 10"/>
    </svg>
  ),
  Repeat: ({ size = 40, color = amber }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <polyline points="17 1 21 5 17 9"/>
      <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
      <polyline points="7 23 3 19 7 15"/>
      <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
    </svg>
  ),
};

const STATUS_BADGE = {
  CONFIRMED: { bg: "rgba(23,162,184,0.18)", color: "#17a2b8", border: "#17a2b866" },
  ONBOARD:   { bg: "rgba(40,167,69,0.18)",  color: "#28a745", border: "#28a74566" },
  PENDING:   { bg: "rgba(255,193,7,0.18)",  color: "#ffc107", border: "#ffc10766" },
  CANCELLED: { bg: "rgba(220,53,69,0.18)",  color: "#dc3545", border: "#dc354566" },
  FAILED:    { bg: "rgba(220,53,69,0.18)",  color: "#dc3545", border: "#dc354566" },
};

const fmtTime = iso =>
  iso
    ? new Date(iso).toLocaleString("en-GB", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "—";

const fmtShort = iso =>
  iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) + " " +
        new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
      : "—";

export default function AgentVerifyQR() {
  const [scanning, setScanning]       = useState(false);
  const [scanErr, setScanErr]         = useState("");
  const [result, setResult]           = useState(null);
  const [verifyErr, setVerifyErr]     = useState("");
  const [verifying, setVerifying]     = useState(false);
  const [manualQR, setManualQR]       = useState("");
  const [cameras, setCameras]         = useState([]);
  const [selectedCam, setSelectedCam] = useState("");
  const [scanHistory, setScanHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const html5Ref = useRef(null);

  // Fetch persisted scan history from the server
  const fetchHistory = async () => {
    try {
      const res = await API.get("agent/scan-history/");
      setScanHistory(
        res.data.map(e => ({ ...e, scannedAtFmt: fmtShort(e.scanned_at) }))
      );
    } catch (_) {
      // non-fatal
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    Html5Qrcode.getCameras()
      .then(devs => {
        setCameras(devs || []);
        const back = devs.find(d => /back|rear|environment/i.test(d.label));
        setSelectedCam(back?.id || devs[0]?.id || "");
      })
      .catch(() => setCameras([]));
  }, []);

  useEffect(() => () => { html5Ref.current?.stop().catch(() => {}); }, []);

  const startScan = async () => {
    setScanErr("");
    setResult(null);
    setVerifyErr("");
    if (!selectedCam && cameras.length === 0) {
      setScanErr("No camera found. Please allow camera access.");
      return;
    }
    try {
      const qr = new Html5Qrcode("qr-reader");
      html5Ref.current = qr;
      await qr.start(
        selectedCam || { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => { qr.stop().catch(() => {}); setScanning(false); verifyCode(decoded); },
        () => {}
      );
      setScanning(true);
    } catch (e) {
      setScanErr(e?.message || "Could not start camera. Please check permissions.");
    }
  };

  const stopScan = () => { html5Ref.current?.stop().catch(() => {}); setScanning(false); };

  const verifyCode = async (code) => {
    if (!code.trim()) return;
    setVerifying(true);
    setVerifyErr("");
    setResult(null);
    try {
      const res = await API.post("verify/qr/", { qr_code_data: code.trim() });
      const data = res.data;
      setResult(data);
      // Prepend new entry to local history immediately, then re-fetch from server
      const newEntry = { ...data, scanned_at: new Date().toISOString(), scannedAtFmt: fmtShort(new Date().toISOString()) };
      setScanHistory(prev => [newEntry, ...prev].slice(0, 200));
      fetchHistory(); // keep in sync with server
    } catch (e) {
      setVerifyErr(e?.response?.data?.detail || "QR verification failed — code not found.");
    } finally {
      setVerifying(false);
    }
  };

  const reset = () => { setResult(null); setVerifyErr(""); setManualQR(""); setScanErr(""); };

  const isDoubleBoard = result?.already_onboard;

  return (
    <div style={{ maxWidth: "640px", margin: "0 auto", paddingBottom: "40px" }}>

      {/* ── Page Header ── */}
      <div style={{ marginBottom: "24px" }}>
        <h2 style={{ color: "#fff", fontWeight: 800, margin: "0 0 6px" }}>Verify Boarding Pass</h2>
        <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "14px", margin: 0, lineHeight: 1.6 }}>
          Scan the passenger's QR code or paste it manually.&nbsp;
          <strong style={{ color: "#17a2b8" }}>CONFIRMED</strong> bookings are marked&nbsp;
          <strong style={{ color: green }}>ON BOARD</strong> automatically.
        </p>
      </div>

      {/* ── Double-Scan Alert (prominent) ── */}
      {isDoubleBoard && (
        <div style={{
          background: "rgba(253,126,20,0.15)",
          border: `2px solid ${amber}`,
          borderRadius: "14px",
          padding: "20px 24px",
          marginBottom: "20px",
          display: "flex",
          gap: "14px",
          alignItems: "flex-start",
        }}>
          <Icons.Warning size={36} color={amber} />
          <div>
            <div style={{ color: amber, fontWeight: 800, fontSize: "18px", marginBottom: "4px" }}>
              DUPLICATE SCAN — Passenger Already On Board!
            </div>
            <div style={{ color: "rgba(255,255,255,0.85)", fontSize: "14px", lineHeight: 1.5 }}>
              <strong style={{ color: "#fff" }}>{result.passenger_name}</strong> was previously scanned
              and is already marked as <strong style={{ color: amber }}>ON BOARD</strong>.
              Do not allow re-boarding without supervisor approval.
            </div>
            <div style={{ marginTop: "10px", display: "flex", gap: "8px", flexWrap: "wrap", fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>
              <span>Ref: <strong style={{ color: "#fff" }}>{result.booking_reference}</strong></span>
              <span>·</span>
              <span>Flight: <strong style={{ color: "#fff" }}>{result.flight_number}</strong></span>
              <span>·</span>
              <span>Seat: <strong style={{ color: "#fff" }}>{result.seat_number || "—"}</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* ── Scan History ── */}
      {(historyLoading || scanHistory.length > 0) && (
        <div style={{ ...CARD, marginBottom: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: "15px" }}>Scan History</div>
              <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "12px", marginTop: "2px" }}>
                {historyLoading ? "Loading…" : `${scanHistory.length} passenger(s) scanned`}
              </div>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
                  {["Time", "Passenger", "Ref", "Flight", "Seat", "Status"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: "rgba(255,255,255,0.45)", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scanHistory.map((entry, i) => {
                  const isOb = entry.already_onboard;
                  const s = STATUS_BADGE[entry.status] || { color: "#aaa" };
                  return (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: isOb ? "rgba(253,126,20,0.06)" : "transparent" }}>
                      <td style={{ padding: "9px 10px", color: "rgba(255,255,255,0.55)", whiteSpace: "nowrap" }}>{entry.scannedAtFmt}</td>
                      <td style={{ padding: "9px 10px", color: "#fff", fontWeight: 600, whiteSpace: "nowrap" }}>
                        {entry.passenger_name || "—"}
                        {isOb && <span style={{ marginLeft: "6px", display: "inline-flex", verticalAlign: "middle" }}><Icons.Warning size={13} color={amber} /></span>}
                      </td>
                      <td style={{ padding: "9px 10px", color: "rgba(255,255,255,0.7)", fontFamily: "monospace", fontSize: "12px" }}>{entry.booking_reference}</td>
                      <td style={{ padding: "9px 10px", color: "rgba(255,255,255,0.7)" }}>{entry.flight_number || "—"}</td>
                      <td style={{ padding: "9px 10px", color: "rgba(255,255,255,0.7)" }}>{entry.seat_number || "—"}</td>
                      <td style={{ padding: "9px 10px" }}>
                        <span style={{ color: s.color, fontWeight: 700, fontSize: "12px" }}>{entry.status}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Camera Selector ── */}
      {cameras.length > 1 && !scanning && !result && (
        <div style={{ ...CARD, marginBottom: "16px" }}>
          <label style={{ display: "block", color: "rgba(255,255,255,0.7)", fontSize: "12px", fontWeight: 700, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Camera
          </label>
          <select
            value={selectedCam}
            onChange={e => setSelectedCam(e.target.value)}
            style={{ width: "100%", padding: "9px 14px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(5,19,30,0.9)", color: "#fff", fontSize: "14px", outline: "none" }}
          >
            {cameras.map(c => (
              <option key={c.id} value={c.id} style={{ background: "#0b1220" }}>{c.label || c.id}</option>
            ))}
          </select>
        </div>
      )}

      {/* ── Scanner Viewport ── */}
      {!result && (
        <div style={{
          background: "rgba(0,0,0,0.6)",
          border: `2px solid ${scanning ? teal : "rgba(255,255,255,0.15)"}`,
          borderRadius: "14px",
          overflow: "hidden",
          marginBottom: "16px",
          transition: "border-color 0.3s",
        }}>
          <div id="qr-reader" style={{ width: "100%" }} />
          {!scanning && (
            <div style={{ padding: "44px 20px", textAlign: "center" }}>
              <Icons.Camera size={56} />
              <div style={{ color: "#fff", fontSize: "15px", fontWeight: 700, marginBottom: "4px" }}>Camera Off</div>
              <div style={{ color: "rgba(255,255,255,0.55)", fontSize: "13px" }}>
                Click <strong style={{ color: teal }}>Start Camera</strong> to begin scanning
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Scan Error ── */}
      {scanErr && (
        <div style={{ background: "rgba(220,53,69,0.15)", border: `1px solid ${red}`, color: "#ff8891", borderRadius: "8px", padding: "12px 16px", marginBottom: "14px", fontSize: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
          <Icons.XCircle size={18} color="#ff8891" />
          {scanErr}
        </div>
      )}

      {/* ── Camera Controls ── */}
      {!result && (
        <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
          {!scanning ? (
            <button
              onClick={startScan}
              style={{ flex: 1, background: teal, color: "#fff", border: "none", borderRadius: "9px", padding: "13px 0", fontWeight: 800, cursor: "pointer", fontSize: "15px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
            >
              <Icons.Camera size={20} /> Start Camera
            </button>
          ) : (
            <button
              onClick={stopScan}
              style={{ flex: 1, background: "rgba(220,53,69,0.2)", color: "#ff6b78", border: `1px solid ${red}`, borderRadius: "9px", padding: "13px 0", fontWeight: 800, cursor: "pointer", fontSize: "15px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
            >
              <Icons.StopSquare size={18} /> Stop Camera
            </button>
          )}
        </div>
      )}

      {/* ── Manual Input ── */}
      {!result && !scanning && (
        <form onSubmit={e => { e.preventDefault(); verifyCode(manualQR); }}>
          <div style={{ ...CARD, marginBottom: "20px" }}>
            <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "12px", fontWeight: 700, marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Or paste QR code manually
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <input
                type="text"
                placeholder="Paste QR code string here…"
                value={manualQR}
                onChange={e => setManualQR(e.target.value)}
                style={{ flex: 1, padding: "10px 14px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.07)", color: "#fff", fontSize: "14px", outline: "none" }}
              />
              <button
                type="submit"
                disabled={!manualQR.trim() || verifying}
                style={{ background: teal, color: "#fff", border: "none", borderRadius: "8px", padding: "10px 20px", cursor: "pointer", fontWeight: 700, fontSize: "14px", opacity: !manualQR.trim() || verifying ? 0.5 : 1 }}
              >
                {verifying ? "…" : "Verify"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ── Verify Error ── */}
      {verifyErr && !result && (
        <div style={{ background: "rgba(220,53,69,0.15)", border: `1px solid ${red}`, borderRadius: "12px", padding: "20px", marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
            <Icons.XCircle size={32} color="#ff6b78" />
            <div>
              <div style={{ color: "#ff6b78", fontWeight: 700, fontSize: "16px" }}>Invalid QR Code</div>
              <div style={{ color: "rgba(255,255,255,0.75)", fontSize: "13px", marginTop: "4px" }}>{verifyErr}</div>
            </div>
          </div>
          <button onClick={reset} style={{ background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "7px", padding: "8px 20px", cursor: "pointer", fontSize: "14px", fontWeight: 600 }}>
            Try Again
          </button>
        </div>
      )}

      {/* ── Success Result ── */}
      {result && (
        <div style={{
          background: isDoubleBoard ? "rgba(253,126,20,0.10)" : "rgba(40,167,69,0.12)",
          border: `2px solid ${isDoubleBoard ? amber : green}`,
          borderRadius: "14px",
          padding: "24px",
          marginBottom: "20px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "20px" }}>
            {isDoubleBoard ? <Icons.Repeat size={40} color={amber} /> : <Icons.CheckCircle size={40} color={green} />}
            <div>
              <div style={{ fontWeight: 800, fontSize: "18px", color: isDoubleBoard ? amber : green }}>
                {isDoubleBoard ? "Already Boarded — Duplicate Scan" : "Boarding Pass Verified!"}
              </div>
              <div style={{ color: "rgba(255,255,255,0.75)", fontSize: "13px", marginTop: "3px" }}>
                {isDoubleBoard
                  ? "This passenger was already marked as ON BOARD. Check with supervisor."
                  : "Status updated to ON BOARD successfully."}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "10px", marginBottom: "20px" }}>
            {[
              ["Booking Ref",  result.booking_reference],
              ["Passenger",    result.passenger_name || "—"],
              ["Flight",       result.flight_number  || "—"],
              ["Route",        result.departure && result.arrival ? `${result.departure} → ${result.arrival}` : "—"],
              ["Departure",    fmtTime(result.departure_time)],
              ["Seat",         result.seat_number || "—"],
            ].map(([lbl, val]) => (
              <div key={lbl} style={{ background: "rgba(5,19,30,0.75)", borderRadius: "8px", padding: "11px 14px" }}>
                <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: "4px" }}>{lbl}</div>
                <div style={{ color: "#fff", fontWeight: 600, fontSize: "14px", wordBreak: "break-word" }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Status badge */}
          {(() => {
            const s = STATUS_BADGE[result.status] || { bg: "rgba(108,117,125,0.2)", color: "#aaa", border: "#6c757d66" };
            return (
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "13px" }}>Status:</span>
                <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: "20px", padding: "4px 14px", fontWeight: 700, fontSize: "13px" }}>
                  {result.status}
                </span>
              </div>
            );
          })()}

          <button
            onClick={reset}
            style={{ background: teal, color: "#fff", border: "none", borderRadius: "8px", padding: "11px 28px", cursor: "pointer", fontWeight: 700, fontSize: "15px" }}
          >
            Scan Next Passenger
          </button>
        </div>
      )}


    </div>
  );
}
