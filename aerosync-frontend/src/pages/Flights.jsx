import { useEffect, useState, useRef, useContext } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/api";
import { AuthContext } from "../context/AuthContext";

const PAGE_SIZE = 10;

/* ─── Searchable dropdown ─────────────────────────────────────────────────── */
function SearchableSelect({ value, onChange, options, placeholder }) {
  const [open, setOpen]     = useState(false);
  const [query, setQuery]   = useState("");
  const ref                 = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = options.filter(o => o.toLowerCase().includes(query.toLowerCase()));

  const select = (opt) => {
    onChange(opt);
    setQuery("");
    setOpen(false);
  };

  const clear = (e) => {
    e.stopPropagation();
    onChange("");
    setQuery("");
    setOpen(false);
  };

  const inputStyle = {
    width: "100%", padding: "9px 32px 9px 10px",
    border: `1px solid ${open ? "#0b1220" : "#ced4da"}`,
    borderRadius: "4px", fontSize: "14px",
    boxSizing: "border-box", backgroundColor: "var(--surface)",
    color: value ? "#212529" : "#6c757d",
    cursor: "pointer", outline: "none",
    transition: "border-color 0.15s",
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* Trigger input */}
      <div style={{ position: "relative" }}>
        <input
          readOnly
          value={open ? query : (value || "")}
          placeholder={value ? value : placeholder}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => { setOpen(true); setQuery(""); }}
          onClick={() => { setOpen(true); setQuery(""); }}
          style={inputStyle}
        />
        {/* chevron / clear */}
        <span
          onClick={value ? clear : () => setOpen(o => !o)}
          style={{
            position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)",
            cursor: "pointer", color: "#6c757d", fontSize: "12px", userSelect: "none",
            display: "flex", alignItems: "center",
          }}
        >
          {value
            ? <svg viewBox="0 0 14 14" width="14" height="14" fill="none" stroke="#6c757d" strokeWidth="2" strokeLinecap="round"><line x1="2" y1="2" x2="12" y2="12"/><line x1="12" y1="2" x2="2" y2="12"/></svg>
            : <svg viewBox="0 0 10 6" width="10" height="6" fill="none" stroke="#6c757d" strokeWidth="1.5" strokeLinecap="round"><polyline points="1,1 5,5 9,1"/></svg>
          }
        </span>
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
          background: "var(--surface)", border: "1px solid #ced4da", borderRadius: "6px",
          boxShadow: "0 6px 20px rgba(0,0,0,0.12)", zIndex: 1000,
          maxHeight: "220px", overflow: "hidden",
          display: "flex", flexDirection: "column", flexWrap: "nowrap",
        }}>
          {/* Search box */}
          <div style={{ padding: "8px", borderBottom: "1px solid #f0f0f0" }}>
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search..."
              style={{
                width: "100%", padding: "6px 8px", border: "1px solid #ced4da",
                borderRadius: "4px", fontSize: "13px", boxSizing: "border-box",
                outline: "none",
              }}
            />
          </div>
          {/* Options list */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            <div
              onClick={() => select("")}
              style={{
                padding: "9px 12px", cursor: "pointer", fontSize: "13px",
                color: "#6c757d", fontStyle: "italic",
                backgroundColor: !value ? "#f0f4ff" : "transparent",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "#f8f9fa"}
              onMouseLeave={e => e.currentTarget.style.background = !value ? "#f0f4ff" : "transparent"}
            >
              {placeholder}
            </div>
            {filtered.length === 0 ? (
              <div style={{ padding: "9px 12px", fontSize: "13px", color: "#adb5bd" }}>No results</div>
            ) : filtered.map((opt, i) => (
              <div
                key={i}
                onClick={() => select(opt)}
                style={{
                  padding: "9px 12px", cursor: "pointer", fontSize: "13px",
                  color: "#212529",
                  backgroundColor: value === opt ? "#f0f4ff" : "transparent",
                  fontWeight: value === opt ? 600 : 400,
                }}
                onMouseEnter={e => e.currentTarget.style.background = "#f8f9fa"}
                onMouseLeave={e => e.currentTarget.style.background = value === opt ? "#f0f4ff" : "transparent"}
              >
                {opt}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Flights() {
  const navigate = useNavigate();
  const { user, loading } = useContext(AuthContext);
  const [items, setItems]         = useState([]);
  const [busy, setBusy]           = useState(true);
  const [moreBusy, setMoreBusy]   = useState(false);
  const [err, setErr]             = useState("");
  const [nextUrl, setNextUrl]     = useState(null);   // DRF "next" page URL
  const [totalCount, setTotal]    = useState(0);
  const [airlines, setAirlines]   = useState([]);
  const [cities, setCities]       = useState({
    departure_cities: [],
    arrival_cities: [],
    all_cities: []
  });

  // Force light theme for public flights page (when not authenticated)
  useEffect(() => {
    if (!user) {
      document.documentElement.setAttribute('data-theme', 'light');
      return () => {
        // Restore user preference on unmount
        const saved = localStorage.getItem('theme') || 'LIGHT';
        if (saved === 'DARK') {
          document.documentElement.setAttribute('data-theme', 'dark');
        }
      };
    }
  }, [user]);

  // Use auth context instead of localStorage check
  const isAuthenticated = !!user && !loading;

  // Filter states
  const [filters, setFilters] = useState({
    date: "",
    min_price: "",
    max_price: "",
    trip_type: "",
    max_stops: "",
    airline: "",
    from_city: "",
    to_city: ""
  });
  const [showFilters, setShowFilters] = useState(false);

  // Build query param object from filters (strips empty strings)
  const buildParams = (overrides = {}) => {
    const p = { ...filters, ...overrides };
    return Object.fromEntries(Object.entries(p).filter(([, v]) => v !== ""));
  };

  // Load first page (replaces items)
  const loadFlights = async (filterParams = {}) => {
    setBusy(true);
    setErr("");
    try {
      const res = await API.get("flights/", { params: filterParams });
      const data = res.data;
      setItems(data.results ?? data);          // graceful if pagination disabled
      setNextUrl(data.next ?? null);
      setTotal(data.count ?? (data.results ?? data).length);
    } catch (e) {
      setErr(e.normalizedMessage || "Failed to load flights");
    } finally {
      setBusy(false);
    }
  };

  // Load next page (appends to items)
  const loadMore = async () => {
    if (!nextUrl || moreBusy) return;
    setMoreBusy(true);
    try {
      const res = await API.get(nextUrl);   // nextUrl is absolute; axios handles it
      const data = res.data;
      setItems(prev => [...prev, ...(data.results ?? data)]);
      setNextUrl(data.next ?? null);
    } catch (e) {
      setErr(e.normalizedMessage || "Failed to load more flights");
    } finally {
      setMoreBusy(false);
    }
  };

  const loadAirlines = async () => {
    try {
      const res = await API.get("airlines/");   // uses dedicated airlines endpoint
      setAirlines(res.data.map(a => a.name));
    } catch (e) {
      console.error("Failed to load airlines:", e);
    }
  };

  const loadCities = async () => {
    try {
      const res = await API.get("flights/cities");
      setCities(res.data);
    } catch (e) {
      console.error("Failed to load cities:", e);
    }
  };

  useEffect(() => {
    loadFlights();
    loadAirlines();
    loadCities();
  }, []);

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const applyFilters = () => {
    loadFlights(buildParams());
  };

  const clearFilters = () => {
    const empty = { date: "", min_price: "", max_price: "", trip_type: "", max_stops: "", airline: "", from_city: "", to_city: "" };
    setFilters(empty);
    loadFlights({});
  };

  return (
    <>
      {/* Hero Header with Logo - Only show when NOT authenticated */}
      {!isAuthenticated && (
        <div style={{
          background: "linear-gradient(135deg, var(--surface) 0%, var(--background) 100%)",
          padding: "30px 20px",
          borderBottom: "2px solid var(--accent)",
          boxShadow: "0 4px 20px var(--shadow-md)"
        }}>
          <div style={{
            maxWidth: "1200px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "20px"
          }}>
          {/* Logo Section */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "15px"
          }}>
            {/* AeroSync Logo Icon */}
            <div style={{
              width: "60px",
              height: "60px",
              background: "linear-gradient(135deg, #d4af37 0%, #f4d03f 100%)",
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 15px rgba(212,175,55,0.4)",
              position: "relative",
              overflow: "hidden"
            }}>
              {/* Stylized airplane/wing design */}
              <svg viewBox="0 0 24 24" fill="white" width="36" height="36">
                <path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2 1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/>
              </svg>
              {/* Shine effect */}
              <div style={{
                position: "absolute",
                top: "-50%",
                left: "-50%",
                width: "200%",
                height: "200%",
                background: "linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.3) 50%, transparent 70%)",
                animation: "shine 3s ease-in-out infinite"
              }} />
            </div>
            
            {/* Brand Name */}
            <div>
              <h1 style={{
                fontSize: "32px",
                fontWeight: "800",
                background: "linear-gradient(135deg, #d4af37 0%, #f4d03f 50%, #d4af37 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                margin: "0",
                letterSpacing: "0.05em",
                textShadow: "0 2px 10px rgba(212,175,55,0.3)",
                lineHeight: "1.2"
              }}>
                AeroSync
              </h1>
              <p style={{
                fontSize: "13px",
                color: "var(--text-secondary)",
                margin: "4px 0 0 0",
                letterSpacing: "0.1em",
                textTransform: "uppercase"
              }}>
                Premium Air Travel
              </p>
            </div>
          </div>
          
          {/* Navigation/CTA */}
          <div style={{
            display: "flex",
            gap: "15px",
            alignItems: "center"
          }}>
            {!isAuthenticated ? (
              <>
                <button
                  onClick={() => navigate('/login')}
                  style={{
                    background: "rgba(212,175,55,0.15)",
                    border: "2px solid rgba(212,175,55,0.4)",
                    color: "#d4af37",
                    padding: "10px 24px",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: "700",
                    cursor: "pointer",
                    transition: "all 0.3s",
                    letterSpacing: "0.05em"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(212,175,55,0.25)";
                    e.currentTarget.style.borderColor = "rgba(212,175,55,0.6)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(212,175,55,0.15)";
                    e.currentTarget.style.borderColor = "rgba(212,175,55,0.4)";
                  }}
                >
                  Sign In
                </button>
                <button
                  onClick={() => navigate('/register')}
                  style={{
                    background: "linear-gradient(135deg, #d4af37 0%, #f4d03f 100%)",
                    border: "none",
                    color: "var(--text-primary)",
                    padding: "10px 24px",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: "700",
                    cursor: "pointer",
                    transition: "all 0.3s",
                    boxShadow: "0 4px 14px rgba(212,175,55,0.4)",
                    letterSpacing: "0.05em"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "linear-gradient(135deg, #c9a227 0%, #e5c545 100%)";
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 6px 20px rgba(212,175,55,0.5)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "linear-gradient(135deg, #d4af37 0%, #f4d03f 100%)";
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 4px 14px rgba(212,175,55,0.4)";
                  }}
                >
                  Register
                </button>
              </>
            ) : (
              <button
                onClick={() => navigate('/')}
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "rgba(255,255,255,0.8)",
                  padding: "10px 24px",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "all 0.3s"
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.14)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
              >
                Dashboard
              </button>
            )}
          </div>
        </div>
      </div>
      )}
      
      <style>{`
        @keyframes shine {
          0% { transform: translateX(-100%) translateY(-100%) rotate(45deg); }
          100% { transform: translateX(100%) translateY(100%) rotate(45deg); }
        }
      `}</style>
      
      <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
        {/* Filter Section - Collapsible */}
        <div style={{
          background: "var(--surface)",
          border: "2px solid #d4af37",
          borderRadius: "14px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          marginBottom: "28px",
          overflow: "hidden",
        }}>
          {/* Filter Toggle Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{
              width: "100%",
              padding: "16px 24px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(212,175,55,0.05)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#d4af37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
              </svg>
              <span style={{
                color: "var(--text-primary)",
                fontSize: "15px",
                fontWeight: "700",
                letterSpacing: "0.02em",
              }}>Filter Flights</span>
              {Object.values(filters).some(v => v !== "") && (
                <span style={{
                  background: "#d4af37",
                  color: "#0b1220",
                  padding: "2px 8px",
                  borderRadius: "10px",
                  fontSize: "11px",
                  fontWeight: "700",
                }}>Active</span>
              )}
            </div>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-secondary)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              width="20"
              height="20"
              style={{
                transition: "transform 0.3s",
                transform: showFilters ? "rotate(180deg)" : "rotate(0deg)",
              }}
            >
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {/* Filter Content - Collapsible */}
          {showFilters && (
            <div style={{
              padding: "0 24px 22px",
              borderTop: "1px solid var(--border)",
            }}>
          
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "15px",
            marginBottom: "20px"
          }}>
            {/* ── Departure Date ── */}
            <div>
              <label style={{
                display: "block",
                marginBottom: "6px",
                fontWeight: "600",
                color: "var(--text-primary)",
                fontSize: "12px",
                letterSpacing: "0.02em",
              }}>
                Departure Date
              </label>
              <input
                type="date"
                value={filters.date}
                onChange={(e) => handleFilterChange("date", e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  fontSize: "14px",
                  boxSizing: "border-box",
                  backgroundColor: "var(--surface)",
                  color: "var(--text-primary)",
                  cursor: "pointer"
                }}
              />
            </div>

            <div>
              <label style={{
                display: "block", marginBottom: "6px", fontWeight: "600",
                color: "var(--text-primary)", fontSize: "12px",
                letterSpacing: "0.02em",
              }}>
                From City
              </label>
              <SearchableSelect
                value={filters.from_city}
                onChange={(v) => handleFilterChange("from_city", v)}
                options={cities.departure_cities}
                placeholder="All Cities"
              />
            </div>
            
            <div>
              <label style={{
                display: "block", marginBottom: "6px", fontWeight: "600",
                color: "var(--text-primary)", fontSize: "12px",
                letterSpacing: "0.02em",
              }}>
                To City
              </label>
              <SearchableSelect
                value={filters.to_city}
                onChange={(v) => handleFilterChange("to_city", v)}
                options={cities.arrival_cities}
                placeholder="All Cities"
              />
            </div>
            
            <div>
              <label style={{
                display: "block", marginBottom: "6px", fontWeight: "600",
                color: "var(--text-primary)", fontSize: "12px",
                letterSpacing: "0.02em",
              }}>
                Min Price (KES)
              </label>
              <input
                type="number"
                value={filters.min_price}
                onChange={(e) => handleFilterChange("min_price", e.target.value)}
                placeholder="0"
                style={{
                  width: "100%", padding: "10px",
                  border: "1px solid var(--border)",
                  borderRadius: "6px", fontSize: "14px",
                  boxSizing: "border-box",
                  backgroundColor: "var(--surface)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
            
            <div>
              <label style={{
                display: "block", marginBottom: "6px", fontWeight: "600",
                color: "var(--text-primary)", fontSize: "12px",
                letterSpacing: "0.02em",
              }}>
                Max Price (KES)
              </label>
              <input
                type="number"
                value={filters.max_price}
                onChange={(e) => handleFilterChange("max_price", e.target.value)}
                placeholder="100000"
                style={{
                  width: "100%", padding: "10px",
                  border: "1px solid var(--border)",
                  borderRadius: "6px", fontSize: "14px",
                  boxSizing: "border-box",
                  backgroundColor: "var(--surface)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
            
            <div>
              <label style={{
                display: "block", marginBottom: "6px", fontWeight: "600",
                color: "var(--text-primary)", fontSize: "12px",
                letterSpacing: "0.02em",
              }}>
                Airline
              </label>
              <SearchableSelect
                value={filters.airline}
                onChange={(v) => handleFilterChange("airline", v)}
                options={airlines}
                placeholder="All Airlines"
              />
            </div>
            
            <div>
              <label style={{
                display: "block", marginBottom: "6px", fontWeight: "600",
                color: "var(--text-primary)", fontSize: "12px",
                letterSpacing: "0.02em",
              }}>
                Trip Type
              </label>
              <select
                value={filters.trip_type}
                onChange={(e) => handleFilterChange("trip_type", e.target.value)}
                style={{
                  width: "100%", padding: "10px",
                  border: "1px solid var(--border)",
                  borderRadius: "6px", fontSize: "14px",
                  boxSizing: "border-box",
                  backgroundColor: "var(--surface)",
                  color: "var(--text-primary)",
                }}
              >
                <option value="">All Types</option>
                <option value="ONE_WAY">One Way</option>
                <option value="ROUND_TRIP">Round Trip</option>
              </select>
            </div>
            
            <div>
              <label style={{
                display: "block", marginBottom: "6px", fontWeight: "600",
                color: "var(--text-primary)", fontSize: "12px",
                letterSpacing: "0.02em",
              }}>
                Max Stops
              </label>
              <select
                value={filters.max_stops}
                onChange={(e) => handleFilterChange("max_stops", e.target.value)}
                style={{
                  width: "100%", padding: "10px",
                  border: "1px solid var(--border)",
                  borderRadius: "6px", fontSize: "14px",
                  boxSizing: "border-box",
                  backgroundColor: "var(--surface)",
                  color: "var(--text-primary)",
                }}
              >
                <option value="">Any</option>
                <option value="0">Direct (0 stops)</option>
                <option value="1">1 stop</option>
                <option value="2">2 stops</option>
                <option value="3">3+ stops</option>
              </select>
            </div>
          </div>
          
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <button
              onClick={clearFilters}
              style={{
                background: "var(--background)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border)",
                padding: "10px 22px", borderRadius: "7px",
                fontSize: "14px", fontWeight: "600", cursor: "pointer",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "var(--background)"}
            >
              Clear Filters
            </button>
            <button
              onClick={applyFilters}
              disabled={busy}
              style={{
                background: busy ? "var(--background)" : "#d4af37",
                color: busy ? "var(--text-secondary)" : "#0b1220",
                border: "none", padding: "10px 22px", borderRadius: "7px",
                fontSize: "14px", fontWeight: "700",
                cursor: busy ? "not-allowed" : "pointer",
                boxShadow: busy ? "none" : "0 4px 14px rgba(212,175,55,0.35)",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => { if (!busy) e.currentTarget.style.background = "#c9a227"; }}
              onMouseLeave={(e) => { if (!busy) e.currentTarget.style.background = "#d4af37"; }}
            >
              {busy ? "Searching..." : "Apply Filters"}
            </button>
          </div>
          </div>
        )}
        </div>
        
        {err ? (
          <div style={{
            background: "#f8d7da",
            color: "#721c24",
            padding: "12px",
            borderRadius: "5px",
            marginBottom: "15px",
            border: "1px solid #f5c6cb",
            fontSize: "14px"
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
          }}>Loading flights...</div>
        ) : null}

        <div style={{ display: "grid", gap: "16px", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
          {items.map((f, index) => {
            const getStatusColor = (status) => {
              switch(status) {
                case 'SCHEDULED': return '#28a745';
                case 'DELAYED':   return '#ffc107';
                case 'CANCELLED': return '#dc3545';
                case 'COMPLETED': return '#6c757d';
                default:          return '#17a2b8';
              }
            };

            return (
              <div
                key={`${f.id}-${index}`}  // Combine ID with index for uniqueness
                onClick={() => {
                  if (!f.id) {
                    console.error('Flight has no ID:', f);
                    return;
                  }
                  
                  if (isAuthenticated) {
                    navigate(`/bookings?flight=${f.id}&seat=choice`);
                  } else {
                    // Redirect to login with return URL and flight ID
                    navigate('/login', { 
                      state: { 
                        from: '/flights',
                        message: 'Please login to book a flight',
                        flightId: f.id  // Store the flight they want to book
                      } 
                    });
                  }
                }}
                style={{
                  background: "var(--surface)",
                  border: "2px solid #d4af37",
                  borderRadius: "14px",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
                  padding: "20px",
                  cursor: "pointer",
                  transition: "transform 0.2s, box-shadow 0.2s, border-color 0.2s",
                  display: "flex", flexDirection: "column", gap: "14px",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.boxShadow = "0 16px 40px rgba(0,0,0,0.2)";
                  e.currentTarget.style.borderColor = "#c9a227";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,0.12)";
                  e.currentTarget.style.borderColor = "#d4af37";
                }}
              >
                {/* Route row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: "22px", fontWeight: "800", color: "#d4af37", letterSpacing: "0.04em" }}>
                    {f.departure_airport_code}
                    <span style={{ margin: "0 8px", opacity: 0.5, fontSize: "16px" }}>→</span>
                    {f.arrival_airport_code}
                  </div>
                  <span style={{
                    backgroundColor: `${getStatusColor(f.status)}22`,
                    color: getStatusColor(f.status),
                    border: `1px solid ${getStatusColor(f.status)}44`,
                    padding: "3px 10px", borderRadius: "20px",
                    fontSize: "11px", fontWeight: "700", letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}>
                    {f.status}
                  </span>
                </div>

                {/* Airport names */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "2px", textTransform: "uppercase", letterSpacing: "0.06em" }}>From</div>
                    <div style={{ fontSize: "13px", color: "var(--text-primary)", fontWeight: 600 }}>{f.departure_airport_name || f.departure_airport_code}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 500 }}>{f.departure_airport_city}</div>
                  </div>
                  <div style={{ color: "rgba(212,175,55,0.4)", paddingTop: "14px" }}>
                    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2 1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg>
                  </div>
                  <div style={{ flex: 1, textAlign: "right" }}>
                    <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "2px", textTransform: "uppercase", letterSpacing: "0.06em" }}>To</div>
                    <div style={{ fontSize: "13px", color: "var(--text-primary)", fontWeight: 600 }}>{f.arrival_airport_name || f.arrival_airport_code}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 500 }}>{f.arrival_airport_city}</div>
                  </div>
                </div>

                {/* Divider */}
                <div style={{ borderTop: "1px solid var(--border)" }} />

                {/* Meta row */}
                <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                  {[
                    { label: "Airline",    val: f.airline },
                    { label: "Departure",  val: new Date(f.departure_time).toLocaleString("en-US", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" }) },
                    { label: "Arrival",    val: new Date(f.arrival_time).toLocaleString("en-US", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" }) },
                    { label: "Stops",      val: f.stops === 0 ? "Direct" : `${f.stops} stop${f.stops > 1 ? "s" : ""}` },
                    { label: "Type",       val: f.trip_type === "ONE_WAY" ? "One Way" : "Round Trip" },
                  ].map(({ label, val }) => (
                    <div key={label}>
                      <div style={{ fontSize: "10px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
                      <div style={{ fontSize: "12px", color: "var(--text-primary)", fontWeight: 500, marginTop: "1px" }}>{val}</div>
                    </div>
                  ))}
                </div>

                {/* Price + CTA */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2px" }}>
                  <div>
                    <span style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>From</span>
                    <div style={{ fontSize: "22px", fontWeight: "800", color: "#d4af37", lineHeight: 1.1 }}>
                      KES {parseFloat(f.price).toLocaleString()}
                    </div>
                  </div>
                  <div style={{
                    background: "#d4af37", border: "none",
                    color: "#0b1220", padding: "8px 16px", borderRadius: "8px",
                    fontSize: "12px", fontWeight: "700", letterSpacing: "0.04em",
                  }}>
                    Book Now
                  </div>
                </div>
              </div>
            );
          })}
          {!busy && items.length === 0 ? (
            <div style={{
              gridColumn: "1 / -1",
              textAlign: "center",
              padding: "40px",
              fontSize: "18px",
              color: "#6c757d"
            }}>
              No flights available.
            </div>
          ) : null}
        </div>

        {/* Showing count + Load More */}
        {!busy && items.length > 0 && (
          <div style={{ textAlign: "center", marginTop: "28px", marginBottom: "10px" }}>
            <div style={{ color: "var(--text-primary)", fontSize: "13px", marginBottom: "14px" }}>
              Showing <strong style={{ color: "#d4af37", fontWeight: "700" }}>{items.length}</strong> of <strong style={{ color: "#d4af37", fontWeight: "700" }}>{totalCount}</strong> flight{totalCount !== 1 ? "s" : ""}
            </div>
            {nextUrl && (
              <button
                onClick={loadMore}
                disabled={moreBusy}
                style={{
                  backgroundColor: moreBusy ? "#6c757d" : "#d4af37",
                  color: moreBusy ? "white" : "#0b1220",
                  border: "none",
                  padding: "12px 40px",
                  borderRadius: "8px",
                  fontSize: "15px",
                  fontWeight: "700",
                  cursor: moreBusy ? "not-allowed" : "pointer",
                  boxShadow: moreBusy ? "none" : "0 4px 14px rgba(212,175,55,0.4)",
                  transition: "all 0.2s",
                }}
                onMouseEnter={e => { if (!moreBusy) e.currentTarget.style.backgroundColor = "#c9a227"; }}
                onMouseLeave={e => { if (!moreBusy) e.currentTarget.style.backgroundColor = "#d4af37"; }}
              >
                {moreBusy ? "Loading…" : `Load More (${totalCount - items.length} remaining)`}
              </button>
            )}
            {!nextUrl && items.length > 0 && (
              <div style={{ color: "var(--text-secondary)", fontSize: "13px", fontStyle: "italic", fontWeight: "500" }}>
                ✓ All flights loaded
              </div>
            )}
          </div>
        )}
      </div>
      

    </>
  );
}