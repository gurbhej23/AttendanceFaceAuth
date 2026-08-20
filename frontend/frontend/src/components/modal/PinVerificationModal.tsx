import { useState, useCallback, useEffect } from "react";
import PortalModal from "../common/PortalModal";
import Button from "../common/Button";
import API, { FACE_REQUEST_TIMEOUT_MS } from "../../services/api";
import { getCurrentLocation } from "../../services/attendanceSecurity";
import { KeyRound, ShieldCheck, AlertCircle, RefreshCw, X } from "lucide-react";

interface PinVerificationModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (message: string, isLate?: boolean, minutesLate?: number) => void;
  employeeId: string;
  workMode: "office" | "wfh";
}

export default function PinVerificationModal({
  open,
  onClose,
  onSuccess,
  employeeId,
  workMode,
}: PinVerificationModalProps) {
  const [pin, setPin] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (open) {
      setPin("");
      setErrorMsg("");
      setSuccessMsg("");
      setVerifying(false);
    }
  }, [open]);

  const handleVerify = useCallback(async () => {
    const code = pin.trim();
    if (!code || code.length < 4) {
      setErrorMsg("Please enter your 4–6 digit attendance PIN.");
      return;
    }

    setVerifying(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const location = await getCurrentLocation();
      const res = await API.post(
        "/attendance/mark-present/",
        {
          employee_id: employeeId,
          work_mode: workMode,
          pin: code,
          ...location,
        },
        { timeout: FACE_REQUEST_TIMEOUT_MS }
      );

      if (res.data?.success) {
        setSuccessMsg("✅ PIN Verified! Attendance Marked.");
        setTimeout(() => {
          onSuccess(
            res.data.message || "Present marked successfully!",
            res.data.is_late,
            res.data.minutes_late
          );
          onClose();
        }, 1000);
      } else {
        setErrorMsg(res.data?.error || "PIN verification failed. Please try again.");
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      const msg = e.response?.data?.error || "Verification failed. Please check your PIN.";
      setErrorMsg(msg);
    } finally {
      setVerifying(false);
    }
  }, [pin, employeeId, workMode, onSuccess, onClose]);

  return (
    <PortalModal open={open} onClose={onClose} cardClassName="max-w-md">
      <div className="dash-modal-card relative w-full overflow-hidden rounded-3xl border border-amber-500/30 bg-slate-950/95 p-5 sm:p-6 shadow-[0_0_50px_rgba(245,158,11,0.18)] backdrop-blur-2xl text-center">
        {/* Ambient glow */}
        <div className="pointer-events-none absolute -top-20 -left-20 h-44 w-44 rounded-full bg-amber-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-44 w-44 rounded-full bg-orange-600/15 blur-3xl" />

        {/* Header */}
        <div className="relative flex items-center justify-between border-b border-white/10 pb-3 mb-4">
          <div className="flex items-center gap-2.5 text-white font-bold text-base sm:text-lg">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div className="text-left">
              <h3 className="leading-tight text-white font-bold">PIN Verification</h3>
              <p className="text-[11px] text-amber-400/90 font-medium">Enter your 4–6 digit attendance PIN</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={verifying}
            className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer disabled:opacity-30"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* PIN input */}
        <div className="mt-4 space-y-4">
          <div className="relative">
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              autoComplete="off"
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !verifying) handleVerify();
              }}
              placeholder="••••••"
              className="w-full rounded-2xl border border-slate-700 bg-slate-900/90 p-4 text-center font-mono text-3xl tracking-[0.4em] text-white outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
            />
          </div>

          {errorMsg && (
            <div className="p-3 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2 text-left">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span className="flex-1">{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 text-left">
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
              <span className="flex-1">{successMsg}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-5 flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={onClose}
              disabled={verifying}
              className="flex-1 py-3 rounded-2xl cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={handleVerify}
              disabled={verifying || pin.length < 4}
              className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 text-white font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/25 disabled:opacity-40"
            >
              {verifying ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-200" /> Verifying...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-amber-200" /> Verify &amp; Present
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </PortalModal>
  );
}
