import axios from "axios";
import { getApiBaseUrl } from "../config/backend";

const baseURL = getApiBaseUrl();

export const FACE_REQUEST_TIMEOUT_MS = 120_000;

const API = axios.create({
  baseURL,
  timeout: 30_000,
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error?.response?.data?.error ||
      error?.response?.data?.message ||
      error?.message ||
      "Request failed";

    if (import.meta.env.DEV) {
      console.error("API request failed", message);
    }

    return Promise.reject({
      ...error,
      message,
    });
  },
);

export default API;
