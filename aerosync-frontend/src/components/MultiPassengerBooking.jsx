import { useState, useEffect } from "react";
import API from "../api/api";
import DateOfBirthPicker from "./DateOfBirthPicker";

const PASSENGER_TYPES = [
  { value: "ADULT", label: "Adult (18+ years)" },
  { value: "CHILD", label: "Child (5-17 years)" },
  { value: "KID", label: "Kid (0-4 years)" }
];

const GENDERS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" }
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
  { value: "+261", label: "+261 (Madagascar)" },
  { value: "+262", label: "+262 (Réunion)" },
  { value: "+263", label: "+263 (Zimbabwe)" },
  { value: "+264", label: "+264 (Namibia)" },
  { value: "+265", label: "+265 (Malawi)" },
  { value: "+266", label: "+266 (Lesotho)" },
  { value: "+267", label: "+267 (Botswana)" },
  { value: "+268", label: "+268 (Eswatini)" },
  { value: "+269", label: "+269 (Comoros)" },
  { value: "+27", label: "+27 (South Africa)" }
];

const NATIONALITIES = [
  "Kenyan", "Tanzanian", "Ugandan", "Rwandan", "Burundian", "Ethiopian", 
  "Somali", "Djiboutian", "South African", "Nigerian", "Ghanaian", "Egyptian",
  "Moroccan", "Tunisian", "Algerian", "Libyan", "Sudanese", "American", 
  "British", "Canadian", "Australian", "Indian", "Chinese", "Japanese",
  // Add more nationalities as needed
];

