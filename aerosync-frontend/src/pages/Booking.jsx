import { useContext, useEffect, useMemo, useState, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import API from "../api/api";
import { AuthContext } from "../context/AuthContext";
import { useBookingRealtime } from "../context/BookingRealtimeContext";
import MultiPassengerBooking from "../components/MultiPassengerBooking";
import DateOfBirthPicker from "../components/DateOfBirthPicker";
import ImprovedMultiPassengerBooking from "../components/ImprovedMultiPassengerBooking";
import PesapalPaymentModal from "../components/PesapalPaymentModal";

export default function Booking() {
  const { user } = useContext(AuthContext);
  const [searchParams] = useSearchParams();

  const flightId = searchParams.get("flight");
  const seatId = searchParams.get("seat");

  const isCreateMode = !!flightId && !!seatId;
  
  const [flight, setFlight] = useState(null);
  const [showMultiPassenger, setShowMultiPassenger] = useState(false);

  useEffect(() => {
    if (isCreateMode) {
      loadFlight();
    }
  }, [isCreateMode, flightId]);

  const loadFlight = async () => {
    if (!flightId || flightId === 'NaN' || flightId === 'undefined') {
      console.error('Invalid flight ID:', flightId);
      return;
    }
    
    try {
      const res = await API.get(`flights/${flightId}/`);
      setFlight(res.data);
    } catch (err) {
      console.error("Failed to load flight:", err);
    }
  };

  const handleBookingComplete = (bookingData) => {
    // Redirect to booking list or show success message
    window.location.href = "/bookings";
  };

  if (isCreateMode && showMultiPassenger && flight) {
    return (
      <ImprovedMultiPassengerBooking 
        flight={flight} 
        onBookingComplete={handleBookingComplete} 
      />
    );
  }

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      <h2 style={{
        color: "var(--text-primary)",
        marginBottom: "20px",
        fontSize: "32px",
        fontWeight: "700",
        textAlign: "center"
      }}>
        {isCreateMode ? "Create Booking" : "My Bookings"}
      </h2>
      
      {!user ? (
        <div style={{ 
          background: "#e2e3e5", 
          padding: "15px", 
          borderRadius: "5px", 
          marginBottom: "20px",
          border: "1px solid #d6d8db",
          color: "#383d41",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "10px"
        }}>
          <span>Please log in to access bookings.</span>
          <Link 
            to="/login" 
            style={{
              backgroundColor: "#007bff",
              color: "white",
              textDecoration: "none",
              padding: "8px 16px",
              borderRadius: "4px",
              fontSize: "14px",
              fontWeight: "600"
            }}
          >
            Login
          </Link>
        </div>
      ) : isCreateMode ? (
        flightId && flightId !== 'NaN' && flightId !== 'undefined' && flightId !== 'null' ? (
          <CreateBookingMultiPassenger flightId={flightId} />
        ) : (
          <div style={{ 
            background: "#e2e3e5", 
            padding: "15px", 
            borderRadius: "5px", 
            marginBottom: "20px",
            border: "1px solid #d6d8db",
            color: "#383d41",
            textAlign: "center"
          }}>
            Invalid flight ID. Please go back and select a flight.
          </div>
        )
      ) : (
        <MyBookings />
      )}
    </div>
  );
}

