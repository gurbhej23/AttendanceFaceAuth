import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Minus,
  MoreVertical,
  Pencil,
  Trash2,
  Phone,
  Video,
  X,
} from "lucide-react";
import API from "../services/api";
import EmojiPicker from "./EmojiPicker";
import type { ChatMessage, Contact } from "../utils/chatHelpers";
import { isCallLogMessage } from "../utils/callHelpers";
import {
  formatLastSeen,
  formatMessageDate,
  getMediaUrl,
  mergeChatMessages,
} from "../utils/chatHelpers";

function AvatarWithPresence({
  src,
  name,
  isOnline,
  size = "md",
}: {
  src?: string;
  name: string;
  isOnline?: boolean;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const dot = size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5";
  return (
    <div className="relative shrink-0">
      {src ? (
        <img
          src={src}
          alt={name}
          className={`${dim} rounded-full object-cover ${
            isOnline
          }`}
        />
      ) : (
        <div
          className={`grid ${dim} place-items-center rounded-full bg-cyan-700 text-sm font-bold ${
            isOnline ? "ring-2 ring-emerald-500/70" : ""
          }`}
        >
          {name.charAt(0)}
        </div>
      )}
      {isOnline && (
        <span
          className={`absolute bottom-0 right-0 ${dot} rounded-full border-1 bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]`}
        />
      )}
    </div>
  );
}

function PresenceStatus({
  typing,
  isOnline,
  lastSeen,
}: {
  typing: boolean;
  isOnline?: boolean;
  lastSeen?: string;
}) {
  if (typing) {
    return (
      <p className="flex items-center gap-1.5 truncate text-xs text-cyan-400"> 
        Typing...
      </p>
    );
  }
  if (isOnline) {
    return (
      <p className="flex items-center gap-1.5 truncate text-xs text-emerald-400"> 
        Online
      </p>
    );
  }
  return (
    <p className="truncate text-xs text-slate-500">
      {formatLastSeen(lastSeen)}
    </p>
  );
}

interface Props {
  contact: Contact;
  employeeId: string;
  socketRef: React.RefObject<WebSocket | null>;
  registerHandler: (handler: (data: Record<string, unknown>) => void) => () => void;
  onClose: () => void;
  onMinimize: () => void;
  minimized: boolean;
  fullScreen?: boolean;
  refreshUnread: () => void;
  typing: boolean;
  onStartVideoCall?: (contact: Contact) => void;
  onStartVoiceCall?: (contact: Contact) => void;
  canStartVideoCall?: boolean;
}

export default function DirectChatPopup({
  contact,
  employeeId,
  socketRef,
  registerHandler,
  onClose,
  onMinimize,
  minimized,
  fullScreen = false,
  refreshUnread,
  typing,
  onStartVideoCall,
  onStartVoiceCall,
  canStartVideoCall = true,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const contactRef = useRef(contact);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [showInputEmoji, setShowInputEmoji] = useState(false);
  const [menuMsgId, setMenuMsgId] = useState<string | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [deleteMsgId, setDeleteMsgId] = useState<string | null>(null);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [clearingChat, setClearingChat] = useState(false);
  const typingStopTimer = useRef<number | null>(null);
  const historySessionRef = useRef(0);

  useEffect(() => {
    contactRef.current = contact;
  }, [contact]);

  const belongsToChat = useCallback(
    (msg: ChatMessage) =>
      (msg.sender_id === contact.employee_id &&
        msg.recipient_id === employeeId) ||
      (msg.sender_id === employeeId &&
        msg.recipient_id === contact.employee_id),
    [contact.employee_id, employeeId],
  );

  const markRead = useCallback(() => {
    const socket = socketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) return;
    socket.send(
      JSON.stringify({ type: "read", contact_id: contact.employee_id }),
    );
    refreshUnread();
  }, [contact.employee_id, refreshUnread, socketRef]);

  const upsertMessage = useCallback((incoming: ChatMessage) => {
    setMessages((cur) => {
      const withoutPending = cur.filter(
        (message) =>
          !(
            message.id.startsWith("pending-") &&
            message.sender_id === incoming.sender_id &&
            message.message === incoming.message
          ),
      );
      return withoutPending.some((message) => message.id === incoming.id)
        ? withoutPending
        : [...withoutPending, incoming];
    });
  }, []);

  useEffect(() => {
    const session = ++historySessionRef.current;
    let cancelled = false;

    const loadHistory = async () => {
      try {
        const res = await API.get("/employees/chat-history/", {
          params: {
            employee_id: employeeId,
            contact_id: contact.employee_id,
          },
        });
        if (cancelled || session !== historySessionRef.current) return;
        const loaded = (res.data.messages || []) as ChatMessage[];
        setMessages((cur) => mergeChatMessages(loaded, cur));
        markRead();
      } catch {
        /* silent */
      }
    };

    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, [contact.employee_id, employeeId, markRead]);

  useEffect(() => {
    const unregister = registerHandler((data) => {
      const open = contactRef.current;
      if (data.type === "message") {
        const incoming = data.message as ChatMessage;
        if (
          (incoming.sender_id === open.employee_id &&
            incoming.recipient_id === employeeId) ||
          (incoming.sender_id === employeeId &&
            incoming.recipient_id === open.employee_id)
        ) {
          upsertMessage(incoming);
          if (incoming.sender_id === open.employee_id) markRead();
        }
      } else if (data.type === "edit" || data.type === "delete" || data.type === "react") {
        const updated = data.message as ChatMessage;
        if (belongsToChat(updated)) {
          setMessages((cur) =>
            cur.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)),
          );
        }
      } else if (data.type === "read" && data.reader_id === open.employee_id) {
        setMessages((cur) =>
          cur.map((message) =>
            message.sender_id === employeeId &&
            message.recipient_id === open.employee_id
              ? { ...message, is_read: true }
              : message,
          ),
        );
      }
    });
    return unregister;
  }, [belongsToChat, employeeId, markRead, registerHandler, upsertMessage]);

  useEffect(() => {
    if (!minimized) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, minimized]);

  useEffect(() => {
    const handler = () => {
      setMenuMsgId(null);
      setShowInputEmoji(false);
      setShowHeaderMenu(false);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const deleteAllChat = async () => {
    if (clearingChat) return;
    const confirmed = window.confirm(
      `Clear all messages with ${contact.name} from your chat only? ${contact.name} will still see the conversation.`,
    );
    if (!confirmed) return;
    setClearingChat(true);
    setShowHeaderMenu(false);
    try {
      await API.delete("/employees/chat-history/clear/", {
        data: {
          employee_id: employeeId,
          contact_id: contact.employee_id,
        },
      });
      setMessages([]);
      refreshUnread();
    } catch {
      window.alert("Could not delete chat history.");
    } finally {
      setClearingChat(false);
    }
  };

  const sendTyping = (isTyping: boolean) => {
    const socket = socketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) return;
    socket.send(
      JSON.stringify({
        type: "typing",
        recipient_id: contact.employee_id,
        is_typing: isTyping,
      }),
    );
  };

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSendError("");
    setSending(true);
    const socket = socketRef.current;

    if (socket?.readyState === WebSocket.OPEN) {
      const optimistic: ChatMessage = {
        id: `pending-${Date.now()}`,
        sender_id: employeeId,
        sender_name: "You",
        sender_role: "",
        recipient_id: contact.employee_id,
        recipient_name: contact.name,
        message: text,
        created_at: new Date().toISOString(),
      };
      upsertMessage(optimistic);
      socket.send(
        JSON.stringify({
          type: "message",
          recipient_id: contact.employee_id,
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
        recipient_id: contact.employee_id,
        message: text,
      });
      if (res.data.success && res.data.message) {
        const saved = res.data.message as ChatMessage;
        if (belongsToChat(saved)) upsertMessage(saved);
        setDraft("");
      } else {
        setSendError(res.data.error || "Message not sent");
      }
    } catch {
      setSendError("Message not sent");
    } finally {
      setSending(false);
    }
  };

  const handleDraftChange = (value: string) => {
    setDraft(value);
    sendTyping(Boolean(value.trim()));
    if (typingStopTimer.current) window.clearTimeout(typingStopTimer.current);
    typingStopTimer.current = window.setTimeout(() => sendTyping(false), 1200);
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
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "delete", message_id: msgId }));
    } else {
      await API.delete(`/employees/chat-message/${msgId}/`, {
        data: { employee_id: employeeId },
      }).catch(() => undefined);
    }
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
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: "edit",
          message_id: editingMsgId,
          new_text: newText,
        }),
      );
    }
    setEditingMsgId(null);
    setEditDraft("");
  };

  if (minimized) {
    return (
      <div className="flex h-12 w-[220px] items-center gap-2 rounded-t-2xl border border-b-0 border-slate-700/80 bg-slate-900 px-3 shadow-lg">
        <button
          type="button"
          onClick={onMinimize}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <AvatarWithPresence
            src={contact.profile_img ? getMediaUrl(contact.profile_img) : undefined}
            name={contact.name}
            isOnline={contact.is_online}
            size="sm"
          />
          <span className="truncate text-sm font-semibold text-white">
            {contact.name}
          </span>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <>
      <div
        className={`flex flex-col overflow-hidden bg-slate-900 ${
          fullScreen
            ? "h-[100dvh] w-full"
            : "h-[min(70vh,480px)] w-[min(calc(100vw-1.5rem),340px)] rounded-2xl border border-b-0 border-slate-700/80 shadow-2xl shadow-black/50 sm:rounded-t-2xl"
        }`}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-slate-800 px-4 py-3">
          {fullScreen && (
            <button
              type="button"
              onClick={onClose}
              className="-ml-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <AvatarWithPresence
            src={contact.profile_img ? getMediaUrl(contact.profile_img) : undefined}
            name={contact.name}
            isOnline={contact.is_online}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white">{contact.name}</p>
            <PresenceStatus
              typing={typing}
              isOnline={contact.is_online}
              lastSeen={contact.last_seen}
            />
          </div>
          <button
            type="button"
            onClick={() => onStartVoiceCall?.(contact)}
            disabled={!canStartVideoCall}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
            title="Start voice call"
          >
            <Phone className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onStartVideoCall?.(contact)}
            disabled={!canStartVideoCall}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
            title="Start video call"
          >
            <Video className="h-4 w-4" />
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowHeaderMenu((v) => !v);
              }}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
              title="Chat options"
              aria-label="Chat options"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {showHeaderMenu && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-9 z-50 w-44 overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
              >
                <button
                  type="button"
                  onClick={() => void deleteAllChat()}
                  disabled={clearingChat}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-red-300 hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                >
                  <Trash2 size={15} />
                  {clearingChat ? "Clearing..." : "Clear chat"}
                </button>
              </div>
            )}
          </div>
          {!fullScreen && (
            <>
              <button
                type="button"
                onClick={onMinimize}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
                title="Minimize"
              >
                <Minus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          )}
        </div>


        <div className="pro-chat-scroll min-h-0 flex-1 space-y-2 p-3 pb-2">
          {messages.map((msg, index) => {
            const mine = msg.sender_id === employeeId;
            const isCallLog = isCallLogMessage(msg.message);
            const showDate =
              index === 0 ||
              formatMessageDate(messages[index - 1].created_at) !==
                formatMessageDate(msg.created_at);
            const isMenuOpen = menuMsgId === msg.id;
            const isEditing = editingMsgId === msg.id;

            if (isCallLog) {
              return (
                <div key={msg.id}>
                  {showDate && (
                    <div className="my-3 text-center text-[10px] text-slate-500">
                      <span className="rounded-full bg-slate-800 px-2 py-1">
                        {formatMessageDate(msg.created_at)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-center px-2 py-1">
                    <p className="max-w-[90%] rounded-full border border-slate-700/80 bg-slate-800/90 px-4 py-1.5 text-center text-xs text-slate-300">
                      {msg.message}
                    </p>
                  </div>
                </div>
              );
            }

            return (
              <div key={msg.id}>
                {showDate && (
                  <div className="my-3 text-center text-[10px] text-slate-500">
                    <span className="rounded-full bg-slate-800 px-2 py-1">
                      {formatMessageDate(msg.created_at)}
                    </span>
                  </div>
                )}
                <div
                  className={`group flex items-end gap-1 ${mine ? "justify-end" : "justify-start"}`}
                >
                  {mine && !msg.is_deleted && !isEditing && (
                    <div className="relative mb-1 opacity-100 md:opacity-0 md:group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuMsgId(isMenuOpen ? null : msg.id);
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
                        aria-label="Message options"
                      >
                        <MoreVertical size={16} />
                      </button>
                      {isMenuOpen && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute bottom-10 right-0 z-10 w-32 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-xl"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setMenuMsgId(null);
                              setEditingMsgId(msg.id);
                              setEditDraft(msg.message);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs hover:bg-slate-800 cursor-pointer text-white"
                          >
                            <Pencil size={13} /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMenuMsgId(null);
                              setDeleteMsgId(msg.id);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs text-red-400 hover:bg-red-500/15 cursor-pointer"
                          >
                            <Trash2 size={13} /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="relative max-w-[82%]">
                    {isEditing ? (
                      <div className="space-y-2">
                        <textarea
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          className="w-full resize-none rounded-2xl border border-blue-500 bg-slate-800 p-2 text-sm text-white outline-none"
                          rows={2}
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMsgId(null);
                              setEditDraft("");
                            }}
                            className="rounded-lg bg-slate-700 px-2 py-1 text-xs"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={submitEdit}
                            className="rounded-lg bg-blue-600 px-2 py-1 text-xs"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`rounded-2xl px-3 py-2 text-sm ${
                          msg.is_deleted
                            ? "bg-slate-800/50 italic text-slate-500"
                            : mine
                              ? "bg-blue-600 text-white"
                              : "bg-slate-800 text-slate-100"
                        }`}
                      >
                        <p className="whitespace-pre-wrap wrap-break-words">
                          {msg.message}
                        </p>
                        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-70">
                          {msg.is_edited && !msg.is_deleted && <span>edited</span>}
                          <span>
                            {new Date(msg.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {mine && !msg.is_deleted && (
                            <span>
                              {msg.is_read ? (
                                <CheckCheck size={14} />
                              ) : (
                                <Check size={14} />
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <div className="shrink-0 border-t border-slate-800 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {sendError && (
            <p className="mb-2 text-xs text-red-300">{sendError}</p>
          )}
          <div className="flex items-end gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowInputEmoji((v) => !v);
                }}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-lg hover:bg-slate-700"
              >
                😊
              </button>
              {showInputEmoji && (
                <EmojiPicker
                  onSelect={(emoji) => {
                    setDraft((d) => d + emoji);
                    inputRef.current?.focus();
                  }}
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
              placeholder="Write a message..."
              rows={1}
              className="max-h-24 min-h-10 flex-1 resize-none rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-500"
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={!draft.trim() || sending}
              className="h-10 shrink-0 rounded-xl bg-blue-600 px-4 text-sm font-semibold hover:bg-blue-700 disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {deleteMsgId && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 ">
            <h3 className="font-semibold text-slate-300">Delete message?</h3>
            <p className="mt-2 text-sm text-slate-200">
              This message will be removed for everyone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteMsgId(null)}
                className="rounded-xl bg-slate-700 text-white px-4 py-2 text-sm cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteMessage(deleteMsgId)}
                className="rounded-xl bg-red-600 text-white px-4 py-2 text-sm cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
