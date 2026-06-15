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
  member_details?: Contact[];
}

/** Personalize group system messages for the current user (e.g. "HR added you to the group"). */
export const formatGroupSystemMessage = (
  message: string,
  employeeId: string,
  employeeName: string,
): string => {
  const added = message.match(/^(.+) added (.+) to the group$/);
  if (
    added &&
    (added[2] === employeeName ||
      added[2] === employeeId ||
      added[2].includes(employeeName))
  ) {
    return `${added[1]} added you to the group`;
  }
  const removed = message.match(/^(.+) removed (.+) from the group$/);
  if (
    removed &&
    (removed[2] === employeeName ||
      removed[2] === employeeId ||
      removed[2].includes(employeeName))
  ) {
    return `${removed[1]} removed you from the group`;
  }
  return message;
};

export const getApiRoot = () => {
  const configured = import.meta.env.VITE_API_URL?.trim();
  if (configured) {
    if (!configured.startsWith("http")) {
      console.warn(
        "[chat] VITE_API_URL must be an absolute URL in production (e.g. https://your-api.onrender.com/api) so WebSocket calls work.",
      );
      return window.location.origin;
    }
    const url = new URL(configured);
    url.pathname = url.pathname.replace(/\/api\/?$/, "");
    return url.toString().replace(/\/$/, "");
  }

  const base =
    API.defaults.baseURL || "http://localhost:8000/api";
  if (!base.startsWith("http")) return window.location.origin;
  const url = new URL(base);
  url.pathname = url.pathname.replace(/\/api\/?$/, "");
  return url.toString().replace(/\/$/, "");
};

export const getMediaUrl = (path?: string | null) => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  const root = getApiRoot();
  return `${root}${path.startsWith("/") ? path : `/${path}`}`;
};

export const getWsUrl = (employeeId: string) => {
  const explicit = import.meta.env.VITE_WS_URL?.trim();
  if (explicit) {
    const base = explicit.replace(/\/$/, "");
    return `${base}/ws/chat/${employeeId}/`;
  }
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
  if (diff < 60_000) return "Last seen recently";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return d.toLocaleDateString([], { day: "numeric", month: "short" });
};

export type OpenChat =
  | { type: "direct"; id: string }
  | { type: "group"; id: string };

export const chatKey = (chat: OpenChat) => `${chat.type}:${chat.id}`;

export const mergeChatMessages = (
  base: ChatMessage[],
  incoming: ChatMessage[],
): ChatMessage[] => {
  const map = new Map<string, ChatMessage>();
  for (const message of base) map.set(message.id, message);
  for (const message of incoming) map.set(message.id, message);
  return Array.from(map.values()).sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
};

export const formatMemberLabel = (member: {
  name: string;
  role?: string;
}) => {
  if (member.role === "hr") return "HR";
  if (member.role === "admin") return "Admin";
  return member.name;
};

export const formatGroupTypingLabel = (
  members: { name: string; role?: string }[],
) => {
  if (members.length === 0) return "";
  if (members.length === 1) {
    return `${formatMemberLabel(members[0])} is typing...`;
  }
  if (members.length === 2) {
    return `${formatMemberLabel(members[0])} and ${formatMemberLabel(members[1])} are typing...`;
  }
  return `${members.length} people are typing...`;
};

export const formatGroupOnlineLabel = (
  onlineMembers: { name: string; role?: string }[],
  totalMembers: number,
) => {
  if (onlineMembers.length === 0) {
    return `${totalMembers} member${totalMembers === 1 ? "" : "s"}`;
  }
  const names = onlineMembers.slice(0, 3).map(formatMemberLabel);
  const extra =
    onlineMembers.length > 3 ? ` +${onlineMembers.length - 3} more` : "";
  return `${names.join(", ")} online${extra}`;
};

export const getGroupWsUrl = (groupId: string, employeeId: string) => {
  const explicit = import.meta.env.VITE_WS_URL?.trim();
  if (explicit) {
    const base = explicit.replace(/\/$/, "");
    return `${base}/ws/group/${groupId}/${employeeId}/`;
  }
  const root = getApiRoot();
  return `${root.replace(/^http:/, "ws:").replace(/^https:/, "wss:")}/ws/group/${groupId}/${employeeId}/`;
};
