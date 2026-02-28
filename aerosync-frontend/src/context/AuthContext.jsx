import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import API from "../api/api";

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileComplete, setProfileComplete] = useState(false);

  const fetchMe = useCallback(async () => {
    try {
      const res = await API.get("auth/me/");
      
      // Also fetch profile data
      try {
        const profileRes = await API.get("auth/profile/");
        setUser({...res.data, profile: profileRes.data});
      } catch {
        // If profile doesn't exist yet, just set user data
        setUser(res.data);
      }
      
      // Check if profile is complete
      const profileCompleted = localStorage.getItem(`profile_completed_${res.data.id}`);
      setProfileComplete(!!profileCompleted);
    } catch {
      setUser(null);
      setProfileComplete(false);
      localStorage.removeItem("token");
    }
  }, []);

  const login = useCallback(async (username, password) => {
    const res = await API.post("auth/login/", { username, password });
    localStorage.setItem("token", res.data.access);
    await fetchMe();
  }, [fetchMe]);
  
  const updateUserProfile = useCallback((updatedUser) => {
    setUser(updatedUser);
    setProfileComplete(true);
    localStorage.setItem(`profile_completed_${updatedUser.id}`, "true");
  }, []);

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