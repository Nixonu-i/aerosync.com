import { useState, useEffect } from "react";
import API from "../api/api";
import DateOfBirthPicker from "./DateOfBirthPicker";

const PASSENGER_TYPES = [
  { value: "ADULT", label: "Adult (18+ years)", icon: "👤", description: "Full details required" },
  { value: "CHILD", label: "Child (5-17 years)", icon: "👦", description: "Reduced information needed" },
  { value: "KID", label: "Kid (0-4 years)", icon: "👶", description: "Minimal information needed" }
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
  { value: "+27", label: "+27 (South Africa)" },
  { value: "+234", label: "+234 (Nigeria)" },
  { value: "+233", label: "+233 (Ghana)" },
  { value: "+20", label: "+20 (Egypt)" }
];

const NATIONALITIES = [
  "Kenyan", "Tanzanian", "Ugandan", "Rwandan", "Burundian", "Ethiopian", 
  "Somali", "Djiboutian", "South African", "Nigerian", "Ghanaian", "Egyptian",
  "Moroccan", "Tunisian", "Algerian", "Libyan", "Sudanese", "American", 
  "British", "Canadian", "Australian", "Indian", "Chinese", "Japanese"
];

export default function ImprovedMultiPassengerBooking({ flight, onBookingComplete }) {
  const [currentStep, setCurrentStep] = useState(1); // 1: Passengers, 2: Seats, 3: Review
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
  const [seats, setSeats] = useState([]);
  const [seatAssignments, setSeatAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showSeatModal, setShowSeatModal] = useState(false);
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [unassignedPassengers, setUnassignedPassengers] = useState([]);
  const [classFilter, setClassFilter] = useState("ALL"); // ALL | FIRST | BUSINESS | ECONOMY

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

  // Step 1: Passenger Management
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

  // Step 2: Seat Selection
  const assignSeat = (seatId, passengerId) => {
    setSeatAssignments(prev => {
      // Remove any existing assignment for this seat
      const filtered = prev.filter(a => a.seat_id !== seatId);
      // Remove any existing assignment for this passenger
      const passengerFiltered = filtered.filter(a => a.passenger_id !== passengerId);
      // Add new assignment
      return [...passengerFiltered, { seat_id: seatId, passenger_id: passengerId }];
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

  const getPassengerSeat = (passengerId) => {
    const assignment = seatAssignments.find(a => a.passenger_id === passengerId);
    if (assignment) {
      return seats.find(s => s.seat_id === assignment.seat_id);
    }
    return null;
  };

  // Validation
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
      // Use the assigned seat's pre-computed price (flight.price × class multiplier)
      // then apply passenger-type discount on top
      const assignedSeat = getPassengerSeat(passenger.id);
      const basePrice = assignedSeat ? parseFloat(assignedSeat.seat_price) : flight.price;
      let price = basePrice;
      if (passenger.passenger_type === "KID")   price *= 0.5;
      else if (passenger.passenger_type === "CHILD") price *= 0.75;
      return total + price;
    }, 0);
  };

  // Estimated price before seats are assigned (uses base flight price only)
  const estimatePassengerPrice = (passenger) => {
    let price = flight.price;
    if (passenger.passenger_type === "KID")   price *= 0.5;
    else if (passenger.passenger_type === "CHILD") price *= 0.75;
    return price;
  };

  // Navigation
  const canProceedToSeats = () => {
    return passengers.every(p => validatePassenger(p).length === 0);
  };

  const canProceedToReview = () => {
    return seatAssignments.length === passengers.length;
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    
    try {
      const referenceNumber = `AS-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
      
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
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      <h2 style={{ 
        color: "#0b1220", 
        marginBottom: "30px", 
        textAlign: "center",
        fontSize: "32px",
        fontWeight: "700"
      }}>
        Multi-Passenger Booking
      </h2>

      {/* Progress Steps */}
      <div style={{
        display: "flex",
        justifyContent: "center",
        marginBottom: "30px",
        gap: "10px",
        backgroundColor: "white",
        padding: "16px 24px",
        borderRadius: "10px",
        boxShadow: "0 1px 6px rgba(0,0,0,0.08)",
        flexWrap: "wrap"
      }}>
        {[1, 2, 3].map(step => (
          <div key={step} style={{
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
            <div style={{
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              backgroundColor: currentStep > step ? "#28a745" : currentStep === step ? "#0b1220" : "#e9ecef",
              color: currentStep >= step ? "white" : "#6c757d",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "700",
              fontSize: "14px",
              flexShrink: 0
            }}>
              {currentStep > step ? "✓" : step}
            </div>
            <span style={{
              color: currentStep >= step ? "#0b1220" : "#adb5bd",
              fontWeight: currentStep === step ? "700" : "400",
              fontSize: "14px",
              whiteSpace: "nowrap"
            }}>
              {step === 1 ? "Passengers" : step === 2 ? "Seat Selection" : "Review & Book"}
            </span>
            {step < 3 && (
              <div style={{
                width: "40px",
                height: "2px",
                backgroundColor: currentStep > step ? "#28a745" : "#dee2e6",
                margin: "0 4px"
              }} />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div style={{
          background: "#f8d7da",
          color: "#721c24",
          padding: "12px",
          borderRadius: "5px",
          marginBottom: "15px",
          border: "1px solid #f5c6cb",
          textAlign: "center"
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
          border: "1px solid #c3e6cb",
          textAlign: "center"
        }}>
          {success}
        </div>
      )}

      {/* Step 1: Passenger Information */}
      {currentStep === 1 && (
        <div style={{
          backgroundColor: "white",
          borderRadius: "10px",
          padding: "30px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
          border: "1px solid #e0e0e0"
        }}>
          <h3 style={{ 
            color: "#0b1220", 
            marginBottom: "20px",
            fontSize: "24px",
            fontWeight: "600"
          }}>
            Passenger Information
          </h3>
          
          <div style={{ marginBottom: "20px" }}>
            <p style={{ color: "#6c757d", marginBottom: "15px" }}>
              Add all passengers who will be traveling on this flight. Each passenger type has different requirements.
            </p>
          </div>

          {passengers.map((passenger, index) => (
            <div key={passenger.id} style={{
              border: "1px solid #e0e0e0",
              borderRadius: "8px",
              padding: "20px",
              marginBottom: "20px",
              backgroundColor: "#f8f9fa"
            }}>
              <div style={{ 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center",
                marginBottom: "15px"
              }}>
                <h4 style={{ 
                  margin: 0, 
                  color: "#0b1220",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px"
                }}>
                  <span style={{ fontSize: "20px" }}>
                    {PASSENGER_TYPES.find(t => t.value === passenger.passenger_type)?.icon}
                  </span>
                  Passenger {index + 1}
                </h4>
                {passengers.length > 1 && (
                  <button
                    onClick={() => removePassenger(passenger.id)}
                    style={{
                      background: "#dc3545",
                      color: "white",
                      border: "none",
                      padding: "5px 12px",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: "600"
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>

              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", 
                gap: "15px",
                marginBottom: "15px"
              }}>
                <div>
                  <label style={{ 
                    display: "block", 
                    marginBottom: "5px", 
                    fontWeight: "600",
                    color: "#495057"
                  }}>
                    Passenger Type *
                  </label>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {PASSENGER_TYPES.map(type => (
                      <button
                        key={type.value}
                        onClick={() => updatePassenger(passenger.id, "passenger_type", type.value)}
                        style={{
                          flex: 1,
                          padding: "10px",
                          border: passenger.passenger_type === type.value 
                            ? "2px solid #0b1220" 
                            : "1px solid #ced4da",
                          borderRadius: "4px",
                          backgroundColor: passenger.passenger_type === type.value 
                            ? "#0b1220" 
                            : "white",
                          color: passenger.passenger_type === type.value 
                            ? "white" 
                            : "#495057",
                          cursor: "pointer",
                          fontWeight: "600",
                          fontSize: "12px",
                          textAlign: "center"
                        }}
                      >
                        <div style={{ fontSize: "16px", marginBottom: "3px" }}>{type.icon}</div>
                        {type.label.split(" ")[0]}
                      </button>
                    ))}
                  </div>
                  <div style={{ 
                    fontSize: "12px", 
                    color: "#6c757d", 
                    marginTop: "5px",
                    fontStyle: "italic"
                  }}>
                    {PASSENGER_TYPES.find(t => t.value === passenger.passenger_type)?.description}
                  </div>
                </div>

                <div>
                  <label style={{ 
                    display: "block", 
                    marginBottom: "5px", 
                    fontWeight: "600",
                    color: "#495057"
                  }}>
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={passenger.full_name}
                    onChange={(e) => updatePassenger(passenger.id, "full_name", e.target.value.toUpperCase())}
                    style={{
                      width: "100%",
                      padding: "10px",
                      border: "1px solid #ced4da",
                      borderRadius: "4px",
                      boxSizing: "border-box",
                      fontSize: "14px"
                    }}
                    placeholder="FULL NAME"
                  />
                </div>

                <div style={{ marginTop: "6px" }}>
                  <label style={{ 
                    display: "block", 
                    marginBottom: "8px", 
                    fontWeight: "600",
                    color: "#495057"
                  }}>
                    Date of Birth *
                  </label>
                  <DateOfBirthPicker
                    value={passenger.date_of_birth}
                    onChange={(v) => updatePassenger(passenger.id, "date_of_birth", v)}
                    theme="light"
                  />
                </div>

                <div>
                  <label style={{ 
                    display: "block", 
                    marginBottom: "5px", 
                    fontWeight: "600",
                    color: "#495057"
                  }}>
                    Nationality *
                  </label>
                  <select
                    value={passenger.nationality}
                    onChange={(e) => updatePassenger(passenger.id, "nationality", e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px",
                      border: "1px solid #ced4da",
                      borderRadius: "4px",
                      boxSizing: "border-box",
                      fontSize: "14px"
                    }}
                  >
                    <option value="">Select Nationality</option>
                    {NATIONALITIES.map(nat => (
                      <option key={nat} value={nat}>{nat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {passenger.passenger_type === "ADULT" && (
                <div style={{ 
                  display: "grid", 
                  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", 
                  gap: "15px",
                  borderTop: "1px solid #e0e0e0",
                  paddingTop: "15px",
                  marginTop: "15px"
                }}>
                  <div>
                    <label style={{ 
                      display: "block", 
                      marginBottom: "5px", 
                      fontWeight: "600",
                      color: "#495057"
                    }}>
                      Passport Number *
                    </label>
                    <input
                      type="text"
                      value={passenger.passport_number}
                      onChange={(e) => updatePassenger(passenger.id, "passport_number", e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px",
                        border: "1px solid #ced4da",
                        borderRadius: "4px",
                        boxSizing: "border-box",
                        fontSize: "14px"
                      }}
                      placeholder="Passport Number"
                    />
                  </div>

                  <div>
                    <label style={{ 
                      display: "block", 
                      marginBottom: "5px", 
                      fontWeight: "600",
                      color: "#495057"
                    }}>
                      Gender *
                    </label>
                    <select
                      value={passenger.gender}
                      onChange={(e) => updatePassenger(passenger.id, "gender", e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px",
                        border: "1px solid #ced4da",
                        borderRadius: "4px",
                        boxSizing: "border-box",
                        fontSize: "14px"
                      }}
                    >
                      <option value="">Select Gender</option>
                      {GENDERS.map(gender => (
                        <option key={gender.value} value={gender.value}>{gender.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ 
                      display: "block", 
                      marginBottom: "5px", 
                      fontWeight: "600",
                      color: "#495057"
                    }}>
                      Phone Area Code *
                    </label>
                    <select
                      value={passenger.phone_area_code}
                      onChange={(e) => updatePassenger(passenger.id, "phone_area_code", e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px",
                        border: "1px solid #ced4da",
                        borderRadius: "4px",
                        boxSizing: "border-box",
                        fontSize: "14px"
                      }}
                    >
                      <option value="">Select Area Code</option>
                      {AREA_CODES.map(code => (
                        <option key={code.value} value={code.value}>{code.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ 
                      display: "block", 
                      marginBottom: "5px", 
                      fontWeight: "600",
                      color: "#495057"
                    }}>
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      value={passenger.phone_number}
                      onChange={(e) => updatePassenger(passenger.id, "phone_number", e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px",
                        border: "1px solid #ced4da",
                        borderRadius: "4px",
                        boxSizing: "border-box",
                        fontSize: "14px"
                      }}
                      placeholder="Phone Number"
                    />
                  </div>
                </div>
              )}

              {validatePassenger(passenger).length > 0 && (
                <div style={{
                  background: "#fff3cd",
                  color: "#856404",
                  padding: "10px",
                  borderRadius: "4px",
                  marginTop: "10px",
                  fontSize: "12px"
                }}>
                  <strong>Missing information:</strong> {validatePassenger(passenger).join(", ")}
                </div>
              )}
            </div>
          ))}

          <button
            onClick={addPassenger}
            style={{
              background: "#28a745",
              color: "white",
              border: "none",
              padding: "12px 25px",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "20px"
            }}
          >
            <span>+</span> Add Another Passenger
          </button>

          <div style={{ textAlign: "center" }}>
            <button
              onClick={() => setCurrentStep(2)}
              disabled={!canProceedToSeats()}
              style={{
                background: canProceedToSeats() ? "#0b1220" : "#6c757d",
                color: "white",
                border: "none",
                padding: "12px 30px",
                borderRadius: "4px",
                cursor: canProceedToSeats() ? "pointer" : "not-allowed",
                fontSize: "16px",
                fontWeight: "600"
              }}
            >
              Continue to Seat Selection
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Seat Selection */}
      {currentStep === 2 && (() => {
        const CLASS_COLORS = { FIRST: "#7c3aed", BUSINESS: "#0d6efd", ECONOMY: "#28a745" };
        const CLASS_LABELS = { FIRST: "First", BUSINESS: "Business", ECONOMY: "Economy" };

        const filteredSeats = classFilter === "ALL" ? seats : seats.filter(s => s.seat_class === classFilter);

        // Build row-based airplane layout from filteredSeats
        const rows = {};
        filteredSeats.forEach(seat => {
          const row  = seat.seat_number.replace(/[^0-9]/g, "");
          const letter = seat.seat_number.replace(/[0-9]/g, "");
          if (!rows[row]) rows[row] = {};
          const colMap = { A: 0, B: 1, C: 3, D: 5, E: 6, F: 7 };
          const col = colMap[letter];
          if (col !== undefined) rows[row][col] = seat;
        });

        const getSeatColor = (seat) => {
          if (isSeatAssigned(seat.seat_id)) return CLASS_COLORS[seat.seat_class] || "#0b1220";
          if (!seat.available) return "#dee2e6";
          return "white";
        };
        const getSeatBorder = (seat) => {
          if (isSeatAssigned(seat.seat_id)) return CLASS_COLORS[seat.seat_class] || "#0b1220";
          if (!seat.available) return "#ced4da";
          return CLASS_COLORS[seat.seat_class] || "#6c757d";
        };
        const getSeatTextColor = (seat) => {
          if (isSeatAssigned(seat.seat_id)) return "white";
          if (!seat.available) return "#adb5bd";
          return CLASS_COLORS[seat.seat_class] || "#495057";
        };

        return (
          <div style={{
            backgroundColor: "white",
            borderRadius: "10px",
            padding: "30px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
            border: "1px solid #e0e0e0"
          }}>
            <h3 style={{ color: "#0b1220", marginBottom: "20px", fontSize: "22px", fontWeight: "600" }}>
              Seat Selection
            </h3>

            {/* Passenger assignment status bar */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: "10px",
              marginBottom: "20px"
            }}>
              {passengers.map((passenger, index) => {
                const assignedSeat = getPassengerSeat(passenger.id);
                return (
                  <div key={passenger.id} style={{
                    padding: "10px 14px",
                    border: `2px solid ${assignedSeat ? "#28a745" : "#ced4da"}`,
                    borderRadius: "8px",
                    backgroundColor: assignedSeat ? "#d4edda" : "#f8f9fa"
                  }}>
                    <div style={{ fontWeight: "600", color: "#0b1220", fontSize: "13px", marginBottom: "3px" }}>
                      {passenger.full_name || `Passenger ${index + 1}`}
                    </div>
                    <div style={{ fontSize: "11px", color: "#6c757d" }}>
                      {passenger.passenger_type}
                    </div>
                    {assignedSeat ? (
                      <div style={{ marginTop: "5px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "13px", fontWeight: "700", color: "#155724" }}>
                          {assignedSeat.seat_number} ({assignedSeat.seat_class.charAt(0)})
                        </span>
                        <button
                          onClick={() => setSeatAssignments(prev => prev.filter(a => a.passenger_id !== passenger.id))}
                          style={{ background: "#dc3545", color: "white", border: "none", padding: "2px 6px", borderRadius: "3px", fontSize: "10px", cursor: "pointer" }}
                        >×</button>
                      </div>
                    ) : (
                      <div style={{ marginTop: "5px", fontSize: "11px", color: "#856404", fontStyle: "italic" }}>No seat assigned</div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Class filter buttons */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
              {["ALL", "FIRST", "BUSINESS", "ECONOMY"].map(cls => (
                <button
                  key={cls}
                  onClick={() => setClassFilter(cls)}
                  style={{
                    padding: "6px 16px",
                    borderRadius: "20px",
                    border: `2px solid ${classFilter === cls ? (CLASS_COLORS[cls] || "#0b1220") : "#dee2e6"}`,
                    backgroundColor: classFilter === cls ? (CLASS_COLORS[cls] || "#0b1220") : "white",
                    color: classFilter === cls ? "white" : "#495057",
                    cursor: "pointer",
                    fontWeight: "600",
                    fontSize: "12px"
                  }}
                >
                  {cls === "ALL" ? "All Classes" : CLASS_LABELS[cls]}
                </button>
              ))}
            </div>

            {/* Airplane layout */}
            <div style={{
              border: "1px solid #e0e0e0",
              borderRadius: "10px",
              padding: "16px",
              backgroundColor: "#f8f9fa",
              overflowY: "auto",
              maxHeight: "420px"
            }}>
              {/* Nose */}
              <div style={{ textAlign: "center", fontSize: "13px", color: "#6c757d", fontWeight: 600, marginBottom: "10px" }}>
                ✈ Nose of Plane
              </div>

              {/* Scrollable plane wrapper so columns never wrap on small screens */}
              <div style={{ overflowX: "auto", paddingBottom: "6px" }}>
                <div style={{ minWidth: "336px" }}>
                  {/* Column headers — 18px spacer matches row-number prefix in data rows */}
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: "6px", gap: "3px" }}>
                    <div style={{ width: "16px", marginRight: "2px", flexShrink: 0 }} />
                    {["A", "B", "C", "", "D", "E", "F"].map((lbl, i) => (
                      <div key={i} style={{ width: lbl ? 44 : 36, flexShrink: 0, textAlign: "center", fontSize: "11px", color: "#6c757d", fontWeight: 600 }}>{lbl}</div>
                    ))}
                  </div>

                  {Object.entries(rows).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([rowNumber, rowSeats]) => (
                    <div key={rowNumber} style={{ display: "flex", justifyContent: "center", marginBottom: "5px", gap: "3px", alignItems: "center", flexWrap: "nowrap" }}>
                      <div style={{ width: "16px", flexShrink: 0, textAlign: "right", fontSize: "10px", color: "#adb5bd", marginRight: "2px" }}>{rowNumber}</div>
                  {[0, 1, 3, "aisle", 5, 6, 7].map((colIndex, arrIdx) => {
                    if (colIndex === "aisle") return (
                      <div key="aisle" style={{ width: 36, textAlign: "center", fontSize: "9px", color: "#adb5bd" }}>|</div>
                    );
                    const seat = rowSeats[colIndex];
                    return seat ? (
                      <button
                        key={seat.seat_id}
                        disabled={!seat.available && !isSeatAssigned(seat.seat_id)}
                        onClick={() => {
                          if (isSeatAssigned(seat.seat_id)) {
                            setSeatAssignments(prev => prev.filter(a => a.seat_id !== seat.seat_id));
                          } else if (seat.available) {
                            const unassigned = passengers.filter(p => !seatAssignments.some(a => a.passenger_id === p.id));
                            if (unassigned.length > 0) {
                              setSelectedSeat(seat);
                              setUnassignedPassengers(unassigned);
                              setShowSeatModal(true);
                            }
                          }
                        }}
                        title={isSeatAssigned(seat.seat_id)
                          ? `Assigned: ${getAssignedPassenger(seat.seat_id)?.full_name || "Passenger"}`
                          : seat.available
                          ? `${seat.seat_class} – KES ${parseFloat(seat.seat_price).toLocaleString()}`
                          : `Taken – ${seat.seat_class}`
                        }
                        style={{
                          width: 44, height: 44,
                          flexShrink: 0,
                          borderRadius: "5px",
                          border: `2px solid ${getSeatBorder(seat)}`,
                          backgroundColor: getSeatColor(seat),
                          color: getSeatTextColor(seat),
                          cursor: (seat.available || isSeatAssigned(seat.seat_id)) ? "pointer" : "not-allowed",
                          opacity: (!seat.available && !isSeatAssigned(seat.seat_id)) ? 0.45 : 1,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: 0,
                          transition: "all 0.15s ease"
                        }}
                      >
                        <div style={{ fontSize: "12px", fontWeight: 700, lineHeight: 1 }}>{seat.seat_number}</div>
                        <div style={{ fontSize: "8px", lineHeight: 1, marginTop: "2px", opacity: 0.85 }}>
                          {isSeatAssigned(seat.seat_id)
                            ? (getAssignedPassenger(seat.seat_id)?.full_name?.split(" ")[0] || "P")
                            : (seat.seat_class === "FIRST" ? "F" : seat.seat_class === "BUSINESS" ? "B" : "E")
                          }
                        </div>
                      </button>
                    ) : (
                      <div key={`empty-${colIndex}-${rowNumber}`} style={{ width: 44, height: 44, flexShrink: 0 }} />
                    );
                  })}                  
                </div>
              ))}
                </div>{/* closes minWidth wrapper */}
              </div>{/* closes overflowX auto wrapper */}
              
              {/* Back of plane */}
              <div style={{ textAlign: "center", fontSize: "13px", color: "#6c757d", fontWeight: 600, marginTop: "10px" }}>
                ← Back of Plane →
              </div>

              {/* Class price legend */}
              <div style={{ display: "flex", justifyContent: "center", gap: "16px", marginTop: "12px", flexWrap: "wrap" }}>
                {["FIRST", "BUSINESS", "ECONOMY"].map(cls => {
                  const sample = seats.find(s => s.seat_class === cls);
                  const price = sample ? parseFloat(sample.seat_price).toLocaleString() : "–";
                  return (
                    <div key={cls} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px" }}>
                      <div style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: CLASS_COLORS[cls] }} />
                      <span style={{ color: "#495057", fontWeight: 600 }}>{CLASS_LABELS[cls]}</span>
                      <span style={{ color: "#6c757d" }}>KES {price}</span>
                    </div>
                  );
                })}
                <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px" }}>
                  <div style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: "#dee2e6" }} />
                  <span style={{ color: "#6c757d" }}>Taken</span>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "20px" }}>
              <button
                onClick={() => setCurrentStep(1)}
                style={{ background: "#6c757d", color: "white", border: "none", padding: "10px 20px", borderRadius: "4px", cursor: "pointer", fontSize: "14px", fontWeight: "600" }}
              >
                ← Back to Passengers
              </button>
              <button
                onClick={() => setCurrentStep(3)}
                disabled={!canProceedToReview()}
                style={{ background: canProceedToReview() ? "#0b1220" : "#6c757d", color: "white", border: "none", padding: "10px 20px", borderRadius: "4px", cursor: canProceedToReview() ? "pointer" : "not-allowed", fontSize: "14px", fontWeight: "600" }}
              >
                Review Booking ({seatAssignments.length}/{passengers.length} seats) →
              </button>
            </div>
          </div>
        );
      })()}

      {/* Step 3: Review and Book */}
      {currentStep === 3 && (
        <div style={{
          backgroundColor: "white",
          borderRadius: "10px",
          padding: "30px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
          border: "1px solid #e0e0e0"
        }}>
          <h3 style={{ 
            color: "#0b1220", 
            marginBottom: "20px",
            fontSize: "24px",
            fontWeight: "600"
          }}>
            Review Your Booking
          </h3>

          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", 
            gap: "30px",
            marginBottom: "30px"
          }}>
            <div>
              <h4 style={{ 
                color: "#0b1220", 
                marginBottom: "15px",
                fontSize: "18px",
                fontWeight: "600"
              }}>
                Flight Details
              </h4>
              <div style={{ 
                backgroundColor: "#f8f9fa",
                padding: "15px",
                borderRadius: "8px"
              }}>
                <div style={{ marginBottom: "10px" }}>
                  <strong>Flight:</strong> {flight.departure_airport_code} → {flight.arrival_airport_code}
                </div>
                <div style={{ marginBottom: "10px" }}>
                  <strong>Date:</strong> {new Date(flight.departure_time).toLocaleDateString()}
                </div>
                <div style={{ marginBottom: "10px" }}>
                  <strong>Airline:</strong> {flight.airline}
                </div>
                <div>
                  <strong>Stops:</strong> {flight.stops === 0 ? "Direct" : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`}
                </div>
              </div>
            </div>

            <div>
              <h4 style={{ 
                color: "#0b1220", 
                marginBottom: "15px",
                fontSize: "18px",
                fontWeight: "600"
              }}>
                Passengers ({passengers.length})
              </h4>
              <div style={{ 
                maxHeight: "200px", 
                overflowY: "auto",
                border: "1px solid #e0e0e0",
                borderRadius: "8px"
              }}>
                {passengers.map((passenger, index) => {
                  const seat = getPassengerSeat(passenger.id);
                  return (
                    <div key={passenger.id} style={{
                      padding: "12px",
                      borderBottom: index < passengers.length - 1 ? "1px solid #e0e0e0" : "none",
                      backgroundColor: "#f8f9fa"
                    }}>
                      <div style={{ 
                        display: "flex", 
                        justifyContent: "space-between",
                        alignItems: "center"
                      }}>
                        <div>
                          <div style={{ 
                            fontWeight: "600", 
                            color: "#0b1220" 
                          }}>
                            {passenger.full_name || `Passenger ${index + 1}`}
                          </div>
                          <div style={{ 
                            fontSize: "12px", 
                            color: "#6c757d" 
                          }}>
                            {passenger.passenger_type} • {passenger.nationality}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: "600", color: "#0b1220" }}>
                            Seat {seat?.seat_number || "Not assigned"}
                            {seat && <span style={{ marginLeft: "5px", fontSize: "11px", color: "#6c757d" }}>({seat.seat_class})</span>}
                          </div>
                          <div style={{ fontSize: "12px", color: "#6c757d" }}>
                            {(() => {
                              const basePrice = seat ? parseFloat(seat.seat_price) : flight.price;
                              let finalPrice = basePrice;
                              if (passenger.passenger_type === "KID")   finalPrice *= 0.5;
                              else if (passenger.passenger_type === "CHILD") finalPrice *= 0.75;
                              const discount = passenger.passenger_type === "KID" ? " (50% off)" : passenger.passenger_type === "CHILD" ? " (25% off)" : "";
                              return `KES ${finalPrice.toLocaleString()}${discount}`;
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div style={{
            backgroundColor: "#f8f9fa",
            padding: "20px",
            borderRadius: "8px",
            border: "1px solid #e0e0e0"
          }}>
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center" 
            }}>
              <h4 style={{ 
                margin: 0, 
                color: "#0b1220",
                fontSize: "18px"
              }}>
                Total Price
              </h4>
              <div style={{ 
                textAlign: "right" 
              }}>
                <div style={{ 
                  fontSize: "24px", 
                  fontWeight: "700", 
                  color: "#0b1220" 
                }}>
                  KES {calculateTotalPrice().toLocaleString()}
                </div>
                <div style={{ fontSize: "12px", color: "#6c757d", marginTop: "5px" }}>
                  {passengers.map((p, i) => {
                    const assignedSeat = getPassengerSeat(p.id);
                    const basePrice = assignedSeat ? parseFloat(assignedSeat.seat_price) : flight.price;
                    let finalPrice = basePrice;
                    if (p.passenger_type === "KID")   finalPrice *= 0.5;
                    else if (p.passenger_type === "CHILD") finalPrice *= 0.75;
                    return (
                      <div key={i}>
                        {p.full_name || `Passenger ${i + 1}`}
                        {assignedSeat ? ` (${assignedSeat.seat_class})` : ""}: KES {finalPrice.toLocaleString()}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center",
            marginTop: "30px"
          }}>
            <button
              onClick={() => setCurrentStep(2)}
              style={{
                background: "#6c757d",
                color: "white",
                border: "none",
                padding: "12px 25px",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "600"
              }}
            >
              ← Back to Seats
            </button>
            
            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                background: loading ? "#6c757d" : "#0b1220",
                color: "white",
                border: "none",
                padding: "12px 30px",
                borderRadius: "4px",
                cursor: loading ? "not-allowed" : "pointer",
                fontSize: "16px",
                fontWeight: "600"
              }}
            >
              {loading ? "Processing..." : "Confirm Booking"}
            </button>
          </div>
        </div>
      )}
      
      {/* Custom Seat Selection Modal */}
      {showSeatModal && selectedSeat && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div style={{
            background: "white",
            padding: "30px",
            borderRadius: "10px",
            maxWidth: "400px",
            width: "90%",
            boxShadow: "0 10px 25px rgba(0,0,0,0.2)"
          }}>
            <h3 style={{
              color: "#0b1220",
              marginBottom: "20px",
              fontSize: "20px",
              fontWeight: "600",
              textAlign: "center"
            }}>
              Assign Seat {selectedSeat.seat_number}
            </h3>
            
            <p style={{
              color: "#6c757d",
              marginBottom: "25px",
              textAlign: "center",
              fontSize: "14px"
            }}>
              Select a passenger for this seat:
            </p>
            
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              marginBottom: "25px",
              maxHeight: "300px",
              overflowY: "auto"
            }}>
              {unassignedPassengers.map((passenger, index) => (
                <button
                  key={passenger.id}
                  onClick={() => {
                    assignSeat(selectedSeat.seat_id, passenger.id);
                    setShowSeatModal(false);
                    setSelectedSeat(null);
                    setUnassignedPassengers([]);
                  }}
                  style={{
                    background: "#f8f9fa",
                    border: "2px solid #e9ecef",
                    borderRadius: "8px",
                    padding: "15px",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px"
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = "#e9ecef";
                    e.target.style.borderColor = "#0b1220";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = "#f8f9fa";
                    e.target.style.borderColor = "#e9ecef";
                  }}
                >
                  <div style={{
                    width: "30px",
                    height: "30px",
                    borderRadius: "50%",
                    background: "#0b1220",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "14px",
                    fontWeight: "600"
                  }}>
                    {index + 1}
                  </div>
                  <div>
                    <div style={{
                      fontWeight: "600",
                      color: "#0b1220",
                      fontSize: "16px"
                    }}>
                      {passenger.full_name || `Passenger ${passengers.findIndex(p => p.id === passenger.id) + 1}`}
                    </div>
                    <div style={{
                      color: "#6c757d",
                      fontSize: "14px",
                      marginTop: "2px"
                    }}>
                      {passenger.passenger_type} {passenger.date_of_birth && `• ${new Date(passenger.date_of_birth).toLocaleDateString()}`}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            
            <div style={{
              display: "flex",
              gap: "10px",
              justifyContent: "center"
            }}>
              <button
                onClick={() => {
                  setShowSeatModal(false);
                  setSelectedSeat(null);
                  setUnassignedPassengers([]);
                }}
                style={{
                  background: "#6c757d",
                  color: "white",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500"
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}