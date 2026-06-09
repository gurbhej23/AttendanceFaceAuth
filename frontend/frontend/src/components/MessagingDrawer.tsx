import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { ChevronDown, ChevronUp, MessageSquare, Search, Users } from "lucide-react";
import API from "../services/api";
import DirectChatPopup from "./DirectChatPopup";
import GroupChatPopup from "./GroupChatPopup";
import NotificationBadge from "./NotificationBadge";
import { useUnreadMessages } from "../hooks/useUnreadMessages";
import type { ChatGroup, Contact, OpenChat } from "../utils/chatHelpers";
import { chatKey, getMediaUrl, getWsUrl } from "../utils/chatHelpers";

const HIDDEN_PATHS = new Set([
  "/",
  "/admin-login",
  "/register",
  "/verify-choice",
  "/verify-face",
  "/verify-otp",
  "/forgot-password",
]);

const MAX_OPEN_CHATS = 3;

export default function MessagingDrawer() {
  const location = useLocation();
  const employeeId = localStorage.getItem("employee_id") || "";
  const employeeName = localStorage.getItem("employee_name") || "You";
  const role = localStorage.getItem("role") || "employee";
  const isStaffRole = role === "admin" || role === "hr";
  const profileImg = getMediaUrl(localStorage.getItem("profile_img"));

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const wsHandlers = useRef(new Set<(data: Record<string, unknown>) => void>());

  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<"direct" | "group">("direct");
  const [search, setSearch] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [openChats, setOpenChats] = useState<OpenChat[]>([]);
  const [minimizedChats, setMinimizedChats] = useState<Record<string, boolean>>({});
  const [typingById, setTypingById] = useState<Record<string, boolean>>({});

  const { summary, refreshUnread } = useUnreadMessages(employeeId, 15000);
  const visible = Boolean(employeeId) && !HIDDEN_PATHS.has(location.pathname);

  const registerHandler = useCallback(
    (handler: (data: Record<string, unknown>) => void) => {
      wsHandlers.current.add(handler);
      return () => wsHandlers.current.delete(handler);
    },
    [],
  );

  const broadcastWs = useCallback((data: Record<string, unknown>) => {
    wsHandlers.current.forEach((handler) => handler(data));
  }, []);

  const loadContacts = useCallback(async () => {
    const res = await API.get("/employees/chat-contacts/", {
      params: { employee_id: employeeId },
    });
    setContacts(res.data.contacts || []);
  }, [employeeId]);

  const loadData = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    try {
      const [contactsRes, groupsRes] = await Promise.all([
        API.get("/employees/chat-contacts/", {
          params: { employee_id: employeeId },
        }),
        API.get("/employees/chat-groups/", {
          params: { employee_id: employeeId },
        }),
      ]);
      setContacts(contactsRes.data.contacts || []);
      setGroups(groupsRes.data.groups || []);
      refreshUnread();
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [employeeId, refreshUnread]);

  useEffect(() => {
    if (visible) loadData();
  }, [visible, loadData]);

  useEffect(() => {
    if (expanded && visible) loadData();
  }, [expanded, visible, loadData]);

  useEffect(() => {
    if (!employeeId || !visible) return;

    let active = true;
    let socket: WebSocket | null = null;

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const connectSocket = () => {
      if (!active) return;
      clearReconnectTimer();
      socket = new WebSocket(getWsUrl(employeeId));
      socketRef.current = socket;

      socket.onopen = () => {
        loadContacts();
      };
      socket.onclose = () => {
        if (!active) return;
        reconnectTimerRef.current = window.setTimeout(connectSocket, 2000);
      };
      socket.onerror = () => socket?.close();
      socket.onmessage = (event) => {
        const data = JSON.parse(event.data) as Record<string, unknown>;
        broadcastWs(data);

        if (data.type === "typing") {
          setTypingById((cur) => ({
            ...cur,
            [String(data.sender_id)]: Boolean(data.is_typing),
          }));
        } else if (data.type === "presence") {
          setContacts((cur) =>
            cur.map((contact) =>
              contact.employee_id === data.employee_id
                ? {
                    ...contact,
                    is_online: Boolean(data.is_online),
                    last_seen: (data.last_seen as string) || contact.last_seen,
                  }
                : contact,
            ),
          );
        } else if (data.type === "message" || data.type === "read") {
          refreshUnread();
        }
      };
    };

    const timer = window.setTimeout(connectSocket, 150);
    return () => {
      active = false;
      window.clearTimeout(timer);
      clearReconnectTimer();
      if (socket) {
        socket.onopen = null;
        socket.onclose = null;
        socket.onerror = null;
        socket.onmessage = null;
        if (socket.readyState === WebSocket.OPEN) socket.close();
      }
      socketRef.current = null;
    };
  }, [broadcastWs, employeeId, loadContacts, refreshUnread, visible]);

  const unreadByContact = useMemo(() => {
    const map: Record<string, number> = {};
    summary.directContacts.forEach((c) => {
      map[c.employee_id] = c.unread;
    });
    return map;
  }, [summary.directContacts]);

  const unreadByGroup = useMemo(() => {
    const map: Record<string, number> = {};
    summary.groupUnread.forEach((g) => {
      map[g.group_id] = g.unread;
    });
    return map;
  }, [summary.groupUnread]);

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? contacts.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.employee_id.toLowerCase().includes(q),
        )
      : [...contacts];
    return list.sort((a, b) => {
      const diff =
        (unreadByContact[b.employee_id] || 0) -
        (unreadByContact[a.employee_id] || 0);
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name);
    });
  }, [contacts, search, unreadByContact]);

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? groups.filter((g) => g.group_name.toLowerCase().includes(q))
      : [...groups];
    return list.sort((a, b) => {
      const diff = (unreadByGroup[b.id] || 0) - (unreadByGroup[a.id] || 0);
      if (diff !== 0) return diff;
      return a.group_name.localeCompare(b.group_name);
    });
  }, [groups, search, unreadByGroup]);

  const openChat = (chat: OpenChat) => {
    setExpanded(true);
    setMinimizedChats((cur) => ({ ...cur, [chatKey(chat)]: false }));
    setOpenChats((cur) => {
      const key = chatKey(chat);
      const without = cur.filter((item) => chatKey(item) !== key);
      const next = [...without, chat];
      return next.slice(-MAX_OPEN_CHATS);
    });
  };

  const closeChat = (chat: OpenChat) => {
    const key = chatKey(chat);
    setOpenChats((cur) => cur.filter((item) => chatKey(item) !== key));
    setMinimizedChats((cur) => {
      const next = { ...cur };
      delete next[key];
      return next;
    });
  };

  const toggleMinimize = (chat: OpenChat) => {
    const key = chatKey(chat);
    setMinimizedChats((cur) => ({ ...cur, [key]: !cur[key] }));
  };

  const contactById = useMemo(() => {
    const map: Record<string, Contact> = {};
    contacts.forEach((c) => {
      map[c.employee_id] = c;
    });
    return map;
  }, [contacts]);

  const groupById = useMemo(() => {
    const map: Record<string, ChatGroup> = {};
    groups.forEach((g) => {
      map[g.id] = g;
    });
    return map;
  }, [groups]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 right-4 z-50 flex items-end gap-2">
      {openChats.map((chat) => {
        const key = chatKey(chat);
        const minimized = Boolean(minimizedChats[key]);

        if (chat.type === "direct") {
          const contact = contactById[chat.id];
          if (!contact) return null;
          return (
            <DirectChatPopup
              key={key}
              contact={contact}
              employeeId={employeeId}
              socketRef={socketRef}
              registerHandler={registerHandler}
              onClose={() => closeChat(chat)}
              onMinimize={() => toggleMinimize(chat)}
              minimized={minimized}
              refreshUnread={refreshUnread}
              typing={Boolean(typingById[chat.id])}
            />
          );
        }

        const group = groupById[chat.id];
        if (!group) return null;
        return (
          <GroupChatPopup
            key={key}
            group={group}
            employeeId={employeeId}
            isStaffRole={isStaffRole}
            allContacts={contacts}
            onClose={() => closeChat(chat)}
            onMinimize={() => toggleMinimize(chat)}
            minimized={minimized}
            refreshUnread={refreshUnread}
            unreadByGroup={unreadByGroup}
          />
        );
      })}

      <div className="flex w-[min(calc(100vw-2rem),360px)] flex-col items-stretch">
        {expanded && (
          <div className="flex max-h-[min(70vh,520px)] flex-col overflow-hidden rounded-t-2xl border border-b-0 border-slate-700/80 bg-slate-900 shadow-2xl shadow-black/50">
            <div className="border-b border-slate-800 p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search conversations"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pl-9 pr-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-600"
                />
              </div>
            </div>

            <div className="flex border-b border-slate-800 px-3">
              <button
                type="button"
                onClick={() => setTab("direct")}
                className={`flex flex-1 items-center justify-center gap-2 border-b-2 py-3 text-sm font-semibold transition ${
                  tab === "direct"
                    ? "border-cyan-500 text-cyan-300"
                    : "border-transparent text-slate-500 hover:text-slate-300"
                }`}
              >
                Personal
                <NotificationBadge count={summary.direct} />
              </button>
              <button
                type="button"
                onClick={() => setTab("group")}
                className={`flex flex-1 items-center justify-center gap-2 border-b-2 py-3 text-sm font-semibold transition ${
                  tab === "group"
                    ? "border-violet-500 text-violet-300"
                    : "border-transparent text-slate-500 hover:text-slate-300"
                }`}
              >
                Groups
                <NotificationBadge count={summary.group} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {loading ? (
                <p className="p-6 text-center text-sm text-slate-500">
                  Loading conversations...
                </p>
              ) : tab === "direct" ? (
                filteredContacts.length === 0 ? (
                  <p className="p-6 text-center text-sm text-slate-500">
                    No personal chats found
                  </p>
                ) : (
                  filteredContacts.map((contact) => (
                    <button
                      key={contact.employee_id}
                      type="button"
                      onClick={() =>
                        openChat({ type: "direct", id: contact.employee_id })
                      }
                      className="flex w-full items-center gap-3 border-b border-slate-800/60 px-4 py-3 text-left transition hover:bg-slate-800/70"
                    >
                      <div className="relative h-11 w-11 shrink-0">
                        {contact.profile_img ? (
                          <img
                            src={getMediaUrl(contact.profile_img)}
                            alt={contact.name}
                            className="h-11 w-11 rounded-full object-cover"
                          />
                        ) : (
                          <div className="grid h-11 w-11 place-items-center rounded-full bg-cyan-700 text-sm font-bold text-white">
                            {contact.name.charAt(0)}
                          </div>
                        )}
                        <span
                          className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-slate-900 ${
                            contact.is_online ? "bg-green-400" : "bg-slate-500"
                          }`}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate font-semibold text-sm text-white">
                            {contact.name}
                          </p>
                          <NotificationBadge
                            count={unreadByContact[contact.employee_id] || 0}
                          />
                        </div>
                        <p className="truncate text-xs text-slate-500">
                          {contact.is_online
                            ? "Online"
                            : contact.role === "hr"
                              ? "HR"
                              : contact.role === "admin"
                                ? "Admin"
                                : contact.department || "Employee"}
                        </p>
                      </div>
                    </button>
                  ))
                )
              ) : filteredGroups.length === 0 ? (
                <p className="p-6 text-center text-sm text-slate-500">
                  No groups found
                </p>
              ) : (
                filteredGroups.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => openChat({ type: "group", id: group.id })}
                    className="flex w-full items-center gap-3 border-b border-slate-800/60 px-4 py-3 text-left transition hover:bg-slate-800/70"
                  >
                    <div className="relative h-11 w-11 shrink-0">
                      {group.group_img ? (
                        <img
                          src={getMediaUrl(group.group_img)}
                          alt={group.group_name}
                          className="h-11 w-11 rounded-full object-cover"
                        />
                      ) : (
                        <div className="grid h-11 w-11 place-items-center rounded-full bg-violet-700 text-white">
                          <Users className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-semibold text-sm text-white">
                          {group.group_name}
                        </p>
                        <NotificationBadge count={unreadByGroup[group.id] || 0} />
                      </div>
                      <p className="truncate text-xs text-slate-500">
                        {group.member_count
                          ? `${group.member_count} members`
                          : "Group chat"}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex h-12 items-center gap-3 border border-b-0 border-slate-700/80 bg-slate-900 px-4 shadow-xl transition hover:bg-slate-800"
        >
          <div className="relative shrink-0">
            {profileImg ? (
              <img
                src={profileImg}
                alt={employeeName}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <div className="grid h-8 w-8 place-items-center rounded-full bg-cyan-700 text-xs font-bold text-white">
                {employeeName.charAt(0)}
              </div>
            )}
            {summary.total > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white">
                {summary.total > 99 ? "99+" : summary.total}
              </span>
            )}
          </div>

          <span className="flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold text-white">
            <MessageSquare className="h-4 w-4 shrink-0 text-cyan-400" />
            Messages
          </span>

          <span className="text-slate-400">
            {expanded ? (
              <ChevronDown className="h-5 w-5" />
            ) : (
              <ChevronUp className="h-5 w-5" />
            )}
          </span>
        </button>
      </div>
    </div>
  );
}
