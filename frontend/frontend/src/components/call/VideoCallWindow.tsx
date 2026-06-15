import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  PhoneOff,
  Users,
} from "lucide-react";
import {
  callStatusLabel,
  formatCallDuration,
  type CallMode,
} from "../../utils/callHelpers";
import { getMediaUrl } from "../../utils/chatHelpers";
import {
  playCallEndSound,
  startOutgoingRingtone,
  stopAllRingtones,
  stopIncomingRingtone,
  stopOutgoingRingtone,
} from "../../utils/callSounds";
import Button from "../common/Button";

export interface CallParticipant {
  employee_id: string;
  name: string;
  profile_img?: string;
  role?: string;
}

export interface ActiveCall {
  callId: string;
  callType: "direct" | "group";
  callMode?: CallMode;
  title: string;
  callerId: string;
  callerName: string;
  groupId?: string;
  groupName?: string;
  peerIds: string[];
  participants: CallParticipant[];
  startedByMe: boolean;
  restored?: boolean;
  connectedAt?: number;
  wasConnected?: boolean;
}

interface Props {
  call: ActiveCall;
  employeeId: string;
  employeeName: string;
  socketRef: React.RefObject<WebSocket | null>;
  registerHandler: (handler: (data: Record<string, unknown>) => void) => () => void;
  onClose: () => void;
  onMissedCall?: (
    call: ActiveCall,
    targetId?: string,
    reason?: "missed" | "declined",
  ) => void | Promise<void>;
  onUnanswered?: (call: ActiveCall) => void | Promise<void>;
  onCallEnded?: (call: ActiveCall, durationSeconds: number) => void | Promise<void>;
  onCallSessionUpdate?: (call: ActiveCall) => void;
}

const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
  iceCandidatePoolSize: 10,
};

const toSessionDescription = (
  value: unknown,
): RTCSessionDescriptionInit | null => {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as RTCSessionDescriptionInit;
    } catch {
      return null;
    }
  }
  if (
    typeof value === "object" &&
    "sdp" in value &&
    "type" in value &&
    typeof (value as RTCSessionDescriptionInit).sdp === "string"
  ) {
    return {
      type: (value as RTCSessionDescriptionInit).type,
      sdp: (value as RTCSessionDescriptionInit).sdp,
    };
  }
  return null;
};

const toIceCandidate = (value: unknown): RTCIceCandidateInit | null => {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as RTCIceCandidateInit;
    } catch {
      return null;
    }
  }
  if (typeof value === "object" && "candidate" in value) {
    return value as RTCIceCandidateInit;
  }
  return null;
};

function CallAvatar({
  name,
  profileImg,
  size = "md",
  className = "",
}: {
  name: string;
  profileImg?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const dim =
    size === "lg" ? "h-24 w-24 text-3xl" : size === "sm" ? "h-12 w-12 text-lg" : "h-20 w-20 text-2xl";
  const src = profileImg && !failed ? getMediaUrl(profileImg) : "";

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setFailed(true)}
        className={`${dim} rounded-full object-cover ring-2 ring-white/10 ${className}`}
      />
    );
  }

  return (
    <div
      className={`grid ${dim} place-items-center rounded-full bg-cyan-700 font-bold text-white ring-2 ring-white/10 ${className}`}
    >
      {name.charAt(0) || "?"}
    </div>
  );
}

