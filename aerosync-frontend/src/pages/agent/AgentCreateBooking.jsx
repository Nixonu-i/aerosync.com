import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../api/api";
import DateOfBirthPicker from "../../components/DateOfBirthPicker";

/* ─── Theme ──────────────────────────────────────────────── */
const teal  = "#20c997";
const DARK  = "rgba(5, 19, 30, 0.90)";
const CARD  = { background: DARK, border: "1px solid rgba(255,255,255,0.12)", borderRadius: "12px", padding: "20px", marginBottom: "20px" };

const inputStyle = {
  width: "100%", padding: "9px 14px", borderRadius: "7px",
  border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.07)",
  color: "#fff", fontSize: "14px", outline: "none", boxSizing: "border-box",
};
const labelStyle = {
  display: "block", color: "rgba(255,255,255,0.55)", fontSize: "11px",
  marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700,
};

/* ─── Data ────────────────────────────────────────────────── */
const NATIONALITIES = [
  "Kenyan","Tanzanian","Ugandan","Rwandan","Burundian","Ethiopian",
  "Somali","Djiboutian","South African","Nigerian","Ghanaian","Egyptian",
  "Moroccan","Tunisian","Algerian","Libyan","Sudanese","American",
  "British","Canadian","Australian","Indian","Chinese","Japanese",
];

const AREA_CODES = [
  { value: "+254", label: "+254 (Kenya)" },
  { value: "+255", label: "+255 (Tanzania)" },
  { value: "+256", label: "+256 (Uganda)" },
  { value: "+250", label: "+250 (Rwanda)" },
  { value: "+257", label: "+257 (Burundi)" },
  { value: "+251", label: "+251 (Ethiopia)" },
  { value: "+252", label: "+252 (Somalia)" },
  { value: "+253", label: "+253 (Djibouti)" },
  { value: "+258", label: "+258 (Mozambique)" },
  { value: "+260", label: "+260 (Zambia)" },
  { value: "+263", label: "+263 (Zimbabwe)" },
  { value: "+264", label: "+264 (Namibia)" },
  { value: "+27",  label: "+27 (South Africa)" },
  { value: "+1",   label: "+1 (USA/Canada)" },
  { value: "+44",  label: "+44 (UK)" },
  { value: "+91",  label: "+91 (India)" },
];

const blankPassenger = () => ({
  full_name: "", date_of_birth: "", gender: "",
  passport_number: "", nationality: "", passenger_type: "ADULT",
  phone_area_code: "+254", phone_number: "",
});

/* ─── Passenger Form ─────────────────────────────────────── */
const TYPE_BTNS = [
  { val: "ADULT", label: "Adult",  sub: "18+ yrs" },
  { val: "CHILD", label: "Child",  sub: "5–17 yrs" },
  { val: "KID",   label: "Kid",    sub: "0–4 yrs" },
];

