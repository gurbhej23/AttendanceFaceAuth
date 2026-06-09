import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import API from "../services/api";
import EmojiPicker from "./EmojiPicker";
import NotificationBadge from "./NotificationBadge";
import {
  Camera,
  Check,
  CheckCheck,
  MoreVertical,
  Pencil,
  Plus,
  Settings,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import type { Contact } from "../utils/chatHelpers";

interface ChatGroup {
  id: string;
  group_name: string;
  group_img?: string;
  created_by: string;
  members: string[];
  member_count?: number;
  member_details: Contact[];
  created_at: string;
}

interface GroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  sender_name: string;
  message: string;
  is_edited?: boolean;
  is_deleted?: boolean;
  read_by?: string[];
  read_count?: number;
  total_recipients?: number;
  is_fully_read?: boolean;
  message_type?: "user" | "system";
  created_at: string;
}

export interface GroupChatHeaderActions {
  openAddMembers: () => void;
  openManage: () => void;
  openMembers: () => void;
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
  if (path.startsWith("http")) return path;
  return `http://localhost:8000${path.startsWith("/") ? path : `/${path}`}`;
};

const getGroupWsUrl = (groupId: string, employeeId: string) => {
  const root = getApiRoot();
  return `${root.replace(/^http:/, "ws:").replace(/^https:/, "wss:")}/ws/group/${groupId}/${employeeId}/`;
};

const getError = (err: unknown, fallback: string) => {
  const e = err as { response?: { data?: { error?: string } } };
  return e.response?.data?.error || fallback;
};

interface Props {
  employeeId: string;
  isStaffRole: boolean;
  allContacts: Contact[];
  active: boolean;
  embedded?: boolean;
  initialGroupId?: string;
  unreadByGroup?: Record<string, number>;
  onUnreadChange?: () => void;
  onRegisterHeaderActions?: (actions: GroupChatHeaderActions) => void;
}

