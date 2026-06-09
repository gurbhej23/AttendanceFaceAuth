import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Minus,
  MoreVertical,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import API from "../services/api";
import EmojiPicker from "./EmojiPicker";
import type { ChatMessage, Contact } from "../utils/chatHelpers";
import {
  formatLastSeen,
  formatMessageDate,
  getMediaUrl,
} from "../utils/chatHelpers";

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
  const typingStopTimer = useRef<number | null>(null);

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

  const loadHistory = useCallback(async () => {
    const res = await API.get("/employees/chat-history/", {
      params: { employee_id: employeeId, contact_id: contact.employee_id },
    });
    setMessages(res.data.messages || []);
    markRead();
  }, [contact.employee_id, employeeId, markRead]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

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
          setMessages((cur) =>
            cur.some((m) => m.id === incoming.id) ? cur : [...cur, incoming],
          );
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
  }, [belongsToChat, employeeId, markRead, registerHandler]);

  useEffect(() => {
    if (!minimized) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, minimized]);

  useEffect(() => {
    const handler = () => {
      setMenuMsgId(null);
      setShowInputEmoji(false);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

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
        setMessages((cur) =>
          belongsToChat(saved) && !cur.some((m) => m.id === saved.id)
            ? [...cur, saved]
            : cur,
        );
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
          {contact.profile_img ? (
            <img
              src={getMediaUrl(contact.profile_img)}
              alt={contact.name}
              className="h-7 w-7 rounded-full object-cover"
            />
          ) : (
            <div className="grid h-7 w-7 place-items-center rounded-full bg-cyan-700 text-xs font-bold">
              {contact.name.charAt(0)}
            </div>
          )}
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
        <div className="flex shrink-0 items-center gap-3 border-b border-slate-800 px-4 py-3">
          {fullScreen && (
            <button
              type="button"
              onClick={onClose}
              className="-ml-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              title="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          {contact.profile_img ? (
            <img
              src={getMediaUrl(contact.profile_img)}
              alt={contact.name}
              className="h-9 w-9 rounded-full object-cover"
            />
          ) : (
            <div className="grid h-9 w-9 place-items-center rounded-full bg-cyan-700 text-sm font-bold">
              {contact.name.charAt(0)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white">{contact.name}</p>
            <p className="truncate text-xs text-slate-400">
              {typing
                ? "Typing..."
                : contact.is_online
                  ? "Online"
                  : formatLastSeen(contact.last_seen)}
            </p>
          </div>
          {!fullScreen && (
            <>
              <button
                type="button"
                onClick={onMinimize}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                title="Minimize"
              >
                <Minus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
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
            const showDate =
              index === 0 ||
              formatMessageDate(messages[index - 1].created_at) !==
                formatMessageDate(msg.created_at);
            const isMenuOpen = menuMsgId === msg.id;
            const isEditing = editingMsgId === msg.id;

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
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700"
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
                            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs hover:bg-slate-800"
                          >
                            <Pencil size={13} /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMenuMsgId(null);
                              setDeleteMsgId(msg.id);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs text-red-400 hover:bg-red-500/15"
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
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5">
            <h3 className="font-semibold">Delete message?</h3>
            <p className="mt-2 text-sm text-slate-400">
              This message will be removed for everyone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteMsgId(null)}
                className="rounded-xl bg-slate-700 px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteMessage(deleteMsgId)}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm"
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
