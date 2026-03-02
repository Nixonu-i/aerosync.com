import axios from "axios";

// Use environment variable in production, fallback to relative in development
const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api/",
  timeout: 20000,
  withCredentials: true,
});

// Attach JWT token
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Normalize error messages
API.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg =
      err?.response?.data?.detail ||
      err?.response?.data?.error ||
      err?.response?.data ||
      err.message;

    err.normalizedMessage =
      typeof msg === "string" ? msg : JSON.stringify(msg);

    throw err;
  }
);

export default API;