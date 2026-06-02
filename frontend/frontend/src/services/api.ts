import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL || "/api";

const API = axios.create({
  baseURL,
  headers: baseURL.includes("ngrok")
    ? {
        "ngrok-skip-browser-warning": "true",
      }
    : undefined,
});

export default API;