function CreateBookingMultiPassenger({ flightId }) {
  const [flight, setFlight] = useState(null);
  const [showMultiPassenger, setShowMultiPassenger] = useState(false);
  const [showSimpleBooking, setShowSimpleBooking] = useState(false);
  const [showBookingChoice, setShowBookingChoice] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadFlight();
  }, [flightId]);

  const loadFlight = async () => {
    if (!flightId || flightId === 'NaN' || flightId === 'undefined' || flightId === 'null') {
      console.error('Invalid flight ID in CreateBookingMultiPassenger:', flightId);
      setError("Invalid flight ID");
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const res = await API.get(`flights/${flightId}/`);
      setFlight(res.data);
    } catch (err) {
      setError("Failed to load flight details");
    } finally {
      setLoading(false);
    }
  };

  const handleBookingComplete = (bookingData) => {
    // Redirect to My Bookings
    window.location.href = "/bookings";
  };
  
  const downloadPass = async (bookingId, ref, passengerId = null) => {
    try {
      // Build URL with optional passenger_id query parameter
      let url = `bookings/${bookingId}/boarding_pass_png/`;
      if (passengerId) {
        url += `?passenger_id=${passengerId}`;
      }
      
      const fileName = passengerId 
        ? `boarding-pass-${ref}-passenger-${passengerId}.png`
        : `boarding-pass-${ref}.png`;
      
      const res = await API.get(url, { responseType: "blob" });
      const blobUrl = window.URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      alert(error.response?.data?.detail || "Failed to download boarding pass. Complete payment first.");
    }
  };

  if (loading) {
    return (
      <div style={{
        textAlign: "center",
        padding: "40px",
        fontSize: "18px",
        color: "#6c757d"
      }}>
        Loading flight details...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        background: "#f8d7da",
        color: "#721c24",
        padding: "15px",
        borderRadius: "5px",
        marginBottom: "20px",
        border: "1px solid #f5c6cb",
        textAlign: "center"
      }}>
        {error}
      </div>
    );
  }

  if (showMultiPassenger && flight) {
    return (
      <ImprovedMultiPassengerBooking 
        flight={flight} 
        onBookingComplete={handleBookingComplete} 
      />
    );
  }
  
  if (showSimpleBooking && flight) {
    return (
      <SimpleBookingForm 
        flight={flight}
        onBookingComplete={handleBookingComplete}
      />
    );
  }
  
  if (showBookingChoice) {
    return (
      <div style={{
        background: "var(--surface)",
        padding: "30px",
        borderRadius: "12px",
        boxShadow: "0 4px 6px -1px var(--shadow), 0 2px 4px -2px var(--shadow)",
        marginBottom: "30px",
        border: "1px solid var(--border)",
        maxWidth: "600px",
        margin: "0 auto",
        textAlign: "center"
      }}>
        <h3 style={{
          color: "var(--text-primary)",
          marginBottom: "25px",
          fontSize: "24px",
          fontWeight: "600"
        }}>
          How would you like to book?
        </h3>
        
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          alignItems: "center"
        }}>
          <button
            onClick={() => {
              setShowBookingChoice(false);
              setShowSimpleBooking(true);
            }}
            style={{
              backgroundColor: "#28a745",
              color: "white",
              border: "none",
              padding: "15px 30px",
              borderRadius: "8px",
              fontSize: "16px",
              fontWeight: "600",
              cursor: "pointer",
              width: "100%",
              maxWidth: "300px"
            }}
          >
            Book for Myself Only
          </button>
          
          <div style={{
            color: "#6c757d",
            fontSize: "14px",
            fontWeight: "500"
          }}>
            OR
          </div>
          
          <button
            onClick={() => {
              setShowBookingChoice(false);
              setShowMultiPassenger(true);
            }}
            style={{
              backgroundColor: "var(--primary)",
              color: "white",
              border: "none",
              padding: "15px 30px",
              borderRadius: "8px",
              fontSize: "16px",
              fontWeight: "600",
              cursor: "pointer",
              width: "100%",
              maxWidth: "300px"
            }}
          >
            Book for Family/Friends
          </button>
        </div>
        
        <p style={{
          color: "#6c757d",
          fontSize: "14px",
          marginTop: "25px",
          lineHeight: "1.5"
        }}>
          You can book a single ticket for yourself or multiple tickets for your family and friends.
        </p>
      </div>
    );
  }
  
  return (
    <div style={{
      background: "var(--surface)",
      padding: "30px",
      borderRadius: "10px",
      boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
      marginBottom: "30px",
      border: "1px solid var(--border)",
      maxWidth: "800px",
      margin: "0 auto"
    }}>
      <h3 style={{
        color: "var(--text-primary)",
        marginBottom: "20px",
        fontSize: "24px",
        fontWeight: "600",
        textAlign: "center"
      }}>
        Flight Details
      </h3>
      
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
        gap: "20px",
        marginBottom: "25px"
      }}>
        <div>
          <div style={{ fontSize: "14px", color: "#6c757d", marginBottom: "5px" }}>Flight ID</div>
          <div style={{ fontSize: "18px", fontWeight: "600", color: "var(--text-primary)" }}>{flightId}</div>
        </div>
        
        <div>
          <div style={{ fontSize: "14px", color: "#6c757d", marginBottom: "5px" }}>Route</div>
          <div style={{ fontSize: "18px", fontWeight: "600", color: "var(--text-primary)" }}>
            {flight?.departure_airport_code} → {flight?.arrival_airport_code}
          </div>
        </div>
        
        <div>
          <div style={{ fontSize: "14px", color: "#6c757d", marginBottom: "5px" }}>Date</div>
          <div style={{ fontSize: "18px", fontWeight: "600", color: "var(--text-primary)" }}>
            {flight ? new Date(flight.departure_time).toLocaleDateString() : "Loading..."}
          </div>
        </div>
        
        <div>
          <div style={{ fontSize: "14px", color: "#6c757d", marginBottom: "5px" }}>Price</div>
          <div style={{ fontSize: "18px", fontWeight: "600", color: "var(--text-primary)" }}>KES {flight?.price || "Loading..."}</div>
        </div>
        
        <div>
          <div style={{ fontSize: "14px", color: "#6c757d", marginBottom: "5px" }}>Airline</div>
          <div style={{ fontSize: "18px", fontWeight: "600", color: "var(--text-primary)" }}>{flight?.airline || "Loading..."}</div>
        </div>
        
        <div>
          <div style={{ fontSize: "14px", color: "#6c757d", marginBottom: "5px" }}>Stops</div>
          <div style={{ fontSize: "18px", fontWeight: "600", color: "var(--text-primary)" }}>
            {flight?.stops === 0 ? "Direct" : `${flight?.stops} stop${flight?.stops > 1 ? "s" : ""}`}
          </div>
        </div>
      </div>
      
      <div style={{
        backgroundColor: "var(--background)",
        padding: "20px",
        borderRadius: "8px",
        marginBottom: "25px",
        textAlign: "center"
      }}>
        <h4 style={{
          color: "var(--text-primary)",
          marginBottom: "15px",
          fontSize: "18px",
          fontWeight: "600"
        }}>
          Book Multiple Passengers
        </h4>
        <p style={{
          color: "#6c757d",
          marginBottom: "20px",
          fontSize: "14px",
          lineHeight: "1.5"
        }}>
          Book seats for your family members with different passenger types. 
          Enjoy discounted rates for children and kids.
        </p>
        <button
          onClick={() => setShowMultiPassenger(true)}
          style={{
            backgroundColor: "var(--primary)",
            color: "white",
            border: "none",
            padding: "12px 30px",
            borderRadius: "6px",
            fontSize: "16px",
            fontWeight: "600",
            cursor: "pointer",
            transition: "background-color 0.2s"
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = "var(--primary-dark)"}
          onMouseLeave={(e) => e.target.style.backgroundColor = "var(--primary)"}
        >
          Start Multi-Passenger Booking
        </button>
      </div>
    </div>
  );
}


