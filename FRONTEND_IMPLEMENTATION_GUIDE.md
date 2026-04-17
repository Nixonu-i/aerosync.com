# Flight Via Routing System - Remaining Frontend Implementation Guide

## Overview
This document provides the specific code changes needed to complete the frontend implementation of the Via Routing System.

---

## 1. ImprovedMultiPassengerBooking.jsx - Add Stopover Selection

**File**: `/home/nixii/Documents/aerosync/aerosync-frontend/src/components/ImprovedMultiPassengerBooking.jsx`

### Changes Required:

#### A. Add State (around line 60):
```jsx
const [stopoverCity, setStopoverCity] = useState('');
```

#### B. Add Stopover Selection Step (between Step 1 and Step 2):

After the passenger information step and before seat selection, add this conditional UI:

```jsx
{/* Stopover City Selection for VIA flights */}
{flight.route_type === 'VIA' && currentStep === 1.5 && (
  <div style={{ padding: "20px" }}>
    <h3 style={{ color: "#0b1220", marginBottom: "20px", textAlign: "center" }}>
      Select Your Stopover City
    </h3>
    <p style={{ color: "#6c757d", marginBottom: "24px", textAlign: "center" }}>
      This flight has intermediate stops. Please select where you'd like to stopover:
    </p>
    
    <div style={{ maxWidth: "400px", margin: "0 auto" }}>
      <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", color: "#0b1220" }}>
        Stopover City
      </label>
      <select
        value={stopoverCity}
        onChange={(e) => setStopoverCity(e.target.value)}
        style={{
          width: "100%",
          padding: "12px",
          border: "1px solid #ced4da",
          borderRadius: "6px",
          fontSize: "14px",
          backgroundColor: "white"
        }}
      >
        <option value="">Select a city...</option>
        {flight.via_cities.map((city, idx) => (
          <option key={idx} value={city}>{city}</option>
        ))}
      </select>
    </div>
    
    <div style={{ textAlign: "center", marginTop: "30px" }}>
      <button
        onClick={() => setCurrentStep(2)}
        disabled={!stopoverCity}
        style={{
          background: stopoverCity ? "#0b1220" : "#6c757d",
          color: "white",
          border: "none",
          padding: "12px 30px",
          borderRadius: "4px",
          cursor: stopoverCity ? "pointer" : "not-allowed",
          fontSize: "16px",
          fontWeight: "600"
        }}
      >
        Continue to Seat Selection
      </button>
    </div>
  </div>
)}
```

#### C. Update Step Navigation:

Modify the `continue to seats` button in Step 1 to go to step 1.5 instead:

```jsx
// In Step 1's continue button
onClick={() => {
  if (flight.route_type === 'VIA') {
    setCurrentStep(1.5);  // Go to stopover selection
  } else {
    setCurrentStep(2);     // Direct flights skip to seat selection
  }
}}
```

#### D. Include stopover_city in API Payload (around line 215):

```jsx
const apiData = {
  flight_id: flight.id,
  stopover_city: stopoverCity || undefined,  // Include stopover city
  reference_number: referenceNumber,
  passengers: passengers.map(p => ({...})),
  seat_assignments: seatAssignments.map(a => ({...}))
};
```

---

## 2. Booking.jsx - Update Flight Display

**File**: `/home/nixii/Documents/aerosync/aerosync-frontend/src/pages/Booking.jsx`

### Changes Required:

#### A. Update "Stops" Display (around line 377-379):

**Current**:
```jsx
<div>
  <div style={{ fontSize: "14px", color: "#6c757d", marginBottom: "5px" }}>Stops</div>
  <div style={{ fontSize: "18px", fontWeight: "600", color: "var(--text-primary)" }}>
    {flight?.stops === 0 ? "Direct" : `${flight?.stops} stop(s)`}
  </div>
</div>
```

