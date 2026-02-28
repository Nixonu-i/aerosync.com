import { useContext, useEffect, useMemo, useState, createPortal } from "react";
import { useSearchParams, Link } from "react-router-dom";
import API from "../api/api";
import { AuthContext } from "../context/AuthContext";
import MultiPassengerBooking from "../components/MultiPassengerBooking";
import DateOfBirthPicker from "../components/DateOfBirthPicker";
import ImprovedMultiPassengerBooking from "../components/ImprovedMultiPassengerBooking";

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
        color: "white",
        marginBottom: "20px",
        fontSize: "32px",
        fontWeight: "700",
        textAlign: "center",
        textShadow: "0 2px 10px rgba(0,0,0,0.7)"
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
        <CreateBookingMultiPassenger flightId={Number(flightId)} />
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
  
  const downloadPass = async (bookingId, ref) => {
    try {
      const res = await API.get(`bookings/${bookingId}/boarding_pass_png/`, { responseType: "blob" });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `boarding-pass-${ref || bookingId}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
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
        background: "white",
        padding: "30px",
        borderRadius: "10px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
        marginBottom: "30px",
        border: "1px solid #e0e0e0",
        maxWidth: "600px",
        margin: "0 auto",
        textAlign: "center"
      }}>
        <h3 style={{
          color: "#0b1220",
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
              backgroundColor: "#0b1220",
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
      background: "white",
      padding: "30px",
      borderRadius: "10px",
      boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
      marginBottom: "30px",
      border: "1px solid #e0e0e0",
      maxWidth: "800px",
      margin: "0 auto"
    }}>
      <h3 style={{
        color: "#0b1220",
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
          <div style={{ fontSize: "18px", fontWeight: "600", color: "#0b1220" }}>{flightId}</div>
        </div>
        
        <div>
          <div style={{ fontSize: "14px", color: "#6c757d", marginBottom: "5px" }}>Route</div>
          <div style={{ fontSize: "18px", fontWeight: "600", color: "#0b1220" }}>
            {flight?.departure_airport_code} → {flight?.arrival_airport_code}
          </div>
        </div>
        
        <div>
          <div style={{ fontSize: "14px", color: "#6c757d", marginBottom: "5px" }}>Date</div>
          <div style={{ fontSize: "18px", fontWeight: "600", color: "#0b1220" }}>
            {flight ? new Date(flight.departure_time).toLocaleDateString() : "Loading..."}
          </div>
        </div>
        
        <div>
          <div style={{ fontSize: "14px", color: "#6c757d", marginBottom: "5px" }}>Price</div>
          <div style={{ fontSize: "18px", fontWeight: "600", color: "#0b1220" }}>KES {flight?.price || "Loading..."}</div>
        </div>
        
        <div>
          <div style={{ fontSize: "14px", color: "#6c757d", marginBottom: "5px" }}>Airline</div>
          <div style={{ fontSize: "18px", fontWeight: "600", color: "#0b1220" }}>{flight?.airline || "Loading..."}</div>
        </div>
        
        <div>
          <div style={{ fontSize: "14px", color: "#6c757d", marginBottom: "5px" }}>Stops</div>
          <div style={{ fontSize: "18px", fontWeight: "600", color: "#0b1220" }}>
            {flight?.stops === 0 ? "Direct" : `${flight?.stops} stop${flight?.stops > 1 ? "s" : ""}`}
          </div>
        </div>
      </div>
      
      <div style={{
        backgroundColor: "#f8f9fa",
        padding: "20px",
        borderRadius: "8px",
        marginBottom: "25px",
        textAlign: "center"
      }}>
        <h4 style={{
          color: "#0b1220",
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
            backgroundColor: "#0b1220",
            color: "white",
            border: "none",
            padding: "12px 30px",
            borderRadius: "6px",
            fontSize: "16px",
            fontWeight: "600",
            cursor: "pointer",
            transition: "background-color 0.2s"
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = "#1a2439"}
          onMouseLeave={(e) => e.target.style.backgroundColor = "#0b1220"}
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
      setError(err.response?.data?.detail || err.response?.data?.non_field_errors?.[0] || "Failed to create booking");
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="light-card" style={{
      background: "white",
      padding: "30px",
      borderRadius: "10px",
      boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
      marginBottom: "30px",
      border: "1px solid #e0e0e0",
      maxWidth: "800px",
      margin: "0 auto",
      color: "#212529"
    }}>
      <h3 style={{
        color: "#0b1220",
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
        backgroundColor: "#f8f9fa",
        borderRadius: "8px"
      }}>
        <div>
          <div style={{ fontSize: "14px", color: "#6c757d", marginBottom: "5px" }}>From</div>
          <div style={{ fontSize: "18px", fontWeight: "600", color: "#0b1220" }}>{flight.departure_airport_code}</div>
        </div>
        
        <div>
          <div style={{ fontSize: "14px", color: "#6c757d", marginBottom: "5px" }}>To</div>
          <div style={{ fontSize: "18px", fontWeight: "600", color: "#0b1220" }}>{flight.arrival_airport_code}</div>
        </div>
        
        <div>
          <div style={{ fontSize: "14px", color: "#6c757d", marginBottom: "5px" }}>Date</div>
          <div style={{ fontSize: "18px", fontWeight: "600", color: "#0b1220" }}>
            {new Date(flight.departure_time).toLocaleDateString()}
          </div>
        </div>
        
        <div>
          <div style={{ fontSize: "14px", color: "#6c757d", marginBottom: "5px" }}>Price</div>
          <div style={{ fontSize: "18px", fontWeight: "600", color: "#0b1220" }}>KES {flight.price}</div>
        </div>
      </div>
      
      <div style={{ marginBottom: "25px" }}>
        <h4 style={{
          color: "#0b1220",
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
                backgroundColor: user && (user.full_name === passenger.full_name || user.username === passenger.full_name) ? "#f8f9fa" : "white",
                cursor: user && (user.full_name === passenger.full_name || user.username === passenger.full_name) ? "not-allowed" : "auto"
              }}
            />
            {user && (user.full_name === passenger.full_name || user.username === passenger.full_name) && (
              <small style={{ color: "#6c757d", fontSize: "12px" }}>
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
                backgroundColor: profileLocked ? "#f8f9fa" : "white",
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
                    backgroundColor: profileLocked ? "#f8f9fa" : "white",
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
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "500", color: "#495057" }}>Passport/ID Number</label>
                <input
                  type="text"
                  value={passenger.passport_number}
                  onChange={(e) => {
                    // Only allow numeric characters for ID number
                    const inputValue = e.target.value;
                    const cleanedValue = inputValue.replace(/[^0-9]/g, '');
                    handlePassengerChange("passport_number", cleanedValue);
                  }}
                  onInput={(e) => {
                    // Real-time cleaning of input
                    const inputValue = e.target.value;
                    const cleanedValue = inputValue.replace(/[^0-9]/g, '');
                    if (inputValue !== cleanedValue) {
                      e.target.value = cleanedValue;
                      handlePassengerChange("passport_number", cleanedValue);
                    }
                  }}
                  placeholder="ID Number"
                  style={{
                    width: "100%",
                    padding: "10px",
                    border: "1px solid #ced4da",
                    borderRadius: "4px",
                    fontSize: "14px"
                  }}
                />
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
                  backgroundColor: profileLocked ? "#f8f9fa" : "white",
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
                  backgroundColor: profileLocked ? "#f8f9fa" : "white",
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
          color: "#0b1220",
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
          backgroundColor: "#f8f9fa",
          position: "relative",
          maxWidth: "100%",
          overflowX: "auto"
        }}>
          <div style={{ marginBottom: "20px", fontWeight: "bold", fontSize: "18px", color: "#0b1220" }}>Aircraft Cabin Layout</div>
          
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
            backgroundColor: loading ? "#6c757d" : "#0b1220",
            color: "white",
            border: "none",
            padding: "12px 30px",
            borderRadius: "6px",
            fontSize: "16px",
            fontWeight: "600",
            cursor: loading ? "not-allowed" : "pointer",
            transition: "background-color 0.2s"
          }}
          onMouseEnter={(e) => !loading && (e.target.style.backgroundColor = "#1a2439")}
          onMouseLeave={(e) => !loading && (e.target.style.backgroundColor = "#0b1220")}
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
  }, []);

  const downloadPass = async (bookingId, ref) => {
    try {
      const res = await API.get(`bookings/${bookingId}/boarding_pass_png/`, { responseType: "blob" });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `boarding-pass-${ref || bookingId}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
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
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentProviders, setPaymentProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [paymentDetails, setPaymentDetails] = useState({});
  
  const showFlashMessage = (message, type = 'error') => {
    setFlashMessage({show: true, type, message});
    setTimeout(() => {
      setFlashMessage({show: false, type: '', message: ''});
    }, 5000); // Hide after 5 seconds
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
  
  const loadPaymentProviders = async () => {
    try {
      const res = await API.get("payment-providers/");
      setPaymentProviders(res.data);
      if (res.data.length > 0) {
        setSelectedProvider(res.data[0].id);
      }
    } catch (e) {
      console.error("Failed to load payment providers", e);
      showFlashMessage("Failed to load payment providers", 'error');
    }
  };
  
  const initiatePayment = async () => {
    // Show payment modal instead of directly initiating payment
    await loadPaymentProviders();
    setShowPaymentModal(true);
  };
  
  const handlePaymentSubmit = async () => {
    if (!selectedProvider) {
      showFlashMessage("Please select a payment provider", 'error');
      return;
    }

    // Client-side validation per provider
    if (selectedProvider === 'mpesa') {
      if (!paymentDetails.phone_number?.trim()) {
        showFlashMessage("Phone number is required for M-Pesa", 'error');
        return;
      }
    } else if (selectedProvider === 'paypal') {
      const email = paymentDetails.email?.trim();
      if (!email) {
        showFlashMessage("Email is required for PayPal", 'error');
        return;
      }
      if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
        showFlashMessage("Please enter a valid email address", 'error');
        return;
      }
    } else if (selectedProvider === 'card') {
      if (!paymentDetails.card_number?.trim()) {
        showFlashMessage("Card number is required", 'error');
        return;
      }
      if (!paymentDetails.expiry_date?.trim()) {
        showFlashMessage("Card expiry date is required", 'error');
        return;
      }
      if (!paymentDetails.cvv?.trim()) {
        showFlashMessage("CVV is required", 'error');
        return;
      }
    }
    // bank transfer: no user input required
    
    setLoading(true);
    setError("");
    
    try {
      const paymentData = {
        ...paymentDetails,
        provider: selectedProvider,
        amount: booking.total_amount,
        currency: 'KES'
      };
      
      const res = await API.post(`bookings/${booking.id}/initiate_payment/`, paymentData);
      
      if (res.status === 200 || res.status === 201) {
        showFlashMessage(res.data.detail || "Payment initiated successfully!", 'success');
        setShowPaymentModal(false);
      } else {
        showFlashMessage("Unexpected response when initiating payment", 'error');
      }
      
      loadPaymentStatus();
    } catch (e) {
      const errorMessage = e.response?.data?.detail || e.response?.data?.non_field_errors?.[0] || e.normalizedMessage || "Failed to initiate payment";
      setError(errorMessage);
      showFlashMessage(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };
  
  // Load payment status on mount
  useEffect(() => {
    loadPaymentStatus();
  }, [booking.id]);
  
  // Load payment providers on mount
  useEffect(() => {
    loadPaymentProviders();
  }, []);
  
  // Determine status color
  const getStatusColor = (status) => {
    switch(status) {
      case 'CONFIRMED': return '#28a745';
      case 'PENDING': return '#ffc107';
      case 'CANCELLED': return '#dc3545';
      case 'ONBOARD': return '#20c997';
      case 'FAILED': return '#dc3545';
      default: return '#6c757d';
    }
  };
  
  return (
    <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8 }}>
      <div style={{ fontWeight: 800 }}>Ref: {booking.confirmation_code}</div>
      <div style={{ fontSize: 12, color: "#555", marginTop: 6 }}>
        Status: <span style={{ fontWeight: 'bold', color: getStatusColor(booking.status) }}>
          {booking.status}
        </span> • Flight: {booking.flight?.departure_airport_code ?? booking.flight?.id ?? '—'} → {booking.flight?.arrival_airport_code ?? ''}
      </div>
      
      {/* Flash Message Display */}
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
          <div style={{ fontSize: 11, marginBottom: 5 }}>
            Booking Status: <strong>{paymentStatus.booking_status}</strong><br />
            {paymentStatus.latest_payment && (
              <span>
                Latest Payment: <strong>{paymentStatus.latest_payment.status}</strong> - KES {paymentStatus.latest_payment.amount}<br />
              </span>
            )}
            {paymentStatus.booking_status !== 'ONBOARD' && (
              <span>
                Boarding Pass Available: <strong style={{ color: paymentStatus.boarding_pass_available ? '#28a745' : '#dc3545' }}>
                  {paymentStatus.boarding_pass_available ? 'YES' : 'NO'}
                </strong>
              </span>
            )}
          </div>
          
          {paymentStatus.booking_status === 'PENDING' && (
            <div>
              <button 
                onClick={initiatePayment} 
                disabled={loading}
                style={{
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  marginRight: '8px',
                  marginBottom: '5px'
                }}
              >
                {loading ? 'Processing...' : 'Initiate Payment'}
              </button>
              <button 
                onClick={loadPaymentStatus} 
                disabled={loading}
                style={{
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  marginRight: '8px',
                  marginBottom: '5px'
                }}
              >
                Refresh
              </button>
              <button 
                onClick={async () => {
                  if (window.confirm('Are you sure you want to cancel this booking?')) {
                    try {
                      setLoading(true);
                      const res = await API.post(`bookings/${booking.id}/cancel/`);
                      setPaymentStatus(res.data);
                      showFlashMessage('Booking cancelled successfully', 'success');
                    } catch (error) {
                      const errorMessage = error.response?.data?.detail || error.normalizedMessage || 'Failed to cancel booking';
                      setError(errorMessage);
                      showFlashMessage(errorMessage, 'error');
                    } finally {
                      setLoading(false);
                    }
                  }
                }}
                disabled={loading}
                style={{
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  marginBottom: '5px'
                }}
              >
                Cancel
              </button>
            </div>
          )}
          
          {paymentStatus.boarding_pass_available && (
            <div>
              {/* For single passenger bookings */}
              {booking.passengers && booking.passengers.length === 1 && (
                <button 
                  onClick={() => onDownloadPass(booking.id, booking.confirmation_code)}
                  style={{
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Download Boarding Pass
                </button>
              )}
              
              {/* For multi-passenger bookings - show individual download buttons */}
              {booking.passengers && booking.passengers.length > 1 && (
                <div style={{ marginTop: '5px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '600', marginBottom: '5px', color: '#0b1220' }}>
                    Individual Passes:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                    {booking.passengers.map((passenger) => (
                      <button 
                        key={passenger.id}
                        onClick={async () => {
                          try {
                            const res = await API.get(`bookings/${booking.id}/boarding_pass_png/?passenger_id=${passenger.id}`, { responseType: "blob" });
                            const url = window.URL.createObjectURL(res.data);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `boarding-pass-${booking.confirmation_code}-${passenger.full_name.replace(/\s+/g, '_')}.png`;
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                            window.URL.revokeObjectURL(url);
                          } catch (error) {
                            alert(error.response?.data?.detail || `Failed to download boarding pass for ${passenger.full_name}.`);
                          }
                        }}
                        style={{
                          backgroundColor: '#28a745',
                          color: 'white',
                          border: 'none',
                          padding: '4px 8px',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          fontSize: '11px'
                        }}
                      >
                        {passenger.full_name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 12 }}>Loading payment status...</div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div className="light-card" style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '460px',
            height: '480px',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            color: '#212529',
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)'
          }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#0b1220' }}>Payment Details</h3>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Payment Provider</label>
              <select
                value={selectedProvider}
                onChange={(e) => { setSelectedProvider(e.target.value); setPaymentDetails({}); }}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              >
                <option value="">Select Provider</option>
                {paymentProviders.map(provider => (
                  <option key={provider.id} value={provider.id}>{provider.name}</option>
                ))}
              </select>
            </div>
            
            {/* Dynamic payment form fields based on selected provider */}
            {selectedProvider ? (
              <div
                key={selectedProvider}
                className="payment-provider-content"
                style={{ flex: 1, overflowY: 'auto', marginBottom: '12px', minHeight: 0 }}
              >
                {selectedProvider === 'mpesa' && (
                  <>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>M-Pesa Phone Number</label>
                    <input
                      type="tel"
                      value={paymentDetails.phone_number || ''}
                      onChange={(e) => setPaymentDetails({...paymentDetails, phone_number: e.target.value})}
                      placeholder="e.g. 254712345678"
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #ced4da',
                        borderRadius: '4px',
                        fontSize: '14px',
                        boxSizing: 'border-box'
                      }}
                    />
                    <small style={{ color: '#6c757d' }}>Enter number in international format (254...)</small>
                  </>
                )}
                {selectedProvider === 'paypal' && (
                  <>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Email</label>
                    <input
                      type="email"
                      value={paymentDetails.email || ''}
                      onChange={(e) => setPaymentDetails({...paymentDetails, email: e.target.value})}
                      placeholder="Enter your PayPal email"
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #ced4da',
                        borderRadius: '4px',
                        fontSize: '14px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </>
                )}
                {selectedProvider === 'card' && (
                  <>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Card Number</label>
                    <input
                      type="text"
                      value={paymentDetails.card_number || ''}
                      onChange={(e) => setPaymentDetails({...paymentDetails, card_number: e.target.value})}
                      placeholder="1234 5678 9012 3456"
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #ced4da',
                        borderRadius: '4px',
                        fontSize: '14px',
                        boxSizing: 'border-box'
                      }}
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Expiry Date</label>
                        <input
                          type="text"
                          value={paymentDetails.expiry_date || ''}
                          onChange={(e) => setPaymentDetails({...paymentDetails, expiry_date: e.target.value})}
                          placeholder="MM/YY"
                          style={{
                            width: '100%',
                            padding: '10px',
                            border: '1px solid #ced4da',
                            borderRadius: '4px',
                            fontSize: '14px',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>CVV</label>
                        <input
                          type="text"
                          value={paymentDetails.cvv || ''}
                          onChange={(e) => setPaymentDetails({...paymentDetails, cvv: e.target.value})}
                          placeholder="123"
                          style={{
                            width: '100%',
                            padding: '10px',
                            border: '1px solid #ced4da',
                            borderRadius: '4px',
                            fontSize: '14px',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                    </div>
                  </>
                )}
                {selectedProvider === 'bank' && (() => {
                  const bankProvider = paymentProviders.find(p => p.id === 'bank');
                  const bd = bankProvider?.bank_details;
                  if (!bd) return <p style={{ color: '#6c757d' }}>Loading bank details...</p>;
                  const rows = [
                    ['Bank Name', bd.bank_name],
                    ['Account Name', bd.account_name],
                    ['Account Number', bd.account_number],
                    ['Routing Number', bd.routing_number],
                    ['Payment Reference', booking.confirmation_code],
                  ];
                  return (
                    <div style={{
                      backgroundColor: '#f0f4ff',
                      border: '1px solid #c7d4f0',
                      borderRadius: '8px',
                      padding: '16px'
                    }}>
                      <p style={{ margin: '0 0 12px 0', fontWeight: '600', color: '#0b1220', fontSize: '15px' }}>
                        Transfer to the following account:
                      </p>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                        <tbody>
                          {rows.map(([label, value]) => (
                            <tr key={label}>
                              <td style={{ padding: '6px 8px', color: '#6c757d', fontWeight: '500', width: '45%' }}>{label}</td>
                              <td style={{ padding: '6px 8px', color: '#0b1220', fontWeight: label === 'Payment Reference' ? '700' : '400' }}>{value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <p style={{ margin: '12px 0 0 0', fontSize: '12px', color: '#6c757d' }}>
                        Use your booking reference <strong>{booking.confirmation_code}</strong> as the payment reference. Click "Process Payment" once you have made the transfer.
                      </p>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div style={{ flex: 1 }} />
            )}
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Amount</label>
              <input
                type="text"
                value={`KES ${booking.total_amount || '0.00'}`}
                readOnly
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '14px',
                  backgroundColor: '#f8f9fa'
                }}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowPaymentModal(false)}
                style={{
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handlePaymentSubmit}
                style={{
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Process Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