function SimpleBookingForm({ flight, onBookingComplete }) {
  const { user } = useContext(AuthContext);
  
  const [passenger, setPassenger] = useState({
    full_name: "",
    date_of_birth: "",
    nationality: "",
    passenger_type: "ADULT",
    phone_area_code: "+254",
    phone_number: "",
    gender: "",
    passport_number: ""
  });

  // True once profile data is successfully fetched from the server.
  // All fields populated from the profile become permanently read-only.
  const [profileLocked, setProfileLocked] = useState(false);
  
  // Load profile data when component mounts
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await API.get("auth/profile/");
        const profileData = response.data;
                
        setPassenger(prev => ({
          ...prev,
          full_name: user.full_name || user.username || "",
          date_of_birth: profileData.date_of_birth || "",
          nationality: profileData.nationality || "",
          gender: profileData.gender || "",
          phone_area_code: profileData.phone_area_code || "+254",
          phone_number: profileData.phone_number || ""
        }));

        // Lock all profile-sourced fields once the server confirms a saved profile
        if (profileData.date_of_birth || profileData.nationality || profileData.gender) {
          setProfileLocked(true);
        }
      } catch (err) {
        setPassenger(prev => ({
          ...prev,
          full_name: user.full_name || user.username || ""
        }));
        console.error("Error loading profile:", err);
      }
    };
            
    if (user) {
      loadProfile();
    }
  }, [user]);
  
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [seats, setSeats] = useState([]);
  const [seatsLoading, setSeatsLoading] = useState(true);
  
  // Load seats for this flight
  useEffect(() => {
    const loadSeats = async () => {
      try {
        const res = await API.get(`flights/${flight.id}/seats/`);
        setSeats(res.data);
        setSeatsLoading(false);
      } catch (err) {
        setError(err.response?.data?.detail || "Failed to load seats");
        setSeatsLoading(false);
      }
    };
    
    loadSeats();
  }, [flight.id]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
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
  
  const renderAirplaneLayout = () => {
    // Group seats by row for better airplane layout
    const rows = {};
    seats.forEach(seat => {
      const row = seat.seat_number.replace(/[^0-9]/g, '');
      const letter = seat.seat_number.replace(/[0-9]/g, '');
      
      if (!rows[row]) {
        rows[row] = {};
      }
      
      // Determine column based on seat letter (A,B,C,D,E,F)
      const colMap = { 'A': 0, 'B': 1, 'C': 3, 'D': 5, 'E': 6, 'F': 7 };
      rows[row][colMap[letter]] = seat;
    });
    
    return Object.entries(rows).map(([rowNumber, rowSeats]) => (
      <div key={rowNumber} style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px', flexWrap: 'nowrap' }}>
        {/* Left aisle space */}
        <div style={{ width: '40px', '@media (max-width: 768px)': { width: '30px' } }}></div>
        
        {/* Left section (A, B, C) */}
        {[0, 1, 2].map(colIndex => {
          const seat = rowSeats[colIndex];
          return seat ? (
            <button
              key={seat.seat_id}
              disabled={!seat.available}
              onClick={() => setSelectedSeat(seat)}
              style={{
                width: '45px',
                height: '45px',
                margin: '0 3px',
                borderRadius: '4px',
                border: selectedSeat?.seat_id === seat.seat_id ? "2px solid #0b1220" : seat.available ? "1px solid #28a745" : "1px solid #dc3545",
                background: seat.available ? "#fff" : "#f8f9fa",
                cursor: seat.available ? "pointer" : "not-allowed",
                opacity: seat.available ? 1 : 0.6,
                transition: "all 0.2s ease",
                boxShadow: selectedSeat?.seat_id === seat.seat_id ? "0 0 0 2px rgba(11, 18, 32, 0.25)" : "none",
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: 'bold',
                '@media (max-width: 768px)': {
                  width: '40px',
                  height: '40px',
                  margin: '0 2px',
                  fontSize: '10px'
                }
              }}
              title={seat.available
                ? `${seat.seat_class} – KES ${parseFloat(seat.seat_price).toLocaleString()}`
                : `Taken – ${seat.seat_class}`
              }
            >
              <div style={{ 
                fontWeight: 700, 
                fontSize: "14px",
                color: seat.available
                  ? (seat.seat_class === 'FIRST' ? '#7c3aed' : seat.seat_class === 'BUSINESS' ? '#0d6efd' : '#28a745')
                  : '#dc3545',
              }}>
                {seat.seat_number}
              </div>
              <div style={{ 
                fontSize: "8px", 
                color: seat.available ? '#6c757d' : '#adb5bd',
                marginTop: "1px",
              }}>
                {seat.seat_class === 'FIRST' ? 'F' : seat.seat_class === 'BUSINESS' ? 'B' : 'E'}
              </div>
            </button>
          ) : colIndex === 2 ? (
            <div key={`aisle-left-${rowNumber}`} style={{ width: '40px', backgroundColor: '#e9ecef', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#6c757d', '@media (max-width: 768px)': { width: '30px', fontSize: '10px' } }}>
              Aisle
            </div>
          ) : (
            <div key={`empty-${colIndex}-${rowNumber}`} style={{ width: '45px', margin: '0 3px', '@media (max-width: 768px)': { width: '40px', margin: '0 2px' } }}></div>
          );
        })}
        
        {/* Right section (D, E, F) */}
        {[5, 6, 7].map(colIndex => {
          const seat = rowSeats[colIndex];
          return seat ? (
            <button
              key={seat.seat_id}
              disabled={!seat.available}
              onClick={() => setSelectedSeat(seat)}
              style={{
                width: '45px',
                height: '45px',
                margin: '0 3px',
                borderRadius: '4px',
                border: selectedSeat?.seat_id === seat.seat_id ? "2px solid #0b1220" : seat.available ? "1px solid #28a745" : "1px solid #dc3545",
                background: seat.available ? "#fff" : "#f8f9fa",
                cursor: seat.available ? "pointer" : "not-allowed",
                opacity: seat.available ? 1 : 0.6,
                transition: "all 0.2s ease",
                boxShadow: selectedSeat?.seat_id === seat.seat_id ? "0 0 0 2px rgba(11, 18, 32, 0.25)" : "none",
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: 'bold',
                '@media (max-width: 768px)': {
                  width: '40px',
                  height: '40px',
                  margin: '0 2px',
                  fontSize: '10px'
                }
              }}
              title={seat.available
                ? `${seat.seat_class} – KES ${parseFloat(seat.seat_price).toLocaleString()}`
                : `Taken – ${seat.seat_class}`
              }
            >
              <div style={{ 
                fontWeight: 700, 
                fontSize: "14px",
                color: seat.available
                  ? (seat.seat_class === 'FIRST' ? '#7c3aed' : seat.seat_class === 'BUSINESS' ? '#0d6efd' : '#28a745')
                  : '#dc3545',
              }}>
                {seat.seat_number}
              </div>
              <div style={{ 
                fontSize: "8px", 
                color: seat.available ? '#6c757d' : '#adb5bd',
                marginTop: "1px",
              }}>
                {seat.seat_class === 'FIRST' ? 'F' : seat.seat_class === 'BUSINESS' ? 'B' : 'E'}
              </div>
            </button>
          ) : colIndex === 5 ? (
            <div key={`aisle-right-${rowNumber}`} style={{ width: '40px', backgroundColor: '#e9ecef', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#6c757d', '@media (max-width: 768px)': { width: '30px', fontSize: '10px' } }}>
              Aisle
            </div>
          ) : (
            <div key={`empty-${colIndex}-${rowNumber}`} style={{ width: '45px', margin: '0 3px', '@media (max-width: 768px)': { width: '40px', margin: '0 2px' } }}></div>
          );
        })}
        
        {/* Right aisle space */}
        <div style={{ width: '40px', '@media (max-width: 768px)': { width: '30px' } }}></div>
      </div>
    ));
  };

  const handlePassengerChange = (field, value) => {
    setPassenger(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  const handleSeatSelect = (seat) => {
    if (seat.available && !seat.passenger_id) {
      setSelectedSeat(seat);
    }
  };
  
  const validatePassenger = (passenger) => {
    const errors = [];
    if (!passenger.full_name.trim()) errors.push("Full name is required");
    
    // Validate name contains only letters and spaces
    if (passenger.full_name.trim() && !/^[A-Za-z\s]+$/.test(passenger.full_name.trim())) {
      errors.push("Name must contain only letters and spaces");
    }
    
    if (!passenger.date_of_birth) errors.push("Date of birth is required");
    if (!passenger.nationality) errors.push("Nationality is required");
    
    // Age validation based on passenger type
    const today = new Date();
    const birthDate = new Date(passenger.date_of_birth);
    const age = Math.floor((today - birthDate) / (365.25 * 24 * 60 * 60 * 1000));
    
    if (passenger.passenger_type === "KID" && age >= 5) {
      errors.push("Kids must be under 5 years old");
    } else if (passenger.passenger_type === "CHILD" && (age < 5 || age >= 18)) {
      errors.push("Children must be between 5 and 17 years old");
    } else if (passenger.passenger_type === "ADULT" && age < 18) {
      errors.push("Adults must be 18 years or older");
    }
    
    if (passenger.passenger_type === "ADULT" && !passenger.gender) {
      errors.push("Gender is required for adults");
    }
    
    // Additional validations based on passenger type
    if (passenger.passenger_type === "ADULT" && !passenger.passport_number) {
      errors.push("ID number is required for adults");
    }
    
    // Validate ID number format for adults
    if (passenger.passenger_type === "ADULT" && passenger.passport_number) {
      if (!/^[0-9]+$/.test(passenger.passport_number)) {
        errors.push("ID number can only contain numeric digits");
      } else if (passenger.passport_number.length < 6 || passenger.passport_number.length > 9) {
        errors.push("ID number must be between 6 and 9 digits");
      }
    }
    
    if (passenger.passenger_type !== "ADULT" && !passenger.phone_number) {
      errors.push("Phone number is required for children and kids");
    }
    
    return errors;
  };
  
  const handleSubmit = async () => {
    const passengerErrors = validatePassenger(passenger);
    if (passengerErrors.length > 0) {
      setError(passengerErrors.join(". "));
      return;
    }
    
    if (!selectedSeat) {
      setError("Please select a seat");
      return;
    }
    
    setLoading(true);
    setError("");
    
    try {
      const res = await API.post("bookings/create_booking/", {
        flight_id: flight.id,
        for_self: true,
        passengers: [{
          full_name: passenger.full_name,
          date_of_birth: passenger.date_of_birth,
          nationality: passenger.nationality,
          passenger_type: passenger.passenger_type,
          phone_area_code: passenger.phone_area_code,
          phone_number: passenger.phone_number,
          gender: passenger.gender,
          ...(passenger.passenger_type === "ADULT" && {
            passport_number: passenger.passport_number
          })
        }],
        seat_assignments: [
          { seat_id: selectedSeat.seat_id, passenger_index: 0 }
        ]
      });
      
      onBookingComplete(res.data);
    } catch (err) {
      console.error('Booking creation error:', err);
      console.error('Error response:', err.response?.data);
      console.error('Error status:', err.response?.status);
      
      // Extract detailed error messages
      const errorData = err.response?.data;
      let errorMessage = "Failed to create booking";
      
      if (errorData) {
        if (errorData.detail) {
          errorMessage = errorData.detail;
        } else if (typeof errorData === 'object') {
          // Format validation errors
          const messages = Object.entries(errorData)
            .map(([field, errors]) => `${field}: ${Array.isArray(errors) ? errors.join(', ') : errors}`)
            .join('\n');
          errorMessage = messages || errorMessage;
        }
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="light-card" style={{
      background: "var(--surface)",
      padding: "30px",
      borderRadius: "12px",
      boxShadow: "0 4px 6px -1px var(--shadow), 0 2px 4px -2px var(--shadow)",
      marginBottom: "30px",
      border: "1px solid var(--border)",
      maxWidth: "800px",
      margin: "0 auto",
      color: "var(--text-primary)"
    }}>
      <h3 style={{
        color: "var(--text-primary)",
        marginBottom: "20px",
        fontSize: "24px",
        fontWeight: "600",
        textAlign: "center"
      }}>
        Book Your Flight - {flight.airline} {flight.flight_number}
      </h3>
      
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
        gap: "20px",
        marginBottom: "25px",
        padding: "15px",
        backgroundColor: "var(--background)",
        borderRadius: "8px"
      }}>
        <div>
          <div style={{ fontSize: "14px", color: "#6c757d", marginBottom: "5px" }}>From</div>
          <div style={{ fontSize: "18px", fontWeight: "600", color: "var(--text-primary)" }}>{flight.departure_airport_code}</div>
        </div>
        
        <div>
          <div style={{ fontSize: "14px", color: "#6c757d", marginBottom: "5px" }}>To</div>
          <div style={{ fontSize: "18px", fontWeight: "600", color: "var(--text-primary)" }}>{flight.arrival_airport_code}</div>
        </div>
        
        <div>
          <div style={{ fontSize: "14px", color: "#6c757d", marginBottom: "5px" }}>Date</div>
          <div style={{ fontSize: "18px", fontWeight: "600", color: "var(--text-primary)" }}>
            {new Date(flight.departure_time).toLocaleDateString()}
          </div>
        </div>
        
        <div>
          <div style={{ fontSize: "14px", color: "#6c757d", marginBottom: "5px" }}>Price</div>
          <div style={{ fontSize: "18px", fontWeight: "600", color: "var(--text-primary)" }}>KES {flight.price}</div>
        </div>
      </div>
      
      <div style={{ marginBottom: "25px" }}>
        <h4 style={{
          color: "var(--text-primary)",
          marginBottom: "15px",
          fontSize: "20px",
          fontWeight: "600"
        }}>
          Passenger Details
        </h4>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "25px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "500", color: "#495057" }}>Full Name *</label>
            <input
              type="text"
              value={passenger.full_name}
              onChange={(e) => {
                // Convert to uppercase and only allow letters and spaces
                const inputValue = e.target.value;
                const cleanedValue = inputValue.toUpperCase().replace(/[^A-Z\s]/g, '');
                handlePassengerChange("full_name", cleanedValue);
              }}
              placeholder="JOHN DOE"
              readOnly={user && (user.full_name === passenger.full_name || user.username === passenger.full_name)}
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #ced4da",
                borderRadius: "4px",
                fontSize: "14px",
                textTransform: "uppercase",
                backgroundColor: user && (user.full_name === passenger.full_name || user.username === passenger.full_name) ? "var(--background)" : "var(--surface)",
                cursor: user && (user.full_name === passenger.full_name || user.username === passenger.full_name) ? "not-allowed" : "auto"
              }}
            />
            {user && (user.full_name === passenger.full_name || user.username === passenger.full_name) && (
              <small style={{ color: "var(--text-secondary)", fontSize: "12px" }}>
                Retrieved from your profile (cannot be edited)
              </small>
            )}
          </div>
          
          <div style={{ marginTop: "8px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "500", color: "#495057" }}>Date of Birth *</label>
            <DateOfBirthPicker
              value={passenger.date_of_birth}
              onChange={(v) => handlePassengerChange("date_of_birth", v)}
              disabled={profileLocked}
              theme="light"
            />
            {profileLocked && (
              <small style={{ color: "#6c757d", fontSize: "12px" }}>
                Retrieved from your profile (cannot be edited)
              </small>
            )}
          </div>
          
          <div>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "500", color: "#495057" }}>Nationality *</label>
            <select
              value={passenger.nationality}
              onChange={(e) => handlePassengerChange("nationality", e.target.value)}
              disabled={profileLocked}
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #ced4da",
                borderRadius: "4px",
                fontSize: "14px",
                backgroundColor: profileLocked ? "var(--background)" : "var(--surface)",
                cursor: profileLocked ? "not-allowed" : "pointer"
              }}
            >
              <option value="">Select Nationality</option>
              <option value="Kenyan">Kenyan</option>
              <option value="Tanzanian">Tanzanian</option>
              <option value="Ugandan">Ugandan</option>
              <option value="Rwandan">Rwandan</option>
              <option value="Burundian">Burundian</option>
              <option value="Ethiopian">Ethiopian</option>
              <option value="Somali">Somali</option>
              <option value="Djiboutian">Djiboutian</option>
              <option value="South African">South African</option>
              <option value="Nigerian">Nigerian</option>
              <option value="Ghanaian">Ghanaian</option>
              <option value="Egyptian">Egyptian</option>
              <option value="Moroccan">Moroccan</option>
              <option value="Tunisian">Tunisian</option>
              <option value="Algerian">Algerian</option>
              <option value="Libyan">Libyan</option>
              <option value="Sudanese">Sudanese</option>
              <option value="American">American</option>
              <option value="British">British</option>
              <option value="Canadian">Canadian</option>
              <option value="Australian">Australian</option>
              <option value="Indian">Indian</option>
              <option value="Chinese">Chinese</option>
              <option value="Japanese">Japanese</option>
            </select>
            {profileLocked && (
              <small style={{ color: "#6c757d", fontSize: "12px" }}>
                Retrieved from your profile (cannot be edited)
              </small>
            )}
          </div>
          
          <div>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "500", color: "#495057" }}>Passenger Type</label>
            <select
              value={passenger.passenger_type}
              onChange={(e) => handlePassengerChange("passenger_type", e.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #ced4da",
                borderRadius: "4px",
                fontSize: "14px"
              }}
            >
              <option value="ADULT">Adult (18+ years)</option>
              <option value="CHILD">Child (5-17 years)</option>
              <option value="KID">Kid (0-4 years)</option>
            </select>
          </div>
          
          {passenger.passenger_type === "ADULT" && (
            <>
              <div>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "500", color: "#495057" }}>Gender *</label>
                <select
                  value={passenger.gender}
                  onChange={(e) => handlePassengerChange("gender", e.target.value)}
                  disabled={profileLocked}
                  style={{
                    width: "100%",
                    padding: "10px",
                    border: "1px solid #ced4da",
                    borderRadius: "4px",
                    fontSize: "14px",
                    backgroundColor: profileLocked ? "var(--background)" : "var(--surface)",
                    cursor: profileLocked ? "not-allowed" : "pointer"
                  }}
                >
                  <option value="">Select Gender</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
                {profileLocked && (
                  <small style={{ color: "#6c757d", fontSize: "12px" }}>
                    Retrieved from your profile (cannot be edited)
                  </small>
                )}
              </div>
              
              <div>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "500", color: "#495057" }}>Passport/ID Number *</label>
                <input
                  type="text"
                  value={passenger.passport_number}
                  onChange={(e) => {
                    // Only allow numeric characters for ID number
                    const inputValue = e.target.value;
                    const cleanedValue = inputValue.replace(/[^0-9]/g, '');
                    // Limit to maximum 9 digits
                    if (cleanedValue.length <= 9) {
                      handlePassengerChange("passport_number", cleanedValue);
                    }
                  }}
                  onInput={(e) => {
                    // Real-time cleaning of input
                    const inputValue = e.target.value;
                    const cleanedValue = inputValue.replace(/[^0-9]/g, '');
                    if (inputValue !== cleanedValue) {
                      e.target.value = cleanedValue;
                      if (cleanedValue.length <= 9) {
                        handlePassengerChange("passport_number", cleanedValue);
                      }
                    }
                  }}
                  placeholder="Enter 6-9 digit ID number"
                  minLength={6}
                  maxLength={9}
                  required
                  style={{
                    width: "100%",
                    padding: "10px",
                    border: "1px solid #ced4da",
                    borderRadius: "4px",
                    fontSize: "14px"
                  }}
                />
                <small style={{ color: "#6c757d", fontSize: "12px", marginTop: "4px", display: "block" }}>
                  ID number must be between 6 and 9 digits
                </small>
              </div>
            </>
          )}
          
          <div>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "500", color: "#495057" }}>Phone Number</label>
            <div style={{ display: "flex", gap: "10px" }}>
              <select
                value={passenger.phone_area_code}
                onChange={(e) => handlePassengerChange("phone_area_code", e.target.value)}
                disabled={profileLocked}
                style={{
                  padding: "10px",
                  border: "1px solid #ced4da",
                  borderRadius: "4px",
                  fontSize: "14px",
                  minWidth: "100px",
                  backgroundColor: profileLocked ? "var(--background)" : "var(--surface)",
                  cursor: profileLocked ? "not-allowed" : "pointer"
                }}
              >
                <option value="+254">+254 (KE)</option>
                <option value="+255">+255 (TZ)</option>
                <option value="+256">+256 (UG)</option>
                <option value="+250">+250 (RW)</option>
                <option value="+257">+257 (BI)</option>
                <option value="+251">+251 (ET)</option>
                <option value="+252">+252 (SO)</option>
                <option value="+253">+253 (DJ)</option>
                <option value="+27">+27 (ZA)</option>
                <option value="+234">+234 (NG)</option>
                <option value="+233">+233 (GH)</option>
                <option value="+20">+20 (EG)</option>
              </select>
              <input
                type="tel"
                value={passenger.phone_number}
                onChange={(e) => {
                  // Only allow numbers for phone number
                  const inputValue = e.target.value;
                  const cleanedValue = inputValue.replace(/[^0-9]/g, '');
                  handlePassengerChange("phone_number", cleanedValue);
                }}
                onInput={(e) => {
                  // Real-time cleaning of input
                  const inputValue = e.target.value;
                  const cleanedValue = inputValue.replace(/[^0-9]/g, '');
                  if (inputValue !== cleanedValue) {
                    e.target.value = cleanedValue;
                    handlePassengerChange("phone_number", cleanedValue);
                  }
                }}
                placeholder="10-digit number"
                disabled={profileLocked}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "1px solid #ced4da",
                  borderRadius: "4px",
                  fontSize: "14px",
                  backgroundColor: profileLocked ? "var(--background)" : "var(--surface)",
                  cursor: profileLocked ? "not-allowed" : "auto"
                }}
              />
            </div>
            {profileLocked && (
              <small style={{ color: "#6c757d", fontSize: "12px" }}>
                Retrieved from your profile (cannot be edited)
              </small>
            )}
          </div>
        </div>
      </div>
      
      <div style={{ marginBottom: "25px" }}>
        <h4 style={{
          color: "var(--text-primary)",
          marginBottom: "15px",
          fontSize: "20px",
          fontWeight: "600"
        }}>
          Select Seat
        </h4>
        
        <div style={{ 
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "10px",
          border: "2px solid #dee2e6",
          borderRadius: "8px",
          backgroundColor: "var(--background)",
          position: "relative",
          maxWidth: "100%",
          overflowX: "auto"
        }}>
          <div style={{ marginBottom: "20px", fontWeight: "bold", fontSize: "18px", color: "var(--text-primary)" }}>Aircraft Cabin Layout</div>
          
          {/* Front of plane indicator */}
          <div style={{ 
            width: "100%", 
            textAlign: "center", 
            marginBottom: "15px",
            fontSize: "14px",
            color: "#6c757d",
            fontWeight: "600"
          }}>
            ← Front of Plane →
          </div>
          
          {/* Airplane seats layout */}
          <div style={{ overflowX: 'auto', paddingBottom: '10px' }}>
            {renderAirplaneLayout()}
          </div>
          
          {/* Back of plane indicator */}
          <div style={{ 
            width: "100%", 
            textAlign: "center", 
            marginTop: "15px",
            fontSize: "14px",
            color: "#6c757d",
            fontWeight: "600"
          }}>
            ← Back of Plane →
          </div>

          {/* Class price legend */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '18px', marginTop: '12px', flexWrap: 'wrap' }}>
            {[
              { label: 'First',    color: '#7c3aed', key: 'FIRST' },
              { label: 'Business', color: '#0d6efd', key: 'BUSINESS' },
              { label: 'Economy',  color: '#28a745', key: 'ECONOMY' },
            ].map(cls => {
              const sample = seats.find(s => s.seat_class === cls.key);
              const price = sample ? parseFloat(sample.seat_price).toLocaleString() : '–';
              return (
                <div key={cls.key} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
                  <div style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: cls.color }} />
                  <span style={{ color: '#495057', fontWeight: 600 }}>{cls.label}</span>
                  <span style={{ color: '#6c757d' }}>KES {price}</span>
                </div>
              );
            })}
          </div>
        </div>
        
        {selectedSeat && (
          <div style={{
            padding: "15px",
            backgroundColor: "#d4edda",
            color: "#155724",
            borderRadius: "4px",
            border: "1px solid #c3e6cb",
            marginBottom: "15px",
            textAlign: "center"
          }}>
            Selected Seat: <strong>{selectedSeat.seat_number}</strong>
            {' '}({selectedSeat.seat_class}){' '}—{' '}
            KES <strong>{parseFloat(selectedSeat.seat_price).toLocaleString()}</strong>
            <span style={{ fontSize: '11px', color: '#5a7a5a', marginLeft: '6px' }}>
              (base KES {parseFloat(flight.price).toLocaleString()} × {selectedSeat.price_multiplier}x)
            </span>
          </div>
        )}
      </div>
      
      {error && (
        <div style={{
          padding: "12px",
          backgroundColor: "#f8d7da",
          color: "#721c24",
          borderRadius: "4px",
          border: "1px solid #f5c6cb",
          marginBottom: "15px",
          textAlign: "center"
        }}>
          {error}
        </div>
      )}
      
      <div style={{ textAlign: "center", marginTop: "20px" }}>
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            backgroundColor: loading ? "var(--text-secondary)" : "var(--primary)",
            color: "white",
            border: "none",
            padding: "12px 30px",
            borderRadius: "6px",
            fontSize: "16px",
            fontWeight: "600",
            cursor: loading ? "not-allowed" : "pointer",
            transition: "background-color 0.2s"
          }}
          onMouseEnter={(e) => !loading && (e.target.style.backgroundColor = "var(--primary-dark)")}
          onMouseLeave={(e) => !loading && (e.target.style.backgroundColor = "var(--primary)")}
        >
          {loading ? "Creating Booking..." : "Create Booking"}
        </button>
      </div>
    </div>
  );
}


