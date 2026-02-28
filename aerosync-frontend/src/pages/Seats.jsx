import { useContext, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import API from "../api/api";
import { AuthContext } from "../context/AuthContext";

export default function Seats() {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const [searchParams, setSearchParams] = useSearchParams();

  const [seats, setSeats] = useState([]);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState("");

  const selectedSeatId = searchParams.get("seat") || "";

  useEffect(() => {
    (async () => {
      setBusy(true);
      setErr("");
      try {
        const res = await API.get(`flights/${id}/seats/`);
        setSeats(res.data);
      } catch (e) {
        setErr(e.normalizedMessage || "Failed to load seats");
      } finally {
        setBusy(false);
      }
    })();
  }, [id]);

  const chooseSeat = (seatId) => setSearchParams({ seat: String(seatId) });

  const availableSeats = useMemo(() => seats.filter((s) => s.available), [seats]);

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
              onClick={() => chooseSeat(seat.seat_id)}
              style={{
                width: '45px',
                height: '45px',
                margin: '0 3px',
                borderRadius: '4px',
                border: selectedSeatId == seat.seat_id ? "2px solid #0b1220" : seat.available ? "1px solid #28a745" : "1px solid #dc3545",
                background: seat.available ? "#fff" : "#f8f9fa",
                cursor: seat.available ? "pointer" : "not-allowed",
                opacity: seat.available ? 1 : 0.6,
                transition: "all 0.2s ease",
                boxShadow: selectedSeatId == seat.seat_id ? "0 0 0 2px rgba(11, 18, 32, 0.25)" : "none",
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
              title={seat.available ? `Available - ${seat.seat_class}` : `Taken - ${seat.seat_class}`}
            >
              <div style={{ 
                fontWeight: 700, 
                fontSize: "14px",
                color: seat.available ? "#28a745" : "#dc3545",
                '@media (max-width: 768px)': {
                  fontSize: "12px"
                }
              }}>
                {seat.seat_number}
              </div>
              <div style={{ 
                fontSize: "8px", 
                color: seat.available ? "#6c757d" : "#adb5bd",
                marginTop: "1px",
                '@media (max-width: 768px)': {
                  fontSize: "7px"
                }
              }}>
                {seat.seat_class.charAt(0)}
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
              onClick={() => chooseSeat(seat.seat_id)}
              style={{
                width: '45px',
                height: '45px',
                margin: '0 3px',
                borderRadius: '4px',
                border: selectedSeatId == seat.seat_id ? "2px solid #0b1220" : seat.available ? "1px solid #28a745" : "1px solid #dc3545",
                background: seat.available ? "#fff" : "#f8f9fa",
                cursor: seat.available ? "pointer" : "not-allowed",
                opacity: seat.available ? 1 : 0.6,
                transition: "all 0.2s ease",
                boxShadow: selectedSeatId == seat.seat_id ? "0 0 0 2px rgba(11, 18, 32, 0.25)" : "none",
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
              title={seat.available ? `Available - ${seat.seat_class}` : `Taken - ${seat.seat_class}`}
            >
              <div style={{ 
                fontWeight: 700, 
                fontSize: "14px",
                color: seat.available ? "#28a745" : "#dc3545",
                '@media (max-width: 768px)': {
                  fontSize: "12px"
                }
              }}>
                {seat.seat_number}
              </div>
              <div style={{ 
                fontSize: "8px", 
                color: seat.available ? "#6c757d" : "#adb5bd",
                marginTop: "1px",
                '@media (max-width: 768px)': {
                  fontSize: "7px"
                }
              }}>
                {seat.seat_class.charAt(0)}
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
  
  const selectedSeat = seats.find(s => s.seat_id == selectedSeatId);
  
  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto", position: 'relative' }}>
      <h2 style={{
        color: "white",
        marginBottom: "20px",
        fontSize: "32px",
        fontWeight: "700",
        textAlign: "center",
        textShadow: "0 2px 10px rgba(0,0,0,0.7)"
      }}>Select Your Seat (Flight {id})</h2>
      
      {err ? (
        <div style={{
          background: "#f8d7da",
          color: "#721c24",
          padding: "12px",
          borderRadius: "5px",
          marginBottom: "15px",
          border: "1px solid #f5c6cb",
          fontSize: "14px",
          textAlign: "center"
        }}>
          {err}
        </div>
      ) : null}
      
      {busy ? (
        <div style={{
          textAlign: "center",
          padding: "40px",
          fontSize: "18px",
          color: "#6c757d"
        }}>Loading seats...</div>
      ) : null}

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
          <span>Please log in to book a seat.</span>
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
      ) : null}

      <div style={{ 
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        marginBottom: "30px",
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
      </div>

      {/* Modal overlay */}
      {user && selectedSeatId && (
        <div style={{
          position: "fixed",
          top: "0",
          left: "0",
          width: "100%",
          height: "100%",
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: "1000"
        }}>
          <div style={{
            backgroundColor: "white",
            padding: "25px",
            borderRadius: "10px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            border: "1px solid #dee2e6",
            minWidth: "350px",
            maxWidth: "500px",
            textAlign: "center"
          }}>
            <h3 style={{ margin: "0 0 15px 0", color: "#0b1220", fontSize: "24px" }}>Confirm Your Selection</h3>
            <div style={{ fontSize: "18px", fontWeight: "600", color: "#28a745", marginBottom: "5px" }}>{selectedSeat?.seat_number} ({selectedSeat?.seat_class})</div>
            <div style={{ fontSize: "16px", color: "#6c757d", marginBottom: "20px" }}>Row {selectedSeat?.seat_number.replace(/[^0-9]/g, '')}</div>
            
            <div style={{ display: "flex", gap: "15px", justifyContent: "center" }}>
              <Link 
                to={`/bookings?flight=${id}&seat=${selectedSeatId}`}
                style={{
                  flex: 1,
                  backgroundColor: "#28a745",
                  color: "white",
                  textDecoration: "none",
                  padding: "14px",
                  borderRadius: "6px",
                  fontSize: "16px",
                  fontWeight: "600",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background-color 0.2s"
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = "#218838"}
                onMouseLeave={(e) => e.target.style.backgroundColor = "#28a745"}
              >
                Book Seat
              </Link>
              <button
                onClick={() => setSearchParams({})}
                style={{
                  flex: 1,
                  backgroundColor: "#dc3545",
                  color: "white",
                  border: "none",
                  padding: "14px",
                  borderRadius: "6px",
                  fontSize: "16px",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "background-color 0.2s"
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = "#c82333"}
                onMouseLeave={(e) => e.target.style.backgroundColor = "#dc3545"}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Available seats counter */}
      <div style={{ 
        position: "fixed",
        top: "100px",
        right: "20px",
        backgroundColor: "white",
        padding: "15px",
        borderRadius: "8px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        border: "1px solid #dee2e6",
        zIndex: "1000",
        fontSize: "14px",
        color: "#495057",
        fontWeight: "600"
      }}>
        Available seats: <span style={{ color: "#28a745" }}>{availableSeats.length}</span>
      </div>
    </div>
  );
}