function VideoTile({
  stream,
  name,
  muted,
  profileImg,
  audioOnly,
}: {
  stream?: MediaStream;
  name: string;
  muted?: boolean;
  profileImg?: string;
  audioOnly?: boolean;
}) {
  const mediaRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = mediaRef.current;
    if (!el || !stream) return;
    el.srcObject = stream;
    const play = () => {
      void el.play().catch(() => undefined);
    };
    play();
    stream.getAudioTracks().forEach((track) => {
      track.onunmute = play;
      track.onmute = play;
    });
  }, [stream]);

  const hasVideo =
    !audioOnly && stream?.getVideoTracks().some((track) => track.enabled);

  return (
    <div className="relative min-h-44 overflow-hidden rounded-2xl border border-white/10 bg-slate-950">
      {stream && (
        <video
          ref={mediaRef}
          autoPlay
          playsInline
          muted={Boolean(muted)}
          className={
            hasVideo
              ? "h-full min-h-44 w-full object-cover"
              : "pointer-events-none absolute h-0 w-0 opacity-0"
          }
        />
      )}
      {!hasVideo && (
        <div className="grid h-full min-h-44 place-items-center bg-gradient-to-br from-slate-900 to-slate-950">
          <CallAvatar name={name} profileImg={profileImg} />
          {audioOnly && (
            <div className="absolute bottom-12 flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-2 w-2 animate-bounce rounded-full bg-emerald-400"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          )}
        </div>
      )}
      <div className="absolute bottom-2 left-2 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
        {name}
      </div>
    </div>
  );
}

