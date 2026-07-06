import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation } from "react-router-dom";
import { MessageSquare, Search, Users, X } from "lucide-react";
import API from "../../services/api";
import DirectChatPopup from "./DirectChatPopup";
import GroupChatPopup from "./GroupChatPopup";
import NotificationBadge from "../common/NotificationBadge";
import { useUnreadMessages } from "../../hooks/useUnreadMessages";
import { useEmployeeSession } from "../../hooks/useEmployeeSession";
import type { ChatGroup, Contact, OpenChat } from "../../utils/chatHelpers";
import {
  chatKey,
  getMediaUrl,
  getWsUrl,
  resolveBackendOrigin,
} from "../../utils/chatHelpers";
import { listenNotificationAction } from "../../utils/notificationActions";
import Button from "../common/Button";
import EmptyState from "../common/EmptyState";
import Input from "../common/Input";
import ProfileAvatarImg from "../common/ProfileAvatarImg";
import { chatPanelSlide } from "../../motion/presets";

const HIDDEN_PATHS = new Set([
  "/",
  "/admin-login",
  "/register",
  "/verify-choice",
  "/verify-face",
  "/verify-otp",
  "/verify-pin",
  "/forgot-password",
]);

const MAX_OPEN_CHATS = 3;
const MOBILE_BP = 768;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < MOBILE_BP : false,
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BP - 1}px)`);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}

export default function MessagingDrawer() {
  const location = useLocation();
  const { employeeId, employeeName, role, isLoggedIn } = useEmployeeSession();
  const isStaffRole = role === "admin" || role === "hr";
  const profileImg = getMediaUrl(localStorage.getItem("profile_img"));

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const typingTimersRef = useRef<Record<string, number>>({});
  const wsHandlers = useRef(new Set<(data: Record<string, unknown>) => void>());

  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<"direct" | "group">("direct");
  const [search, setSearch] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [openChats, setOpenChats] = useState<OpenChat[]>([]);
  const [minimizedChats, setMinimizedChats] = useState<Record<string, boolean>>(
    {},
  );
  const [typingById, setTypingById] = useState<Record<string, boolean>>({});
  const [groupAddedNotice, setGroupAddedNotice] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [presenceById, setPresenceById] = useState<
    Record<string, { is_online: boolean; last_seen?: string }>
  >({});
  const contactsRef = useRef<Contact[]>([]);
  const prevUnreadTotalRef = useRef(0);
  const [fabAttention, setFabAttention] = useState(false);

  const { summary, refreshUnread } = useUnreadMessages(
    employeeId,
    wsConnected ? 30000 : 4000,
  );
  const isMobile = useIsMobile();
  const visible = isLoggedIn && !HIDDEN_PATHS.has(location.pathname);
  const socketEnabled = visible;

  const activeChat = openChats[openChats.length - 1] ?? null;
  const activeChatKey = activeChat ? chatKey(activeChat) : "";
  const showMobileChat =
    isMobile && activeChat && !minimizedChats[activeChatKey];

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

  const presenceByIdRef = useRef(presenceById);
  presenceByIdRef.current = presenceById;

  const loadContacts = useCallback(async () => {
    if (!employeeId) return;
    const res = await API.get("/employees/chat-contacts/", {
      params: { employee_id: employeeId },
    });
    const list = (res.data.contacts || []) as Contact[];
    const presence = presenceByIdRef.current;
    setContacts(
      list.map((contact) => {
        const live = presence[contact.employee_id];
        if (!live) return contact;
        return {
          ...contact,
          is_online: live.is_online,
          last_seen: live.last_seen ?? contact.last_seen,
        };
      }),
    );
  }, [employeeId]);

  const loadContactsRef = useRef(loadContacts);
  loadContactsRef.current = loadContacts;
  const refreshUnreadRef = useRef(refreshUnread);
  refreshUnreadRef.current = refreshUnread;
  const reconnectAttemptRef = useRef(0);
  const heartbeatTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (summary.total > prevUnreadTotalRef.current) {
      setFabAttention(true);
      const timer = window.setTimeout(() => setFabAttention(false), 560);
      prevUnreadTotalRef.current = summary.total;
      return () => window.clearTimeout(timer);
    }
    prevUnreadTotalRef.current = summary.total;
    return undefined;
  }, [summary.total]);

  const applyPresence = useCallback(
    (id: string, isOnline: boolean, lastSeen?: string) => {
      setPresenceById((cur) => ({
        ...cur,
        [id]: {
          is_online: isOnline,
          last_seen: lastSeen || cur[id]?.last_seen,
        },
      }));
      setContacts((cur) =>
        cur.map((contact) =>
          contact.employee_id === id
            ? {
                ...contact,
                is_online: isOnline,
                last_seen: lastSeen || contact.last_seen,
              }
            : contact,
        ),
      );
    },
    [],
  );

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
      const list = (contactsRes.data.contacts || []) as Contact[];
      const presence = presenceByIdRef.current;
      setContacts(
        list.map((contact) => {
          const live = presence[contact.employee_id];
          if (!live) return contact;
          return {
            ...contact,
            is_online: live.is_online,
            last_seen: live.last_seen ?? contact.last_seen,
          };
        }),
      );
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
    if (socketEnabled && employeeId) {
      void loadContactsRef.current();
    }
  }, [socketEnabled, employeeId]);

  useEffect(() => {
    contactsRef.current = contacts;
  }, [contacts]);

  useEffect(() => {
    if (!employeeId || !socketEnabled) {
      setWsConnected(false);
      return;
    }

    let active = true;
    let socket: WebSocket | null = null;

    const clearHeartbeat = () => {
      if (heartbeatTimerRef.current) {
        window.clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
    };

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const connectSocket = async () => {
      if (!active) return;
      clearReconnectTimer();
      clearHeartbeat();

      const url = getWsUrl(employeeId);
      if (!url) {
        setWsConnected(false);
        setConnectionError(
          "Chat server URL missing. Set VITE_API_URL on Vercel to your Render backend /api URL.",
        );
        window.setTimeout(() => setConnectionError(""), 6000);
        return;
      }

      // Wake Render free-tier instance before WebSocket handshake.
      if (!import.meta.env.DEV) {
        const root = resolveBackendOrigin();
        if (root) {
          try {
            await fetch(`${root}/`, { method: "GET", cache: "no-store" });
          } catch {
            /* server may still be starting */
          }
        }
      }

      if (!active) return;

      socket = new WebSocket(url);
      socketRef.current = socket;

      socket.onopen = () => {
        reconnectAttemptRef.current = 0;
        setWsConnected(true);
        void loadContactsRef.current();
        heartbeatTimerRef.current = window.setInterval(() => {
          if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "ping" }));
          }
        }, 25000);
      };
      socket.onclose = () => {
        setWsConnected(false);
        clearHeartbeat();
        if (!active) return;
        const attempt = reconnectAttemptRef.current;
        reconnectAttemptRef.current = attempt + 1;
        const delay = Math.min(500 * 2 ** attempt, 5000);
        reconnectTimerRef.current = window.setTimeout(() => {
          void connectSocket();
        }, delay);
      };
      socket.onerror = () => {
        setWsConnected(false);
        socket?.close();
      };
      socket.onmessage = (event) => {
        let data: Record<string, unknown>;
        try {
          data = JSON.parse(event.data) as Record<string, unknown>;
        } catch {
          return;
        }
        broadcastWs(data);

        if (data.type === "typing") {
          const senderId = String(data.sender_id);
          const isTyping = Boolean(data.is_typing);
          setTypingById((cur) => ({ ...cur, [senderId]: isTyping }));
          if (typingTimersRef.current[senderId]) {
            window.clearTimeout(typingTimersRef.current[senderId]);
            delete typingTimersRef.current[senderId];
          }
          if (isTyping) {
            typingTimersRef.current[senderId] = window.setTimeout(() => {
              setTypingById((cur) => ({ ...cur, [senderId]: false }));
              delete typingTimersRef.current[senderId];
            }, 3000);
          }
        } else if (data.type === "presence") {
          applyPresence(
            String(data.employee_id),
            Boolean(data.is_online),
            (data.last_seen as string) || undefined,
          );
        } else if (data.type === "presence_snapshot") {
          const onlineIds = new Set((data.online_ids as string[]) || []);
          setPresenceById((cur) => {
            const next = { ...cur };
            onlineIds.forEach((id) => {
              next[id] = { is_online: true, last_seen: next[id]?.last_seen };
            });
            return next;
          });
          setContacts((cur) =>
            cur.map((contact) => ({
              ...contact,
              is_online: onlineIds.has(contact.employee_id),
            })),
          );
        } else if (data.type === "message" || data.type === "read") {
          refreshUnreadRef.current();
        } else if (data.type === "group_added") {
          const group = data.group as ChatGroup | undefined;
          const notice = String(data.message || "You were added to a group");
          if (group?.id) {
            setGroups((cur) =>
              cur.some((g) => g.id === group.id) ? cur : [group, ...cur],
            );
            setTab("group");
            setExpanded(true);
            setGroupAddedNotice(notice);
            window.setTimeout(() => setGroupAddedNotice(null), 6000);
            window.dispatchEvent(
              new CustomEvent("group_added", { detail: group }),
            );
            refreshUnread();
          }
        }
      };
    };

    void connectSocket();
    return () => {
      active = false;
      clearReconnectTimer();
      clearHeartbeat();
      Object.values(typingTimersRef.current).forEach((timerId) =>
        window.clearTimeout(timerId),
      );
      typingTimersRef.current = {};
      if (socket) {
        socket.onopen = null;
        socket.onclose = null;
        socket.onerror = null;
        socket.onmessage = null;
        if (socket.readyState === WebSocket.OPEN) socket.close();
      }
      socketRef.current = null;
      setWsConnected(false);
    };
  }, [applyPresence, broadcastWs, employeeId, socketEnabled, refreshUnread]);

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
    setMinimizedChats((cur) => ({ ...cur, [chatKey(chat)]: false }));
    setExpanded(false);
    if (isMobile) {
      setOpenChats([chat]);
      return;
    }
    setOpenChats((cur) => {
      const key = chatKey(chat);
      const without = cur.filter((item) => chatKey(item) !== key);
      return [...without, chat].slice(-MAX_OPEN_CHATS);
    });
  };

  useEffect(() => {
    return listenNotificationAction((action) => {
      if (action.type === "open_chat") {
        if (action.contact) {
          setContacts((cur) => {
            if (
              cur.some((c) => c.employee_id === action.contact!.employee_id)
            ) {
              return cur;
            }
            return [...cur, action.contact!];
          });
        }
        openChat(action.chat);
      }
    });
  });

  const closeChat = (chat: OpenChat) => {
    const key = chatKey(chat);
    setOpenChats((cur) => cur.filter((item) => chatKey(item) !== key));
    setMinimizedChats((cur) => {
      const next = { ...cur };
      delete next[key];
      return next;
    });
    setExpanded(true);
  };

  const toggleMinimize = (chat: OpenChat) => {
    const key = chatKey(chat);
    setMinimizedChats((cur) => {
      const next = !cur[key];
      return { ...cur, [key]: next };
    });
    if (isMobile) return;
    setExpanded(false);
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

  const renderChatPopup = (chat: OpenChat, fullScreen: boolean) => {
    const key = chatKey(chat);
    const minimized = Boolean(minimizedChats[key]);
    const commonClose = () => closeChat(chat);

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
          onClose={commonClose}
          onMinimize={() => toggleMinimize(chat)}
          minimized={minimized}
          fullScreen={fullScreen}
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
        onClose={commonClose}
        onMinimize={() => toggleMinimize(chat)}
        minimized={minimized}
        fullScreen={fullScreen}
        refreshUnread={refreshUnread}
        unreadByGroup={unreadByGroup}
      />
    );
  };

  const drawerPanel = (
    <div
      className={`chat-panel flex flex-col overflow-hidden border border-slate-700/60 bg-slate-800/98 shadow-2xl backdrop-blur-xl rounded-t-2xl ${
        isMobile
          ? "max-h-[min(80dvh,640px)] w-full border-b-0"
          : "max-h-[min(75vh,520px)] w-full border-b-0"
      }`}
    >
      <div className="flex justify-end gap-3 border-b border-slate-800 p-3">
        <button
          type="button"
          onClick={() => setExpanded(false)}
          aria-label="Close messages"
          className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full text-slate-400 transition hover:bg-slate-700 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {groupAddedNotice && (
        <div className="border-b border-emerald-500/30 bg-emerald-500/15 px-4 py-2.5 text-center text-sm font-medium text-emerald-200">
          {groupAddedNotice}
        </div>
      )}

      {/* rest of drawerPanel stays exactly the same */}

      <div className="border-b border-slate-800 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pl-9 pr-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-600"
          />
        </div>
      </div>

      <div className="flex border-b border-slate-800 px-3">
        <Button
          text={
            <>
              Personal
              <NotificationBadge count={summary.direct} />{" "}
            </>
          }
          type="button"
          onClick={() => setTab("direct")}
          className={`flex flex-1 items-center justify-center gap-2 border-b-2 py-3 text-sm font-semibold transition cursor-pointer ${
            tab === "direct"
              ? "border-cyan-500 text-cyan-300"
              : "border-transparent text-slate-500 hover:text-slate-300"
          }`}
        />
        <Button
          text={
            <>
              Groups
              <NotificationBadge count={summary.group} />
            </>
          }
          type="button"
          onClick={() => setTab("group")}
          className={`flex flex-1 items-center justify-center gap-2 border-b-2 py-3 text-sm font-semibold transition cursor-pointer ${
            tab === "group"
              ? "border-violet-500 text-violet-300"
              : "border-transparent text-slate-500 hover:text-slate-300"
          }`}
        />
      </div>

      <div className="pro-chat-scroll min-h-0 flex-1">
        {loading ? (
          <p className="p-6 text-center text-sm text-slate-500">
            Loading conversations...
          </p>
        ) : tab === "direct" ? (
          filteredContacts.length === 0 ? (
            <EmptyState
              icon={<MessageSquare className="h-7 w-7 text-slate-600" />}
              title="No personal chats found"
              className="py-8"
            />
          ) : (
            filteredContacts.map((contact) => (
              <button
                key={contact.employee_id}
                type="button"
                onClick={() =>
                  openChat({ type: "direct", id: contact.employee_id })
                }
                className="flex w-full items-center gap-3 border-b border-slate-800/60 px-4 py-3 text-left transition hover:bg-slate-800/70 cursor-pointer"
              >
                <div className="relative h-11 w-11 shrink-0">
                  {contact.profile_img ? (
                    <ProfileAvatarImg
                      src={getMediaUrl(contact.profile_img)}
                      alt={contact.name}
                      className="h-11 w-11 rounded-full"
                    />
                  ) : (
                    <div className="grid h-11 w-11 place-items-center rounded-full bg-cyan-700 text-sm font-bold text-white">
                      {contact.name.charAt(0)}
                    </div>
                  )}
                  {contact.is_online && (
                    <span className="absolute bottom-0.5 right-0 h-3 w-3 rounded-full border-2 border-slate-900 bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
                  )}
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
                    {typingById[contact.employee_id]
                      ? "Typing..."
                      : contact.is_online
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
          <EmptyState
            icon={<Users className="h-7 w-7 text-slate-600" />}
            title="No groups found"
            className="py-8"
          />
        ) : (
          filteredGroups.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => openChat({ type: "group", id: group.id })}
              className="flex w-full items-center gap-3 border-b border-slate-800/60 px-4 py-3 text-left transition hover:bg-slate-800/70 cursor-pointer"
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
  );

  const fabButton = (
    <>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={`chat-fab flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center rounded-full border border-cyan-800 bg-slate-800 px-4 text-cyan-500 shadow-xl shadow-cyan-950/40 backdrop-blur-xl transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] hover:scale-105 active:scale-95 md:h-14 md:w-14 md:p-0 md:gap-3 md:border-slate-700 md:hover:scale-100 md:hover:bg-slate-700 fixed right-4 bottom-4 ${
          fabAttention ? "fab-attention-bounce" : ""
        }`}
        aria-label={expanded ? "Close messages" : "Open messages"}
      >
        <div className="relative flex items-center gap-3">
          <MessageSquare className="h-8 w-8 md:hidden" />
          <div className="relative hidden md:block">
            {profileImg ? (
              <ProfileAvatarImg
                src={profileImg}
                alt={employeeName}
                className="h-14 w-14 rounded-full "
              />
            ) : (
              <div className="grid h-10 w-10 place-items-center rounded-full bg-cyan-700 text-xs font-bold text-white">
                {employeeName.charAt(0)}
              </div>
            )}
          </div>
          <span
            className={`absolute bottom-0 left-6 md:left-9.5 h-3 w-3 rounded-full ring-1 ring-slate-900 ${
              wsConnected ? "bg-emerald-400" : "bg-amber-400"
            }`}
            title={
              wsConnected ? "Live chat connected" : "Connecting to chat server…"
            }
          />
          {summary.total > 0 && (
            <span className="notification-badge-pulse absolute -left-1 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white ring-1 ring-slate-900">
              {summary.total > 99 ? "99+" : summary.total}
            </span>
          )}
        </div>
        {/* <div className="absolute right-5 top-4">
          <ChevronUp
            className={`h-5 w-5 transition-transform duration-400 hidden md:block ${expanded ? "rotate-180" : ""
              }`}
          />
        </div> */}
      </button>
    </>
  );

  if (!visible) return null;

  return createPortal(
    <>
      {connectionError && (
        <div className="fixed left-1/2 top-5 z-90 max-w-md -translate-x-1/2 rounded-2xl border border-red-500/40 bg-red-950/95 px-4 py-3 text-center text-sm text-red-200 shadow-xl">
          {connectionError}
        </div>
      )}

      {/* Mobile: backdrop when list open */}
      {isMobile && expanded && !showMobileChat && (
        <button
          type="button"
          aria-label="Close messages"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] md:hidden"
          onClick={() => setExpanded(false)}
        />
      )}

      {/* Mobile: full-screen chat */}
      {showMobileChat && activeChat && (
        <div className="pointer-events-auto fixed inset-0 z-60 md:hidden">
          {renderChatPopup(activeChat, true)}
        </div>
      )}

      {/* Desktop: floating chat windows */}
      <div className="z-app-chat fixed bottom-0 right-0 hidden items-end gap-2 md:flex">
        {openChats.map((chat) => (
          <div
            key={chatKey(chat)}
            className="pointer-events-auto fixed right-4 shrink-0 z-999"
          >
            {renderChatPopup(chat, false)}
          </div>
        ))}
        <div className="pointer-events-auto flex w-[min(calc(100vw-2rem),460px)] flex-col items-end fixed right-4">
          {!expanded && fabButton}
          <AnimatePresence>
            {expanded && (
              <motion.div
                key="chat-drawer-desktop"
                className="pointer-events-auto mb-0 w-full"
                initial={chatPanelSlide.initial}
                animate={chatPanelSlide.animate}
                exit={chatPanelSlide.exit}
                transition={chatPanelSlide.transition}
              >
                {drawerPanel}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Mobile: bottom sheet + FAB */}
      {!showMobileChat && (
        <div className="z-app-chat pointer-events-none fixed inset-x-0 bottom-0 flex flex-col items-end p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
          <AnimatePresence>
            {expanded && (
              <motion.div
                key="chat-drawer-mobile"
                className="pointer-events-auto mb-3 w-full"
                initial={chatPanelSlide.initial}
                animate={chatPanelSlide.animate}
                exit={chatPanelSlide.exit}
                transition={chatPanelSlide.transition}
              >
                {drawerPanel}
              </motion.div>
            )}
          </AnimatePresence>
          {!expanded && <div className="pointer-events-auto">{fabButton}</div>}
        </div>
      )}
    </>,
    document.body,
  );
}
