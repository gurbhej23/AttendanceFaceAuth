import { useCallback, useEffect, useMemo, useState } from "react";
import API from "../services/api";

export interface DashboardNotification {
  id: string;
  title: string;
  message: string;
  time?: string;
}

interface EmployeeLeaveRow {
  date: string;
  status: string;
  reason: string;
  leave_type: string;
  leave_end_date?: string;
}

interface AdminLeaveRow {
  id?: string;
  employee_id: string;
  employee_name: string;
  date: string;
  reason: string;
  leave_type: string;
  status: string;
}

const readKey = (employeeId: string) => `dash_notif_read_${employeeId}`;

const loadReadIds = (employeeId: string): Set<string> => {
  if (!employeeId) return new Set();
  try {
    const raw = localStorage.getItem(readKey(employeeId));
    return new Set(JSON.parse(raw || "[]") as string[]);
  } catch {
    return new Set();
  }
};

const saveReadIds = (employeeId: string, ids: Set<string>) => {
  if (!employeeId) return;
  localStorage.setItem(readKey(employeeId), JSON.stringify([...ids]));
};

const leaveStatusLabel = (status: string) => {
  if (status === "leave_approved") return "approved";
  if (status === "leave_rejected") return "rejected";
  if (status === "leave_pending") return "pending";
  return status.replace(/_/g, " ");
};

export function useDashboardNotifications(
  employeeId: string,
  role: "employee" | "admin" | "hr",
  pollMs = 30000,
) {
  const [readIds, setReadIds] = useState<Set<string>>(() => loadReadIds(employeeId));
  const [allNotifications, setAllNotifications] = useState<DashboardNotification[]>([]);
  const isStaff = role === "admin" || role === "hr";

  const refreshNotifications = useCallback(async () => {
    if (!employeeId) {
      setAllNotifications([]);
      return;
    }

    const next: DashboardNotification[] = [];

    try {
      const unreadRes = await API.get("/employees/chat-unread-count/", {
        params: { employee_id: employeeId },
      });
      const unreadTotal = Number(unreadRes.data.total || 0);
      if (unreadTotal > 0) {
        next.push({
          id: "chat-unread",
          title: "Unread messages",
          message: `You have ${unreadTotal} unread message${unreadTotal === 1 ? "" : "s"}.`,
        });
      }
    } catch {
      /* silent */
    }

    if (isStaff) {
      try {
        const res = await API.get("/attendance/admin-leave-requests/", {
          params: { status: "leave_pending" },
        });
        const records = (res.data.records || []) as AdminLeaveRow[];
        records.forEach((row) => {
          next.push({
            id: `admin-leave-${row.employee_id}-${row.date}`,
            title: `Leave request · ${row.employee_name}`,
            message: `${row.leave_type} leave on ${row.date}: ${row.reason}`,
            time: row.date,
          });
        });
      } catch {
        /* silent */
      }
    } else {
      try {
        const res = await API.get("/attendance/my-leave-requests/", {
          params: { employee_id: employeeId },
        });
        const records = (res.data.records || []) as EmployeeLeaveRow[];
        records.forEach((row) => {
          const status = row.status || "leave_pending";
          next.push({
            id: `leave-${row.date}-${status}`,
            title: `Leave ${leaveStatusLabel(status)}`,
            message: `${row.leave_type} leave (${row.date}${row.leave_end_date && row.leave_end_date !== row.date ? ` – ${row.leave_end_date}` : ""}): ${row.reason}`,
            time: row.date,
          });
        });
      } catch {
        /* silent */
      }
    }

    setAllNotifications(next);
  }, [employeeId, isStaff]);

  useEffect(() => {
    setReadIds(loadReadIds(employeeId));
  }, [employeeId]);

  useEffect(() => {
    void refreshNotifications();
    const interval = window.setInterval(refreshNotifications, pollMs);
    return () => window.clearInterval(interval);
  }, [pollMs, refreshNotifications]);

  const unreadNotifications = useMemo(
    () => allNotifications.filter((item) => !readIds.has(item.id)),
    [allNotifications, readIds],
  );

  const unreadCount = unreadNotifications.length;

  const markAllRead = useCallback(() => {
    const merged = new Set(readIds);
    allNotifications.forEach((item) => merged.add(item.id));
    setReadIds(merged);
    saveReadIds(employeeId, merged);
  }, [allNotifications, employeeId, readIds]);

  const markOneRead = useCallback(
    (id: string) => {
      const merged = new Set(readIds);
      merged.add(id);
      setReadIds(merged);
      saveReadIds(employeeId, merged);
    },
    [employeeId, readIds],
  );

  return {
    notifications: unreadNotifications,
    unreadCount,
    markAllRead,
    markOneRead,
    refreshNotifications,
  };
}