**Replace with**:
```jsx
<div>
  <div style={{ fontSize: "14px", color: "#6c757d", marginBottom: "5px" }}>Route Type</div>
  <div style={{ fontSize: "18px", fontWeight: "600", color: "var(--text-primary)" }}>
    {flight?.route_type === 'VIA' 
      ? `Via ${flight.via_cities?.join(', ')}` 
      : 'Direct'}
  </div>
</div>
```

---

## 3. AdminFlights.jsx - Add Route Type and Via Cities Form

**File**: `/home/nixii/Documents/aerosync/aerosync-frontend/src/pages/admin/AdminFlights.jsx`

### Changes Required:

#### A. Update EMPTY Form State (line 33):

**Current**:
```jsx
const EMPTY = { airline: "", aircraft: "", departure_airport: "", arrival_airport: "", departure_time: "", arrival_time: "", price: "", trip_type: "ONE_WAY", stops: "0", status: "SCHEDULED" };
```

**Replace with**:
```jsx
const EMPTY = { 
  airline: "", 
  aircraft: "", 
  departure_airport: "", 
  arrival_airport: "", 
  departure_time: "", 
  arrival_time: "", 
  price: "", 
  trip_type: "ONE_WAY", 
  route_type: "DIRECT", 
  via_cities: [], 
  stops: "0", 
  status: "SCHEDULED" 
};
```

#### B. Add Route Type Dropdown in Modal:

In the create/edit modal form (around line 516-525), add after Trip Type:

```jsx
{/* Route Type */}
<div>
  <label style={labelStyle}>Route Type</label>
  <SearchableSelect
    value={form.route_type}
    onChange={v => setForm(p => ({ ...p, route_type: v, via_cities: v === 'DIRECT' ? [] : p.via_cities }))}
    options={[
      { value: "DIRECT", label: "Direct" },
      { value: "VIA", label: "Via" }
    ]}
    placeholder="Select route type…"
  />
</div>

{/* Via Cities (only for VIA flights) */}
{form.route_type === 'VIA' && (
  <div>
    <label style={labelStyle}>Via Cities (comma-separated)</label>
    <input
      value={form.via_cities.join(', ')}
      onChange={e => setForm(p => ({ 
        ...p, 
        via_cities: e.target.value.split(',').map(c => c.trim()).filter(c => c)
      }))}
      placeholder="e.g., Mombasa, Dar es Salaam"
      style={{
        width: "100%", padding: "10px 12px", border: "1px solid #ced4da",
        borderRadius: "6px", fontSize: "14px", boxSizing: "border-box",
      }}
    />
    <small style={{ color: "#6c757d", fontSize: "11px", marginTop: "4px", display: "block" }}>
      Enter intermediate cities in travel order, separated by commas
    </small>
  </div>
)}
```

#### C. Update Table Display:

In the flights table (around line 420-440), replace the stops column:

**Current**:
```jsx
<td>{f.stops === 0 ? "Direct" : f.stops}</td>
```

**Replace with**:
```jsx
<td>
  {f.route_type === 'VIA' 
    ? <span style={{ color: "#d4af37", fontWeight: "600" }}>Via {f.via_cities?.length || 0}</span>
    : <span style={{ color: "#28a745" }}>Direct</span>
  }
</td>
```

---

## 4. AdminReports.jsx - Add Flight Filter and Stopover Display

**File**: `/home/nixii/Documents/aerosync/aerosync-frontend/src/pages/admin/AdminReports.jsx`

### Changes Required:

#### A. Add State Variables (around line 358):

```jsx
const [flightFilter, setFlightFilter] = useState('');
const [flightsWithBookings, setFlightsWithBookings] = useState([]);
```

#### B. Fetch Flights with Bookings (in useEffect, line 393):

```jsx
useEffect(() => { 
  load();
  // Fetch flights that have bookings
  API.get('reports/flights-with-bookings/')
    .then(res => setFlightsWithBookings(res.data))
    .catch(err => console.error('Failed to load flights with bookings:', err));
}, [load]);
```

#### C. Add Flight Filter Dropdown in BookingsTable (line 121-138):

