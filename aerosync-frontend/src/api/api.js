import axios from "axios";

// Use relative paths for API calls to automatically adapt to the current origin
// This ensures that whether accessed locally or via ngrok, the API calls go to the correct server
const API = axios.create({
  baseURL: "/api/",
  timeout: 20000,
});

// Simple dynamic API configuration without complex fallback
// This will ensure that when accessed from ngrok, it uses the correct API endpoint

// Ensure interceptors are applied to the API instance with the correct baseURL
API.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg =
      err?.response?.data?.detail ||
      err?.response?.data?.error ||
      err?.response?.data ||
      err.message;
    err.normalizedMessage = typeof msg === "string" ? msg : JSON.stringify(msg);
    throw err;
  }
);

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default API;