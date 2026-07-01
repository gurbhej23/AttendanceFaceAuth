import { useCallback, useEffect, useMemo, useState } from "react";
import API from "../services/api";

export type NotificationType =
  | "message"
  | "group_message"
  | "leave_request"
  | "leave_status";

export interface DashboardNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  time?: string;
  contact_id?: string;
  group_id?: string;
  isRead: boolean;
}

const readKey = (employeeId: string) => `dash_notif_read_${employeeId}`;
const deletedKey = (employeeId: string) => `dash_notif_deleted_${employeeId}`;

const loadReadIds = (employeeId: string): Set<string> => {
  if (!employeeId) return new Set();
  try {
    const raw = localStorage.getItem(readKey(employeeId));
    return new Set(JSON.parse(raw || "[]") as string[]);
  } catch {
    return new Set();
  }
};

const loadDeletedIds = (employeeId: string): Set<string> => {
  if (!employeeId) return new Set();
  try {
    const raw = localStorage.getItem(deletedKey(employeeId));
    return new Set(JSON.parse(raw || "[]") as string[]);
  } catch {
    return new Set();
  }
};

const saveReadIds = (employeeId: string, ids: Set<string>) => {
  if (!employeeId) return;
  localStorage.setItem(readKey(employeeId), JSON.stringify([...ids]));
};

const saveDeletedIds = (employeeId: string, ids: Set<string>) => {
  if (!employeeId) return;
  localStorage.setItem(deletedKey(employeeId), JSON.stringify([...ids]));
};

export function useDashboardNotifications(
  employeeId: string,
  _role: "employee" | "admin" | "hr",
  pollMs = 15000,
) {
  const [readIds, setReadIds] = useState<Set<string>>(() => loadReadIds(employeeId));
  const [deletedIds, setDeletedIds] = useState<Set<string>>(() =>
    loadDeletedIds(employeeId),
  );
  const [allNotifications, setAllNotifications] = useState<DashboardNotification[]>([]);

  const refreshNotifications = useCallback(async () => {
    if (!employeeId) {
      setAllNotifications([]);
      return;
    }
    try {
      const res = await API.get("/employees/dashboard-notifications/", {
        params: { employee_id: employeeId },
      });
      const items = (res.data.notifications || []) as Omit<
        DashboardNotification,
        "isRead"
      >[];
      setAllNotifications(
        items.map((item) => ({ ...item, isRead: false })),
      );
    } catch {
      /* silent */
    }
  }, [employeeId]);

  useEffect(() => {
    setReadIds(loadReadIds(employeeId));
    setDeletedIds(loadDeletedIds(employeeId));
  }, [employeeId]);

  useEffect(() => {
    void refreshNotifications();
    const interval = window.setInterval(refreshNotifications, pollMs);
    return () => window.clearInterval(interval);
  }, [pollMs, refreshNotifications]);

  const notifications = useMemo(() => {
    const withRead = allNotifications
      .filter((item) => !deletedIds.has(item.id))
      .map((item) => ({
        ...item,
        isRead: readIds.has(item.id),
      }));
    return withRead.sort((a, b) => {
      if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
      return 0;
    });
  }, [allNotifications, deletedIds, readIds]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.isRead).length,
    [notifications],
  );

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

  const deleteOne = useCallback(
    (id: string) => {
      const merged = new Set(deletedIds);
      merged.add(id);
      setDeletedIds(merged);
      saveDeletedIds(employeeId, merged);
      const readMerged = new Set(readIds);
      readMerged.delete(id);
      setReadIds(readMerged);
      saveReadIds(employeeId, readMerged);
    },
    [deletedIds, employeeId, readIds],
  );

  return {
    notifications,
    unreadCount,
    markAllRead,
    markOneRead,
    deleteOne,
    refreshNotifications,
  };
}
