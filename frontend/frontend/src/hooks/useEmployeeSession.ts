import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

export interface EmployeeSession {
  employeeId: string;
  employeeName: string;
  role: string;
  token: string;
  isLoggedIn: boolean;
}

const readSession = (): EmployeeSession => {
  const employeeId = localStorage.getItem("employee_id") || "";
  const token = localStorage.getItem("token") || "";
  return {
    employeeId,
    employeeName: localStorage.getItem("employee_name") || "You",
    role: localStorage.getItem("role") || "employee",
    token,
    isLoggedIn: Boolean(
      employeeId && token && token !== "undefined" && employeeId !== "undefined",
    ),
  };
};

/** Re-read localStorage when route changes (e.g. after login navigation). */
export function useEmployeeSession(): EmployeeSession {
  const location = useLocation();
  const [session, setSession] = useState<EmployeeSession>(readSession);

  useEffect(() => {
    setSession(readSession());
  }, [location.pathname, location.key]);

  useEffect(() => {
    const sync = () => setSession(readSession());
    window.addEventListener("storage", sync);
    window.addEventListener("auth-changed", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("auth-changed", sync);
    };
  }, []);

  return session;
}

export const notifyAuthChanged = () => {
  window.dispatchEvent(new Event("auth-changed"));
};
