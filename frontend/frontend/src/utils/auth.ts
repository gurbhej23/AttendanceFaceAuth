/** Auth/session keys cleared on logout — theme & notification dismissals are kept. */
const SESSION_KEYS = [
  "token",
  "employee_id",
  "employee_name",
  "role",
  "profile_img",
  "cv_file",
] as const;

export const getToken = () => localStorage.getItem("token");

export const getRole = () => localStorage.getItem("role");

export const isAuthenticated = () => {
  return !!localStorage.getItem("token");
};

export const isAdminOrHR = () => {
  const role = localStorage.getItem("role");
  return role === "admin" || role === "hr";
};

/** Log out without wiping theme or per-user notification read/deleted state. */
export function clearAuthSession() {
  SESSION_KEYS.forEach((key) => localStorage.removeItem(key));
}
