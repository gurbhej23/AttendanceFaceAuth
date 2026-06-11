import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL || "/api";

/** Face endpoints load TensorFlow on the server and can take 30–90s on first request. */
export const FACE_REQUEST_TIMEOUT_MS = 120_000;

const API = axios.create({
  baseURL,
  timeout: 30_000,
});

export default API;
