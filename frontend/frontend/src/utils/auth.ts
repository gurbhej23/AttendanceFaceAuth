export const getToken = () => localStorage.getItem("token");

export const getRole = () => localStorage.getItem("role");

export const isAuthenticated = () => {
  return !!localStorage.getItem("token");
};

export const isAdminOrHR = () => {
  const role = localStorage.getItem("role");
  return role === "admin" || role === "hr";
};
