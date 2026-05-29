// src/pages/Messages.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import EmojiPicker from "../components/EmojiPicker";
import { ArrowBigLeft } from "lucide-react";

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

const getMediaUrl = (path?: string | null) => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `http://localhost:8000${path.startsWith("/") ? path : `/${path}`}`;
};

const getWsUrl = (employeeId: string) => {
  const base = API.defaults.baseURL || "http://localhost:8000/api";
  const root = base.replace(/\/api\/?$/, "");
  return `${root.replace(/^http/, "ws")}/ws/chat/${employeeId}/`;
};

export default function Messages() {
  const navigate = useNavigate();
  const socketRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<Contact | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const employeeId = localStorage.getItem("employee_id") || "";
  const employeeName = localStorage.getItem("employee_name") || "Me";
  const role = localStorage.getItem("role") || "employee";

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [menuMsgId, setMenuMsgId] = useState<string | null>(null);
  const [emojiPickerMsgId, setEmojiPickerMsgId] = useState<string | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [typingById, setTypingById] = useState<Record<string, boolean>>({});
  const typingStopTimer = useRef<number | null>(null);
  // Emoji picker for the message input box
  const [showInputEmoji, setShowInputEmoji] = useState(false);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    const handler = () => {
      setMenuMsgId(null);
      setEmojiPickerMsgId(null);
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
    setSelected((c) => c || next[0] || null);
	    setLoading(false);
	  }, [employeeId, navigate]);

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
    const diff = Date.now() - d.getTime();
    if (diff < 60_000) return "Last seen just now";
    if (diff < 3_600_000) return `Last seen ${Math.floor(diff / 60_000)} min ago`;
    if (d.toDateString() === new Date().toDateString()) {
      return `Last seen ${d.toLocaleTimeString([], {
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
    let socket: WebSocket | null = null;
    const t = window.setTimeout(() => {
      socket = new WebSocket(getWsUrl(employeeId));
      socketRef.current = socket;
      socket.onopen = () => setConnected(true);
      socket.onclose = () => setConnected(false);
      socket.onerror = () => setConnected(false);
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
    }, 150);
    return () => {
      window.clearTimeout(t);
      if (socket?.readyState === WebSocket.OPEN) socket.close();
      socketRef.current = null;
    };
	  }, [employeeId, markConversationRead]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const staffContacts = useMemo(
    () => contacts.filter((c) => c.role !== "employee"),
    [contacts],
  );

	  const sendMessage = () => {
	    const text = draft.trim();
	    if (!text || !selected || socketRef.current?.readyState !== WebSocket.OPEN)
	      return;
    socketRef.current.send(
      JSON.stringify({ recipient_id: selected.employee_id, message: text }),
	    );
	    setDraft("");
	    sendTyping(false);
	    inputRef.current?.focus();
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
    setMenuMsgId(null);

    // Update locally immediately
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

    // Update locally immediately
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
    setEmojiPickerMsgId(null);

    // Update locally immediately
    setMessages((cur) =>
      cur.map((m) => {
        if (m.id !== msgId) return m;
        const reactions = { ...(m.reactions || {}) };
        const users = [...(reactions[emoji] || [])];
        const idx = users.indexOf(employeeId);
        if (idx >= 0) users.splice(idx, 1);
        else users.push(employeeId);
        if (users.length === 0) delete reactions[emoji];
        else reactions[emoji] = users;
        return { ...m, reactions };
      }),
    );

		    const socket = socketRef.current;
		    const socketOpen = socket?.readyState === WebSocket.OPEN;
		    if (socketOpen) {
		      socket.send(
	        JSON.stringify({
	          type: "react",
          message_id: msgId,
          emoji: emoji,
        }),
	      );
	    }
	
	    if (!socketOpen) {
	      try {
	        await API.post(`/employees/chat-message/${msgId}/react/`, {
	          employee_id: employeeId,
	          emoji,
	        });
	      } catch {
	        /* already updated locally */
	      }
	    }
	  };

  // Insert emoji into message input
  const insertEmoji = (emoji: string) => {
    setDraft((d) => d + emoji);
    inputRef.current?.focus();
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-white sm:p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <button
            onClick={() =>
              navigate(role === "employee" ? "/dashboard" : "/attendance-sheet")
            }
            className="  px-5 py-3 text-sm font-semibold hover:bg-slate-800 cursor-pointer"
          >
            {<ArrowBigLeft size={30} />}
          </button>
          <div>
            <p className="mt-1 text-sm text-slate-400">
              {employeeName} / {role.toUpperCase()} /&nbsp;
              <span
                className={connected ? "text-green-400" : "text-yellow-400"}
              >
                {connected ? "● Connected" : "◌ Connecting..."}
              </span>
            </p>
          </div>
        </header>

        <div className="grid min-h-[72vh] overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 lg:grid-cols-[300px_1fr]">
          {/* Sidebar */}
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
                        ? "bg-blue-600"
                        : "bg-slate-950 hover:bg-slate-800"
                    }`}
                  >
	                    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-2xl bg-slate-800">
	                      {contact.profile_img ? (
	                        <img
                          src={getMediaUrl(contact.profile_img)}
                          alt={contact.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center bg-cyan-600 font-bold text-sm">
	                          {contact.name.charAt(0)}
	                        </div>
	                      )}
	                      <span
	                        className={`absolute -bottom-1 right-1 h-2.5 w-2.5 rounded-full border border-slate-950 ${
	                          contact.is_online ? "bg-green-400" : "bg-slate-500"
	                        }`}
	                      />
	                    </div>
                    <div className="min-w-0">
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

          {/* Main */}
          <main className="flex min-h-[72vh] flex-col">
            {selected ? (
              <>
                {/* Chat header */}
                <div className="border-b border-slate-800 p-4 flex items-center gap-3">
	                  <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl bg-slate-800">
	                    {selected.profile_img ? (
                      <img
                        src={getMediaUrl(selected.profile_img)}
                        alt={selected.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center bg-cyan-600 font-bold text-sm">
	                        {selected.name.charAt(0)}
	                      </div>
	                    )}
	                    <span
	                      className={`absolute -bottom-1 z-50 right-0 h-2.5 w-2.5 rounded-full border border-slate-900 ${
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
                <div className="flex-1 space-y-1 overflow-y-auto p-4">
                  {messages.map((msg, index) => {
                    const mine = msg.sender_id === employeeId;
                    const showDate =
                      index === 0 ||
                      formatMessageDate(messages[index - 1].created_at) !==
                        formatMessageDate(msg.created_at);
                    const isMenuOpen = menuMsgId === msg.id;
                    const isEmojiOpen = emojiPickerMsgId === msg.id;
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
                              {/* Full emoji picker for reactions */}
                              <div className="relative">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEmojiPickerMsgId(
                                      isEmojiOpen ? null : msg.id,
                                    );
                                    setMenuMsgId(null);
                                  }}
                                  className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-base transition cursor-pointer"
                                  title="React with emoji"
                                >
                                  😊
                                </button>
                                {isEmojiOpen && (
                                  <EmojiPicker
                                    onSelect={(emoji) =>
                                      reactToMessage(msg.id, emoji)
                                    }
                                    onClose={() => setEmojiPickerMsgId(null)}
                                    position="top"
                                    align={mine ? "right" : "left"}
                                  />
                                )}
                              </div>

                              {/* 3-dot menu — own messages only */}
                              {mine && (
                                <div className="relative">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setMenuMsgId(isMenuOpen ? null : msg.id);
                                      setEmojiPickerMsgId(null);
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
                                        onClick={() => deleteMessage(msg.id)}
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
                                <p className="whitespace-pre-wrap break-words">
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
	                                      {msg.is_read ? "Seen" : "Sent"}
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
                      className="flex-1 resize-none rounded-2xl border border-slate-700 bg-slate-950 p-3 text-sm outline-none focus:border-blue-500 transition min-h-[48px] max-h-32"
                      rows={1}
                    />

                    <button
                      onClick={sendMessage}
                      disabled={!draft.trim() || !connected}
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
              <div className="grid flex-1 place-items-center p-8 text-center text-slate-500">
                <div>
                  <div className="text-5xl mb-3">💬</div>
                  <p className="font-semibold text-slate-400">
                    Select a contact to start chatting
                  </p>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
