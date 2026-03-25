import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import API from "../api/api";
import { useNavigate } from "react-router-dom";

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileComplete, setProfileComplete] = useState(false);

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
        setLoading(false); // Ensure loading is false after successful fetch
        return userData;
      } catch {
        // If profile doesn't exist yet, just set user data
        setUser(res.data);
        setProfileComplete(false);
        localStorage.removeItem(`profile_completed_${res.data.id}`);
        setLoading(false); // Ensure loading is false
        return res.data;
      }
      
    } catch (error) {
      if (error.response?.status === 401) {
        // Token expired or invalid - clear and redirect to login
        localStorage.removeItem("token");
        setUser(null);
        setProfileComplete(false);
        setLoading(false); // Stop loading before navigation
        navigate('/login', { replace: true });
      } else {
        setUser(null);
        setProfileComplete(false);
        localStorage.removeItem("token");
        setLoading(false); // Stop loading on error
      }
      throw error;
    }
  }, [navigate]); // Changed dependency to prevent circular reference

  const login = useCallback(async (username, password) => {
    const res = await API.post("auth/login/", { username, password });
    localStorage.setItem("token", res.data.access);
    const userData = await fetchMe();
    return userData; // Return user data for role-based redirect
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
    setUser(null);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const token = localStorage.getItem("token");
      if (token) await fetchMe();
      setLoading(false);
    })();
  }, [fetchMe]);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, profileComplete, updateUserProfile }),
    [user, loading, login, register, logout, profileComplete, updateUserProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};