import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  headers: {
    "ngrok-skip-browser-warning": "true",
  },
});

export default API;