```jsx
function BookingsTable({ data }) {
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState("");
  const [flightF, setFlightF] = useState("");  // Add this

  const filtered = data.filter((b) => {
    const q = search.toLowerCase();
    const matchQ = !q || b.confirmation_code?.toLowerCase().includes(q) || b.username?.toLowerCase().includes(q) || b.flight_number?.toLowerCase().includes(q);
    const matchFlight = !flightF || b.flight === flightF;  // Add this
    return matchQ && (!statusF || b.booking_status === statusF) && matchFlight;  // Update this
  });

  // ... rest of function

  return (
    <div>
      <div style={{ display: "flex", gap: "10px", marginBottom: "14px", flexWrap: "wrap", alignItems: "center" }}>
        {/* Add Flight Filter Dropdown */}
        <select value={flightF} onChange={(e) => setFlightF(e.target.value)}
          style={{ padding: "8px 12px", border: "1px solid #ced4da", borderRadius: "6px", fontSize: "13px" }}>
          <option value="">All Flights</option>
          {flightsWithBookings.map((f) => (
            <option key={f.id} value={f.id}>
              {f.flight_number} ({f.departure_code} → {f.arrival_code})
            </option>
          ))}
        </select>
        
        {/* ... rest of filters */}
      </div>
```

#### D. Update Table Headers and Cells (line 142-170):

Add columns for route type and stopover:

```jsx
<thead>
  <tr>
    <TH>#</TH>
    <TH>Confirmation</TH>
    <TH>User</TH>
    <TH>Flight</TH>
    <TH>Route</TH>
    <TH>Booking Date</TH>
    <TH>Route Type</TH>  {/* New */}
    <TH>Stopover</TH>    {/* New */}
    <TH>Booking Status</TH>
    <TH>Payment</TH>
    <TH right>Amount (KES)</TH>
    <TH right>Pax</TH>
  </tr>
</thead>
<tbody>
  {filtered.map((b, i) => (
    <tr key={b.id} {...}>
      <TD>{i + 1}</TD>
      <TD mono>{b.confirmation_code}</TD>
      <TD>{b.username}</TD>
      <TD>{b.flight_number}</TD>
      <TD><strong>{b.departure_code} → {b.arrival_code}</strong></TD>
      <TD>{fmtDateOnly(b.booking_date)}</TD>
      <TD>  {/* New column */}
        {b.flight_route_type === 'VIA' 
          ? <span style={{ color: "#d4af37", fontWeight: "600" }}>Via</span>
          : <span style={{ color: "#28a745" }}>Direct</span>
        }
      </TD>
      <TD>  {/* New column */}
        {b.stopover_city || '—'}
      </TD>
      <TD><StatusBadge status={b.booking_status} /></TD>
      <TD><StatusBadge status={b.payment_status} /></TD>
      <TD right><strong>{Number(b.total_amount).toLocaleString()}</strong></TD>
      <TD right>{b.passengers?.length || 0}</TD>
    </tr>
  ))}
</tbody>
```

---

## Testing Checklist

After implementing all changes:

1. ✅ Run migrations: `python manage.py migrate`
2. ✅ Test flight search with Direct filter
3. ✅ Test flight search with VIA filter + specific via city
4. ✅ Create a VIA flight in admin panel
5. ✅ Book a DIRECT flight (no stopover selection)
6. ✅ Book a VIA flight (must select stopover)
7. ✅ Verify stopover city is saved in booking
8. ✅ Check admin reports show flight filter dropdown
9. ✅ Verify bookings table shows route type and stopover columns

---

## API Endpoints Reference

- `GET /api/flights/` - Supports `route_type` and `via_city` query params
- `GET /api/flights/via-cities/` - Returns list of available via cities
- `POST /api/bookings/create_booking/` - Accepts `stopover_city` field
- `GET /api/reports/flights-with-bookings/` - Returns flights with booking counts

---

## Notes

- All via_cities must be valid city names that exist in the Airport model
- The system auto-updates the `stops` field based on `via_cities.length` for backward compatibility
- DIRECT flights cannot have via_cities (automatically cleared on save)
- VIA flights must have at least one city in via_cities