export default function VideoCallWindow({
  call,
  employeeId,
  employeeName,
  socketRef,
  registerHandler,
  onClose,
  onMissedCall,
  onUnanswered,
  onCallEnded,
  onCallSessionUpdate,
}: Props) {
  const callMode = call.callMode || "video";
  const audioOnly = callMode === "audio";

  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Record<string, RTCPeerConnection>>({});
  const acceptedPeersRef = useRef<Set<string>>(new Set(call.peerIds));
  const pendingIceRef = useRef<Record<string, RTCIceCandidateInit[]>>({});
  const closedRef = useRef(false);
  const connectedRef = useRef(false);
  const callStartRef = useRef<number | null>(null);
  const callRef = useRef(call);
  const makingOfferRef = useRef<Record<string, boolean>>({});

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [participants, setParticipants] = useState<Record<string, CallParticipant>>(
    () => {
      const map: Record<string, CallParticipant> = {};
      call.participants.forEach((participant) => {
        map[participant.employee_id] = participant;
      });
      return map;
    },
  );
  const participantsRef = useRef(participants);

  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  useEffect(() => {
    callRef.current = call;
  }, [call]);
  const [status, setStatus] = useState(
    call.startedByMe ? "Calling..." : "Connecting...",
  );
  const [permissionError, setPermissionError] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(!audioOnly);
  const [expanded, setExpanded] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const connectedCount = Object.keys(remoteStreams).length;

  const sendCallEvent = useCallback(
    (payload: Record<string, unknown>) => {
      const socket = socketRef.current;
      if (socket?.readyState !== WebSocket.OPEN) return false;
      socket.send(
        JSON.stringify({
          call_id: call.callId,
          call_type: call.callType,
          call_mode: callMode,
          group_id: call.groupId,
          group_name: call.groupName,
          ...payload,
        }),
      );
      return true;
    },
    [call.callId, call.callType, call.groupId, call.groupName, callMode, socketRef],
  );

  const closePeer = useCallback((peerId: string) => {
    peersRef.current[peerId]?.close();
    delete peersRef.current[peerId];
    delete makingOfferRef.current[peerId];
    delete pendingIceRef.current[peerId];
    setRemoteStreams((cur) => {
      const next = { ...cur };
      delete next[peerId];
      return next;
    });
  }, []);

  const resetPeer = useCallback(
    (peerId: string) => {
      closePeer(peerId);
    },
    [closePeer],
  );

  const persistCallSession = useCallback(() => {
    onCallSessionUpdate?.({
      ...callRef.current,
      wasConnected: connectedRef.current,
      connectedAt: callStartRef.current ?? undefined,
    });
  }, [onCallSessionUpdate]);

  const markConnected = useCallback(() => {
    stopAllRingtones();
    if (connectedRef.current) {
      setStatus("Connected");
      return;
    }
    connectedRef.current = true;
    callStartRef.current = callStartRef.current || Date.now();
    setIsConnected(true);
    setStatus("Connected");
    if (callRef.current.restored) {
      callRef.current = { ...callRef.current, restored: false };
    }
    persistCallSession();
  }, [persistCallSession]);

  const failConnection = useCallback(() => {
    if (!connectedRef.current) setStatus("Connection failed");
  }, []);

  const attachLocalTracks = useCallback((pc: RTCPeerConnection) => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getTracks().forEach((track) => {
      const hasTrack = pc
        .getSenders()
        .some((sender) => sender.track?.kind === track.kind);
      if (!hasTrack) {
        pc.addTrack(track, stream);
      }
    });
  }, []);

  const createPeer = useCallback(
    (peerId: string) => {
      if (peersRef.current[peerId]) return peersRef.current[peerId];
      const pc = new RTCPeerConnection(rtcConfig);
      peersRef.current[peerId] = pc;
      attachLocalTracks(pc);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendCallEvent({
            type: "call_ice",
            target_id: peerId,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      pc.ontrack = (event) => {
        const stream =
          event.streams[0] ||
          new MediaStream([event.track]);
        setRemoteStreams((cur) => ({ ...cur, [peerId]: stream }));
        markConnected();
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          markConnected();
        }
        if (pc.connectionState === "failed") {
          if (!connectedRef.current) failConnection();
          else setStatus("Connection lost");
        }
        if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
          closePeer(peerId);
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (
          pc.iceConnectionState === "connected" ||
          pc.iceConnectionState === "completed"
        ) {
          markConnected();
        }
      };

      return pc;
    },
    [attachLocalTracks, closePeer, failConnection, markConnected, sendCallEvent],
  );

  useEffect(() => {
    if (!localStream) return;
    localStreamRef.current = localStream;
    Object.values(peersRef.current).forEach((pc) => attachLocalTracks(pc));
  }, [attachLocalTracks, localStream]);

  const flushIce = useCallback(async (peerId: string, pc: RTCPeerConnection) => {
    const pending = pendingIceRef.current[peerId] || [];
    pendingIceRef.current[peerId] = [];
    for (const candidate of pending) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => undefined);
    }
  }, []);

  const waitForLocalStream = useCallback(async () => {
    if (localStreamRef.current) return localStreamRef.current;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 100));
      if (localStreamRef.current) return localStreamRef.current;
    }
    return null;
  }, []);

  const createOffer = useCallback(
    async (peerId: string, options?: { force?: boolean }) => {
      if (peerId === employeeId || makingOfferRef.current[peerId]) return;
      if (options?.force) {
        resetPeer(peerId);
      }
      const existing = peersRef.current[peerId];
      if (!options?.force) {
        if (existing?.localDescription?.type === "offer") return;
        if (existing?.signalingState === "stable" && existing.remoteDescription) return;
      }

      const stream = await waitForLocalStream();
      if (!stream) {
        setStatus("Waiting for camera/mic...");
        return;
      }
      makingOfferRef.current[peerId] = true;
      try {
        acceptedPeersRef.current.add(peerId);
        const pc = createPeer(peerId);
        attachLocalTracks(pc);
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: !audioOnly,
        });
        await pc.setLocalDescription(offer);
        sendCallEvent({
          type: "call_offer",
          target_id: peerId,
          offer: { type: offer.type, sdp: offer.sdp },
        });
        setStatus("Connecting...");
      } catch {
        failConnection();
      } finally {
        makingOfferRef.current[peerId] = false;
      }
    },
    [
      attachLocalTracks,
      audioOnly,
      createPeer,
      employeeId,
      failConnection,
      resetPeer,
      sendCallEvent,
      waitForLocalStream,
    ],
  );

  const handleOffer = useCallback(
    async (senderId: string, rawOffer: unknown) => {
      if (senderId === employeeId) return;
      const offer = toSessionDescription(rawOffer);
      if (!offer) {
        failConnection();
        return;
      }
      const stream = await waitForLocalStream();
      if (!stream) {
        setStatus("Waiting for camera/mic...");
        return;
      }
      try {
        acceptedPeersRef.current.add(senderId);
        if (peersRef.current[senderId]?.remoteDescription) {
          resetPeer(senderId);
        }
        const pc = createPeer(senderId);
        attachLocalTracks(pc);
        if (pc.signalingState === "have-local-offer") {
          await pc.setLocalDescription({ type: "rollback" } as RTCSessionDescriptionInit);
        }
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        await flushIce(senderId, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendCallEvent({
          type: "call_answer",
          target_id: senderId,
          answer: { type: answer.type, sdp: answer.sdp },
        });
        if (
          pc.signalingState === "stable" ||
          pc.iceConnectionState === "connected" ||
          pc.iceConnectionState === "completed"
        ) {
          markConnected();
        } else {
          setStatus("Connecting...");
        }
      } catch {
        failConnection();
      }
    },
    [
      attachLocalTracks,
      createPeer,
      employeeId,
      failConnection,
      flushIce,
      markConnected,
      resetPeer,
      sendCallEvent,
      waitForLocalStream,
    ],
  );

  const handleAnswer = useCallback(
    async (senderId: string, rawAnswer: unknown) => {
      const answer = toSessionDescription(rawAnswer);
      if (!answer) {
        failConnection();
        return;
      }
      const pc = peersRef.current[senderId];
      if (!pc) return;
      if (pc.signalingState !== "have-local-offer") return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        await flushIce(senderId, pc);
        markConnected();
      } catch {
        failConnection();
      }
    },
    [failConnection, flushIce, markConnected],
  );

  const handleIce = useCallback(async (senderId: string, rawCandidate: unknown) => {
    const candidate = toIceCandidate(rawCandidate);
    if (!candidate) return;
    const pc = peersRef.current[senderId];
    if (!pc || !pc.remoteDescription) {
      pendingIceRef.current[senderId] = [
        ...(pendingIceRef.current[senderId] || []),
        candidate,
      ];
      return;
    }
    await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => undefined);
  }, []);

  const endCall = useCallback(
    (notify = true) => {
      if (closedRef.current) return;
      closedRef.current = true;
      const wasConnected = connectedRef.current;
      const durationSeconds = callStartRef.current
        ? Math.floor((Date.now() - callStartRef.current) / 1000)
        : 0;
      stopAllRingtones();
      if (notify) {
        playCallEndSound();
        if (call.callType === "group" && call.groupId) {
          sendCallEvent({ type: "call_end" });
        } else {
          const endTargets = new Set<string>([
            ...acceptedPeersRef.current,
            ...call.peerIds,
            ...(!call.startedByMe ? [call.callerId] : []),
          ]);
          endTargets.forEach((peerId) => {
            if (peerId && peerId !== employeeId) {
              sendCallEvent({ type: "call_end", target_id: peerId });
            }
          });
        }
        if (call.startedByMe && !wasConnected) {
          void Promise.resolve(onUnanswered?.(call));
        }
      }
      if (wasConnected && notify) {
        void Promise.resolve(onCallEnded?.(call, durationSeconds));
      }
      Object.values(peersRef.current).forEach((peer) => peer.close());
      peersRef.current = {};
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
      onClose();
    },
    [call, employeeId, onCallEnded, onClose, onUnanswered, sendCallEvent],
  );

  useEffect(() => {
    if (call.restored && call.wasConnected && call.connectedAt) {
      connectedRef.current = false;
      callStartRef.current = call.connectedAt;
      setIsConnected(true);
      setElapsed(Math.floor((Date.now() - call.connectedAt) / 1000));
      setStatus("Reconnecting...");
    } else if (!call.startedByMe) {
      setStatus("Connecting...");
    }
  }, [call.connectedAt, call.restored, call.startedByMe, call.wasConnected]);

  useEffect(() => {
    if (Object.keys(remoteStreams).length > 0) {
      markConnected();
    }
  }, [markConnected, remoteStreams]);

  useEffect(() => {
    if (!call.restored) return;
    let cancelled = false;
    let attempts = 0;

    const rejoinCall = async () => {
      if (cancelled || connectedRef.current) return;
      const stream = await waitForLocalStream();
      if (!stream) {
        window.setTimeout(() => void rejoinCall(), 400);
        return;
      }
      const peerIds = call.startedByMe ? call.peerIds : [call.callerId];
      let sent = false;
      peerIds.forEach((peerId) => {
        if (!peerId || peerId === employeeId) return;
        if (
          sendCallEvent({
            type: "call_rejoin",
            target_id: peerId,
          })
        ) {
          sent = true;
        }
      });
      attempts += 1;
      if (!connectedRef.current && !cancelled && attempts < 25) {
        window.setTimeout(() => void rejoinCall(), sent ? 2500 : 500);
      }
    };

    void rejoinCall();
    return () => {
      cancelled = true;
    };
  }, [
    call.callerId,
    call.peerIds,
    call.restored,
    call.startedByMe,
    employeeId,
    sendCallEvent,
    waitForLocalStream,
  ]);

  useEffect(() => {
    stopIncomingRingtone();
  }, []);

  useEffect(() => {
    if (call.startedByMe && status === "Calling..." && !connectedRef.current) {
      startOutgoingRingtone();
    } else {
      stopOutgoingRingtone();
    }
    return () => stopOutgoingRingtone();
  }, [call.startedByMe, status]);

  useEffect(() => {
    let cancelled = false;
    const openMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: !audioOnly,
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        localStreamRef.current = stream;
        setLocalStream(stream);
      } catch {
        setPermissionError(
          audioOnly
            ? "Microphone permission is blocked. Allow access in the browser to join the call."
            : "Camera or microphone permission is blocked. Allow access in the browser to join the call.",
        );
        setStatus("Permission needed");
      }
    };
    void openMedia();
    return () => {
      cancelled = true;
    };
  }, [audioOnly]);

  useEffect(() => {
    if (!call.startedByMe || connectedRef.current || call.restored) return;
    const timer = window.setTimeout(() => {
      if (!connectedRef.current && !closedRef.current) {
        endCall(true);
      }
    }, 30000);
    return () => window.clearTimeout(timer);
  }, [call, call.startedByMe, endCall, onUnanswered]);

  useEffect(() => {
    if (!isConnected) return;
    const timer = window.setInterval(() => {
      if (callStartRef.current) {
        setElapsed(Math.floor((Date.now() - callStartRef.current) / 1000));
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isConnected]);

  const signalHandlerRef = useRef<(data: Record<string, unknown>) => void>(
    () => undefined,
  );

  signalHandlerRef.current = (data: Record<string, unknown>) => {
    if (!String(data.type || "").startsWith("call_")) return;
    if (String(data.call_id) !== callRef.current.callId) return;
    const senderId = String(data.sender_id || "");
    if (!senderId || senderId === employeeId) return;

    const activeCall = callRef.current;
    const caller = data.caller as CallParticipant | undefined;
    if (caller?.employee_id) {
      setParticipants((cur) => ({ ...cur, [caller.employee_id]: caller }));
    }

    if (data.type === "call_accept") {
      acceptedPeersRef.current.add(senderId);
      const existingPc = peersRef.current[senderId];
      if (existingPc?.localDescription?.type === "offer") return;
      setStatus("Connecting...");
      if (activeCall.callType === "group") {
        const existing = Array.from(acceptedPeersRef.current).filter(
          (peerId) => peerId !== senderId,
        );
        existing.forEach((peerId) => {
          sendCallEvent({
            type: "call_peer_joined",
            target_id: peerId,
            peer_id: senderId,
            peer: caller,
          });
          sendCallEvent({
            type: "call_peer_joined",
            target_id: senderId,
            peer_id: peerId,
            peer: participantsRef.current[peerId],
          });
        });
      }
      void createOffer(senderId);
    } else if (data.type === "call_peer_joined") {
      const peerId = String(data.peer_id || "");
      const peer = data.peer as CallParticipant | undefined;
      if (peer?.employee_id) {
        setParticipants((cur) => ({ ...cur, [peer.employee_id]: peer }));
      }
      if (peerId && peerId !== employeeId) {
        acceptedPeersRef.current.add(peerId);
        if (employeeId < peerId) void createOffer(peerId);
      }
    } else if (data.type === "call_rejoin") {
      closePeer(senderId);
      delete makingOfferRef.current[senderId];
      acceptedPeersRef.current.add(senderId);
      setStatus(
        activeCall.wasConnected || connectedRef.current
          ? "Reconnecting..."
          : "Connecting...",
      );
      void createOffer(senderId, { force: true });
    } else if (data.type === "call_offer") {
      void handleOffer(senderId, data.offer);
    } else if (data.type === "call_answer") {
      void handleAnswer(senderId, data.answer);
    } else if (data.type === "call_ice") {
      void handleIce(senderId, data.candidate);
    } else if (data.type === "call_decline") {
      stopAllRingtones();
      playCallEndSound();
      closePeer(senderId);
      acceptedPeersRef.current.delete(senderId);
      const reason = data.reason === "missed" ? "missed" : "declined";
      void (async () => {
        await Promise.resolve(onMissedCall?.(activeCall, senderId, reason));
        setStatus(data.reason === "busy" ? "User unavailable" : "Call declined");
        if (activeCall.callType === "direct") {
          endCall(false);
        }
      })();
    } else if (data.type === "call_end") {
      stopAllRingtones();
      playCallEndSound();
      closePeer(senderId);
      acceptedPeersRef.current.delete(senderId);
      if (activeCall.callType === "direct") {
        setStatus("Call ended");
        window.setTimeout(() => endCall(false), 800);
      } else if (acceptedPeersRef.current.size === 0) {
        setStatus("Call ended");
        window.setTimeout(() => endCall(false), 800);
      }
    }
  };

  useEffect(() => {
    return registerHandler((data) => signalHandlerRef.current(data));
  }, [registerHandler]);

  useEffect(
    () => () => {
      Object.values(peersRef.current).forEach((peer) => peer.close());
      peersRef.current = {};
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    },
    [],
  );

  const remoteTiles = useMemo(() => {
    const ids = new Set([
      ...Object.keys(participants),
      ...Object.keys(remoteStreams),
    ]);
    return Array.from(ids)
      .filter((id) => id !== employeeId)
      .map((id) => ({
        id,
        participant: participants[id] || {
          employee_id: id,
          name: id,
        },
        stream: remoteStreams[id],
      }));
  }, [employeeId, participants, remoteStreams]);

  const selfParticipant = useMemo(
    () =>
      participants[employeeId] ||
      call.participants.find((p) => p.employee_id === employeeId),
    [call.participants, employeeId, participants],
  );

  const waitingPeer = useMemo(() => {
    if (call.callType !== "direct") return null;
    const peerId = call.startedByMe ? call.peerIds[0] : call.callerId;
    if (!peerId) return null;
    return (
      participants[peerId] ||
      call.participants.find((p) => p.employee_id === peerId) ||
      null
    );
  }, [call, participants]);

  const statusText = callStatusLabel(status, callMode);
  const showTimer = isConnected && elapsed > 0;

  const toggleMic = () => {
    const next = !micOn;
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = next;
    });
    setMicOn(next);
  };

  const toggleCamera = () => {
    if (audioOnly) return;
    const next = !cameraOn;
    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = next;
    });
    setCameraOn(next);
  };

  return (
    <div
      className={`fixed z-[80] overflow-hidden border border-white/10 bg-slate-950 text-white shadow-2xl shadow-black/60 ${
        expanded
          ? "inset-3 rounded-3xl"
          : "bottom-4 right-4 w-[min(calc(100vw-2rem),920px)] rounded-3xl"
      }`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {call.callType === "group" && <Users size={17} className="text-violet-300" />}
            <p className="truncate text-sm font-bold">{call.title}</p>
            {showTimer && (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                {formatCallDuration(elapsed)}
              </span>
            )}
          </div>
          <p
            className={`text-xs ${
              statusText === "In call"
                ? "text-emerald-400"
                : statusText.includes("Ringing") || statusText.includes("Calling")
                  ? "animate-pulse text-cyan-400"
                  : "text-slate-400"
            }`}
          >
            {statusText}
            {call.callType === "group" && connectedCount > 0
              ? ` · ${connectedCount + 1} in call`
              : ""}
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          text={expanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          unstyled
          className="rounded-xl p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
          title={expanded ? "Restore" : "Expand"}
        />
      </div>

      {permissionError ? (
        <div className="p-6 text-center">
          <p className="text-sm font-semibold text-red-300">{permissionError}</p>
          <Button
            type="button"
            onClick={() => endCall(true)}
            text="Close call"
            className="mt-4 bg-red-600 px-5 py-3 text-sm hover:bg-red-700"
          />
        </div>
      ) : (
        <div
          className={`grid max-h-[calc(100dvh-10rem)] gap-3 overflow-y-auto p-3 ${
            remoteTiles.length > 1 ? "md:grid-cols-2" : "md:grid-cols-2"
          }`}
        >
          <VideoTile
            stream={localStream || undefined}
            name={`${employeeName} (You)`}
            muted
            profileImg={selfParticipant?.profile_img}
            audioOnly={audioOnly && !cameraOn}
          />
          {remoteTiles.length === 0 ? (
            <div className="grid min-h-44 place-items-center rounded-2xl border border-dashed border-slate-700 bg-slate-900/70 p-6 text-center">
              {call.startedByMe ? (
                <>
                  {waitingPeer ? (
                    <CallAvatar
                      name={waitingPeer.name || waitingPeer.employee_id}
                      profileImg={waitingPeer.profile_img}
                      size="lg"
                      className="mb-3"
                    />
                  ) : (
                    <span className="mb-3 h-12 w-12 animate-ping rounded-full bg-cyan-500/20" />
                  )}
                  <p className="text-sm text-slate-300">
                    {audioOnly ? "Calling..." : "Ringing..."}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {waitingPeer?.name
                      ? `Waiting for ${waitingPeer.name}`
                      : "Waiting for answer"}
                  </p>
                </>
              ) : (
                <>
                  {waitingPeer && (
                    <CallAvatar
                      name={waitingPeer.name || waitingPeer.employee_id}
                      profileImg={waitingPeer.profile_img}
                      size="lg"
                      className="mb-3"
                    />
                  )}
                  <p className="text-sm text-slate-400">Connecting to participants...</p>
                </>
              )}
            </div>
          ) : (
            remoteTiles.map(({ id, participant, stream }) => (
              <VideoTile
                key={id}
                stream={stream}
                name={participant.name || id}
                profileImg={participant.profile_img}
                audioOnly={audioOnly}
              />
            ))
          )}
        </div>
      )}

      <div className="flex items-center justify-center gap-3 border-t border-white/10 p-4">
        <button
          type="button"
          onClick={toggleMic}
          className={`grid h-12 w-12 place-items-center rounded-full transition ${
            micOn ? "bg-white/10 hover:bg-white/15" : "bg-red-600 hover:bg-red-700"
          }`}
          title={micOn ? "Mute microphone" : "Unmute microphone"}
        >
          {micOn ? <Mic size={18} /> : <MicOff size={18} />}
        </button>
        {!audioOnly && (
          <button
            type="button"
            onClick={toggleCamera}
            className={`grid h-12 w-12 place-items-center rounded-full transition ${
              cameraOn ? "bg-white/10 hover:bg-white/15" : "bg-red-600 hover:bg-red-700"
            }`}
            title={cameraOn ? "Turn camera off" : "Turn camera on"}
          >
            {cameraOn ? <Camera size={18} /> : <CameraOff size={18} />}
          </button>
        )}
        <button
          type="button"
          onClick={() => endCall(true)}
          className="grid h-14 w-14 place-items-center rounded-full bg-red-600 text-white transition hover:bg-red-700"
          title="End call"
        >
          <PhoneOff size={22} />
        </button>
      </div>
    </div>
  );
}
