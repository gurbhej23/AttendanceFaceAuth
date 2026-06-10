export type CallMode = "video" | "audio";

export interface CallParticipantSnapshot {
  employee_id: string;
  name: string;
  profile_img?: string;
  role?: string;
}

export interface CallSessionSnapshot {
  callId: string;
  callType: "direct" | "group";
  callMode?: CallMode;
  title: string;
  callerId: string;
  callerName: string;
  groupId?: string;
  groupName?: string;
  peerIds: string[];
  participants: CallParticipantSnapshot[];
  startedByMe: boolean;
  restored?: boolean;
  connectedAt?: number;
  wasConnected?: boolean;
}

const callSessionKey = (employeeId: string) => `active_call_${employeeId}`;

export const saveCallSession = (
  employeeId: string,
  call: CallSessionSnapshot,
) => {
  if (!employeeId) return;
  try {
    sessionStorage.setItem(callSessionKey(employeeId), JSON.stringify(call));
  } catch {
    /* quota / private mode */
  }
};

export const loadCallSession = (
  employeeId: string,
): CallSessionSnapshot | null => {
  if (!employeeId) return null;
  try {
    const raw = sessionStorage.getItem(callSessionKey(employeeId));
    if (!raw) return null;
    return JSON.parse(raw) as CallSessionSnapshot;
  } catch {
    return null;
  }
};

export const clearCallSession = (employeeId: string) => {
  if (!employeeId) return;
  sessionStorage.removeItem(callSessionKey(employeeId));
};

export const MISSED_CALL_MESSAGE = "Missed video call";
export const DECLINED_CALL_MESSAGE = "Video call declined";
export const MISSED_VOICE_MESSAGE = "Missed voice call";
export const DECLINED_VOICE_MESSAGE = "Voice call declined";
export const ENDED_VIDEO_MESSAGE = "Video call ended";
export const ENDED_VOICE_MESSAGE = "Voice call ended";

export const formatCallDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const formatMemberRole = (role?: string) => {
  if (role === "hr") return "HR";
  if (role === "admin") return "Admin";
  return role || "Employee";
};

export const missedCallMessage = (mode: CallMode, reason: "missed" | "declined") => {
  if (mode === "audio") {
    return reason === "missed" ? MISSED_VOICE_MESSAGE : DECLINED_VOICE_MESSAGE;
  }
  return reason === "missed" ? MISSED_CALL_MESSAGE : DECLINED_CALL_MESSAGE;
};

export const endedCallMessage = (mode: CallMode) =>
  mode === "audio" ? ENDED_VOICE_MESSAGE : ENDED_VIDEO_MESSAGE;

export const isCallLogMessage = (text: string) => {
  const value = text.toLowerCase();
  return (
    (value.includes("missed") && value.includes("call")) ||
    value.includes("call declined") ||
    value.includes("call ended")
  );
};

export const callStatusLabel = (status: string, mode: CallMode) => {
  if (status === "Connected") return "In call";
  if (status === "Connection lost") return "Connection lost";
  if (status === "Connecting...") return "Connecting...";
  if (status === "Reconnecting...") return "Reconnecting...";
  if (status === "Calling...") {
    return mode === "audio" ? "Calling..." : "Ringing...";
  }
  return status;
};