function MyBookings() {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState("");
  
  // WebSocket integration - only connects when this component is mounted
  const { subscribeToAll, subscribeToPaymentUpdates, isConnected, reconnect, disconnect } = useBookingRealtime();

  const load = async () => {
    setBusy(true);
    setErr("");
    try {
      const res = await API.get("bookings/");
      setItems(res.data);
    } catch (e) {
      setErr(e.normalizedMessage || "Failed to load bookings");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load();
    
    // Connect to WebSocket stream when component mounts
    console.log('📡 Connecting to WebSocket stream for MyBookings');
    reconnect();
    
    // Subscribe to real-time booking updates (silent)
    const unsubscribe = subscribeToAll((updatedBooking, changedFields) => {
      // Update the booking in our list silently by merging fields
      setItems(prevItems => {
        const index = prevItems.findIndex(b => b.id === updatedBooking.id);
        if (index === -1) return prevItems; // Not our booking
        
        const newItems = [...prevItems];
        // Merge the updated fields with existing booking data
        newItems[index] = {
          ...newItems[index],  // Keep all existing fields (flight, passengers, seats, etc.)
          ...updatedBooking,   // Override with updated fields (booking_status, etc.)
        };
        return newItems;
      });
      // No visual feedback - silent update, boarding pass button will auto-update based on status
    });
    
    // Cleanup: disconnect WebSocket when component unmounts to free backend resources
    return () => {
      console.log('🔌 Disconnecting from WebSocket stream - component unmount');
      unsubscribe();
      disconnect(); // Tell backend to close the connection
      console.log('✅ WebSocket cleanup complete');
    };
  }, []); // Empty dependency array - only run once on mount

  const downloadPass = async (bookingId, ref, passengerId = null) => {
    try {
      // Build URL with optional passenger_id query parameter
      let url = `bookings/${bookingId}/boarding_pass_png/`;
      if (passengerId) {
        url += `?passenger_id=${passengerId}`;
      }
      
      const fileName = passengerId 
        ? `boarding-pass-${ref}-passenger-${passengerId}.png`
        : `boarding-pass-${ref}.png`;
      
      const res = await API.get(url, { responseType: "blob" });
      const blobUrl = window.URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      alert(error.response?.data?.detail || "Failed to download boarding pass. Complete payment first.");
    }
  };

  return (
    <div>
      {err ? <div style={{ background: "#fee", padding: 10, border: "1px solid #f99" }}>{err}</div> : null}
      {busy ? <div>Loading...</div> : null}

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
        {items.map((b) => (
          <BookingItem key={b.id} booking={b} onDownloadPass={downloadPass} />
        ))}
        {!busy && items.length === 0 ? <div>No bookings.</div> : null}
      </div>
    </div>
  );
}