export default function MultiPassengerBooking({ flight, onBookingComplete }) {
  const [seats, setSeats] = useState([]);
  const [passengers, setPassengers] = useState([{
    id: Date.now(),
    full_name: "",
    date_of_birth: "",
    nationality: "",
    passenger_type: "ADULT",
    phone_area_code: "",
    phone_number: "",
    gender: "",
    passport_number: ""
  }]);
  const [seatAssignments, setSeatAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadSeats();
  }, [flight.id]);

  const loadSeats = async () => {
    try {
      const res = await API.get(`flights/${flight.id}/seats/`);
      setSeats(res.data);
    } catch (err) {
      setError("Failed to load seats");
    }
  };

  const addPassenger = () => {
    setPassengers(prev => [...prev, {
      id: Date.now(),
      full_name: "",
      date_of_birth: "",
      nationality: "",
      passenger_type: "ADULT",
      phone_area_code: "",
      phone_number: "",
      gender: "",
      passport_number: ""
    }]);
  };

  const removePassenger = (id) => {
    if (passengers.length > 1) {
      setPassengers(prev => prev.filter(p => p.id !== id));
      setSeatAssignments(prev => prev.filter(a => a.passenger_id !== id));
    }
  };

  const updatePassenger = (id, field, value) => {
    setPassengers(prev => prev.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  const assignSeat = (seatId, passengerId) => {
    setSeatAssignments(prev => {
      // Remove any existing assignment for this seat
      const filtered = prev.filter(a => a.seat_id !== seatId);
      // Add new assignment
      return [...filtered, { seat_id: seatId, passenger_id: passengerId }];
    });
  };

  const isSeatAssigned = (seatId) => {
    return seatAssignments.some(a => a.seat_id === seatId);
  };

  const getAssignedPassenger = (seatId) => {
    const assignment = seatAssignments.find(a => a.seat_id === seatId);
    if (assignment) {
      return passengers.find(p => p.id === assignment.passenger_id);
    }
    return null;
  };

  const validatePassenger = (passenger) => {
    const errors = [];
    
    if (!passenger.full_name.trim()) {
      errors.push("Full name is required");
    }
    
    if (!passenger.date_of_birth) {
      errors.push("Date of birth is required");
    }
    
    if (!passenger.nationality) {
      errors.push("Nationality is required");
    }
    
    if (passenger.passenger_type === "ADULT") {
      if (!passenger.passport_number.trim()) {
        errors.push("Passport number is required for adults");
      }
      if (!passenger.phone_area_code) {
        errors.push("Phone area code is required for adults");
      }
      if (!passenger.phone_number.trim()) {
        errors.push("Phone number is required for adults");
      }
      if (!passenger.gender) {
        errors.push("Gender is required for adults");
      }
    }
    
    return errors;
  };

  const calculateTotalPrice = () => {
    return passengers.reduce((total, passenger) => {
      let price = flight.price;
      if (passenger.passenger_type === "KID") {
        price *= 0.5;
      } else if (passenger.passenger_type === "CHILD") {
        price *= 0.75;
      }
      return total + price;
    }, 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    
    // Validate all passengers
    const validationErrors = [];
    passengers.forEach((passenger, index) => {
      const errors = validatePassenger(passenger);
      if (errors.length > 0) {
        validationErrors.push(`Passenger ${index + 1}: ${errors.join(", ")}`);
      }
    });
    
    if (validationErrors.length > 0) {
      setError(validationErrors.join("; "));
      setLoading(false);
      return;
    }
    
    // Check seat assignments
    if (seatAssignments.length !== passengers.length) {
      setError("Please assign seats to all passengers");
      setLoading(false);
      return;
    }
    
    // Check for duplicate seat assignments
    const seatIds = seatAssignments.map(a => a.seat_id);
    if (new Set(seatIds).size !== seatIds.length) {
      setError("Each seat can only be assigned to one passenger");
      setLoading(false);
      return;
    }
    
    try {
      // Generate reference number
      const referenceNumber = `AS-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
      
      // Prepare data for API
      const apiData = {
        flight_id: flight.id,
        reference_number: referenceNumber,
        passengers: passengers.map(p => ({
          full_name: p.full_name,
          date_of_birth: p.date_of_birth,
          nationality: p.nationality,
          passenger_type: p.passenger_type,
          phone_area_code: p.phone_area_code,
          phone_number: p.phone_number,
          gender: p.gender,
          passport_number: p.passport_number
        })),
        seat_assignments: seatAssignments.map(a => ({
          seat_id: a.seat_id,
          passenger_index: passengers.findIndex(p => p.id === a.passenger_id)
        }))
      };
      
      const res = await API.post("bookings/create_booking/", apiData);
      setSuccess("Booking created successfully!");
      setTimeout(() => {
        onBookingComplete(res.data);
      }, 2000);
    } catch (err) {
      setError(err.normalizedMessage || "Failed to create booking");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h3 style={{ color: "#0b1220", marginBottom: "20px" }}>
        Book Flight for Multiple Passengers
      </h3>
      
      {error && (
        <div style={{
          background: "#f8d7da",
          color: "#721c24",
          padding: "12px",
          borderRadius: "5px",
          marginBottom: "15px",
          border: "1px solid #f5c6cb"
        }}>
          {error}
        </div>
      )}
      
      {success && (
        <div style={{
          background: "#d4edda",
          color: "#155724",
          padding: "12px",
          borderRadius: "5px",
          marginBottom: "15px",
          border: "1px solid #c3e6cb"
        }}>
          {success}
        </div>
      )}
      
      <div style={{ display: "flex", gap: "20px", marginBottom: "30px" }}>
        {/* Passenger Forms */}
        <div style={{ flex: 1 }}>
          <h4 style={{ marginBottom: "15px", color: "#0b1220" }}>Passengers</h4>
          {passengers.map((passenger, index) => (
            <div key={passenger.id} style={{
              border: "1px solid #e0e0e0",
              borderRadius: "8px",
              padding: "15px",
              marginBottom: "15px",
              backgroundColor: "white"
            }}>
              <div style={{ 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center",
                marginBottom: "10px"
              }}>
                <h5 style={{ margin: 0, color: "#0b1220" }}>
                  Passenger {index + 1}
                </h5>
                {passengers.length > 1 && (
                  <button
                    onClick={() => removePassenger(passenger.id)}
                    style={{
                      background: "#dc3545",
                      color: "white",
                      border: "none",
                      padding: "5px 10px",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "12px"
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "600" }}>
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={passenger.full_name}
                    onChange={(e) => updatePassenger(passenger.id, "full_name", e.target.value.toUpperCase())}
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid #ced4da",
                      borderRadius: "4px",
                      boxSizing: "border-box"
                    }}
                    placeholder="FULL NAME"
                  />
                </div>
                
                <div style={{ marginTop: "6px" }}>
                  <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>
                    Date of Birth *
                  </label>
                  <DateOfBirthPicker
                    value={passenger.date_of_birth}
                    onChange={(v) => updatePassenger(passenger.id, "date_of_birth", v)}
                    theme="light"
                  />
                </div>
                
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "600" }}>
                    Nationality *
                  </label>
                  <select
                    value={passenger.nationality}
                    onChange={(e) => updatePassenger(passenger.id, "nationality", e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid #ced4da",
                      borderRadius: "4px",
                      boxSizing: "border-box"
                    }}
                  >
                    <option value="">Select Nationality</option>
                    {NATIONALITIES.map(nat => (
                      <option key={nat} value={nat}>{nat}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "600" }}>
                    Passenger Type *
                  </label>
                  <select
                    value={passenger.passenger_type}
                    onChange={(e) => updatePassenger(passenger.id, "passenger_type", e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid #ced4da",
                      borderRadius: "4px",
                      boxSizing: "border-box"
                    }}
                  >
                    {PASSENGER_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
                
                {passenger.passenger_type === "ADULT" && (
                  <>
                    <div>
                      <label style={{ display: "block", marginBottom: "5px", fontWeight: "600" }}>
                        Passport Number *
                      </label>
                      <input
                        type="text"
                        value={passenger.passport_number}
                        onChange={(e) => updatePassenger(passenger.id, "passport_number", e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px",
                          border: "1px solid #ced4da",
                          borderRadius: "4px",
                          boxSizing: "border-box"
                        }}
                        placeholder="Passport Number"
                      />
                    </div>
                    
                    <div>
                      <label style={{ display: "block", marginBottom: "5px", fontWeight: "600" }}>
                        Gender *
                      </label>
                      <select
                        value={passenger.gender}
                        onChange={(e) => updatePassenger(passenger.id, "gender", e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px",
                          border: "1px solid #ced4da",
                          borderRadius: "4px",
                          boxSizing: "border-box"
                        }}
                      >
                        <option value="">Select Gender</option>
                        {GENDERS.map(gender => (
                          <option key={gender.value} value={gender.value}>{gender.label}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label style={{ display: "block", marginBottom: "5px", fontWeight: "600" }}>
                        Phone Area Code *
                      </label>
                      <select
                        value={passenger.phone_area_code}
                        onChange={(e) => updatePassenger(passenger.id, "phone_area_code", e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px",
                          border: "1px solid #ced4da",
                          borderRadius: "4px",
                          boxSizing: "border-box"
                        }}
                      >
                        <option value="">Select Area Code</option>
                        {AREA_CODES.map(code => (
                          <option key={code.value} value={code.value}>{code.label}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label style={{ display: "block", marginBottom: "5px", fontWeight: "600" }}>
                        Phone Number *
                      </label>
                      <input
                        type="tel"
                        value={passenger.phone_number}
                        onChange={(e) => updatePassenger(passenger.id, "phone_number", e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px",
                          border: "1px solid #ced4da",
                          borderRadius: "4px",
                          boxSizing: "border-box"
                        }}
                        placeholder="Phone Number"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
          
          <button
            onClick={addPassenger}
            style={{
              background: "#28a745",
              color: "white",
              border: "none",
              padding: "10px 20px",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600"
            }}
          >
            Add Another Passenger
          </button>
        </div>
        
        {/* Seat Selection */}
        <div style={{ flex: 1 }}>
          <h4 style={{ marginBottom: "15px", color: "#0b1220" }}>
            Select Seats ({seatAssignments.length}/{passengers.length} assigned)
          </h4>
          
          <div style={{
            border: "1px solid #e0e0e0",
            borderRadius: "8px",
            padding: "15px",
            backgroundColor: "white",
            maxHeight: "500px",
            overflowY: "auto"
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "8px" }}>
              {seats.map(seat => (
                <div
                  key={seat.seat_id}
                  onClick={() => {
                    if (seat.available && !isSeatAssigned(seat.seat_id)) {
                      // Show dropdown to select passenger
                      const passengerOptions = passengers.filter(p => 
                        !seatAssignments.some(a => a.passenger_id === p.id)
                      );
                      if (passengerOptions.length > 0) {
                        const selectedPassengerId = prompt(
                          "Select passenger for seat " + seat.seat_number + ":\n" +
                          passengerOptions.map((p, i) => `${i + 1}. ${p.full_name || `Passenger ${passengers.indexOf(p) + 1}`}`).join("\n")
                        );
                        const selectedIndex = parseInt(selectedPassengerId) - 1;
                        if (!isNaN(selectedIndex) && selectedIndex >= 0 && selectedIndex < passengerOptions.length) {
                          assignSeat(seat.seat_id, passengerOptions[selectedIndex].id);
                        }
                      }
                    } else if (isSeatAssigned(seat.seat_id)) {
                      // Remove assignment
                      setSeatAssignments(prev => prev.filter(a => a.seat_id !== seat.seat_id));
                    }
                  }}
                  style={{
                    padding: "10px",
                    border: "2px solid",
                    borderRadius: "4px",
                    textAlign: "center",
                    cursor: seat.available ? "pointer" : "not-allowed",
                    backgroundColor: isSeatAssigned(seat.seat_id) ? "#0b1220" : seat.available ? "white" : "#f8f9fa",
                    borderColor: isSeatAssigned(seat.seat_id) ? "#0b1220" : seat.available ? "#0b1220" : "#ced4da",
                    color: isSeatAssigned(seat.seat_id) ? "white" : seat.available ? "#0b1220" : "#6c757d"
                  }}
                >
                  <div style={{ fontSize: "12px", fontWeight: "600" }}>{seat.seat_number}</div>
                  <div style={{ fontSize: "10px" }}>
                    {isSeatAssigned(seat.seat_id) 
                      ? getAssignedPassenger(seat.seat_id)?.full_name?.split(" ")[0] || "Assigned" 
                      : seat.available ? "Available" : "Booked"
                    }
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* Summary and Submit */}
      <div style={{
        backgroundColor: "white",
        border: "1px solid #e0e0e0",
        borderRadius: "8px",
        padding: "20px",
        marginTop: "20px"
      }}>
        <h4 style={{ color: "#0b1220", marginBottom: "15px" }}>Booking Summary</h4>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div><strong>Flight:</strong> {flight.departure_airport_code} → {flight.arrival_airport_code}</div>
            <div><strong>Date:</strong> {new Date(flight.departure_time).toLocaleDateString()}</div>
            <div><strong>Passengers:</strong> {passengers.length}</div>
            <div><strong>Seats Assigned:</strong> {seatAssignments.length}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "18px", fontWeight: "700", color: "#0b1220" }}>
              Total: KES {calculateTotalPrice().toLocaleString()}
            </div>
            <div style={{ fontSize: "12px", color: "#6c757d", marginTop: "5px" }}>
              {passengers.map((p, i) => {
                let price = flight.price;
                if (p.passenger_type === "KID") price *= 0.5;
                else if (p.passenger_type === "CHILD") price *= 0.75;
                return (
                  <div key={i}>
                    {p.full_name || `Passenger ${i + 1}`}: KES {price.toLocaleString()}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        
        <button
          onClick={handleSubmit}
          disabled={loading || seatAssignments.length !== passengers.length}
          style={{
            width: "100%",
            background: loading || seatAssignments.length !== passengers.length ? "#6c757d" : "#0b1220",
            color: "white",
            border: "none",
            padding: "15px",
            borderRadius: "4px",
            cursor: loading || seatAssignments.length !== passengers.length ? "not-allowed" : "pointer",
            fontSize: "16px",
            fontWeight: "600",
            marginTop: "20px"
          }}
        >
          {loading ? "Processing..." : "Create Booking"}
        </button>
      </div>
    </div>
  );
}