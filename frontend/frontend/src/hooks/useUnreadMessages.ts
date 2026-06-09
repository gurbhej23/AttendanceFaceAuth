import { useCallback, useEffect, useState } from "react";
import API from "../services/api";

export interface UnreadContact {
  employee_id: string;
  name: string;
  unread: number;
}

export interface UnreadGroup {
  group_id: string;
  group_name: string;
  unread: number;
}

export interface UnreadSummary {
  total: number;
  direct: number;
  group: number;
  directContacts: UnreadContact[];
  groupUnread: UnreadGroup[];
}

const emptySummary = (): UnreadSummary => ({
  total: 0,
  direct: 0,
  group: 0,
  directContacts: [],
  groupUnread: [],
});

export function useUnreadMessages(employeeId: string, pollMs = 30000) {
  const [summary, setSummary] = useState<UnreadSummary>(emptySummary);

  const refreshUnread = useCallback(async () => {
    if (!employeeId) {
      setSummary(emptySummary());
      return;
    }
    try {
      const res = await API.get("/employees/chat-unread-count/", {
        params: { employee_id: employeeId },
      });
      setSummary({
        total: res.data.total || 0,
        direct: res.data.direct || 0,
        group: res.data.group || 0,
        directContacts: res.data.direct_contacts || [],
        groupUnread: res.data.group_unread || [],
      });
    } catch {
      setSummary(emptySummary());
    }
  }, [employeeId]);

  useEffect(() => {
    refreshUnread();
    const interval = window.setInterval(refreshUnread, pollMs);
    return () => window.clearInterval(interval);
  }, [refreshUnread, pollMs]);

  return {
    unreadCount: summary.total,
    summary,
    refreshUnread,
  };
}
