import axios, { type InternalAxiosRequestConfig } from "axios";
import { getApiBaseUrl } from "../config/backend";

const baseURL = getApiBaseUrl();

export const FACE_REQUEST_TIMEOUT_MS = 120_000;

const API = axios.create({
  baseURL,
  timeout: 30_000,
});

const PUBLIC_ENDPOINTS = [
  "/employees/login/",
  "/employees/admin-login/",
  "/employees/register/",
  "/employees/send-otp/",
  "/employees/reset-password/",
  "/employees/send-registration-otp/",
  "/employees/verify-registration-otp/",
];

const isPublicEndpoint = (url = "") =>
  PUBLIC_ENDPOINTS.some((endpoint) => url.includes(endpoint));

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) &&
  typeof value === "object" &&
  !(value instanceof FormData) &&
  !(value instanceof URLSearchParams);

API.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (isPublicEndpoint(config.url)) return config;

  const employeeId = localStorage.getItem("employee_id");
  delete config.headers.Authorization;

  if (!employeeId || employeeId === "undefined") return config;

  const method = (config.method || "get").toLowerCase();
  if (method === "get" || method === "delete") {
    const params = isPlainObject(config.params) ? config.params : {};
    if (!params.employee_id && !params.employeeId) {
      config.params = { ...params, employee_id: employeeId };
    }
    return config;
  }

  if (!config.data) {
    const method = (config.method || "get").toLowerCase();
    if (method !== "get" && method !== "delete") {
      // Only append if your backend strictly requires it as a JSON body
      config.data = { employee_id: employeeId };
    }
    return config;
  }

  if (
    isPlainObject(config.data) &&
    !config.data.employee_id &&
    !config.data.employeeId
  ) {
    config.data = { ...config.data, employee_id: employeeId };
  }

  return config;
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
