import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  MessageSquare,
  Search,
  Users,
  ChevronUp,
} from "lucide-react";
import API from "../services/api";
import DirectChatPopup from "./DirectChatPopup";
import GroupChatPopup from "./GroupChatPopup";
import IncomingCallModal from "./IncomingCallModal";
import VideoCallWindow, {
  type ActiveCall,
  type CallParticipant,
} from "./VideoCallWindow";
import NotificationBadge from "./NotificationBadge";
import { useUnreadMessages } from "../hooks/useUnreadMessages";
import {
  clearCallSession,
  loadCallSession,
  missedCallMessage,
  endedCallMessage,
  saveCallSession,
  type CallMode,
} from "../utils/callHelpers";
import type { ChatGroup, ChatMessage, Contact, OpenChat } from "../utils/chatHelpers";
import { chatKey, getMediaUrl, getWsUrl } from "../utils/chatHelpers";
import {
  playCallEndSound,
  startIncomingRingtone,
  stopIncomingRingtone,
} from "../utils/callSounds";
import Button from "./Button";
import Input from "./Input";

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
  const employeeId = localStorage.getItem("employee_id") || "";
  const employeeName = localStorage.getItem("employee_name") || "You";
  const role = localStorage.getItem("role") || "employee";
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
  const [activeCall, setActiveCallState] = useState<ActiveCall | null>(() => {
    const saved = loadCallSession(employeeId);
    if (!saved) return null;
    return { ...saved, restored: true };
  });
  const [incomingCall, setIncomingCall] = useState<ActiveCall | null>(null);
  const activeCallRef = useRef<ActiveCall | null>(null);
  const incomingCallRef = useRef<ActiveCall | null>(null);
  const openCallChatRef = useRef<(call: ActiveCall) => void>(() => undefined);

  const setActiveCall = useCallback(
    (call: ActiveCall | null) => {
      setActiveCallState(call);
      if (call) {
        saveCallSession(employeeId, call);
      } else {
        clearCallSession(employeeId);
      }
    },
    [employeeId],
  );

  const updateCallSession = useCallback(
    (call: ActiveCall) => {
      saveCallSession(employeeId, call);
      setActiveCallState(call);
    },
    [employeeId],
  );

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  useEffect(() => {
    if (incomingCall && !activeCall) {
      startIncomingRingtone();
      return () => stopIncomingRingtone();
    }
    stopIncomingRingtone();
    return undefined;
  }, [incomingCall, activeCall]);

  const { summary, refreshUnread } = useUnreadMessages(employeeId, 15000);
  const isMobile = useIsMobile();
  const visible = Boolean(employeeId) && !HIDDEN_PATHS.has(location.pathname);

  const activeChat = openChats[openChats.length - 1] ?? null;
  const activeChatKey = activeChat ? chatKey(activeChat) : "";
  const showMobileChat =
    isMobile && activeChat && !minimizedChats[activeChatKey];

  const meParticipant = useMemo<CallParticipant>(
    () => ({
      employee_id: employeeId,
      name: employeeName,
      role,
      profile_img: localStorage.getItem("profile_img") || "",
    }),
    [employeeId, employeeName, role],
  );

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

  const sendCallEvent = useCallback(
    (payload: Record<string, unknown>) => {
      const socket = socketRef.current;
      if (socket?.readyState !== WebSocket.OPEN) return false;
      socket.send(JSON.stringify(payload));
      return true;
    },
    [],
  );

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
        } else if (data.type === "call_invite") {
          const caller = data.caller as CallParticipant | undefined;
          const callerId = String(data.sender_id || caller?.employee_id || "");
          const callId = String(data.call_id || "");
          if (!callerId || !callId || callerId === employeeId) return;
          if (activeCallRef.current) {
            sendCallEvent({
              type: "call_decline",
              call_id: callId,
              call_type: data.call_type,
              call_mode: data.call_mode,
              group_id: data.group_id,
              group_name: data.group_name,
              target_id: callerId,
              reason: "busy",
            });
            return;
          }

          const callType = data.call_type === "group" ? "group" : "direct";
          const callMode = data.call_mode === "audio" ? "audio" : "video";
          setIncomingCall({
            callId,
            callType,
            callMode,
            title:
              callType === "group"
                ? String(data.group_name || "Group call")
                : caller?.name || String(data.caller_name || "Video call"),
            callerId,
            callerName: caller?.name || String(data.caller_name || callerId),
            groupId: data.group_id ? String(data.group_id) : undefined,
            groupName: data.group_name ? String(data.group_name) : undefined,
            peerIds: [callerId],
            participants: [meParticipant, caller || { employee_id: callerId, name: callerId }],
            startedByMe: false,
          });
        } else if (data.type === "call_end") {
          const callId = String(data.call_id || "");
          const incoming = incomingCallRef.current;
          if (incoming && incoming.callId === callId) {
            stopIncomingRingtone();
            playCallEndSound();
            setIncomingCall(null);
            openCallChatRef.current({ ...incoming, startedByMe: false });
          }
        } else if (data.type === "call_error") {
          setActiveCall(null);
        }
      };
    };

    const timer = window.setTimeout(connectSocket, 150);
    return () => {
      active = false;
      window.clearTimeout(timer);
      clearReconnectTimer();
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
    };
  }, [broadcastWs, employeeId, loadContacts, refreshUnread, sendCallEvent, visible]);

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

  const startDirectCall = useCallback(
    (contact: Contact, callMode: CallMode) => {
      if (activeCall) return;
      const callId = `direct-${employeeId}-${contact.employee_id}-${Date.now()}`;
      const nextCall: ActiveCall = {
        callId,
        callType: "direct",
        callMode,
        title: contact.name,
        callerId: employeeId,
        callerName: employeeName,
        peerIds: [contact.employee_id],
        participants: [meParticipant, contact],
        startedByMe: true,
      };
      setActiveCall(nextCall);
      sendCallEvent({
        type: "call_invite",
        call_id: callId,
        call_type: "direct",
        call_mode: callMode,
        recipient_id: contact.employee_id,
        caller_name: employeeName,
        title: employeeName,
      });
    },
    [activeCall, employeeId, employeeName, meParticipant, sendCallEvent],
  );

  const startDirectVideoCall = useCallback(
    (contact: Contact) => startDirectCall(contact, "video"),
    [startDirectCall],
  );

  const startDirectVoiceCall = useCallback(
    (contact: Contact) => startDirectCall(contact, "audio"),
    [startDirectCall],
  );

  const startGroupCall = useCallback(
    (group: ChatGroup, callMode: CallMode) => {
      if (activeCall) return;
      const members = group.member_details || [];
      const callId = `group-${group.id}-${employeeId}-${Date.now()}`;
      const nextCall: ActiveCall = {
        callId,
        callType: "group",
        callMode,
        title: group.group_name,
        callerId: employeeId,
        callerName: employeeName,
        groupId: group.id,
        groupName: group.group_name,
        peerIds: [],
        participants: [meParticipant, ...members],
        startedByMe: true,
      };
      setActiveCall(nextCall);
      sendCallEvent({
        type: "call_invite",
        call_id: callId,
        call_type: "group",
        call_mode: callMode,
        group_id: group.id,
        group_name: group.group_name,
        caller_name: employeeName,
        title: group.group_name,
      });
    },
    [activeCall, employeeId, employeeName, meParticipant, sendCallEvent],
  );

  const startGroupVideoCall = useCallback(
    (group: ChatGroup) => startGroupCall(group, "video"),
    [startGroupCall],
  );

  const startGroupVoiceCall = useCallback(
    (group: ChatGroup) => startGroupCall(group, "audio"),
    [startGroupCall],
  );

  const openCallChat = useCallback((call: ActiveCall) => {
    if (call.callType !== "direct") return;
    const contactId = call.startedByMe ? call.peerIds[0] : call.callerId;
    if (!contactId) return;
    openChat({ type: "direct", id: contactId });
  }, []);

  useEffect(() => {
    openCallChatRef.current = openCallChat;
  }, [openCallChat]);

  const postDirectCallMessage = useCallback(
    async (recipientId: string, message: string) => {
      if (!recipientId) return null;
      try {
        const res = await API.post("/employees/chat-message/send/", {
          sender_id: employeeId,
          recipient_id: recipientId,
          message,
        });
        if (res.data.success && res.data.message) {
          broadcastWs({ type: "message", message: res.data.message });
          refreshUnread();
          return res.data.message as ChatMessage;
        }
      } catch {
        /* silent */
      }
      return null;
    },
    [broadcastWs, employeeId, refreshUnread],
  );

  const sendDirectCallMessage = useCallback(
    async (
      call: ActiveCall,
      targetId?: string,
      reason: "missed" | "declined" = "missed",
    ) => {
      if (call.callType !== "direct") return;
      const recipientId = targetId || call.peerIds[0];
      if (!recipientId) return;
      const mode = call.callMode || "video";
      await postDirectCallMessage(recipientId, missedCallMessage(mode, reason));
      openCallChat(call);
    },
    [openCallChat, postDirectCallMessage],
  );

  const sendDirectCallEndedMessage = useCallback(
    async (call: ActiveCall, durationSeconds: number) => {
      if (call.callType !== "direct") return;
      const recipientId = call.peerIds[0];
      if (!recipientId) return;
      const mode = call.callMode || "video";
      const duration =
        durationSeconds >= 60
          ? `${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s`
          : `${durationSeconds}s`;
      await postDirectCallMessage(
        recipientId,
        `${endedCallMessage(mode)} · ${duration}`,
      );
      openCallChat(call);
    },
    [openCallChat, postDirectCallMessage],
  );

  const sendGroupCallMessage = useCallback(
    async (call: ActiveCall, reason: "missed" | "declined" | "ended" = "missed") => {
      if (call.callType !== "group" || !call.groupId) return;
      const mode = call.callMode || "video";
      const label =
        reason === "ended"
          ? endedCallMessage(mode)
          : reason === "missed"
            ? mode === "audio"
              ? "Missed group voice call"
              : "Missed group video call"
            : mode === "audio"
              ? "Group voice call declined"
              : "Group video call declined";
      try {
        const res = await API.post("/employees/chat-groups/message/send/", {
          sender_id: employeeId,
          group_id: call.groupId,
          message: label,
        });
        if (res.data.success) {
          refreshUnread();
        }
      } catch {
        /* silent */
      }
    },
    [employeeId, refreshUnread],
  );

  const handleUnansweredCall = useCallback(
    async (call: ActiveCall) => {
      if (call.callType === "direct") {
        await sendDirectCallMessage(call, call.peerIds[0], "missed");
      } else {
        await sendGroupCallMessage(call, "missed");
      }
    },
    [sendDirectCallMessage, sendGroupCallMessage],
  );

  const handleCallEnded = useCallback(
    (call: ActiveCall, durationSeconds: number) => {
      if (call.callType === "direct") {
        void sendDirectCallEndedMessage(call, durationSeconds);
      } else {
        void sendGroupCallMessage(call, "ended");
      }
    },
    [sendDirectCallEndedMessage, sendGroupCallMessage],
  );

  const handleMissedCall = useCallback(
    async (
      call: ActiveCall,
      targetId?: string,
      reason: "missed" | "declined" = "missed",
    ) => {
      if (call.callType === "direct") {
        await sendDirectCallMessage(call, targetId, reason);
      }
    },
    [sendDirectCallMessage],
  );

  const acceptIncomingCall = () => {
    if (!incomingCall || activeCall) return;
    stopIncomingRingtone();
    const call = incomingCall;
    sendCallEvent({
      type: "call_accept",
      call_id: call.callId,
      call_type: call.callType,
      call_mode: call.callMode,
      group_id: call.groupId,
      group_name: call.groupName,
      target_id: call.callerId,
      caller_id: call.callerId,
      participant: {
        employee_id: employeeId,
        name: employeeName,
      },
    });
    setActiveCall({ ...call, startedByMe: false });
    setIncomingCall(null);
  };

  const declineIncomingCall = useCallback(
    async (reason: "declined" | "missed" | "busy" = "declined") => {
      if (!incomingCall) return;
      stopIncomingRingtone();
      playCallEndSound();
      const call = incomingCall;
      sendCallEvent({
        type: "call_decline",
        call_id: call.callId,
        call_type: call.callType,
        call_mode: call.callMode,
        group_id: call.groupId,
        group_name: call.groupName,
        target_id: call.callerId,
        reason,
      });
      setIncomingCall(null);
      if (reason === "missed" && call.callType === "direct") {
        openCallChat({ ...call, startedByMe: false });
      }
    },
    [incomingCall, openCallChat, sendCallEvent],
  );

  useEffect(() => {
    if (!incomingCall) return;
    const timer = window.setTimeout(() => declineIncomingCall("missed"), 30000);
    return () => window.clearTimeout(timer);
  }, [declineIncomingCall, incomingCall]);

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
          onStartVideoCall={startDirectVideoCall}
          onStartVoiceCall={startDirectVoiceCall}
          canStartVideoCall={!activeCall}
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
        onStartGroupVideoCall={startGroupVideoCall}
        onStartGroupVoiceCall={startGroupVoiceCall}
        canStartGroupCall={!activeCall}
      />
    );
  };

  const drawerPanel = (
    <div
      className={`flex flex-col overflow-hidden border border-slate-700/60 bg-slate-900/98 shadow-2xl backdrop-blur-xl ${
        isMobile
          ? "max-h-[min(85dvh,640px)] w-full border-b-0"
          : "max-h-[min(75vh,520px)] w-full border-b-0"
      }`}
    >
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
                className="flex w-full items-center gap-3 border-b border-slate-800/60 px-4 py-3 text-left transition hover:bg-slate-800/70 cursor-pointer"
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
                  {contact.is_online && (
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-slate-900 bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
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
          <p className="p-6 text-center text-sm text-slate-500">
            No groups found
          </p>
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
        className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full md:rounded-none border border-cyan-800 bg-slate-900/95 shadow-xl shadow-cyan-950/40 backdrop-blur-xl text-cyan-500 transition hover:scale-105 active:scale-95 md:border-slate-800 md:h-12 md:w-full md:max-w-none md:justify-start md:gap-3 md:px-4 md:py-0 md:hover:scale-100 cursor-pointer"
        aria-label={expanded ? "Close messages" : "Open messages"}
      >
        <div className="relative flex items-center gap-3">
          <MessageSquare className="h-6 w-6 md:hidden" />
          <div className="relative hidden md:block">
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
          </div>
          <span className="hidden text-sm font-semibold text-white md:inline">
            Messages
          </span>
          {summary.total > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white ring-2 ring-slate-900">
              {summary.total > 99 ? "99+" : summary.total}
            </span>
          )}
        </div>
        <div className="absolute right-5 top-4">
          <ChevronUp
            className={`h-5 w-5 transition-transform duration-400 hidden md:block ${
              expanded ? "rotate-180" : ""
            }`}
          /> 
        </div>
      </button>
    </>
  );

  if (!visible) return null;

  return (
    <>
      {incomingCall && (
        <IncomingCallModal
          call={incomingCall}
          onAccept={acceptIncomingCall}
          onDecline={() => declineIncomingCall("declined")}
        />
      )}

      {activeCall && (
        <VideoCallWindow
          call={activeCall}
          employeeId={employeeId}
          employeeName={employeeName}
          socketRef={socketRef}
          registerHandler={registerHandler}
          onClose={() => setActiveCall(null)}
          onMissedCall={handleMissedCall}
          onUnanswered={handleUnansweredCall}
          onCallEnded={handleCallEnded}
          onCallSessionUpdate={updateCallSession}
        />
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
      <div className="fixed bottom-0 right-0 z-50 hidden items-end gap-2 md:flex">
        {openChats.map((chat) => (
          <div key={chatKey(chat)} className="pointer-events-auto shrink-0">
            {renderChatPopup(chat, false)}
          </div>
        ))}
        <div className="pointer-events-auto flex w-[min(calc(100vw-2rem),460px)] flex-col">
          {fabButton}
          {expanded && drawerPanel}
        </div>
      </div>

      {/* Mobile: bottom sheet + FAB */}
      {!showMobileChat && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-end p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
          {expanded && (
            <div className="pointer-events-auto mb-3 w-full">{drawerPanel}</div>
          )}
          <div className="pointer-events-auto">{fabButton}</div>
        </div>
      )}
    </>
  );
}