export default function GroupChatSection({
  employeeId,
  isStaffRole,
  allContacts,
  active,
  embedded = false,
  initialGroupId = "",
  unreadByGroup = {},
  onUnreadChange,
  onRegisterHeaderActions,
}: Props) {
  const socketRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const initialGroupPick = useRef(false);
  const sessionRef = useRef(0);

  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [showInputEmoji, setShowInputEmoji] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [addMemberSearch, setAddMemberSearch] = useState("");
  const [employeePool, setEmployeePool] = useState<Contact[]>([]);
  const [actionError, setActionError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [menuMsgId, setMenuMsgId] = useState<string | null>(null);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [editGroupName, setEditGroupName] = useState("");
  const [editGroupImage, setEditGroupImage] = useState("");
  const groupImageInputRef = useRef<HTMLInputElement>(null);

  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === selectedGroupId) ?? null,
    [groups, selectedGroupId],
  );

  useEffect(() => {
    const handler = () => {
      setShowInputEmoji(false);
      setMenuMsgId(null);
      setShowHeaderMenu(false);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  useEffect(() => {
    if (selectedGroup) {
      setEditGroupName(selectedGroup.group_name);
      setEditGroupImage(selectedGroup.group_img || "");
    }
  }, [selectedGroup]);

  const loadGroups = useCallback(async () => {
    try {
      const res = await API.get("/employees/chat-groups/", {
        params: { employee_id: employeeId },
      });
      const next = res.data.groups || [];
      setGroups(next);
      setSelectedGroupId((current) => {
        if (current && next.some((g: ChatGroup) => g.id === current)) {
          return current;
        }
        if (
          initialGroupId &&
          next.some((g: ChatGroup) => g.id === initialGroupId)
        ) {
          initialGroupPick.current = true;
          return initialGroupId;
        }
        if (!initialGroupPick.current && next.length > 0) {
          initialGroupPick.current = true;
          return next[0].id;
        }
        return current;
      });
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [employeeId, initialGroupId]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const loadEmployeePool = useCallback(async () => {
    if (!isStaffRole) return;
    try {
      const res = await API.get("/employees/admin-employees/", {
        params: { status: "active", role: "employee" },
      });
      setEmployeePool(res.data.employees || []);
    } catch {
      setEmployeePool(allContacts.filter((c) => c.role === "employee"));
    }
  }, [isStaffRole, allContacts]);

  useEffect(() => {
    if (isStaffRole) loadEmployeePool();
  }, [isStaffRole, loadEmployeePool]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!active || !selectedGroupId) {
      if (socketRef.current) {
        socketRef.current.onclose = null;
        socketRef.current.onmessage = null;
        socketRef.current.close();
        socketRef.current = null;
      }
      if (!selectedGroupId) setMessages([]);
      return;
    }

    const session = ++sessionRef.current;
    let cancelled = false;

    const loadHistory = async () => {
      const res = await API.get("/employees/chat-groups/history/", {
        params: { employee_id: employeeId, group_id: selectedGroupId },
      });
      if (!cancelled && session === sessionRef.current) {
        setMessages(res.data.messages || []);
        onUnreadChange?.();
      }
    };

    void loadHistory();

    const socket = new WebSocket(getGroupWsUrl(selectedGroupId, employeeId));
    socketRef.current = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: "read" }));
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (session !== sessionRef.current || !data.message) return;
      const incoming = data.message as GroupMessage;
      if (incoming.group_id !== selectedGroupId) return;

      if (data.type === "message") {
        setMessages((cur) =>
          cur.some((m) => m.id === incoming.id) ? cur : [...cur, incoming],
        );
        return;
      }

      if (["edit", "delete", "read"].includes(data.type)) {
        setMessages((cur) =>
          cur.map((m) => (m.id === incoming.id ? { ...m, ...incoming } : m)),
        );
      }
    };

    return () => {
      cancelled = true;
      socket.onmessage = null;
      socket.onclose = null;
      if (socket.readyState === WebSocket.OPEN) socket.close();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [active, employeeId, onUnreadChange, selectedGroupId]);

  const formatMessageDate = (ds: string) => {
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

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text || !selectedGroup || sending) return;
    setSendError("");
    setSending(true);

    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ message: text }));
      setDraft("");
      setSending(false);
      inputRef.current?.focus();
      return;
    }

    try {
      const res = await API.post("/employees/chat-groups/message/send/", {
        sender_id: employeeId,
        group_id: selectedGroup.id,
        message: text,
      });
      if (res.data.success && res.data.message) {
        const saved = res.data.message as GroupMessage;
        setMessages((cur) =>
          cur.some((m) => m.id === saved.id) ? cur : [...cur, saved],
        );
        setDraft("");
        inputRef.current?.focus();
      } else {
        setSendError(res.data.error || "Message not sent");
      }
    } catch (err) {
      setSendError(getError(err, "Message not sent"));
    } finally {
      setSending(false);
    }
  };

  const startEdit = (msg: GroupMessage) => {
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
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: "edit",
          message_id: editingMsgId,
          new_text: newText,
        }),
      );
    } else {
      try {
        await API.patch(`/employees/chat-groups/message/${editingMsgId}/`, {
          employee_id: employeeId,
          message: newText,
        });
      } catch {
        /* updated locally */
      }
    }
    setEditingMsgId(null);
    setEditDraft("");
  };

  const deleteMessage = async (msgId: string) => {
    setMenuMsgId(null);
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
      try {
        await API.delete(`/employees/chat-groups/message/${msgId}/`, {
          data: { employee_id: employeeId },
        });
      } catch {
        /* updated locally */
      }
    }
  };

  const updateGroupDetails = async () => {
    if (!selectedGroup) return;
    setActionLoading(true);
    setActionError("");
    try {
      const payload: Record<string, string> = { employee_id: employeeId };
      if (editGroupName.trim()) payload.group_name = editGroupName.trim();
      if (editGroupImage && editGroupImage.startsWith("data:")) {
        payload.group_img = editGroupImage;
      }
      const res = await API.patch(
        `/employees/chat-groups/${selectedGroup.id}/update/`,
        payload,
      );
      if (res.data.group) {
        const updated = res.data.group as ChatGroup;
        setGroups((cur) => cur.map((g) => (g.id === updated.id ? updated : g)));
      }
    } catch (err) {
      setActionError(getError(err, "Could not update group"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleGroupImagePick = (file?: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setEditGroupImage(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const createGroup = async () => {
    const name = newGroupName.trim();
    if (!name) {
      setActionError("Group name is required");
      return;
    }
    setActionLoading(true);
    setActionError("");
    try {
      const res = await API.post("/employees/chat-groups/create/", {
        employee_id: employeeId,
        group_name: name,
        members: selectedMemberIds,
      });
      if (res.data.success && res.data.group) {
        const created = res.data.group as ChatGroup;
        setGroups((cur) => [created, ...cur]);
        setSelectedGroupId(created.id);
        setShowCreateModal(false);
        setNewGroupName("");
        setSelectedMemberIds([]);
        setAddMemberSearch("");
        setShowAddMemberModal(true);
      }
    } catch (err) {
      setActionError(getError(err, "Could not create group"));
    } finally {
      setActionLoading(false);
    }
  };

  const addMember = async (memberId: string) => {
    if (!selectedGroup) return;
    setActionLoading(true);
    setActionError("");
    try {
      const res = await API.post("/employees/chat-groups/add-member/", {
        employee_id: employeeId,
        group_id: selectedGroup.id,
        member_id: memberId,
      });
      if (res.data.group) {
        const updated = res.data.group as ChatGroup;
        setGroups((cur) => cur.map((g) => (g.id === updated.id ? updated : g)));
      }
      if (res.data.system_message) {
        const sys = res.data.system_message as GroupMessage;
        setMessages((cur) =>
          cur.some((m) => m.id === sys.id) ? cur : [...cur, sys],
        );
      }
    } catch (err) {
      setActionError(getError(err, "Could not add member"));
    } finally {
      setActionLoading(false);
    }
  };

  const removeMember = async (memberId: string) => {
    if (!selectedGroup) return;
    setActionLoading(true);
    setActionError("");
    try {
      const res = await API.post("/employees/chat-groups/remove-member/", {
        employee_id: employeeId,
        group_id: selectedGroup.id,
        member_id: memberId,
      });
      if (res.data.group) {
        const updated = res.data.group as ChatGroup;
        setGroups((cur) => cur.map((g) => (g.id === updated.id ? updated : g)));
      }
      if (res.data.system_message) {
        const sys = res.data.system_message as GroupMessage;
        setMessages((cur) =>
          cur.some((m) => m.id === sys.id) ? cur : [...cur, sys],
        );
      }
    } catch (err) {
      setActionError(getError(err, "Could not remove member"));
    } finally {
      setActionLoading(false);
    }
  };

  const deleteGroup = async () => {
    if (!selectedGroup) return;
    setActionLoading(true);
    try {
      await API.delete(`/employees/chat-groups/${selectedGroup.id}/`, {
        data: { employee_id: employeeId },
      });
      setGroups((cur) => {
        const remaining = cur.filter((g) => g.id !== selectedGroup.id);
        setSelectedGroupId(remaining[0]?.id ?? "");
        return remaining;
      });
      setMessages([]);
      setShowDeleteConfirm(false);
      setShowManageModal(false);
    } catch (err) {
      setActionError(getError(err, "Could not delete group"));
    } finally {
      setActionLoading(false);
    }
  };

  const openAddMemberModal = useCallback(() => {
    setActionError("");
    setAddMemberSearch("");
    void loadEmployeePool();
    setShowAddMemberModal(true);
  }, [loadEmployeePool]);

  const openManageModal = useCallback(() => {
    setActionError("");
    setShowManageModal(true);
  }, []);

  const openMembersModal = useCallback(() => {
    setShowMembersModal(true);
  }, []);

  useEffect(() => {
    if (!embedded || !onRegisterHeaderActions) return;
    onRegisterHeaderActions({
      openAddMembers: openAddMemberModal,
      openManage: openManageModal,
      openMembers: openMembersModal,
    });
  }, [
    embedded,
    onRegisterHeaderActions,
    openAddMemberModal,
    openManageModal,
    openMembersModal,
  ]);

  const renderHeaderMenu = () => {
    if (!isStaffRole || !selectedGroup) return null;
    return (
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowHeaderMenu((v) => !v);
          }}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 text-slate-300 transition hover:bg-slate-800 hover:text-white"
          title="Group options"
        >
          <MoreVertical size={18} />
        </button>
        {showHeaderMenu && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-10 z-50 w-44 overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => {
                setShowHeaderMenu(false);
                openMembersModal();
              }}
              className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm hover:bg-slate-800"
            >
              <Users size={15} /> View members
            </button>
            <button
              type="button"
              onClick={() => {
                setShowHeaderMenu(false);
                openAddMemberModal();
              }}
              className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-green-300 hover:bg-green-500/10"
            >
              <UserPlus size={15} /> Add members
            </button>
            <button
              type="button"
              onClick={() => {
                setShowHeaderMenu(false);
                openManageModal();
              }}
              className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm hover:bg-slate-800"
            >
              <Settings size={15} /> Manage group
            </button>
          </div>
        )}
      </div>
    );
  };

  const toggleCreateMember = (id: string) => {
    setSelectedMemberIds((cur) =>
      cur.includes(id) ? cur.filter((m) => m !== id) : [...cur, id],
    );
  };

  const employeeOptions =
    employeePool.length > 0
      ? employeePool
      : allContacts.filter((c) => c.role === "employee");
  const filteredEmployees = employeeOptions.filter((c) =>
    `${c.name} ${c.department ?? ""} ${c.designation ?? ""}`
      .toLowerCase()
      .includes(memberSearch.toLowerCase()),
  );
  const nonMembers = selectedGroup
    ? employeeOptions.filter((c) => !selectedGroup.members.includes(c.employee_id))
    : [];
  const addMemberCandidates = selectedGroup
    ? nonMembers.filter((c) =>
        `${c.name} ${c.department ?? ""} ${c.designation ?? ""}`
          .toLowerCase()
          .includes(addMemberSearch.toLowerCase()),
      )
    : [];

  return (
    <div className={`flex flex-col ${embedded ? "h-full min-h-0" : "min-h-[72vh]"}`}>
      {!embedded && (
      <section className="border-b border-slate-800 bg-slate-950/40">
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-slate-100">Group Chats</p>
            <p className="text-xs text-slate-500">
              {groups.length} group{groups.length === 1 ? "" : "s"}
            </p>
          </div>
          {isStaffRole && (
            <button
              type="button"
              onClick={() => {
                setActionError("");
                setShowCreateModal(true);
              }}
              className="flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold hover:bg-blue-700 transition cursor-pointer"
            >
              <Plus size={16} />
              New Group
            </button>
          )}
        </div>
        <div className="flex gap-3 overflow-x-auto px-5 pb-4">
          {loading ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-500">
              Loading groups...
            </div>
          ) : groups.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-500">
              {isStaffRole
                ? "No groups yet. Create one to get started."
                : "You are not in any group yet."}
            </div>
          ) : (
            groups.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => setSelectedGroupId(group.id)}
                className={`flex min-w-[180px] items-center gap-3 rounded-2xl border px-4 py-3 text-left transition cursor-pointer ${
                  selectedGroup?.id === group.id
                    ? "border-blue-500 bg-blue-600/20"
                    : "border-slate-800 bg-slate-900 hover:border-slate-600 hover:bg-slate-800"
                }`}
              >
                <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-violet-600">
                  {group.group_img ? (
                    <img
                      src={getMediaUrl(group.group_img)}
                      alt={group.group_name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-sm font-bold">
                      <Users size={18} />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-slate-100">
                      {group.group_name}
                    </p>
                    <NotificationBadge count={unreadByGroup[group.id] || 0} />
                  </div>
                  <p className="truncate text-xs text-slate-400">
                    {group.members.length} member
                    {group.members.length === 1 ? "" : "s"}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </section>
      )}

      <main className={`flex flex-1 flex-col ${embedded ? "min-h-0" : "min-h-[60vh]"}`}>
        {selectedGroup ? (
          <>
            {!embedded && (
            <div className="flex items-center gap-3 border-b border-slate-800 p-4">
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-violet-600">
                {selectedGroup.group_img ? (
                  <img
                    src={getMediaUrl(selectedGroup.group_img)}
                    alt={selectedGroup.group_name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center">
                    <Users size={18} />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-sm">{selectedGroup.group_name}</p>
                <button
                  type="button"
                  onClick={() => setShowMembersModal(true)}
                  className="truncate text-xs text-slate-400 hover:text-violet-300 cursor-pointer"
                >
                  {selectedGroup.member_count ?? selectedGroup.members.length} employee
                  {(selectedGroup.member_count ?? selectedGroup.members.length) === 1
                    ? ""
                    : "s"}{" "}
                  in group
                </button>
              </div>
              {renderHeaderMenu()}
            </div>
            )}

            <div
              className={`pro-chat-scroll flex-1 space-y-2 p-4 ${embedded ? "min-h-0" : ""}`}
            >
              {messages.map((msg, index) => {
                const isSystem =
                  msg.message_type === "system" || msg.sender_id === "system";
                const mine = !isSystem && msg.sender_id === employeeId;
                const isEditing = editingMsgId === msg.id;
                const isMenuOpen = menuMsgId === msg.id;
                const showDate =
                  index === 0 ||
                  formatMessageDate(messages[index - 1].created_at) !==
                    formatMessageDate(msg.created_at);

                if (isSystem) {
                  return (
                    <div key={msg.id}>
                      {showDate && (
                        <div className="my-3 text-center text-[10px] text-slate-500">
                          <span className="rounded-full bg-slate-800/80 px-3 py-1">
                            {formatMessageDate(msg.created_at)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-center px-2 py-1">
                        <p className="max-w-[90%] rounded-full border border-violet-500/25 bg-violet-500/10 px-4 py-1.5 text-center text-xs leading-relaxed text-violet-200">
                          {msg.message}
                        </p>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={msg.id}>
                    {showDate && (
                      <div className="my-4 text-center text-xs text-slate-500">
                        <span className="rounded-full bg-slate-800 px-3 py-1">
                          {formatMessageDate(msg.created_at)}
                        </span>
                      </div>
                    )}
                    <div
                      className={`group flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}
                    >
                      {!msg.is_deleted && mine && !isEditing && (
                        <div className="relative opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
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
                              className="absolute bottom-10 right-0 z-50 w-36 overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl text-slate-300"
                            >
                              <button
                                type="button"
                                onClick={() => startEdit(msg)}
                                className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm hover:bg-slate-800"
                              >
                                <Pencil size={14} /> Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteMessage(msg.id)}
                                className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-red-400 hover:bg-red-500/15"
                              >
                                <Trash2 size={14} /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="max-w-[75%]">
                        {!mine && (
                          <p className="mb-1 text-xs font-semibold text-violet-300">
                            {msg.sender_name}
                          </p>
                        )}
                        {isEditing ? (
                          <div className="flex flex-col gap-2">
                            <textarea
                              value={editDraft}
                              onChange={(e) => setEditDraft(e.target.value)}
                              className="w-full resize-none rounded-2xl border border-blue-500 bg-slate-800 p-3 text-sm outline-none"
                              rows={2}
                              autoFocus
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingMsgId(null);
                                  setEditDraft("");
                                }}
                                className="rounded-xl bg-slate-700 px-3 py-1.5 text-xs cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={submitEdit}
                                className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs cursor-pointer"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            className={`rounded-3xl px-4 py-3 text-xs ${
                              msg.is_deleted
                                ? "bg-slate-800/50 text-slate-500 italic"
                                : mine
                                  ? "bg-blue-600 text-white"
                                  : "bg-slate-800 text-slate-100"
                            }`}
                          >
                            <p className="whitespace-pre-wrap wrap-break-words">
                              {msg.message}
                            </p>
                            <div className="mt-1 flex items-center justify-end gap-2">
                              {msg.is_edited && !msg.is_deleted && (
                                <span className="text-[10px] opacity-50">edited</span>
                              )}
                              <span className="text-[11px] opacity-60">
                                {new Date(msg.created_at).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                              {mine && !msg.is_deleted && (
                                <span className="text-[10px] opacity-70">
                                  {msg.is_fully_read ? (
                                    <CheckCheck size={18} />
                                  ) : (
                                    <Check size={18} />
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

            <div className="shrink-0 border-t border-slate-800 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:p-4">
              {sendError && (
                <p className="mb-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300">
                  {sendError}
                </p>
              )}
              <div className="flex items-end gap-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowInputEmoji((v) => !v);
                    }}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-800 text-xl transition hover:bg-slate-700 cursor-pointer"
                  >
                    😊
                  </button>
                  {showInputEmoji && (
                    <EmojiPicker
                      onSelect={(emoji) => setDraft((d) => d + emoji)}
                      onClose={() => setShowInputEmoji(false)}
                      position="top"
                      align="left"
                    />
                  )}
                </div>
                <textarea
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Message the group..."
                  className="min-h-12 max-h-32 flex-1 resize-none rounded-2xl border border-slate-700 bg-slate-950 text-white p-3 text-sm outline-none transition focus:border-blue-500"
                  rows={1}
                />
                <button
                  type="button"
                  onClick={sendMessage}
                  disabled={!draft.trim()}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 transition hover:bg-blue-700 disabled:opacity-40 cursor-pointer"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-5 w-5"
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
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-slate-800 bg-slate-950 text-2xl text-violet-300">
                <Users size={28} />
              </div>
              <p className="text-lg font-semibold text-slate-100">
                Select a group
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Pick a group from the list above to start chatting.
              </p>
            </div>
          </div>
        )}
      </main>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-hidden rounded-3xl border border-slate-700 bg-slate-900">
            <div className="border-b border-slate-800 p-5">
              <h3 className="text-lg font-semibold">Create Group</h3>
              <p className="mt-1 text-sm text-slate-400">
                Set a group name. Members are optional — you can add employees
                after the group is created.
              </p>
            </div>
            <div className="max-h-[60vh] space-y-4 overflow-y-auto p-5">
              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Group name
                </label>
                <input
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g. Marketing Team"
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Add members now (optional)
                </label>
                <input
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Search employees..."
                  className="mb-3 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-blue-500"
                />
                <div className="max-h-48 space-y-2 overflow-y-auto">
                  {filteredEmployees.map((emp) => {
                    const checked = selectedMemberIds.includes(emp.employee_id);
                    return (
                      <label
                        key={emp.employee_id}
                        className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition ${
                          checked
                            ? "border-blue-500 bg-blue-600/10"
                            : "border-slate-800 bg-slate-950 hover:bg-slate-800"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCreateMember(emp.employee_id)}
                          className="accent-blue-500"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-300">{emp.name}</p>
                          <p className="truncate text-xs text-slate-400">
                            {emp.department} · {emp.designation}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
              {actionError && (
                <p className="text-sm text-red-400">{actionError}</p>
              )}
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-800 p-5">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-xl bg-slate-700 px-4 py-2 hover:bg-slate-600 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={createGroup}
                disabled={actionLoading}
                className="rounded-xl bg-blue-600 px-4 py-2 hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                {actionLoading ? "Creating..." : "Create Group"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddMemberModal && selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-hidden rounded-3xl border border-slate-700 bg-slate-900">
            <div className="border-b border-slate-800 p-5">
              <h3 className="text-lg font-semibold">Add Members</h3>
              <p className="mt-1 text-sm text-slate-400">
                Add employees to <strong>{selectedGroup.group_name}</strong>
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {selectedGroup.member_details.length} member
                {selectedGroup.member_details.length === 1 ? "" : "s"} currently
                in this group
              </p>
            </div>
            <div className="max-h-[55vh] space-y-4 overflow-y-auto p-5">
              <input
                value={addMemberSearch}
                onChange={(e) => setAddMemberSearch(e.target.value)}
                placeholder="Search employees by name, department..."
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-green-500"
              />

              {addMemberCandidates.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-center text-sm text-slate-500">
                  {nonMembers.length === 0
                    ? "All employees are already in this group."
                    : "No employees match your search."}
                </div>
              ) : (
                <div className="space-y-2">
                  {addMemberCandidates.map((emp) => (
                    <div
                      key={emp.employee_id}
                      className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950 p-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-cyan-600 text-sm font-bold">
                          {emp.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-300">{emp.name}</p>
                          <p className="truncate text-xs text-slate-400">
                            {emp.department} · {emp.designation}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => addMember(emp.employee_id)}
                        disabled={actionLoading}
                        className="flex items-center gap-1.5 rounded-xl bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50 cursor-pointer"
                      >
                        <UserPlus size={14} />
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {actionError && (
                <p className="text-sm text-red-400">{actionError}</p>
              )}
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-800 p-5">
              <button
                type="button"
                onClick={() => setShowAddMemberModal(false)}
                className="rounded-xl bg-slate-700 px-4 py-2 hover:bg-slate-600 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {showManageModal && selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-hidden rounded-3xl border border-slate-700 bg-slate-900">
            <div className="border-b border-slate-800 p-5">
              <h3 className="text-lg font-semibold">Manage Group</h3>
              <p className="mt-1 text-sm text-slate-400">{selectedGroup.group_name}</p>
            </div>
            <div className="max-h-[60vh] space-y-5 overflow-y-auto p-5">
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <p className="mb-3 text-sm font-semibold text-slate-300">
                  Group settings
                </p>
                <div className="mb-4 flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => groupImageInputRef.current?.click()}
                    className="relative h-16 w-16 overflow-hidden rounded-2xl bg-violet-600 cursor-pointer"
                  >
                    {editGroupImage ? (
                      <img
                        src={
                          editGroupImage.startsWith("data:")
                            ? editGroupImage
                            : getMediaUrl(editGroupImage)
                        }
                        alt="Group"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center">
                        <Users size={22} />
                      </div>
                    )}
                    <span className="absolute inset-0 grid place-items-center bg-black/40 opacity-0 hover:opacity-100 transition">
                      <Camera size={18} />
                    </span>
                  </button>
                  <input
                    ref={groupImageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleGroupImagePick(e.target.files?.[0])}
                  />
                  <div className="flex-1">
                    <label className="mb-1 block text-xs text-slate-400">
                      Group name
                    </label>
                    <input
                      value={editGroupName}
                      onChange={(e) => setEditGroupName(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={updateGroupDetails}
                  disabled={actionLoading}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                >
                  Save changes
                </button>
              </div>

              <div>
                <p className="mb-3 text-sm font-semibold text-slate-300">
                  Employees in group ({selectedGroup.member_details.length})
                </p>
                <div className="space-y-2">
                  {selectedGroup.member_details.map((member) => (
                    <div
                      key={member.employee_id}
                      className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950 p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-300">{member.name}</p>
                        <p className="truncate text-xs text-slate-400">
                          {member.role} · {member.department}
                        </p>
                      </div>
                      {member.employee_id !== employeeId && (
                        <button
                          type="button"
                          onClick={() => removeMember(member.employee_id)}
                          disabled={actionLoading}
                          className="rounded-xl p-2 text-red-400 hover:bg-red-500/10 cursor-pointer"
                          title="Remove member"
                        >
                          <UserMinus size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {nonMembers.length > 0 && (
                <div>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-300">
                      Add employees ({nonMembers.length} available)
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setShowManageModal(false);
                        openAddMemberModal();
                      }}
                      className="text-xs font-semibold text-green-400 hover:text-green-300 cursor-pointer"
                    >
                      Open add members
                    </button>
                  </div>
                  <div className="max-h-40 space-y-2 overflow-y-auto">
                    {nonMembers.map((emp) => (
                      <div
                        key={emp.employee_id}
                        className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950 p-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-300">{emp.name}</p>
                          <p className="truncate text-xs text-slate-400">
                            {emp.department}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => addMember(emp.employee_id)}
                          disabled={actionLoading}
                          className="rounded-xl p-2 text-green-400 hover:bg-green-500/10 cursor-pointer"
                          title="Add member"
                        >
                          <UserPlus size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {actionError && (
                <p className="text-sm text-red-400">{actionError}</p>
              )}

              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300 hover:bg-red-500/20 cursor-pointer"
              >
                <Trash2 size={16} />
                Delete Group
              </button>
            </div>
            <div className="flex justify-end border-t border-slate-800 p-5">
              <button
                type="button"
                onClick={() => setShowManageModal(false)}
                className="rounded-xl bg-slate-700 px-4 py-2 hover:bg-slate-600 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showMembersModal && selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[80vh] w-full max-w-md overflow-hidden rounded-3xl border border-slate-700 bg-slate-900">
            <div className="border-b border-slate-800 p-5">
              <h3 className="text-lg font-semibold">Group Members</h3>
              <p className="mt-1 text-sm text-slate-400">
                {selectedGroup.member_details.length} employee
                {selectedGroup.member_details.length === 1 ? "" : "s"} in{" "}
                {selectedGroup.group_name}
              </p>
            </div>
            <div className="max-h-[50vh] space-y-2 overflow-y-auto p-5">
              {selectedGroup.member_details.map((member) => (
                <div
                  key={member.employee_id}
                  className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950 p-3"
                >
                  <div className="h-10 w-10 overflow-hidden rounded-full bg-slate-800">
                    {member.profile_img ? (
                      <img
                        src={getMediaUrl(member.profile_img)}
                        alt={member.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center bg-cyan-600 text-sm font-bold">
                        {member.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-300">{member.name}</p>
                    <p className="truncate text-xs text-slate-400">
                      {member.role} · {member.department}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-800 p-5">
              {isStaffRole && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMembersModal(false);
                    openAddMemberModal();
                  }}
                  className="rounded-xl bg-green-600 px-4 py-2 text-sm hover:bg-green-700 cursor-pointer"
                >
                  Add Members
                </button>
              )}
              {isStaffRole && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMembersModal(false);
                    setShowManageModal(true);
                  }}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm hover:bg-blue-700 cursor-pointer"
                >
                  Manage group
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowMembersModal(false)}
                className="rounded-xl bg-slate-700 px-4 py-2 hover:bg-slate-600 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-3xl border border-slate-700 bg-slate-900 p-6">
            <h3 className="text-lg font-semibold">Delete Group?</h3>
            <p className="mt-2 text-sm text-slate-400">
              This will permanently delete the group and all its messages.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-xl bg-slate-700 px-4 py-2 hover:bg-slate-600 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={deleteGroup}
                disabled={actionLoading}
                className="rounded-xl bg-red-600 px-4 py-2 hover:bg-red-700 cursor-pointer"
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