function PassengerForm({ index, data, onChange, onRemove, showRemove }) {
  const set     = (k, v) => onChange(index, { ...data, [k]: v });
  const isAdult = data.passenger_type === "ADULT";

  return (
    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "16px", marginBottom: "12px" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
        <div style={{ color: teal, fontWeight: 700, fontSize: "13px" }}>Passenger {index + 1}</div>
        {showRemove && (
          <button type="button" onClick={onRemove}
            style={{ background: "rgba(220,53,69,0.12)", color: "#dc3545", border: "1px solid rgba(220,53,69,0.3)", borderRadius: "6px", padding: "4px 12px", cursor: "pointer", fontSize: "12px", fontWeight: 600 }}>
            Remove
          </button>
        )}
      </div>

      {/* ── Passenger Type — shown FIRST ── */}
      <div style={{ marginBottom: "16px" }}>
        <label style={labelStyle}>Passenger Type *</label>
        <div style={{ display: "flex", gap: "8px" }}>
          {TYPE_BTNS.map(({ val, label, sub }) => (
            <button key={val} type="button" onClick={() => set("passenger_type", val)}
              style={{
                flex: 1, padding: "9px 6px", borderRadius: "7px", cursor: "pointer",
                border: `1px solid ${data.passenger_type === val ? teal : "rgba(255,255,255,0.15)"}`,
                background: data.passenger_type === val ? "rgba(32,201,151,0.15)" : "rgba(255,255,255,0.03)",
                color: data.passenger_type === val ? teal : "rgba(255,255,255,0.45)",
                textAlign: "center", transition: "all 0.15s",
              }}>
              <div style={{ fontWeight: 700, fontSize: "12px" }}>{label}</div>
              <div style={{ fontSize: "10px", marginTop: "2px", opacity: 0.75 }}>{sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Fields grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>

        {/* Common — all types */}
        <div>
          <label style={labelStyle}>Full Name *</label>
          <input value={data.full_name} style={inputStyle} placeholder="FULL NAME"
            onChange={e => set("full_name", e.target.value.toUpperCase().replace(/[^A-Z\s]/g, ""))} />
        </div>
        <div>
          <label style={labelStyle}>Date of Birth *</label>
          <DateOfBirthPicker
            value={data.date_of_birth}
            onChange={(v) => set("date_of_birth", v)}
            theme="dark"
          />
        </div>
        <div>
          <label style={labelStyle}>Nationality *</label>
          <select value={data.nationality} style={inputStyle} onChange={e => set("nationality", e.target.value)}>
            <option value="" style={{ background: "#0b1220" }}>— Select —</option>
            {NATIONALITIES.map(n => <option key={n} value={n} style={{ background: "#0b1220" }}>{n}</option>)}
          </select>
        </div>

        {/* Adult-only fields */}
        {isAdult && (
          <>
            <div>
              <label style={labelStyle}>Gender *</label>
              <select value={data.gender} style={inputStyle} onChange={e => set("gender", e.target.value)}>
                <option value="" style={{ background: "#0b1220" }}>— Select —</option>
                <option value="MALE"   style={{ background: "#0b1220" }}>Male</option>
                <option value="FEMALE" style={{ background: "#0b1220" }}>Female</option>
                <option value="OTHER"  style={{ background: "#0b1220" }}>Other</option>
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Phone Number *</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <select
                  value={data.phone_area_code}
                  style={{ ...inputStyle, width: "160px", flexShrink: 0 }}
                  onChange={e => set("phone_area_code", e.target.value)}>
                  {AREA_CODES.map(ac => (
                    <option key={ac.value} value={ac.value} style={{ background: "#0b1220" }}>{ac.label}</option>
                  ))}
                </select>
                <input
                  value={data.phone_number}
                  style={inputStyle}
                  placeholder="Phone number"
                  inputMode="numeric"
                  maxLength={15}
                  onChange={e => set("phone_number", e.target.value.replace(/[^0-9]/g, ""))} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Passport / ID (numbers only) *</label>
              <input value={data.passport_number} style={inputStyle} placeholder="Numbers only" inputMode="numeric"
                onChange={e => set("passport_number", e.target.value.replace(/[^0-9]/g, ""))} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Airplane Seat Layout ──────────────────────────────── */
function renderSeatBtn(seat, assignments, onSeatClick, onSeatUnclick) {
  if (!seat) return null;
  const asgn    = assignments.find(a => a.seat_id === seat.seat_id);
  const assigned = !!asgn;
  const avail    = seat.available && !assigned;
  const taken    = !seat.available && !assigned;

  return (
    <button key={seat.seat_id} type="button"
      onClick={() => assigned ? onSeatUnclick(seat.seat_id) : (avail ? onSeatClick(seat) : null)}
      disabled={taken}
      title={assigned ? `Unassign P${asgn.passenger_index + 1}` : avail ? seat.seat_number : "Taken"}
      style={{
        width: "36px", height: "34px", margin: "0 2px", borderRadius: "5px",
        border: assigned ? `2px solid ${teal}` : avail ? "1px solid rgba(255,255,255,0.28)" : "1px solid rgba(255,255,255,0.08)",
        background: assigned ? teal : avail ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.02)",
        color: assigned ? "#fff" : avail ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.18)",
        cursor: taken ? "not-allowed" : "pointer",
        fontSize: "11px", fontWeight: 700, padding: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {assigned ? `P${asgn.passenger_index + 1}` : seat.seat_number.replace(/[0-9]/g, "")}
    </button>
  );
}

function AirplaneLayout({ seats, assignments, onSeatClick, onSeatUnclick }) {
  const rows = {};
  seats.forEach(seat => {
    const row    = seat.seat_number.replace(/[^0-9]/g, "") || "0";
    const letter = seat.seat_number.replace(/[0-9]/g, "");
    if (!rows[row]) rows[row] = {};
    const colMap = { A: 0, B: 1, C: 3, D: 5, E: 6, F: 7 };
    const col = colMap[letter.toUpperCase()] ?? 0;
    rows[row][col] = seat;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", overflowX: "auto", paddingBottom: "8px" }}>
      {/* Header labels */}
      <div style={{ display: "flex", marginBottom: "6px", paddingLeft: "28px" }}>
        {["A","B","","D","E","F"].map((l, i) => (
          <div key={i} style={{ width: l === "" ? "20px" : "40px", textAlign: "center", color: "rgba(255,255,255,0.35)", fontSize: "11px", fontWeight: 700 }}>{l}</div>
        ))}
      </div>
      {Object.entries(rows).sort(([a], [b]) => parseInt(a) - parseInt(b)).map(([rowNum, rowSeats]) => (
        <div key={rowNum} style={{ display: "flex", alignItems: "center", marginBottom: "4px" }}>
          <div style={{ width: "24px", textAlign: "right", fontSize: "10px", color: "rgba(255,255,255,0.3)", marginRight: "4px", flexShrink: 0 }}>{rowNum}</div>
          {renderSeatBtn(rowSeats[0], assignments, onSeatClick, onSeatUnclick)}
          {renderSeatBtn(rowSeats[1], assignments, onSeatClick, onSeatUnclick)}
          <div style={{ width: "20px", flexShrink: 0 }} />
          {renderSeatBtn(rowSeats[5], assignments, onSeatClick, onSeatUnclick)}
          {renderSeatBtn(rowSeats[6], assignments, onSeatClick, onSeatUnclick)}
          {renderSeatBtn(rowSeats[7], assignments, onSeatClick, onSeatUnclick)}
        </div>
      ))}
    </div>
  );
}

/* ─── Seat Assign Modal ──────────────────────────────────── */
function SeatAssignModal({ seat, passengers, assignments, onAssign, onClose }) {
  const unassigned = passengers
    .map((p, i) => ({ p, i }))
    .filter(({ i }) => !assignments.find(a => a.passenger_index === i));

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: "#0b1220", border: `1px solid ${teal}`, borderRadius: "14px", padding: "24px", width: "90%", maxWidth: "380px" }}>
        <div style={{ color: "#fff", fontWeight: 800, fontSize: "16px", marginBottom: "4px" }}>Assign Seat {seat.seat_number}</div>
        <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "13px", marginBottom: "18px" }}>Select a passenger for this seat:</div>
        {unassigned.length === 0 ? (
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "14px", textAlign: "center", marginBottom: "16px" }}>All passengers already have seats.</div>
        ) : (
          unassigned.map(({ p, i }) => (
            <button key={i} type="button" onClick={() => onAssign(seat.seat_id, i)}
              style={{ width: "100%", background: "rgba(32,201,151,0.08)", border: "1px solid rgba(32,201,151,0.25)", borderRadius: "8px", padding: "12px 16px", marginBottom: "8px", cursor: "pointer", textAlign: "left", color: "#fff" }}>
              <div style={{ fontWeight: 700, fontSize: "14px" }}>
                Passenger {i + 1}{p.full_name ? ` — ${p.full_name}` : ""}
              </div>
              <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", marginTop: "2px" }}>{p.passenger_type}</div>
            </button>
          ))
        )}
        <button type="button" onClick={onClose}
          style={{ width: "100%", marginTop: "4px", background: "rgba(255,255,255,0.07)", color: "#fff", border: "1px solid rgba(255,255,255,0.18)", borderRadius: "8px", padding: "10px", cursor: "pointer", fontWeight: 600 }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ─── Payment Modal ──────────────────────────────────────── */
function PaymentModal({ booking, providers, onClose, onPaid }) {
  const [provider, setProvider] = useState(providers[0]?.id || "");
  const [details, setDetails]   = useState({});
  const [busy, setBusy]         = useState(false);
  const [errMsg, setErrMsg]     = useState("");

  const set = (k, v) => setDetails(d => ({ ...d, [k]: v }));

  /* Client-side validation — mirrors customer Booking.jsx */
  const validate = () => {
    if (!provider) return "Please select a payment provider.";
    if (provider === "mpesa") {
      if (!details.phone_number?.trim()) return "Phone number is required for M-Pesa.";
    } else if (provider === "paypal") {
      const email = details.email?.trim();
      if (!email) return "Email is required for PayPal.";
      if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) return "Please enter a valid email address.";
    } else if (provider === "card") {
      if (!details.card_number?.trim()) return "Card number is required.";
      if (!details.expiry_date?.trim()) return "Card expiry date is required.";
      if (!details.cvv?.trim()) return "CVV is required.";
    }
    return null; // bank: no user input required
  };

  const submit = async () => {
    const err = validate();
    if (err) { setErrMsg(err); return; }
    setBusy(true);
    setErrMsg("");
    try {
      const res = await API.post(`bookings/${booking.booking_id}/initiate_payment/`, {
        ...details, provider, amount: booking.total_amount, currency: "KES",
      });
      onPaid(res.data.detail || "Payment initiated successfully!");
    } catch (e) {
      setErrMsg(e?.response?.data?.detail || "Payment failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  /* Bank details from provider metadata */
  const bd = providers.find(p => p.id === "bank")?.bank_details;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: "#0b1220", border: `1px solid ${teal}`, borderRadius: "14px", padding: "28px", width: "90%", maxWidth: "440px", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ color: "#fff", fontWeight: 800, fontSize: "18px", marginBottom: "2px" }}>Payment Details</div>
        <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "13px", marginBottom: "20px" }}>
          Ref: <strong style={{ color: "#fff" }}>{booking.confirmation_code}</strong>
        </div>

        {errMsg && (
          <div style={{ background: "rgba(220,53,69,0.12)", border: "1px solid #dc3545", color: "#ff6b75", borderRadius: "8px", padding: "10px 14px", marginBottom: "14px", fontSize: "13px" }}>{errMsg}</div>
        )}

        {/* Provider selector */}
        <div style={{ marginBottom: "16px" }}>
          <label style={labelStyle}>Payment Provider</label>
          <select
            value={provider}
            onChange={e => { setProvider(e.target.value); setDetails({}); setErrMsg(""); }}
            style={inputStyle}
          >
            <option value="" style={{ background: "#0b1220" }}>— Select Provider —</option>
            {providers.map(p => <option key={p.id} value={p.id} style={{ background: "#0b1220" }}>{p.name}</option>)}
          </select>
        </div>

        {/* M-Pesa */}
        {provider === "mpesa" && (
          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>M-Pesa Phone Number</label>
            <input
              type="tel"
              value={details.phone_number || ""}
              onChange={e => set("phone_number", e.target.value)}
              placeholder="254712345678"
              style={inputStyle}
            />
            <small style={{ color: "rgba(255,255,255,0.35)", fontSize: "11px" }}>Enter number in international format (254…)</small>
          </div>
        )}

        {/* PayPal */}
        {provider === "paypal" && (
          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>PayPal Email</label>
            <input
              type="email"
              value={details.email || ""}
              onChange={e => set("email", e.target.value)}
              placeholder="your@email.com"
              style={inputStyle}
            />
          </div>
        )}

        {/* Card */}
        {provider === "card" && (
          <>
            <div style={{ marginBottom: "12px" }}>
              <label style={labelStyle}>Card Number</label>
              <input
                value={details.card_number || ""}
                onChange={e => set("card_number", e.target.value)}
                placeholder="1234 5678 9012 3456"
                style={inputStyle}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
              <div>
                <label style={labelStyle}>Expiry Date</label>
                <input
                  value={details.expiry_date || ""}
                  onChange={e => set("expiry_date", e.target.value)}
                  placeholder="MM/YY"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>CVV</label>
                <input
                  value={details.cvv || ""}
                  onChange={e => set("cvv", e.target.value)}
                  placeholder="123"
                  style={inputStyle}
                />
              </div>
            </div>
          </>
        )}

        {/* Bank Transfer — show provider metadata, no user input required */}
        {provider === "bank" && (
          <div style={{ marginBottom: "16px" }}>
            {bd ? (
              <div style={{ background: "rgba(32,201,151,0.07)", border: "1px solid rgba(32,201,151,0.25)", borderRadius: "8px", padding: "16px" }}>
                <div style={{ color: "#fff", fontWeight: 700, fontSize: "13px", marginBottom: "12px" }}>Transfer to the following account:</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <tbody>
                    {[
                      ["Bank Name",        bd.bank_name],
                      ["Account Name",     bd.account_name],
                      ["Account Number",   bd.account_number],
                      ["Routing Number",   bd.routing_number],
                      ["Payment Reference", booking.confirmation_code],
                    ].map(([label, value]) => (
                      <tr key={label}>
                        <td style={{ padding: "5px 0", color: "rgba(255,255,255,0.5)", width: "45%" }}>{label}</td>
                        <td style={{ padding: "5px 0", color: label === "Payment Reference" ? teal : "#fff", fontWeight: label === "Payment Reference" ? 700 : 400 }}>{value || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p style={{ margin: "12px 0 0", fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>
                  Use booking reference <strong style={{ color: teal }}>{booking.confirmation_code}</strong> as the payment reference. Click “Process Payment” once the transfer is made.
                </p>
              </div>
            ) : (
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px" }}>Loading bank details…</div>
            )}
          </div>
        )}

        {/* Amount — read-only */}
        <div style={{ marginBottom: "20px" }}>
          <label style={labelStyle}>Amount</label>
          <input value={`KES ${booking.total_amount}`} readOnly style={{ ...inputStyle, opacity: 0.6, cursor: "default" }} />
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button type="button" onClick={onClose}
            style={{ flex: 1, background: "rgba(255,255,255,0.07)", color: "#fff", border: "1px solid rgba(255,255,255,0.18)", borderRadius: "8px", padding: "11px", cursor: "pointer", fontWeight: 600 }}>
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={busy}
            style={{ flex: 2, background: teal, color: "#fff", border: "none", borderRadius: "8px", padding: "11px", cursor: busy ? "not-allowed" : "pointer", fontWeight: 800, opacity: busy ? 0.7 : 1 }}>
            {busy ? "Processing…" : "Process Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Step Bar ───────────────────────────────────────────── */
function StepBar({ step }) {
  const steps = ["Flight & Passengers", "Select Seats", "Confirm & Pay"];
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: "28px", flexWrap: "wrap", gap: "4px" }}>
      {steps.map((label, i) => {
        const n = i + 1;
        const active = step === n;
        const done   = typeof step === "number" && step > n;
        return (
          <div key={n} style={{ display: "flex", alignItems: "center", gap: "6px", flex: "0 0 auto" }}>
            <div style={{
              width: "28px", height: "28px", borderRadius: "50%",
              background: done ? teal : active ? "#fff" : "rgba(255,255,255,0.12)",
              color: done ? "#fff" : active ? "#0b1220" : "rgba(255,255,255,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 800, fontSize: "13px", flexShrink: 0,
              border: active ? `2px solid ${teal}` : "none",
            }}>
              {done ? "✓" : n}
            </div>
            <span style={{ color: active ? "#fff" : done ? teal : "rgba(255,255,255,0.4)", fontSize: "13px", fontWeight: active ? 700 : 400 }}>
              {label}
            </span>
            {i < 2 && <div style={{ width: "24px", height: "2px", background: done ? teal : "rgba(255,255,255,0.12)", margin: "0 4px" }} />}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Main Component ──────────────────────────────────────── */
export default function AgentCreateBooking() {
  const navigate = useNavigate();
  const [step, setStep]           = useState(1);

  // Flight
  const [flightId, setFlightId]             = useState("");
  const [flights, setFlights]               = useState([]);
  const [flightsBusy, setFlightsBusy]       = useState(true);
  const [flightSearch, setFlightSearch]     = useState("");
  const [flightSearchBusy, setFlightSearchBusy] = useState(false);
  const [flightSearchErr, setFlightSearchErr]   = useState("");

  // Passengers
  const [passengers, setPassengers] = useState([blankPassenger()]);

  // Seats
  const [seats, setSeats]         = useState([]);
  const [seatsBusy, setSeatsBusy] = useState(false);
  const [seatAssignments, setSeatAssignments] = useState([]);
  const [seatModal, setSeatModal] = useState(null);

  // Booking result
  const [booking, setBooking]     = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr]             = useState("");

  // Payment
  const [showPayment, setShowPayment]   = useState(false);
  const [paymentProviders, setPaymentProviders] = useState([]);
  const [paymentMsg, setPaymentMsg]     = useState("");

  const fmt = iso =>
    iso ? new Date(iso).toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }) : "—";

  // Load flights
  useEffect(() => {
    (async () => {
      try {
        const res = await API.get("agent/flights/");
        setFlights(res.data.results ?? res.data);
      } catch {} finally { setFlightsBusy(false); }
    })();
  }, []);

  // Load seats when flight changes
  useEffect(() => {
    if (!flightId) return;
    setSeatsBusy(true);
    setSeats([]);
    setSeatAssignments([]);
    API.get(`flights/${flightId}/seats/`)
      .then(r => setSeats(r.data))
      .catch(() => {})
      .finally(() => setSeatsBusy(false));
  }, [flightId]);

  // Load payment providers
  useEffect(() => {
    API.get("payment-providers/")
      .then(r => setPaymentProviders(r.data))
      .catch(() => {});
  }, []);

  const selectedFlight = flights.find(f => String(f.id) === String(flightId));
  
    const handleFlightSearch = async () => {
      if (!flightSearch.trim()) return;
      setFlightSearchBusy(true);
      setFlightSearchErr("");
      try {
        const res = await API.get("agent/flights/", { params: { search: flightSearch.trim() } });
        const found = res.data.results ?? res.data;
        if (!found.length) {
          setFlightSearchErr(`No flight found matching "${flightSearch.trim()}".`);
          return;
        }
        // Merge found flights into the list (avoid duplicates)
        setFlights(prev => {
          const existingIds = new Set(prev.map(f => f.id));
          const newOnes = found.filter(f => !existingIds.has(f.id));
          return [...prev, ...newOnes];
        });
        // Auto-select first match
        setFlightId(String(found[0].id));
        setSeatAssignments([]);
      } catch {
        setFlightSearchErr("Search failed. Please try again.");
      } finally {
        setFlightSearchBusy(false);
      }
    };

  /* Passenger helpers */
  const setPassenger = (i, data) => setPassengers(prev => prev.map((p, idx) => idx === i ? data : p));
  const addPassenger = () => setPassengers(p => [...p, blankPassenger()]);
  const removePassenger = (i) => {
    setPassengers(p => p.filter((_, idx) => idx !== i));
    setSeatAssignments(a =>
      a.filter(x => x.passenger_index !== i)
        .map(x => ({ ...x, passenger_index: x.passenger_index > i ? x.passenger_index - 1 : x.passenger_index }))
    );
  };

  /* Seat helpers */
  const onSeatClick   = (seat) => setSeatModal(seat);
  const onSeatUnclick = (seatId) => setSeatAssignments(a => a.filter(x => x.seat_id !== seatId));
  const onSeatAssign  = (seatId, passengerIndex) => {
    setSeatAssignments(a => {
      const filtered = a.filter(x => x.seat_id !== seatId && x.passenger_index !== passengerIndex);
      return [...filtered, { seat_id: seatId, passenger_index: passengerIndex }];
    });
    setSeatModal(null);
  };

  /* Validation */
  const validateStep1 = () => {
    if (!flightId) return "Please select a flight.";
    for (const [i, p] of passengers.entries()) {
      const n = i + 1;
      if (!p.full_name.trim())  return `Passenger ${n}: Full name is required.`;
      if (!p.date_of_birth)     return `Passenger ${n}: Date of birth is required.`;
      if (!p.nationality)       return `Passenger ${n}: Nationality is required.`;
      if (p.passenger_type === "ADULT") {
        if (!p.gender)                return `Passenger ${n}: Gender is required for adults.`;
        if (!p.phone_number.trim())   return `Passenger ${n}: Phone number is required for adults.`;
        if (!p.passport_number.trim()) return `Passenger ${n}: Passport/ID is required for adults.`;
      }
    }
    return null;
  };

  const goToStep2 = () => {
    const e = validateStep1();
    if (e) { setErr(e); return; }
    setErr("");
    setStep(2);
  };

  const goToStep3 = () => {
    if (seatAssignments.length < passengers.length) {
      setErr(`Please assign seats to all ${passengers.length} passenger(s). (${seatAssignments.length}/${passengers.length} assigned)`);
      return;
    }
    setErr("");
    setStep(3);
  };

  /* Submit */
  const handleConfirm = async () => {
    setSubmitting(true);
    setErr("");
    try {
      const seat_ids = passengers.map((_, i) => {
        const asgn = seatAssignments.find(a => a.passenger_index === i);
        return asgn?.seat_id;
      }).filter(Boolean);

      const res = await API.post("agent/bookings/create_for_customer/", {
        flight_id: Number(flightId),
        passengers: passengers.map(p => ({ ...p })),
        seat_ids,
      });
      setBooking(res.data);
      setStep("done");
    } catch (e) {
      setErr(e?.response?.data?.detail || JSON.stringify(e?.response?.data) || "Booking failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetAll = () => {
    setStep(1); setFlightId(""); setPassengers([blankPassenger()]);
    setSeats([]); setSeatAssignments([]); setBooking(null);
    setErr(""); setPaymentMsg("");
  };

  /* ── Render: Done / Booking Created ── */
  if (step === "done" && booking) {
    return (
      <div style={{ maxWidth: "640px" }}>
        <div style={{ background: "rgba(40,167,69,0.10)", border: "1px solid #28a745", borderRadius: "14px", padding: "28px", marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "18px" }}>
            <span style={{ fontSize: "40px" }}>✅</span>
            <div>
              <div style={{ color: "#28a745", fontWeight: 800, fontSize: "20px" }}>Booking Created!</div>
              <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px", marginTop: "3px" }}>Awaiting payment to confirm.</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "10px", marginBottom: "20px" }}>
            {[
              ["Ref",        booking.confirmation_code],
              ["Passengers", booking.passenger_count],
              ["Total",      `KES ${booking.total_amount}`],
              ["Status",     "PENDING"],
            ].map(([lbl, val]) => (
              <div key={lbl} style={{ background: "rgba(5,19,30,0.7)", borderRadius: "8px", padding: "10px 14px" }}>
                <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: "3px" }}>{lbl}</div>
                <div style={{ color: "#fff", fontWeight: 700, fontSize: "14px" }}>{val}</div>
              </div>
            ))}
          </div>
          {paymentMsg && (
            <div style={{ background: "rgba(32,201,151,0.12)", border: "1px solid rgba(32,201,151,0.3)", borderRadius: "8px", padding: "10px 14px", marginBottom: "16px", color: teal, fontSize: "14px", fontWeight: 600 }}>
              {paymentMsg}
            </div>
          )}
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button type="button" onClick={resetAll}
              style={{ background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "8px", padding: "11px 22px", cursor: "pointer", fontWeight: 600 }}>
              + New Booking
            </button>
            <button type="button" onClick={() => setShowPayment(true)}
              style={{ background: teal, color: "#fff", border: "none", borderRadius: "8px", padding: "11px 24px", cursor: "pointer", fontWeight: 800 }}>
              Initiate Payment
            </button>
          </div>
        </div>
        {showPayment && (
          <PaymentModal
            booking={booking}
            providers={paymentProviders}
            onClose={() => setShowPayment(false)}
            onPaid={msg => { setShowPayment(false); setPaymentMsg(msg); navigate("/agent/bookings"); }}
          />
        )}
      </div>
    );
  }

  /* ── Render: Wizard Steps ── */
  return (
    <div style={{ maxWidth: "780px", paddingBottom: "40px" }}>
      <h2 style={{ color: "#fff", fontWeight: 800, margin: "0 0 6px" }}>Create Booking</h2>
      <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "14px", marginBottom: "24px" }}>
        Book a flight for a walk-in customer. Payment is required to confirm.
      </p>

      <StepBar step={step} />

      {/* Global error */}
      {err && (
        <div style={{ background: "rgba(220,53,69,0.12)", border: "1px solid #dc3545", color: "#ff6b75", borderRadius: "8px", padding: "12px 16px", marginBottom: "16px", fontSize: "14px" }}>
          {err}
        </div>
      )}

      {/* ── Step 1: Flight + Passengers ── */}
      {step === 1 && (
        <>
          {/* Flight select */}
          <div style={CARD}>
            <h3 style={{ color: "#fff", fontSize: "15px", margin: "0 0 16px", fontWeight: 700 }}>Select Flight</h3>

            {/* ── Search by flight number (any status) ── */}
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>Search by Flight Number</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  value={flightSearch}
                  onChange={e => { setFlightSearch(e.target.value); setFlightSearchErr(""); }}
                  onKeyDown={e => e.key === "Enter" && handleFlightSearch()}
                  placeholder="e.g. AS12345"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  type="button"
                  onClick={handleFlightSearch}
                  disabled={!flightSearch.trim() || flightSearchBusy}
                  style={{
                    background: (!flightSearch.trim() || flightSearchBusy) ? "rgba(32,201,151,0.25)" : teal,
                    color: "#fff",
                    border: "none",
                    borderRadius: "7px",
                    padding: "9px 20px",
                    fontWeight: 700,
                    fontSize: "14px",
                    cursor: (!flightSearch.trim() || flightSearchBusy) ? "not-allowed" : "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {flightSearchBusy ? "Searching…" : "Find"}
                </button>
              </div>
              {flightSearchErr && (
                <div style={{ color: "#ff6b78", fontSize: "12px", marginTop: "6px" }}>{flightSearchErr}</div>
              )}
              <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "11px", marginTop: "5px" }}>
                Searches all flights regardless of status. Use the dropdown below for upcoming scheduled flights.
              </div>
            </div>

            <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", marginBottom: "14px" }} />

            {/* ── Upcoming flights dropdown ── */}
            <label style={labelStyle}>Upcoming Scheduled Flights</label>
            {flightsBusy ? (
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px" }}>Loading flights…</div>
            ) : (
              <select
                value={flightId}
                onChange={e => { setFlightId(e.target.value); setSeatAssignments([]); }}
                style={inputStyle}
              >
                <option value="" style={{ background: "#0b1220" }}>— Select a flight —</option>
                {flights.map(f => (
                  <option key={f.id} value={f.id} style={{ background: "#0b1220" }}>
                    {f.flight_number} · {f.departure_airport_code || f.departure_airport?.code || "?"} → {f.arrival_airport_code || f.arrival_airport?.code || "?"} · {fmt(f.departure_time)}{f.status !== "SCHEDULED" ? ` [${f.status}]` : ""}
                  </option>
                ))}
              </select>
            )}
            {selectedFlight && (
              <div style={{ marginTop: "14px", background: "rgba(32,201,151,0.07)", border: "1px solid rgba(32,201,151,0.2)", borderRadius: "8px", padding: "12px 16px", display: "flex", flexWrap: "wrap", gap: "14px", fontSize: "13px" }}>
                {[
                  ["Flight",   selectedFlight.flight_number],
                  ["Route",    `${selectedFlight.departure_airport?.code || selectedFlight.departure_airport_code || "?"} → ${selectedFlight.arrival_airport?.code || selectedFlight.arrival_airport_code || "?"}`],
                  ["Departs",  fmt(selectedFlight.departure_time)],
                  ["Price",    `KES ${Number(selectedFlight.price || 0).toLocaleString()} / person`],
                  ["Airline",  selectedFlight.airline || "—"],
                ].map(([lbl, val]) => (
                  <span key={lbl}><strong style={{ color: teal }}>{lbl}:</strong> <span style={{ color: "rgba(255,255,255,0.75)" }}>{val}</span></span>
                ))}
              </div>
            )}
          </div>

          {/* Passengers */}
          <div style={CARD}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ color: "#fff", fontSize: "15px", margin: 0, fontWeight: 700 }}>Passengers ({passengers.length})</h3>
              <button type="button" onClick={addPassenger}
                style={{ background: "rgba(32,201,151,0.12)", color: teal, border: `1px solid rgba(32,201,151,0.35)`, borderRadius: "6px", padding: "6px 14px", cursor: "pointer", fontSize: "13px", fontWeight: 700 }}>
                + Add
              </button>
            </div>
            {passengers.map((p, i) => (
              <PassengerForm key={i} index={i} data={p} onChange={setPassenger}
                onRemove={() => removePassenger(i)} showRemove={passengers.length > 1} />
            ))}
          </div>

          {/* Total */}
          {selectedFlight && (
            <div style={{ background: "rgba(32,201,151,0.07)", border: "1px solid rgba(32,201,151,0.2)", borderRadius: "10px", padding: "14px 18px", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
              <span style={{ color: "rgba(255,255,255,0.65)", fontSize: "14px" }}>
                {passengers.length} × KES {Number(selectedFlight.price || 0).toLocaleString()}
              </span>
              <span style={{ color: teal, fontWeight: 800, fontSize: "20px" }}>
                Total: KES {(Number(selectedFlight.price || 0) * passengers.length).toLocaleString()}
              </span>
            </div>
          )}

          <button type="button" onClick={goToStep2}
            style={{ background: teal, color: "#fff", border: "none", borderRadius: "8px", padding: "13px 32px", fontWeight: 800, cursor: "pointer", fontSize: "15px", width: "100%" }}>
            Continue to Seat Selection →
          </button>
        </>
      )}

      {/* ── Step 2: Seat Selection ── */}
      {step === 2 && (
        <>
          <div style={CARD}>
            <h3 style={{ color: "#fff", fontSize: "15px", margin: "0 0 16px", fontWeight: 700 }}>Select Seats</h3>

            {/* Passenger assignment summary */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "18px" }}>
              {passengers.map((p, i) => {
                const asgn = seatAssignments.find(a => a.passenger_index === i);
                const seat = asgn ? seats.find(s => s.seat_id === asgn.seat_id) : null;
                return (
                  <div key={i} style={{
                    background: seat ? "rgba(32,201,151,0.12)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${seat ? "rgba(32,201,151,0.35)" : "rgba(255,255,255,0.12)"}`,
                    borderRadius: "8px", padding: "8px 14px", fontSize: "13px",
                  }}>
                    <div style={{ color: "#fff", fontWeight: 600 }}>P{i + 1} {p.full_name || "(unnamed)"}</div>
                    <div style={{ color: seat ? teal : "rgba(255,255,255,0.4)", fontSize: "12px", marginTop: "2px" }}>
                      {seat ? `Seat ${seat.seat_number}` : "No seat yet"}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div style={{ display: "flex", gap: "16px", marginBottom: "14px", flexWrap: "wrap" }}>
              {[
                { color: "rgba(255,255,255,0.07)", border: "rgba(255,255,255,0.28)", label: "Available" },
                { color: teal, border: teal, label: "Your selection" },
                { color: "rgba(255,255,255,0.02)", border: "rgba(255,255,255,0.08)", label: "Taken" },
              ].map(({ color, border, label }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <div style={{ width: "18px", height: "16px", background: color, border: `1px solid ${border}`, borderRadius: "3px" }} />
                  <span style={{ color: "rgba(255,255,255,0.55)", fontSize: "12px" }}>{label}</span>
                </div>
              ))}
            </div>

            {/* Plane layout */}
            {seatsBusy ? (
              <div style={{ textAlign: "center", padding: "30px 0", color: "rgba(255,255,255,0.45)" }}>Loading seats…</div>
            ) : seats.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 0", color: "rgba(255,255,255,0.4)" }}>No seats found for this flight.</div>
            ) : (
              <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: "10px", padding: "20px 10px", overflowX: "auto" }}>
                {/* Nose indicator */}
                <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: "12px", marginBottom: "12px", letterSpacing: "1px" }}>
                  ✈ FRONT
                </div>
                <AirplaneLayout
                  seats={seats}
                  assignments={seatAssignments}
                  onSeatClick={onSeatClick}
                  onSeatUnclick={onSeatUnclick}
                />
                <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: "12px", marginTop: "12px", letterSpacing: "1px" }}>
                  REAR ✈
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: "12px" }}>
            <button type="button" onClick={() => { setStep(1); setErr(""); }}
              style={{ background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.18)", borderRadius: "8px", padding: "12px 24px", cursor: "pointer", fontWeight: 600 }}>
              ← Back
            </button>
            <button type="button" onClick={goToStep3}
              style={{ flex: 1, background: teal, color: "#fff", border: "none", borderRadius: "8px", padding: "12px 0", cursor: "pointer", fontWeight: 800, fontSize: "15px" }}>
              Review Booking ({seatAssignments.length}/{passengers.length} seats) →
            </button>
          </div>
        </>
      )}

      {/* ── Step 3: Review & Confirm ── */}
      {step === 3 && selectedFlight && (
        <>
          <div style={CARD}>
            <h3 style={{ color: "#fff", fontSize: "15px", margin: "0 0 16px", fontWeight: 700 }}>Review Booking</h3>

            {/* Flight */}
            <div style={{ background: "rgba(32,201,151,0.07)", border: "1px solid rgba(32,201,151,0.18)", borderRadius: "8px", padding: "14px 16px", marginBottom: "16px" }}>
              <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>Flight</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", fontSize: "14px", color: "rgba(255,255,255,0.8)" }}>
                <span><strong style={{ color: "#fff" }}>{selectedFlight.flight_number}</strong></span>
                <span>{selectedFlight.departure_airport?.code || selectedFlight.departure_airport_code || "?"} → {selectedFlight.arrival_airport?.code || selectedFlight.arrival_airport_code || "?"}</span>
                <span>{fmt(selectedFlight.departure_time)}</span>
                <span>{selectedFlight.airline}</span>
              </div>
            </div>

            {/* Passengers + Seats */}
            <div style={{ marginBottom: "16px" }}>
              <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>Passengers & Seats</div>
              {passengers.map((p, i) => {
                const asgn = seatAssignments.find(a => a.passenger_index === i);
                const seat = asgn ? seats.find(s => s.seat_id === asgn.seat_id) : null;
                return (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "rgba(255,255,255,0.04)", borderRadius: "8px", marginBottom: "6px" }}>
                    <div>
                      <div style={{ color: "#fff", fontWeight: 600, fontSize: "14px" }}>
                        {p.full_name || `Passenger ${i + 1}`}
                        <span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 400, fontSize: "12px", marginLeft: "8px" }}>{p.passenger_type}</span>
                      </div>
                      <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "12px", marginTop: "2px" }}>{p.nationality}</div>
                    </div>
                    <div style={{ color: teal, fontWeight: 700, fontSize: "15px" }}>
                      {seat ? `Seat ${seat.seat_number}` : "—"}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total */}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "rgba(255,255,255,0.55)", fontSize: "14px" }}>{passengers.length} passenger(s) × KES {Number(selectedFlight.price || 0).toLocaleString()}</span>
              <span style={{ color: teal, fontWeight: 800, fontSize: "20px" }}>KES {(Number(selectedFlight.price || 0) * passengers.length).toLocaleString()}</span>
            </div>
          </div>

          <div style={{ background: "rgba(253,126,20,0.08)", border: "1px solid rgba(253,126,20,0.25)", borderRadius: "8px", padding: "12px 16px", marginBottom: "20px", fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>
            ℹ️ Booking will be created as <strong style={{ color: "#fd7e14" }}>PENDING</strong>. Payment is required to confirm and generate the boarding pass.
          </div>

          <div style={{ display: "flex", gap: "12px" }}>
            <button type="button" onClick={() => { setStep(2); setErr(""); }}
              style={{ background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.18)", borderRadius: "8px", padding: "12px 24px", cursor: "pointer", fontWeight: 600 }}>
              ← Back
            </button>
            <button type="button" onClick={handleConfirm} disabled={submitting}
              style={{ flex: 1, background: teal, color: "#fff", border: "none", borderRadius: "8px", padding: "12px 0", cursor: "pointer", fontWeight: 800, fontSize: "15px", opacity: submitting ? 0.7 : 1 }}>
              {submitting ? "Creating Booking…" : "✓ Confirm Booking"}
            </button>
          </div>
        </>
      )}

      {/* Seat assignment modal */}
      {seatModal && (
        <SeatAssignModal
          seat={seatModal}
          passengers={passengers}
          assignments={seatAssignments}
          onAssign={onSeatAssign}
          onClose={() => setSeatModal(null)}
        />
      )}
    </div>
  );
}