function BookingItem({ booking, onDownloadPass }) {
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [flashMessage, setFlashMessage] = useState({show: false, type: '', message: ''});
  const [showPesapalModal, setShowPesapalModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const cardRef = useRef(null);
  
  // Access real-time payment updates from context
  const { subscribeToPaymentUpdates } = useBookingRealtime();
  
  // Trigger animation when booking status changes
  useEffect(() => {
    setIsUpdating(true);
    const timer = setTimeout(() => setIsUpdating(false), 2000);
    return () => clearTimeout(timer);
  }, [booking.booking_status, booking.total_amount]);
  
  const showFlashMessage = (message, type = 'error') => {
    setFlashMessage({show: true, type, message});
    setTimeout(() => {
      setFlashMessage({show: false, type: '', message: ''});
    }, 5000);
  };
  
  const loadPaymentStatus = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await API.get(`bookings/${booking.id}/payment_status/`);
      setPaymentStatus(res.data);
    } catch (e) {
      const errorMessage = e.response?.data?.detail || e.normalizedMessage || "Failed to load payment status";
      setError(errorMessage);
      showFlashMessage(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadPaymentStatus();
    
    // Subscribe to payment updates for this booking
    const unsubscribePayment = subscribeToPaymentUpdates((payment, bookingId) => {
      if (bookingId === booking.id) {
        // Reload payment status when payment changes
        loadPaymentStatus();
      }
    });
    
    return () => unsubscribePayment();
  }, []); // Empty dependency array - only run once on mount

  return (
    <div ref={cardRef} style={{
      ...styles.bookingCard,
      animation: isUpdating ? 'cardHighlight 2s ease-out' : 'none',
      transition: 'all 0.3s ease'
    }}>
      {/* Status Badge */}
      <div style={{
        ...styles.statusBadge,
        backgroundColor: booking.booking_status === 'CONFIRMED' ? '#d4edda' : 
                         booking.booking_status === 'PENDING' ? '#fff3cd' : '#f8d7da',
        color: booking.booking_status === 'CONFIRMED' ? '#155724' : 
               booking.booking_status === 'PENDING' ? '#856404' : '#721c24'
      }}>
        {booking.booking_status}
      </div>

      {/* Card Header */}
      <div style={styles.cardHeader}>
        <div style={styles.confirmationCode}>{booking.confirmation_code}</div>
        <div style={styles.airline}>{booking.flight_name || booking.airline}</div>
      </div>

      {/* Route */}
      <div style={styles.routeSection}>
        <div style={styles.route}>{booking.route}</div>
        <div style={styles.date}>
          {booking.flight_date ? new Date(booking.flight_date).toLocaleDateString('en-US', { 
            weekday: 'short', 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
          }) : 'Date not available'}
        </div>
      </div>

      {/* Seats & Amount */}
      <div style={styles.detailsRow}>
        <div style={styles.detailItem}>
          <div style={styles.detailLabel}>Seats</div>
          <div style={styles.detailValue}>
            {booking.seat_numbers && booking.seat_numbers.length > 0 
              ? booking.seat_numbers.join(', ') 
              : booking.passengers && booking.passengers.length > 0
                ? booking.passengers.map(p => p.seat_number).filter(Boolean).join(', ')
                : 'Not assigned'}
          </div>
        </div>
        <div style={styles.detailItem}>
          <div style={styles.detailLabel}>Amount</div>
          <div style={styles.detailValue}>KES {booking.total_amount?.toLocaleString()}</div>
        </div>
      </div>

      {/* Flash Message */}
      {flashMessage.show && (
        <div style={{
          padding: '8px',
          borderRadius: '4px',
          marginBottom: '8px',
          backgroundColor: flashMessage.type === 'success' ? '#d4edda' : '#f8d7da',
          color: flashMessage.type === 'success' ? '#155724' : '#721c24',
          border: `1px solid ${flashMessage.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`,
          fontWeight: '500',
          fontSize: '12px'
        }}>
          {flashMessage.message}
        </div>
      )}
      
      {error && <div style={{ background: "#fee", padding: 10, border: "1px solid #f99", margin: "10px 0", fontSize: 12 }}>{error}</div>}
      
      {paymentStatus ? (
        <div style={{ marginTop: 10 }}>
          {paymentStatus.latest_payment && (
            <div style={{ fontSize: 11, marginBottom: 5, color: '#6c757d' }}>
              Payment: <strong style={{ 
                color: paymentStatus.latest_payment.status === 'SUCCESS' ? '#28a745' : '#dc3545' 
              }}>{paymentStatus.latest_payment.status}</strong> - KES {paymentStatus.latest_payment.amount}
            </div>
          )}
                    
          {/* Show Pay Now button when payment is PENDING, FAILED, CANCELLED, or doesn't exist */}
          {(!paymentStatus.latest_payment || 
            paymentStatus.latest_payment.status === 'PENDING' || 
            paymentStatus.latest_payment.status === 'FAILED' ||
            paymentStatus.latest_payment.status === 'CANCELLED') && (
            <button 
              onClick={() => setShowPesapalModal(true)} 
              disabled={loading}
              style={styles.payButton}
            >
              {loading ? 'Processing...' : 'Pay Now'}
            </button>
          )}
                    
          {/* Calculate boarding pass availability dynamically based on current status and payment */}
          {(booking.booking_status === 'CONFIRMED' || booking.booking_status === 'ONBOARD') && 
           paymentStatus.latest_payment?.status === 'SUCCESS' && (
            <div>
              {/* Check if there are multiple passengers */}
              {booking.passengers && booking.passengers.length > 1 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {booking.passengers.map((passenger, index) => (
                    <button 
                      key={passenger.id || index}
                      onClick={() => onDownloadPass(booking.id, booking.confirmation_code, passenger.id)}
                      style={{
                        ...styles.downloadButton,
                        marginTop: index > 0 ? '0' : '12px'
                      }}
                    >
                      <img 
                        src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white' width='18' height='18'%3E%3Cpath d='M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z'/%3E%3C/svg%3E" 
                        alt="Download" 
                        style={{ width: '18px', height: '18px' }}
                      />
                      Download - {passenger.full_name} ({booking.seat_numbers?.[index] || `Seat ${index + 1}`})
                    </button>
                  ))}
                </div>
              ) : (
                // Single passenger - show one button
                <button 
                  onClick={() => onDownloadPass(booking.id, booking.confirmation_code)}
                  style={styles.downloadButton}
                >
                  <img 
                    src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white' width='18' height='18'%3E%3Cpath d='M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z'/%3E%3C/svg%3E" 
                    alt="Download" 
                    style={{ width: '18px', height: '18px' }}
                  />
                  Download Boarding Pass
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: '#6c757d' }}>Loading payment status...</div>
      )}

      {/* Pesapal Payment Modal */}
      {showPesapalModal && (
        <PesapalPaymentModal
          booking={booking}
          onClose={() => setShowPesapalModal(false)}
          onPaymentComplete={(payment) => {
            setShowPesapalModal(false);
            showFlashMessage('Payment completed successfully! 🎉', 'success');
            loadPaymentStatus();
          }}
        />
      )}
    </div>
  );
}

// Styles for the new booking card design
const styles = {
  bookingCard: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    border: '1px solid #e9ecef',
    transition: 'transform 0.2s, box-shadow 0.2s',
    ':hover': {
      transform: 'translateY(-4px)',
      boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
    }
  },
  statusBadge: {
    display: 'inline-block',
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '700',
    marginBottom: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  },
  confirmationCode: {
    fontSize: '16px',
    fontWeight: '800',
    color: '#0b1220',
    letterSpacing: '1px'
  },
  airline: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#6c757d'
  },
  routeSection: {
    marginBottom: '16px'
  },
  route: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: '4px'
  },
  date: {
    fontSize: '13px',
    color: '#6c757d',
    fontWeight: '500'
  },
  detailsRow: {
    display: 'flex',
    gap: '20px',
    marginBottom: '16px',
    flexWrap: 'wrap'
  },
  detailItem: {
    flex: '1',
    minWidth: '120px'
  },
  detailLabel: {
    fontSize: '11px',
    color: '#6c757d',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    fontWeight: '600',
    marginBottom: '4px'
  },
  detailValue: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#2c3e50'
  },
  payButton: {
    width: '100%',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    marginTop: '12px',
    transition: 'background-color 0.2s'
  },
  downloadButton: {
    width: '100%',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
    marginTop: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px'
  }
};
