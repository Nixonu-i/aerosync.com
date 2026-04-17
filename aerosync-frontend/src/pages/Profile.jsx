import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import API from "../api/api";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import DateOfBirthPicker from "../components/DateOfBirthPicker";
import ProtectedImage from "../components/ProtectedImage";

export default function Profile() {
  const { user, updateUserProfile } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get flight ID from login state (if user came from flights page)
  const flightId = location.state?.flightId;
  
  const [formData, setFormData] = useState({
    date_of_birth: "",
    gender: "",
    nationality: "",
    phone_area_code: "+254",
    phone_number: "",
    profile_photo: null
  });
  
  const [phoneError, setPhoneError] = useState("");
  const [isProfileComplete, setIsProfileComplete] = useState(false);
  const [isFirstTime, setIsFirstTime] = useState(false); // Track if user is logging in for the first time
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saved, setSaved] = useState(false); // tracks green "Saved" button state

  // Load user profile data when component mounts
  useEffect(() => {
    const loadProfile = async () => {
      try {
        // Fetch profile from API
        const response = await API.get("auth/profile/");
        const profileData = response.data;
        
        // Check if profile has been filled
        if (profileData.date_of_birth || profileData.gender || profileData.nationality || profileData.phone_number) {
          setFormData(profileData);
          setIsProfileComplete(true);
          setSaved(true); // already saved previously — show green button
          
          // if API tells us the setup flag still false, mark first-time
          if (!profileData.initial_setup_done) {
            setIsFirstTime(true);
          }
        } else {
          // If no profile exists, this is first time
          setIsFirstTime(true);
        }
      } catch (err) {
        // If profile doesn't exist yet, user needs to complete it
        setIsFirstTime(true);
        console.error("Error loading profile:", err);
      }
    };

    if (user) {
      loadProfile();
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Reset saved state when user modifies any field
    if (saved) setSaved(false);
    
    // Phone number validation - only digits, correct length
    if (name === 'phone_number') {
      // Remove any non-digit characters
      const digitsOnly = value.replace(/\D/g, '');
      
      // Validate length based on country code
      const expectedLength = formData.phone_area_code === '+254' ? 10 : null; // Kenya expects 10 digits
      
      if (digitsOnly.length > 0 && expectedLength && digitsOnly.length < expectedLength) {
        setPhoneError(`Phone number is too short. Expected ${expectedLength} digits.`);
      } else if (digitsOnly.length > expectedLength) {
        setPhoneError(`Phone number is too long. Expected ${expectedLength} digits.`);
        setFormData({
          ...formData,
          [name]: digitsOnly.slice(0, expectedLength)
        });
        return;
      } else {
        setPhoneError("");
      }
      
      setFormData({
        ...formData,
        [name]: digitsOnly
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };
  
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (max 2MB)
      const maxSize = 2 * 1024 * 1024; // 2MB
      if (file.size > maxSize) {
        setError(`File size must be under 2MB. Current size: ${(file.size / 1024).toFixed(0)}KB`);
        e.target.value = ''; // Reset file input
        return;
      }
      
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        setError('Unsupported file type. Please use JPG, PNG, GIF, or WebP images.');
        e.target.value = ''; // Reset file input
        return;
      }
      
      setFormData(prev => ({
        ...prev,
        profile_photo: file
      }));
      setError(''); // Clear any previous errors
      // Reset saved state when user changes photo
      if (saved) setSaved(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
  
    // On first save, all fields are required
    if (isFirstTime) {
      if (!formData.date_of_birth) {
        setError("Date of birth is required.");
        setLoading(false);
        return;
      }
      if (!formData.gender) {
        setError("Gender is required.");
        setLoading(false);
        return;
      }
      if (!formData.nationality) {
        setError("Nationality is required.");
        setLoading(false);
        return;
      }
      if (!formData.phone_number?.trim()) {
        setError("Phone number is required.");
        setLoading(false);
        return;
      }
        
      // Validate phone number length
      const expectedLength = formData.phone_area_code === '+254' ? 10 : null;
      if (expectedLength && formData.phone_number.length !== expectedLength) {
        setError(`Phone number must be exactly ${expectedLength} digits for ${formData.phone_area_code}.`);
        setLoading(false);
        return;
      }
    }
      
    // Profile photo is always required (on first time)
    if (isFirstTime && !formData.profile_photo) {
      setError("Profile photo is required.");
      setLoading(false);
      return;
    }
  
    try {
      // Prepare form data for upload
      const profileData = new FormData();
      
      // CRITICAL: On first-time setup, MUST send ALL required fields
      if (isFirstTime) {
        profileData.append('date_of_birth', formData.date_of_birth);
        profileData.append('gender', formData.gender);
        profileData.append('nationality', formData.nationality);
      }
          
      // Always send phone number fields
      profileData.append('phone_area_code', formData.phone_area_code);
      profileData.append('phone_number', formData.phone_number);
          
      // Send photo if it exists (either new file or keep existing)
      // Backend will keep existing photo if no new one is uploaded
      if (formData.profile_photo && typeof formData.profile_photo !== 'string') {
        // It's a new File object - upload it
        profileData.append('profile_photo', formData.profile_photo);
      }
      // If it's a string (existing URL), don't send anything - backend keeps current photo
          
      // Save profile data via API
      await API.post("auth/profile/", profileData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
        
      // Update state
      setIsProfileComplete(true);
      setIsFirstTime(false);
      setSaved(true); // flip button to green "Saved"
        
      setSuccess("Profile updated successfully!");
        
      // Optionally, update user context with profile data
      if (updateUserProfile) {
        updateUserProfile({ ...user, profile: formData });
      }
        
      // Redirect to booking page if user came from flights
      if (flightId) {
        setTimeout(() => {
          navigate(`/bookings?flight=${flightId}&seat=choice`, {
            state: { message: 'Profile completed! Continue with your booking.' }
          });
        }, 1000); // Wait 1 second so user sees success message
      }
    } catch (err) {
      // Get detailed error from backend
      const errorMsg = err.response?.data?.phone_number || 
                       err.response?.data?.profile_photo ||
                       err.response?.data?.detail || 
                       "Failed to update profile. Please try again.";
      setError(errorMsg);
      console.error("Profile update error:", err.response?.data);
    } finally {
      setLoading(false);
    }
  };

  /* ── shared styles ── */
  const CARD = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "14px",
    boxShadow: "0 8px 24px var(--shadow-md)",
  };
  const locked = !isFirstTime && isProfileComplete;
  // Phone number and profile photo can always be edited
  const phonePhotoEditable = true;
  const inputSt = {
    width: "100%", padding: "11px 14px", borderRadius: "8px",
    border: "1px solid var(--border)",
    background: locked ? "var(--background)" : "var(--surface)",
    color: locked ? "var(--text-primary)" : "var(--text-primary)",
    fontSize: "14px", outline: "none", boxSizing: "border-box",
    cursor: locked ? "not-allowed" : "auto",
  };
  // Input style for always-editable fields (phone number)
  const editableInputSt = {
    ...inputSt,
    background: "var(--surface)",
    color: "var(--text-primary)",
    cursor: "auto",  // Normal text cursor for inputs
  };
  const labelSt = {
    display: "block", marginBottom: "7px",
    fontWeight: 600, color: "var(--text-secondary)", fontSize: "13px",
  };

  if (!user) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", color: "var(--text-secondary)", fontSize: "16px" }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 20px", maxWidth: "640px", margin: "0 auto" }}>

      {/* ── Page header ── */}
      <div style={{ ...CARD, padding: "28px 32px", marginBottom: "24px", position: "relative", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "16px" }}>
          {/* Profile Photo */}
          <div style={{ width: "64px", height: "64px", borderRadius: "50%", overflow: "hidden", border: "2px solid rgba(212,175,55,0.3)", backgroundColor: "rgba(255,255,255,0.05)" }}>
            {(formData.profile_photo_url) ? (
              <ProtectedImage 
                src={formData.profile_photo_url}
                alt="Profile" 
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                onError={(e) => console.error('Profile photo failed to load:', e)}
              />
            ) : formData.profile_photo ? (
              <img 
                src={URL.createObjectURL(formData.profile_photo)}
                alt="Profile" 
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)" }}>
                <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
            )}
          </div>
          <div>
            <h1 style={{ color: "var(--text-primary)", fontSize: "28px", fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.02em" }}>
              My Profile
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "13px", margin: 0 }}>
              {locked ? "Your personal details are locked after initial setup." : "Fill in your personal details — required before booking."}
            </p>
          </div>
        </div>
        
        {/* Upload Button */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <label htmlFor="profile-photo-upload" style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "8px 16px",
            background: "rgba(212,175,55,0.1)",
            border: "1px solid rgba(212,175,55,0.3)",
            color: "#d4af37",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 600,
          }}>
            <input
              id="profile-photo-upload"
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
              onChange={handlePhotoChange}
              style={{ display: "none" }}
            />
            Update Photo
          </label>
          <span style={{ color: "var(--text-secondary)", fontSize: "12px" }}>
            Max 2MB (JPG, PNG, GIF, WebP)
          </span>
        </div>
      </div>

      {/* ── Alerts ── */}
      {error && (
        <div style={{ background: "rgba(220,53,69,0.12)", border: "1px solid rgba(220,53,69,0.4)", color: "#ff8891", padding: "12px 16px", borderRadius: "10px", marginBottom: "16px", fontSize: "13px" }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ background: "rgba(40,167,69,0.12)", border: "1px solid rgba(40,167,69,0.4)", color: "#6ddf8e", padding: "12px 16px", borderRadius: "10px", marginBottom: "16px", fontSize: "13px" }}>
          {success}
        </div>
      )}

      {/* ── Form card ── */}
      <form onSubmit={handleSubmit} style={{ ...CARD, padding: "28px 28px 24px" }}>

        {/* Full name — read-only */}
        <div style={{ marginBottom: "22px" }}>
          <label style={labelSt}>Full Name</label>
          <input
            type="text"
            value={user.full_name || user.username || ""}
            readOnly
            style={{ ...inputSt, background: "var(--background)", color: "var(--text-primary)", cursor: "default" }}
          />
        </div>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", marginBottom: "22px" }} />

        {/* Date of birth */}
        <div style={{ marginBottom: "22px" }}>
          <label style={labelSt}>Date of Birth {!locked && <span style={{ color: "#d4af37" }}>*</span>}</label>
          <DateOfBirthPicker
            value={formData.date_of_birth}
            onChange={(v) => handleChange({ target: { name: "date_of_birth", value: v } })}
            disabled={locked && name !== "phone_number" && name !== "phone_area_code"}
            theme="light"
          />
        </div>

        {/* Gender */}
        <div style={{ marginBottom: "22px" }}>
          <label style={labelSt}>Gender {!locked && <span style={{ color: "#d4af37" }}>*</span>}</label>
          <select
            name="gender"
            value={formData.gender}
            onChange={handleChange}
            required={!locked || name === "phone_number" || name === "phone_area_code"}
            disabled={locked && name !== "phone_number" && name !== "phone_area_code"}
            style={{ ...inputSt, appearance: "none" }}
          >
            <option value="" style={{ background: "var(--surface)" }}>Select Gender</option>
            <option value="MALE" style={{ background: "var(--surface)" }}>Male</option>
            <option value="FEMALE" style={{ background: "var(--surface)" }}>Female</option>
            <option value="OTHER" style={{ background: "var(--surface)" }}>Other</option>
          </select>
        </div>

        {/* Nationality */}
        <div style={{ marginBottom: "22px" }}>
          <label style={labelSt}>Nationality {!locked && <span style={{ color: "#d4af37" }}>*</span>}</label>
          <select
            name="nationality"
            value={formData.nationality}
            onChange={handleChange}
            required={!locked || name === "phone_number" || name === "phone_area_code"}
            disabled={locked && name !== "phone_number" && name !== "phone_area_code"}
            style={{ ...inputSt, appearance: "none" }}
          >
            <option value="" style={{ background: "var(--surface)" }}>Select Nationality</option>
            <option value="Kenyan" style={{ background: "var(--surface)" }}>Kenyan</option>
            <option value="Tanzanian" style={{ background: "var(--surface)" }}>Tanzanian</option>
            <option value="Ugandan" style={{ background: "var(--surface)" }}>Ugandan</option>
            <option value="Rwandan" style={{ background: "var(--surface)" }}>Rwandan</option>
            <option value="Burundian" style={{ background: "var(--surface)" }}>Burundian</option>
            <option value="Ethiopian" style={{ background: "var(--surface)" }}>Ethiopian</option>
            <option value="Somali" style={{ background: "var(--surface)" }}>Somali</option>
            <option value="Djiboutian" style={{ background: "var(--surface)" }}>Djiboutian</option>
            <option value="South African" style={{ background: "var(--surface)" }}>South African</option>
            <option value="Nigerian" style={{ background: "var(--surface)" }}>Nigerian</option>
            <option value="Ghanaian" style={{ background: "var(--surface)" }}>Ghanaian</option>
            <option value="Egyptian" style={{ background: "var(--surface)" }}>Egyptian</option>
            <option value="Moroccan" style={{ background: "var(--surface)" }}>Moroccan</option>
            <option value="Tunisian" style={{ background: "var(--surface)" }}>Tunisian</option>
            <option value="Algerian" style={{ background: "var(--surface)" }}>Algerian</option>
            <option value="Libyan" style={{ background: "var(--surface)" }}>Libyan</option>
            <option value="Sudanese" style={{ background: "var(--surface)" }}>Sudanese</option>
            <option value="American" style={{ background: "var(--surface)" }}>American</option>
            <option value="British" style={{ background: "var(--surface)" }}>British</option>
            <option value="Canadian" style={{ background: "var(--surface)" }}>Canadian</option>
            <option value="Australian" style={{ background: "var(--surface)" }}>Australian</option>
            <option value="Indian" style={{ background: "var(--surface)" }}>Indian</option>
            <option value="Chinese" style={{ background: "var(--surface)" }}>Chinese</option>
            <option value="Japanese" style={{ background: "var(--surface)" }}>Japanese</option>
          </select>
        </div>

        {/* Phone number */}
        <div style={{ marginBottom: "28px" }}>
          <label style={labelSt}>Phone Number {!locked && <span style={{ color: "#d4af37" }}>*</span>}</label>
          <div style={{ display: "flex", gap: "10px" }}>
            <select
              name="phone_area_code"
              value={formData.phone_area_code || "+254"}
              onChange={handleChange}
              required={true}
              disabled={false}
              style={{ ...editableInputSt, width: "auto", minWidth: "110px", flex: "0 0 auto", appearance: "none" }}
            >
              <option value="+254" style={{ background: "var(--surface)" }}>+254 (KE)</option>
              <option value="+255" style={{ background: "var(--surface)" }}>+255 (TZ)</option>
              <option value="+256" style={{ background: "var(--surface)" }}>+256 (UG)</option>
              <option value="+250" style={{ background: "var(--surface)" }}>+250 (RW)</option>
              <option value="+257" style={{ background: "var(--surface)" }}>+257 (BI)</option>
              <option value="+251" style={{ background: "var(--surface)" }}>+251 (ET)</option>
              <option value="+252" style={{ background: "var(--surface)" }}>+252 (SO)</option>
              <option value="+253" style={{ background: "var(--surface)" }}>+253 (DJ)</option>
              <option value="+27"  style={{ background: "var(--surface)" }}>+27 (ZA)</option>
              <option value="+234" style={{ background: "var(--surface)" }}>+234 (NG)</option>
              <option value="+233" style={{ background: "var(--surface)" }}>+233 (GH)</option>
              <option value="+20"  style={{ background: "var(--surface)" }}>+20 (EG)</option>
            </select>
            <input
              type="tel"
              name="phone_number"
              value={formData.phone_number}
              onChange={handleChange}
              placeholder="712345678"
              required={true}
              disabled={false}
              style={{ 
                ...editableInputSt, 
                flex: 1,
                borderColor: phoneError ? '#dc3545' : editableInputSt.borderColor
              }}
            />
          </div>
          {phoneError && (
            <div style={{ 
              color: '#ff6b75', 
              fontSize: '12px', 
              marginTop: '6px',
              background: 'rgba(220,53,69,0.1)',
              padding: '6px 10px',
              borderRadius: '4px'
            }}>
              {phoneError}
            </div>
          )}
        </div>

        {/* Save button */}
        <button
          type="submit"
          disabled={loading || saved}
          style={{
            backgroundColor: saved ? "#28a745" : loading ? "#d4af37" : "#d4af37",
            color: "#fff",
            border: "none",
            padding: "13px 25px",
            borderRadius: "9px",
            fontSize: "15px",
            fontWeight: 700,
            cursor: loading ? "wait" : (saved ? "default" : "pointer"), opacity: loading ? 0.8 : 1,
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            transition: "background-color 0.3s",
          }}
          onMouseEnter={(e) => { if (!loading && !saved) e.currentTarget.style.backgroundColor = "#c9a227"; }}
          onMouseLeave={(e) => { if (!loading && !saved) e.currentTarget.style.backgroundColor = "#d4af37"; }}
        >
          {saved ? (
            <>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2.5 8.5L6 12L13.5 4" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Saved
            </>
          ) : loading ? (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.3"/>
                <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round">
                  <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/>
                </path>
              </svg>
              Saving...
            </>
          ) : "Save Profile"}
        </button>
      </form>
    </div>
  );
}