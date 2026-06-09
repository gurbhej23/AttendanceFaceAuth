import API from "../services/api";

export interface Contact {
  employee_id: string;
  name: string;
  role: string;
  department?: string;
  designation?: string;
  profile_img: string;
  is_online?: boolean;
  last_seen?: string;
}

export interface ChatMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  recipient_id: string;
  recipient_name: string;
  message: string;
  is_read?: boolean;
  created_at: string;
  reactions?: Record<string, string[]>;
  is_edited?: boolean;
  is_deleted?: boolean;
}

export interface ChatGroup {
  id: string;
  group_name: string;
  group_img?: string;
  member_count?: number;
  members?: string[];
}

export const getApiRoot = () => {
  const base =
    import.meta.env.VITE_API_URL ||
    API.defaults.baseURL ||
    "http://localhost:8000/api";
  if (!base.startsWith("http")) return window.location.origin;
  const url = new URL(base);
  url.pathname = url.pathname.replace(/\/api\/?$/, "");
  return url.toString().replace(/\/$/, "");
};

export const getMediaUrl = (path?: string | null) => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `http://localhost:8000${path.startsWith("/") ? path : `/${path}`}`;
};

export const getWsUrl = (employeeId: string) => {
  const root = getApiRoot();
  return `${root.replace(/^http:/, "ws:").replace(/^https:/, "wss:")}/ws/chat/${employeeId}/`;
};

export const formatMessageDate = (ds: string) => {
  const d = new Date(ds);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export const formatLastSeen = (ds?: string) => {
  if (!ds) return "Offline";
  const d = new Date(ds);
  if (Number.isNaN(d.getTime())) return "Offline";
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "Active now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return d.toLocaleDateString([], { day: "numeric", month: "short" });
};

export type OpenChat =
  | { type: "direct"; id: string }
  | { type: "group"; id: string };

export const chatKey = (chat: OpenChat) => `${chat.type}:${chat.id}`;
