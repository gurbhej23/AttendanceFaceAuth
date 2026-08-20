import PortalModal from "../common/PortalModal";
import { Camera, KeyRound, X, Sparkles } from "lucide-react";

interface PresentChoiceModalProps {
  open: boolean;
  onClose: () => void;
  onSelectFace: () => void;
  onSelectPin: () => void;
}

export default function PresentChoiceModal({
  open,
  onClose,
  onSelectFace,
  onSelectPin,
}: PresentChoiceModalProps) {
  return (
    <PortalModal open={open} onClose={onClose} cardClassName="max-w-md">
      <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-slate-950/95 p-6 shadow-2xl backdrop-blur-2xl text-left">
        {/* Glow ambient background */}
        <div className="pointer-events-none absolute -top-20 -left-20 h-44 w-44 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-44 w-44 rounded-full bg-cyan-600/15 blur-3xl" />

        {/* Modal Header */}
        <div className="relative flex items-center justify-between border-b border-white/10 pb-3 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 text-slate-950 shadow-md">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Mark Attendance</h2>
              <p className="text-xs text-slate-400">Choose your verification method</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Choice Buttons */}
        <div className="space-y-3.5">
          {/* Option 1: Face Verification */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onSelectFace();
            }}
            className="group relative flex w-full items-center gap-4 rounded-2xl border border-cyan-500/30 bg-cyan-950/30 p-4 transition-all duration-200 hover:border-cyan-400 hover:bg-cyan-900/40 hover:shadow-lg hover:shadow-cyan-500/10 cursor-pointer text-left"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md group-hover:scale-105 transition-transform">
              <Camera className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-base">Face Verification</span>
                <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold text-cyan-300 border border-cyan-500/30">
                  Recommended
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-300">
                Live AI face scan to verify registered face profile
              </p>
            </div>
          </button>

          {/* Option 2: PIN Verification */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onSelectPin();
            }}
            className="group relative flex w-full items-center gap-4 rounded-2xl border border-amber-500/30 bg-amber-950/30 p-4 transition-all duration-200 hover:border-amber-400 hover:bg-amber-900/40 hover:shadow-lg hover:shadow-amber-500/10 cursor-pointer text-left"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md group-hover:scale-105 transition-transform">
              <KeyRound className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-base">PIN Verification</span>
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30">
                  Fast
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-300">
                Enter your 4–6 digit attendance security PIN
              </p>
            </div>
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-2xl border border-slate-800 bg-slate-900/60 py-2.5 text-center text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </PortalModal>
  );
}
