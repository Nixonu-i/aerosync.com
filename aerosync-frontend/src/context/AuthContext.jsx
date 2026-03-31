import { createContext, useCallback, useEffect, useMemo, useState, useContext } from "react";
import API from "../api/api";
import { useNavigate } from "react-router-dom";

export const AuthContext = createContext(null);

/**
 * Custom hook to access auth context
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileComplete, setProfileComplete] = useState(false);
  // FIX: token is now proper reactive state instead of a stale getToken() call
  // This ensures useBookingUpdates re-runs its effect when the token changes
  const [token, setToken] = useState(() => localStorage.getItem("token"));

  const fetchMe = useCallback(async () => {
    try {
      const res = await API.get("auth/me/");
      
      // Also fetch profile data
      try {
        const profileRes = await API.get("auth/profile/");
        const userData = {...res.data, profile: profileRes.data};
        setUser(userData);
        // Check backend's initial_setup_done flag
        setProfileComplete(!!profileRes.data.initial_setup_done);
        // Sync to localStorage for persistence
        if (profileRes.data.initial_setup_done) {
          localStorage.setItem(`profile_completed_${res.data.id}`, "true");
        } else {
          localStorage.removeItem(`profile_completed_${res.data.id}`);
        }
        setLoading(false);
        return userData;
      } catch {
        // If profile doesn't exist yet, just set user data
        setUser(res.data);
        setProfileComplete(false);
        localStorage.removeItem(`profile_completed_${res.data.id}`);
        setLoading(false);
        return res.data;
      }
      
    } catch (error) {
      if (error.response?.status === 401) {
        // Token expired or invalid - clear and redirect to login
        localStorage.removeItem("token");
        setToken(null); // FIX: clear reactive token state
        setUser(null);
        setProfileComplete(false);
        setLoading(false);
        navigate('/login', { replace: true });
      } else {
        setUser(null);
        setProfileComplete(false);
        localStorage.removeItem("token");
        setToken(null); // FIX: clear reactive token state
        setLoading(false);
      }
      throw error;
    }
  }, [navigate]);

  const login = useCallback(async (username, password) => {
    const res = await API.post("auth/login/", { username, password });
    localStorage.setItem("token", res.data.access);
    setToken(res.data.access); // FIX: update reactive token so SSE hook re-connects
    const userData = await fetchMe();
    return userData;
  }, [fetchMe]);
  
  const updateUserProfile = useCallback(async (updatedUser) => {
    setUser(updatedUser);
    // Re-fetch to get updated initial_setup_done flag from backend
    await fetchMe();
    localStorage.setItem(`profile_completed_${updatedUser.id}`, "true");
  }, [fetchMe]);

  const register = useCallback(async (payload) => {
    await API.post("auth/register/", payload);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setToken(null); // FIX: clear reactive token so SSE hook disconnects cleanly
    setUser(null);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const storedToken = localStorage.getItem("token");
      if (storedToken) {
        // FIX: sync reactive token state with whatever is in localStorage on mount
        setToken(storedToken);
        await fetchMe();
      }
      setLoading(false);
    })();
  }, [fetchMe]);

  const value = useMemo(
    // FIX: token is now the reactive state variable, not getToken()
    // useMemo will re-run when token changes, giving useBookingUpdates the fresh value
    () => ({ user, loading, login, register, logout, profileComplete, updateUserProfile, token }),
    [user, loading, login, register, logout, profileComplete, updateUserProfile, token]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};