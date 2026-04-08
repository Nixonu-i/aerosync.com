import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "./context/AuthContext";
import { BookingRealtimeProvider } from "./context/BookingRealtimeContext";
import Navbar from "./components/Navbar";
import AdminNavbar from "./components/AdminNavbar";
import AgentNavbar from "./components/AgentNavbar";
import Login from "./pages/Login";
import Register from "./pages/Register";
import VerifyEmail from "./pages/VerifyEmail";
import ForgotPassword from "./pages/ForgotPassword";
import Flights from "./pages/Flights";
import Seats from "./pages/Seats";
import Booking from "./pages/Booking";
import Profile from "./pages/Profile";
import Dashboard from "./pages/Dashboard";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminFlights from "./pages/admin/AdminFlights";
import AdminBookings from "./pages/admin/AdminBookings";
import AdminAirports from "./pages/admin/AdminAirports";
import AdminAircraft from "./pages/admin/AdminAircraft";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminAirlines from "./pages/admin/AdminAirlines";
import AdminReports from "./pages/admin/AdminReports";
import AdminActivityLogs from "./pages/admin/AdminActivityLogs";
import AgentDashboard from "./pages/agent/AgentDashboard";
import AgentFlights from "./pages/agent/AgentFlights";
import AgentVerifyQR from "./pages/agent/AgentVerifyQR";
import AgentCreateBooking from "./pages/agent/AgentCreateBooking";
import AgentBookings from "./pages/agent/AgentBookings";
import AgentProfile from "./pages/agent/AgentProfile";

export default function App() {
  const { user, loading } = useContext(AuthContext);
  
  return (
    <div style={{
      width: "100%",
      minHeight: "100vh",
      backgroundColor: "transparent",
      overflowX: "hidden",
      position: "relative"
    }}>
      {/* Show Navbar for authenticated users only (not admin/agent as they have custom navbars) */}
      {!loading && user && !user.is_admin && user.role !== 'ADMIN' && !user.is_agent && user.role !== 'AGENT' && <Navbar />}
      
      {/* Animated golden horizon glow */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, height: "40%",
        background: "radial-gradient(ellipse 120% 100% at 50% 100%, rgba(212,175,55,0.13) 0%, rgba(212,175,55,0.05) 50%, transparent 72%)",
        animation: "goldGlow 7s ease-in-out infinite alternate",
        pointerEvents: "none",
        zIndex: 0
      }} />
      {/* Animated deep-blue nebula layers */}
      <div style={{
        position: "fixed", inset: 0,
        background: "radial-gradient(ellipse 65% 75% at 8% 55%, rgba(20,70,150,0.16) 0%, transparent 55%), radial-gradient(ellipse 55% 65% at 92% 38%, rgba(10,30,100,0.13) 0%, transparent 50%)",
        animation: "nebulaFloat 32s ease-in-out infinite",
        pointerEvents: "none",
        zIndex: 0
      }} />
      <Routes>
        {/* Default route goes to public flights page */}
        <Route path="/" element={<Flights />} />
        <Route path="/flights" element={<Flights />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="*" element={
          <PrivateContent />
        } />
      </Routes>
    </div>
  );
}

function PrivateContent() {
  const { user, loading, profileComplete } = useContext(AuthContext);
  const location = useLocation();

  if (loading) {
    return (
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        fontSize: "18px",
        color: "#6c757d"
      }}>
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

<<<<<<< HEAD
  // force onboarding: customers/agents must complete profile once
  if (!profileComplete && !user.is_admin) {
    // Redirect to appropriate profile page based on role
    const isAgentPath = location.pathname.startsWith('/agent');
    const isProfilePath = location.pathname === '/profile';
    const isAgentProfilePath = location.pathname === '/agent/profile';
    
    // Allow access to profile pages and auth endpoints
    if (isProfilePath || isAgentProfilePath) {
      // Let them stay on profile page
    } else if (isAgentPath && user.role === 'AGENT') {
      // Agent trying to access agent pages - redirect to agent profile
      return <Navigate to="/agent/profile" replace />;
    } else if (user.role === 'CUST' || !user.role) {
      // Customer trying to access customer pages - redirect to customer profile
      return <Navigate to="/profile" replace />;
=======
  // Force profile completion based on user type
  if (!profileComplete && !user.is_admin) {
    // Check if user is agent
    const isAgent = user.is_agent || user.role === 'AGENT';
    
    if (isAgent) {
      // Agent profile completion enforcement
      const isAgentProfilePath = location.pathname === '/agent/profile';
      const isAgentPath = location.pathname.startsWith('/agent');
      
      // Allow access to agent profile page
      if (!isAgentProfilePath && isAgentPath) {
        // Agent trying to access other agent pages - redirect to profile
        return <Navigate to="/agent/profile" replace />;
      }
    } else {
      // Customer profile completion enforcement
      const isProfilePath = location.pathname === '/profile';
      
      // Allow access to profile page, redirect everything else
      if (!isProfilePath) {
        return <Navigate to="/profile" replace />;
      }
>>>>>>> 9007297460809f07bfaa364ef37dd6359fbbe48b
    }
  }

  // Admin users get their own panel
  if (user.is_admin || user.role === "ADMIN") {
    return <AdminContent />;
  }

  // Agent users get the agent portal
  if (user.is_agent || user.role === "AGENT") {
    return <AgentContent />;
  }

  // Customer/users get customer pages
  return (
    <BookingRealtimeProvider>
      <div className="as-content">
        <Routes>
          {/* Customer Dashboard - separate from public flights */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/flights/:id/seats" element={<Seats />} />
          <Route path="/bookings" element={<Booking />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </BookingRealtimeProvider>
  );
}

function AdminContent() {
  return (
    <>
      <AdminNavbar />
      <div className="as-content">
        <Routes>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/flights" element={<AdminFlights />} />
          <Route path="/admin/bookings" element={<AdminBookings />} />
          <Route path="/admin/airports" element={<AdminAirports />} />
          <Route path="/admin/aircraft" element={<AdminAircraft />} />
          <Route path="/admin/airlines" element={<AdminAirlines />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/reports" element={<AdminReports />} />
          <Route path="/admin/activity-logs" element={<AdminActivityLogs />} />
          {/* Catch-all: redirect admin to dashboard */}
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </div>
    </>
  );
}

function AgentContent() {
  return (
    <>
      <AgentNavbar />
      <div className="as-content">
        <Routes>
          <Route path="/agent" element={<AgentDashboard />} />
          <Route path="/agent/flights" element={<AgentFlights />} />
          <Route path="/agent/verify" element={<AgentVerifyQR />} />
          <Route path="/agent/create-booking" element={<AgentCreateBooking />} />
          <Route path="/agent/bookings" element={<AgentBookings />} />
          <Route path="/agent/profile" element={<AgentProfile />} />
          {/* Catch-all: redirect agent to dashboard */}
          <Route path="*" element={<Navigate to="/agent" replace />} />
        </Routes>
      </div>
    </>
  );
}