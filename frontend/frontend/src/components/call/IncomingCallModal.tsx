import { Phone, PhoneOff, Users, Video } from "lucide-react";
import Button from "../common/Button";
import type { ActiveCall } from "./VideoCallWindow";
import { formatMemberRole, type CallMode } from "../../utils/callHelpers";
import { getMediaUrl } from "../../utils/chatHelpers";

interface Props {
  call: ActiveCall;
  onAccept: () => void;
  onDecline: () => void;
}

export default function IncomingCallModal({ call, onAccept, onDecline }: Props) {
  const caller = call.participants.find((p) => p.employee_id === call.callerId);
  const mode = (call.callMode || "video") as CallMode;
  const isGroup = call.callType === "group";

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl shadow-black/50">
        <div className="relative px-6 pb-2 pt-8 text-center">
          <div className="pointer-events-none absolute inset-x-0 top-6 flex justify-center">
            <span className="h-28 w-28 animate-ping rounded-full bg-emerald-500/20" />
          </div>
          <div className="relative mx-auto">
            <div
              className={`relative mx-auto grid h-24 w-24 place-items-center overflow-hidden rounded-full border-4 ${
                isGroup ? "border-violet-500/60 bg-violet-600/20" : "border-emerald-500/60 bg-emerald-600/20"
              }`}
            >
              {caller?.profile_img ? (
                <img
                  src={getMediaUrl(caller.profile_img)}
                  alt={call.callerName}
                  className="h-full w-full object-cover"
                />
              ) : isGroup ? (
                <Users size={34} className="text-violet-300" />
              ) : (
                <span className="text-3xl font-bold text-white">
                  {call.callerName.charAt(0)}
                </span>
              )}
            </div>
            <span className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full bg-slate-900 ring-2 ring-slate-950">
              {mode === "audio" ? (
                <Phone size={16} className="text-emerald-400" />
              ) : (
                <Video size={16} className="text-cyan-400" />
              )}
            </span>
          </div>

          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Incoming {isGroup ? "group" : mode} call
          </p>
          <h3 className="mt-2 truncate text-2xl font-bold text-white">
            {isGroup ? call.title : call.callerName}
          </h3>
          {isGroup ? (
            <p className="mt-1 text-sm text-slate-400">
              {call.callerName} ({formatMemberRole(caller?.role)}) started the call
            </p>
          ) : (
            <p className="mt-1 text-sm text-slate-400">
              {formatMemberRole(caller?.role)}
              {mode === "audio" ? " · Voice call" : " · Video call"}
            </p>
          )}
          <p className="mt-3 animate-pulse text-xs text-emerald-400">Ringing...</p>
        </div>

        <div className="flex gap-3 border-t border-white/10 p-4">
          <Button
            type="button"
            onClick={onDecline}
            text={
              <>
                <PhoneOff size={22} />
                Decline
              </>
            }
            className="flex flex-1 flex-col items-center justify-center gap-1 bg-red-600/90 px-4 py-4 text-sm text-white hover:bg-red-600"
          />
          <Button
            type="button"
            onClick={onAccept}
            text={
              <>
                {mode === "audio" ? <Phone size={22} /> : <Video size={22} />}
                Accept
              </>
            }
            className="flex flex-1 flex-col items-center justify-center gap-1 bg-emerald-600 px-4 py-4 text-sm text-white hover:bg-emerald-500"
          />
        </div>
      </div>
    </div>
  );
}
