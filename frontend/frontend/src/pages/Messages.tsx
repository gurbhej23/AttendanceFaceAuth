// src/pages/Messages.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import EmojiPicker from "../components/EmojiPicker";
import { ArrowBigLeft, Check, CheckCheck } from "lucide-react";

interface Contact {
  employee_id: string;
  name: string;
  role: string;
  department: string;
  designation: string;
  profile_img: string;
  is_online?: boolean;
  last_seen?: string;
}

interface ChatMessage {
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

const getApiRoot = () => {
  const base =
    import.meta.env.VITE_API_URL ||
    API.defaults.baseURL ||
    "http://localhost:8000/api";
  if (!base.startsWith("http")) return window.location.origin;

  const url = new URL(base);
  url.pathname = url.pathname.replace(/\/api\/?$/, "");
  return url.toString().replace(/\/$/, "");
};

const getMediaUrl = (path?: string | null) => {
  if (!path) return "";
  if (path.startsWith("http")) {
    const url = new URL(path);
    if (window.location.protocol === "https:" && url.protocol === "http:") {
      return `${getApiRoot()}${url.pathname}`;
    }
    return path;
  }
  return `${getApiRoot()}${path.startsWith("/") ? path : `/${path}`}`;
};

const getWsUrl = (employeeId: string) => {
  const root = getApiRoot();
  return `${root.replace(/^http:/, "ws:").replace(/^https:/, "wss:")}/ws/chat/${employeeId}/`;
};

export default function Messages() {
  const navigate = useNavigate();
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<Contact | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const employeeId = localStorage.getItem("employee_id") || "";
  const role = localStorage.getItem("role") || "employee";
  const isStaffRole = role === "admin" || role === "hr";

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [menuMsgId, setMenuMsgId] = useState<string | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [sendError, setSendError] = useState("");
  const [sending, setSending] = useState(false);
  const [typingById, setTypingById] = useState<Record<string, boolean>>({});
  const typingStopTimer = useRef<number | null>(null);
  const [showInputEmoji, setShowInputEmoji] = useState(false);
  // state used strictly to trigger re-renders so timers increment on-screen
  const [, setTick] = useState(0);
  const [deleteMsgId, setDeleteMsgId] = useState<string | null>(null);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    const handler = () => {
      setMenuMsgId(null);
      setShowInputEmoji(false);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const loadContacts = useCallback(async () => {
    if (!employeeId) {
      navigate("/", { replace: true });
      return;
    }
    const res = await API.get("/employees/chat-contacts/", {
      params: { employee_id: employeeId },
    });
    const next = res.data.contacts || [];
    setContacts(next);
    setSelected((current) => {
      if (!current) return isStaffRole ? null : next[0] || null;
      return (
        next.find(
          (contact: Contact) => contact.employee_id === current.employee_id,
        ) ||
        current ||
        null
      );
    });
    setLoading(false);
  }, [employeeId, isStaffRole, navigate]);

  const markConversationRead = useCallback((contactId: string) => {
    const socket = socketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "read", contact_id: contactId }));
  }, []);

  const loadHistory = useCallback(async () => {
    if (!selected) return;
    const res = await API.get("/employees/chat-history/", {
      params: { employee_id: employeeId, contact_id: selected.employee_id },
    });
    setMessages(res.data.messages || []);
    markConversationRead(selected.employee_id);
  }, [employeeId, markConversationRead, selected]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const formatMessageDate = (ds: string) => {
    const d = new Date(ds),
      today = new Date();
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

  const formatLastSeen = (ds?: string) => {
    if (!ds) return "Offline";
    const d = new Date(ds);
    if (Number.isNaN(d.getTime())) return "Offline";

    const currentTimestamp = Date.now();
    const diff = currentTimestamp - d.getTime();

    if (diff < 60_000) return "Last seen just now";
    if (diff < 3_600_000) {
      return `Last seen ${Math.floor(diff / 60_000)} min ago`;
    }

    const today = new Date(currentTimestamp);
    const yesterday = new Date(currentTimestamp);
    yesterday.setDate(today.getDate() - 1);

    const dString = d.toDateString();

    if (dString === today.toDateString()) {
      return `Last seen ${d.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    }

    if (dString === yesterday.toDateString()) {
      return `Last seen yesterday at ${d.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    }

    return `Last seen ${d.toLocaleDateString([], {
      day: "numeric",
      month: "short",
    })}`;
  };

  const sendTyping = (isTyping: boolean) => {
    if (!selected || socketRef.current?.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: "typing",
        recipient_id: selected.employee_id,
        is_typing: isTyping,
      }),
    );
  };

  useEffect(() => {
    if (!employeeId) return;
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
        setConnected(true);
        loadContacts();
      };
      socket.onclose = () => {
        if (!active) return;
        setConnected(false);
        reconnectTimerRef.current = window.setTimeout(connectSocket, 2000);
      };
      socket.onerror = () => {
        setConnected(false);
        socket?.close();
      };
      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);

        // ── New message ──────────────────────────────────────────────────────
        if (data.type === "message") {
          const incoming = data.message as ChatMessage;
          const open = selectedRef.current;
          if (open && incoming.sender_id === open.employee_id) {
            markConversationRead(open.employee_id);
          }
          setMessages((cur) => {
            const belongs =
              open &&
              ((incoming.sender_id === open.employee_id &&
                incoming.recipient_id === employeeId) ||
                (incoming.sender_id === employeeId &&
                  incoming.recipient_id === open.employee_id));
            if (!belongs || cur.some((m) => m.id === incoming.id)) return cur;
            return [...cur, incoming];
          });
        }

        // ── Edit broadcast — other person edited a message ───────────────────
        else if (data.type === "edit") {
          const updated = data.message as ChatMessage;
          setMessages((cur) =>
            cur.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)),
          );
        }

        // ── Delete broadcast ─────────────────────────────────────────────────
        else if (data.type === "delete") {
          const updated = data.message as ChatMessage;
          setMessages((cur) =>
            cur.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)),
          );
        }

        // ── React broadcast ──────────────────────────────────────────────────
        else if (data.type === "react") {
          const updated = data.message as ChatMessage;
          setMessages((cur) =>
            cur.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)),
          );
        } else if (data.type === "typing") {
          setTypingById((cur) => ({
            ...cur,
            [data.sender_id]: Boolean(data.is_typing),
          }));
        } else if (data.type === "presence") {
          setContacts((cur) =>
            cur.map((contact) =>
              contact.employee_id === data.employee_id
                ? {
                    ...contact,
                    is_online: Boolean(data.is_online),
                    last_seen: data.last_seen || contact.last_seen,
                  }
                : contact,
            ),
          );
          setSelected((contact) => {
            if (!contact || contact.employee_id !== data.employee_id) {
              return contact;
            }
            return {
              ...contact,
              is_online: Boolean(data.is_online),
              last_seen: data.last_seen || contact.last_seen,
            };
          });
        } else if (data.type === "read") {
          if (data.reader_id === selectedRef.current?.employee_id) {
            setMessages((cur) =>
              cur.map((message) =>
                message.sender_id === employeeId &&
                message.recipient_id === data.reader_id
                  ? { ...message, is_read: true }
                  : message,
              ),
            );
          }
        }
      };
    };

    const t = window.setTimeout(connectSocket, 150);

    return () => {
      active = false;
      window.clearTimeout(t);
      clearReconnectTimer();
      if (typingStopTimer.current) window.clearTimeout(typingStopTimer.current);
      if (socket) {
        socket.onopen = null;
        socket.onclose = null;
        socket.onerror = null;
        socket.onmessage = null;
        if (socket.readyState === WebSocket.OPEN) socket.close();
      }
      socketRef.current = null;
    };
  }, [employeeId, loadContacts, markConversationRead]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const staffContacts = useMemo(
    () => contacts.filter((c) => c.role !== "employee"),
    [contacts],
  );

  const isConversationMessage = useCallback(
    (message: ChatMessage, contact: Contact | null) =>
      Boolean(
        contact &&
        ((message.sender_id === contact.employee_id &&
          message.recipient_id === employeeId) ||
          (message.sender_id === employeeId &&
            message.recipient_id === contact.employee_id)),
      ),
    [employeeId],
  );

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text || !selected || sending) return;
    setSendError("");
    setSending(true);
    const recipientId = selected.employee_id;
    const socket = socketRef.current;
    const socketOpen = socket?.readyState === WebSocket.OPEN;

    if (socketOpen) {
      socket.send(
        JSON.stringify({
          type: "message",
          recipient_id: recipientId,
          message: text,
        }),
      );
      setDraft("");
      sendTyping(false);
      setSending(false);
      inputRef.current?.focus();
      return;
    }

    try {
      const res = await API.post("/employees/chat-message/send/", {
        sender_id: employeeId,
        recipient_id: recipientId,
        message: text,
      });
      if (res.data.success && res.data.message) {
        const saved = res.data.message as ChatMessage;
        setMessages((cur) =>
          isConversationMessage(saved, selectedRef.current) &&
          !cur.some((msg) => msg.id === saved.id)
            ? [...cur, saved]
            : cur,
        );
        setDraft("");
        sendTyping(false);
        inputRef.current?.focus();
      } else {
        setSendError(res.data.error || "Message not sent");
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setSendError(
        error.response?.data?.error || "Message not sent. Check backend.",
      );
    } finally {
      setSending(false);
    }
  };

  const handleDraftChange = (value: string) => {
    setDraft(value);
    sendTyping(Boolean(value.trim()));
    if (typingStopTimer.current) {
      window.clearTimeout(typingStopTimer.current);
    }
    typingStopTimer.current = window.setTimeout(() => {
      sendTyping(false);
    }, 1200);
  };

  const deleteMessage = async (msgId: string) => {
    setDeleteMsgId(null);

    setMessages((cur) =>
      cur.map((m) =>
        m.id === msgId
          ? { ...m, is_deleted: true, message: "This message was deleted" }
          : m,
      ),
    );

    const socket = socketRef.current;
    const socketOpen = socket?.readyState === WebSocket.OPEN;
    if (socketOpen) {
      socket.send(
        JSON.stringify({
          type: "delete",
          message_id: msgId,
        }),
      );
    }

    if (!socketOpen) {
      try {
        await API.delete(`/employees/chat-message/${msgId}/`, {
          data: { employee_id: employeeId },
        });
      } catch {
        /* already updated locally */
      }
    }
  };

  const startEdit = (msg: ChatMessage) => {
    setMenuMsgId(null);
    setEditingMsgId(msg.id);
    setEditDraft(msg.message);
  };

  const submitEdit = async () => {
    if (!editingMsgId || !editDraft.trim()) return;
    const newText = editDraft.trim();

    setMessages((cur) =>
      cur.map((m) =>
        m.id === editingMsgId ? { ...m, message: newText, is_edited: true } : m,
      ),
    );

    const socket = socketRef.current;
    const socketOpen = socket?.readyState === WebSocket.OPEN;
    if (socketOpen) {
      socket.send(
        JSON.stringify({
          type: "edit",
          message_id: editingMsgId,
          new_text: newText,
        }),
      );
    }

    if (!socketOpen) {
      try {
        await API.patch(`/employees/chat-message/${editingMsgId}/`, {
          employee_id: employeeId,
          message: newText,
        });
      } catch {
        /* already updated locally */
      }
    }

    setEditingMsgId(null);
    setEditDraft("");
  };

  const reactToMessage = async (msgId: string, emoji: string) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: "react",
          message_id: msgId,
          emoji,
        }),
      );
    } else {
      try {
        await API.post(`/employees/chat-message/${msgId}/react/`, {
          employee_id: employeeId,
          emoji,
        });
      } catch (err) {
        console.error("Failed to react to message:", err);
      }
    }
  };

  const insertEmoji = (emoji: string) => {
    setDraft((d) => d + emoji);
    inputRef.current?.focus();
  };

  return (
    <div className="chat-scroll min-h-screen bg-slate-950 p-4 text-white sm:p-6">
      <style>{`
        .chat-scroll [class*="overflow-y-auto"] {
          overflow-y: scroll !important;
          scrollbar-gutter: stable;
          scrollbar-width: thin;
          scrollbar-color: #64748b #020617;
        }

        .chat-scroll main [class*="overflow-y-auto"] {
          max-height: calc(100vh - 260px);
          min-height: 360px;
        }

        .chat-scroll [class*="overflow-y-auto"]::-webkit-scrollbar {
          width: 10px;
        }

        .chat-scroll [class*="overflow-y-auto"]::-webkit-scrollbar-track {
          background: #020617;
          border-radius: 999px;
        }

        .chat-scroll [class*="overflow-y-auto"]::-webkit-scrollbar-thumb {
          background: #64748b;
          border: 2px solid #020617;
          border-radius: 999px;
        }

        .chat-scroll [class*="overflow-y-auto"]::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
      <div className="mx-auto max-w-7xl">
        <header className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <button
            onClick={() =>
              navigate(role === "employee" ? "/dashboard" : "/attendance-sheet")
            }
            className="px-2 text-sm font-semibold hover:bg-slate-800 cursor-pointer"
          >
            {<ArrowBigLeft size={30} />}
          </button>
          {/* <div>
            <p className="mt-1 text-sm text-slate-400">
              <span
                className={connected ? "text-green-400" : "text-yellow-400"}
              >
                {connected ? "● Connected" : "◌ Connecting..."}
              </span>
            </p>
          </div> */}
        </header>

        <div
          className={`min-h-[72vh] overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 ${
            isStaffRole ? "flex flex-col" : "grid lg:grid-cols-[300px_1fr]"
          }`}
        >
          {/* Sidebar */}
          {!isStaffRole && (
          <aside className="border-b border-slate-800 lg:border-b-0 lg:border-r">
            <div className="border-b border-slate-800 p-4">
              <p className="text-sm font-semibold text-slate-300">
                {role === "employee" ? "Admin / HR" : "Employees"}
              </p>
              {role === "employee" && (
                <p className="mt-1 text-xs text-slate-500">
                  {staffContacts.length} staff contact
                  {staffContacts.length === 1 ? "" : "s"} available
                </p>
              )}
            </div>
            <div className="max-h-[68vh] overflow-y-auto p-3">
              {loading ? (
                <p className="p-4 text-sm text-slate-500">
                  Loading contacts...
                </p>
              ) : contacts.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">No contacts found</p>
              ) : (
                contacts.map((contact) => (
                  <button
                    key={contact.employee_id}
                    onClick={() => setSelected(contact)}
                    className={`mb-2 flex w-full items-center gap-3 rounded-2xl p-3 text-left transition ${
                      selected?.employee_id === contact.employee_id
                        ? "bg-slate-600"
                        : "bg-slate-950 hover:bg-slate-800"
                    }`}
                  >
                    <div className="absolute top-4 left-50 h-11 w-11 shrink-0 rounded-full bg-slate-800">
                      {contact.profile_img ? (
                        <div className="h-full w-full overflow-hidden rounded-full">
                          <img
                            src={getMediaUrl(contact.profile_img)}
                            alt={contact.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="grid h-full w-full place-items-center overflow-hidden rounded-2xl bg-cyan-600 font-bold text-sm">
                          {contact.name.charAt(0)}
                        </div>
                      )}
                      <span
                        className={`absolute bottom-0.5 right-0 h-2.5 w-2.5 rounded-full border border-slate-950 ${
                          contact.is_online ? "bg-green-400" : "bg-slate-500"
                        }`}
                      />
                    </div>
                    <div className="min-w-0 flex flex-col gap-2">
                      <p className="truncate font-semibold text-sm">
                        {contact.name}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {contact.is_online
                          ? "Online"
                          : formatLastSeen(contact.last_seen)}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </aside>
          )}

          {isStaffRole && (
            <section className="border-b border-slate-800 bg-slate-950/40">
              <div className="flex items-center justify-between gap-4 px-5 py-4">
                <div>
                  <p className="text-sm font-semibold text-slate-100">
                    Conversations
                  </p>
                  <p className="text-xs text-slate-500">
                    {contacts.length} active employee
                    {contacts.length === 1 ? "" : "s"}
                  </p>
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    connected
                      ? "border-green-500/30 bg-green-500/10 text-green-300"
                      : "border-yellow-500/30 bg-yellow-500/10 text-yellow-300"
                  }`}
                >
                  {connected ? "Connected" : "Connecting"}
                </span>
              </div>
              <div className="flex gap-3 overflow-x-auto px-5 pb-4">
                {loading ? (
                  <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-500">
                    Loading employees...
                  </div>
                ) : contacts.length === 0 ? (
                  <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-500">
                    No employees found
                  </div>
                ) : (
                  contacts.map((contact) => (
                    <button
                      key={contact.employee_id}
                      type="button"
                      onClick={() => setSelected(contact)}
                      className={`flex min-w-64 items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                        selected?.employee_id === contact.employee_id
                          ? "border-blue-500 bg-blue-600/20"
                          : "border-slate-800 bg-slate-900 hover:border-slate-600 hover:bg-slate-800"
                      }`}
                    >
                      <div className="relative h-11 w-11 shrink-0 rounded-full bg-slate-800">
                        {contact.profile_img ? (
                          <div className="h-full w-full overflow-hidden rounded-full">
                            <img
                              src={getMediaUrl(contact.profile_img)}
                              alt={contact.name}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="grid h-full w-full place-items-center overflow-hidden rounded-full bg-cyan-600 text-sm font-bold">
                            {contact.name.charAt(0)}
                          </div>
                        )}
                        <span
                          className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border border-slate-950 ${
                            contact.is_online ? "bg-green-400" : "bg-slate-500"
                          }`}
                        />
                      </div>
                      {/* <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-100">
                          {contact.name}
                        </p>
                        <p className="truncate text-xs text-slate-400">
                          {contact.designation || contact.department || contact.role}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {contact.is_online
                            ? "Online"
                            : formatLastSeen(contact.last_seen)}
                        </p>
                      </div> */}
                    </button>
                  ))
                )}
              </div>
            </section>
          )}

          {/* Main */}
          <main className="flex min-h-[72vh] flex-col">
            {selected ? (
              <>
                {/* Chat header */}
                <div className="border-b border-slate-800 p-4 flex items-center gap-3">
                  <div className="relative h-9 w-9 shrink-0 rounded-full bg-slate-800">
                    {selected.profile_img ? (
                      <div className="h-full w-full overflow-hidden rounded-full">
                        <img
                          src={getMediaUrl(selected.profile_img)}
                          alt={selected.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="grid h-full w-full place-items-center overflow-hidden rounded-xl bg-cyan-600 font-bold text-sm">
                        {selected.name.charAt(0)}
                      </div>
                    )}
                    <span
                      className={`absolute bottom-0 z-50 right-0 h-2.5 w-2.5 rounded-full border border-slate-900 ${
                        selected.is_online ? "bg-green-400" : "bg-slate-500"
                      }`}
                    />
                  </div>
                  <div>
                    <p className="font-bold text-sm">{selected.name}</p>
                    <p className="text-xs text-slate-400">
                      {typingById[selected.employee_id]
                        ? "Typing..."
                        : selected.is_online
                          ? "Online"
                          : formatLastSeen(selected.last_seen)}
                    </p>
                  </div>
                </div>

                {/* Messages list */}
                <div className="flex-1 space-y-2 overflow-y-auto p-4">
                  {messages.map((msg, index) => {
                    const mine = msg.sender_id === employeeId;
                    const showDate =
                      index === 0 ||
                      formatMessageDate(messages[index - 1].created_at) !==
                        formatMessageDate(msg.created_at);
                    const isMenuOpen = menuMsgId === msg.id;
                    const isEditing = editingMsgId === msg.id;
                    const totalReactions = Object.values(
                      msg.reactions || {},
                    ).reduce((a, b) => a + b.length, 0);

                    return (
                      <div key={msg.id}>
                        {showDate && (
                          <div className="my-4 text-center text-xs text-slate-500">
                            <span className="bg-slate-800 px-3 py-1 rounded-full">
                              {formatMessageDate(msg.created_at)}
                            </span>
                          </div>
                        )}

                        <div
                          className={`group flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}
                        >
                          {/* Action buttons — shown on hover */}
                          {!msg.is_deleted && (
                            <div
                              className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${mine ? "order-first" : "order-last"}`}
                            >
                              {/* 3-dot menu — own messages only */}
                              {mine && (
                                <div className="relative">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setMenuMsgId(isMenuOpen ? null : msg.id);
                                    }}
                                    className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition cursor-pointer"
                                    title="Options"
                                  >
                                    <span className="text-slate-400 text-lg leading-none">
                                      ⋮
                                    </span>
                                  </button>
                                  {isMenuOpen && (
                                    <div
                                      onClick={(e) => e.stopPropagation()}
                                      className="absolute bottom-9 right-0 z-50 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden w-36"
                                    >
                                      <button
                                        onClick={() => startEdit(msg)}
                                        className="w-full flex items-center gap-2 px-4 py-3 text-sm hover:bg-slate-700 transition cursor-pointer text-left"
                                      >
                                        ✏️ Edit
                                      </button>
                                      <div className="border-t border-slate-700" />
                                      <button
                                        onClick={() => {
                                          setMenuMsgId(null);
                                          setDeleteMsgId(msg.id);
                                        }}
                                        className="w-full flex items-center gap-2 px-4 py-3 text-sm hover:bg-red-500/20 text-red-400 transition cursor-pointer text-left"
                                      >
                                        🗑️ Delete
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Bubble */}
                          <div className="max-w-[70%]">
                            {isEditing ? (
                              <div className="flex flex-col gap-2">
                                <textarea
                                  value={editDraft}
                                  onChange={(e) => setEditDraft(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                      e.preventDefault();
                                      submitEdit();
                                    }
                                    if (e.key === "Escape") {
                                      setEditingMsgId(null);
                                      setEditDraft("");
                                    }
                                  }}
                                  autoFocus
                                  className="w-full resize-none rounded-2xl border border-blue-500 bg-slate-800 p-3 text-sm outline-none"
                                  rows={2}
                                />
                                <div className="flex gap-2 justify-end">
                                  <button
                                    onClick={() => {
                                      setEditingMsgId(null);
                                      setEditDraft("");
                                    }}
                                    className="text-xs px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 transition cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={submitEdit}
                                    className="text-xs px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 transition cursor-pointer"
                                  >
                                    Save
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div
                                className={`rounded-3xl px-4 py-3 text-sm ${
                                  msg.is_deleted
                                    ? "bg-slate-800/50 text-slate-500 italic"
                                    : mine
                                      ? "bg-blue-600 text-white"
                                      : "bg-slate-800 text-slate-100"
                                }`}
                              >
                                <p className="whitespace-pre-wrap wrap-break-words text-lg">
                                  {msg.message}
                                </p>
                                <div className="mt-1 flex items-center justify-end gap-2">
                                  {msg.is_edited && !msg.is_deleted && (
                                    <span className="text-[10px] opacity-50">
                                      edited
                                    </span>
                                  )}
                                  <span className="text-[11px] opacity-60">
                                    {new Date(
                                      msg.created_at,
                                    ).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                  {mine && !msg.is_deleted && (
                                    <span className="text-[10px] opacity-70">
                                      {msg.is_read ? (
                                        <CheckCheck size={20} />
                                      ) : (
                                        <Check size={20} />
                                      )}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Reactions display */}
                            {totalReactions > 0 && !isEditing && (
                              <div
                                className={`flex flex-wrap gap-1 mt-1 ${mine ? "justify-end" : "justify-start"}`}
                              >
                                {Object.entries(msg.reactions || {}).map(
                                  ([emoji, users]) =>
                                    users.length > 0 ? (
                                      <button
                                        key={emoji}
                                        onClick={() =>
                                          reactToMessage(msg.id, emoji)
                                        }
                                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition cursor-pointer ${
                                          users.includes(employeeId)
                                            ? "bg-blue-600/30 border-blue-500 text-blue-300"
                                            : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500"
                                        }`}
                                      >
                                        {emoji} {users.length}
                                      </button>
                                    ) : null,
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>

                {/* Input bar */}
                <div className="border-t border-slate-800 p-4">
                  {sendError && (
                    <p className="mb-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300">
                      {sendError}
                    </p>
                  )}
                  {selected && typingById[selected.employee_id] && (
                    <p className="mb-2 text-xs font-semibold text-green-300">
                      {selected.name} is typing...
                    </p>
                  )}
                  <div className="flex gap-2 items-end">
                    {/* Emoji button for input */}
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowInputEmoji((v) => !v);
                        }}
                        className="h-12 w-12 rounded-2xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-xl transition cursor-pointer shrink-0"
                        title="Add emoji to message"
                      >
                        😊
                      </button>
                      {showInputEmoji && (
                        <EmojiPicker
                          onSelect={insertEmoji}
                          onClose={() => setShowInputEmoji(false)}
                          position="top"
                          align="left"
                        />
                      )}
                    </div>

                    <textarea
                      ref={inputRef}
                      value={draft}
                      onChange={(e) => handleDraftChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                      placeholder="Type a message..."
                      className="flex-1 resize-none rounded-2xl border border-slate-700 bg-slate-950 p-3 text-sm outline-none focus:border-blue-500 transition min-h-12 max-h-32"
                      rows={1}
                    />

                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        sendMessage();
                      }}
                      disabled={!draft.trim() || !selected}
                      aria-busy={sending}
                      className="h-12 w-12 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center transition cursor-pointer shrink-0"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="w-5 h-5"
                      >
                        <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="grid flex-1 place-items-center p-8 text-center">
                <div className="max-w-sm">
                  <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-slate-800 bg-slate-950 text-2xl text-slate-300">
                    +
                  </div>
                  <p className="text-lg font-semibold text-slate-100">
                    Select a user for conversation
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    Choose an employee from the conversation bar to open messages.
                  </p>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
      {deleteMsgId && (
        <div className="fixed inset-0 z-99 flex items-center justify-center bg-black/60">
          <div className="w-87.5 rounded-3xl bg-slate-900 p-6 border border-slate-700">
            <h3 className="text-lg font-semibold">Delete Message?</h3>

            <p className="mt-2 text-sm text-slate-400">
              This message will be removed for everyone.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDeleteMsgId(null)}
                className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 cursor-pointer"
              >
                Cancel
              </button>

              <button
                onClick={() => deleteMessage(deleteMsgId)}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
