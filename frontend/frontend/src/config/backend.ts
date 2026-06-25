/** Live Render backend — used when VITE_API_URL is not set at build time. */
export const PRODUCTION_BACKEND_ORIGIN =
  import.meta.env.VITE_BACKEND_ORIGIN?.trim() ||
  "https://attendancefaceauth.onrender.com";

export const getApiBaseUrl = (): string => {
  const fromEnv = import.meta.env.VITE_API_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }
  if (import.meta.env.PROD) {
    return `${PRODUCTION_BACKEND_ORIGIN}/api`;
  }
  return "/api";
};

export const getBackendOrigin = (): string => {
  const apiUrl = import.meta.env.VITE_API_URL?.trim();
  if (apiUrl?.startsWith("http")) {
    const url = new URL(apiUrl);
    url.pathname = url.pathname.replace(/\/api\/?$/, "");
    return url.origin;
  }

  const wsUrl = import.meta.env.VITE_WS_URL?.trim();
  if (wsUrl) {
    return wsUrl
      .replace(/\/$/, "")
      .replace(/^wss:/i, "https:")
      .replace(/^ws:/i, "http:")
      .replace(/\/ws\/?$/, "");
  }

  if (import.meta.env.PROD) {
    return PRODUCTION_BACKEND_ORIGIN;
  }

  return import.meta.env.VITE_DEV_API_ORIGIN?.trim() || "http://localhost:8000";
};
