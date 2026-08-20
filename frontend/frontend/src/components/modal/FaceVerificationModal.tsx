import { useRef, useState, useCallback, useEffect } from "react";
import Webcam from "react-webcam";
import { motion, AnimatePresence } from "framer-motion";
import PortalModal from "../common/PortalModal";
import Button from "../common/Button";
import API, { FACE_REQUEST_TIMEOUT_MS } from "../../services/api";
import { getCurrentLocation } from "../../services/attendanceSecurity";
import {
  Camera,
  CheckCircle2,
  AlertCircle,
  ScanFace,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  X,
  Clock,
  RefreshCw,
} from "lucide-react";

interface FaceVerificationModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (message: string, isLate?: boolean, minutesLate?: number) => void;
  employeeId: string;
  workMode: "office" | "wfh";
}

export default function FaceVerificationModal({
  open,
  onClose,
  onSuccess,
  employeeId,
  workMode,
}: FaceVerificationModalProps) {
  const webcamRef = useRef<Webcam>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [currentTime, setCurrentTime] = useState(() =>
    new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    })
  );

  // Live clock ticker
  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => {
      setCurrentTime(
        new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
    }, 1000);
    return () => clearInterval(timer);
  }, [open]);

  useEffect(() => {
    if (open) {
      setErrorMsg("");
      setSuccessMsg("");
      setVerifying(false);
      setCapturedImage(null);
    }
  }, [open]);

  // Capture snapshot
  const handleCapture = useCallback(() => {
    if (!webcamRef.current) return;
    const snap = webcamRef.current.getScreenshot();
    if (!snap) {
      setErrorMsg("Failed to capture image. Please check camera permissions.");
      return;
    }
    setCapturedImage(snap);
    setErrorMsg("");
  }, []);

  // Reset captured image
  const handleRetake = useCallback(() => {
    setCapturedImage(null);
    setErrorMsg("");
    setSuccessMsg("");
  }, []);

  // Scan & Verify captured image with backend
  const handleVerify = useCallback(async () => {
    if (!capturedImage || verifying) return;

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
          image: capturedImage,
          ...location,
        },
        { timeout: FACE_REQUEST_TIMEOUT_MS }
      );

      if (res.data?.success) {
        setSuccessMsg(res.data.message || "Face Verified! Attendance Marked.");
        setTimeout(() => {
          onSuccess(
            res.data.message || "Present marked successfully!",
            res.data.is_late,
            res.data.minutes_late
          );
          onClose();
        }, 1200);
      } else {
        setErrorMsg(res.data?.error || "Face verification failed. Please try again.");
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      const msg = e.response?.data?.error || "Face verification failed. Please retry.";
      setErrorMsg(msg);
    } finally {
      setVerifying(false);
    }
  }, [capturedImage, employeeId, workMode, verifying, onSuccess, onClose]);

  return (
    <PortalModal open={open} onClose={onClose} cardClassName="max-w-md">
      <div className="dash-modal-card relative w-full overflow-hidden rounded-3xl border border-white/15 bg-slate-950/95 p-5 sm:p-6 shadow-[0_0_60px_rgba(0,0,0,0.7)] backdrop-blur-2xl text-center">
        {/* Ambient glow */}
        <div className="pointer-events-none absolute -top-24 -left-24 h-48 w-48 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-48 w-48 rounded-full bg-blue-600/15 blur-3xl" />

        {/* Modal Header */}
        <div className="relative mb-4 flex items-center justify-between border-b border-white/10 pb-3.5">
          <div className="flex items-center gap-2.5 text-left">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 shadow-inner">
              <ScanFace className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white leading-tight">
                  Face Check-In
                </h3>
                <span className="rounded-full bg-cyan-500/20 border border-cyan-500/30 px-2 py-0.2 text-[9px] font-bold text-cyan-300">
                  AI Biometric
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1 font-mono">
                <Clock size={11} className="text-cyan-400" /> {currentTime}
              </p>
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

        {/* Camera Viewport with Holographic Laser Scanner Overlay */}
        <div
          className={`relative mx-auto aspect-video w-full overflow-hidden rounded-2xl border-2 shadow-2xl transition-all duration-300 ${successMsg
              ? "border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.3)]"
              : capturedImage
                ? "border-cyan-400 shadow-[0_0_30px_rgba(6,182,212,0.25)]"
                : "border-cyan-500/40 shadow-[0_0_25px_rgba(6,182,212,0.15)]"
            }`}
        >
          {/* Holographic Target Brackets */}
          <div className="pointer-events-none absolute inset-3 z-10">
            <div className="absolute top-0 left-0 h-4 w-4 border-t-2 border-l-2 border-cyan-400 rounded-tl-md shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
            <div className="absolute top-0 right-0 h-4 w-4 border-t-2 border-r-2 border-cyan-400 rounded-tr-md shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
            <div className="absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-cyan-400 rounded-bl-md shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
            <div className="absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-cyan-400 rounded-br-md shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
          </div>

          {!capturedImage ? (
            /* Live Webcam */
            <Webcam
              audio={false}
              ref={webcamRef}
              mirrored
              screenshotFormat="image/jpeg"
              screenshotQuality={0.95}
              onUserMedia={() => setCameraReady(true)}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            /* Snapshot Preview */
            <img
              src={capturedImage}
              alt="Captured face preview"
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}

          {/* Oval Face Alignment Guide */}
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div
              className={`h-[78%] w-[54%] rounded-[50%] border-2 transition-all duration-300 ${successMsg
                  ? "border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.6)]"
                  : capturedImage
                    ? "border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.5)]"
                    : "border-dashed border-cyan-300/70 shadow-[0_0_20px_rgba(6,182,212,0.3)] animate-pulse"
                }`}
            />
          </div>

          {/* Animated Gliding Laser Scan Bar */}
          {(!capturedImage || verifying) && (
            <motion.div
              className="pointer-events-none absolute left-0 right-0 z-20 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_rgba(34,211,238,1)]"
              animate={{ top: ["8%", "92%", "8%"] }}
              transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
            />
          )}

          {/* Top-Right Camera Status Pill */}
          <div className="absolute top-2.5 right-2.5 z-20">
            <div className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[9px] font-bold backdrop-blur-md border border-cyan-500/40 bg-slate-950/80 text-cyan-300">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
              {capturedImage ? "SNAPSHOT READY" : "LIVE CAMERA"}
            </div>
          </div>
        </div>

        {/* Animated Guidance Banner */}
        <AnimatePresence mode="wait">
          {successMsg ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3.5 flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 p-2.5 text-xs font-semibold text-emerald-300"
            >
              <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </motion.div>
          ) : errorMsg ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3.5 flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/15 p-2.5 text-xs text-red-300 text-left"
            >
              <AlertCircle size={15} className="text-red-400 shrink-0" />
              <span className="flex-1">{errorMsg}</span>
            </motion.div>
          ) : (
            <motion.div
              key="guide"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3.5 flex items-center justify-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-2.5 text-xs font-semibold text-cyan-200"
            >
              <ShieldCheck size={14} className="text-cyan-400" />
              <span>
                {capturedImage
                  ? "Photo ready • Click Verify & Check In"
                  : "Align your face in the oval and capture photo"}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Buttons */}
        <div className="mt-4 flex items-center gap-3">
          {!capturedImage ? (
            <>
              <Button
                variant="secondary"
                onClick={onClose}
                className="flex-1 py-3 rounded-2xl cursor-pointer text-xs sm:text-sm font-medium"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCapture}
                disabled={!cameraReady}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/25 disabled:opacity-40"
              >
                <Camera className="w-4 h-4" /> Capture Photo
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="secondary"
                onClick={handleRetake}
                disabled={verifying}
                className="flex-1 py-3 rounded-2xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-medium flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 text-xs sm:text-sm"
              >
                <RotateCcw className="w-4 h-4 text-slate-400" /> Retake
              </Button>
              <Button
                onClick={handleVerify}
                disabled={verifying}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/25 disabled:opacity-50 text-xs sm:text-sm"
              >
                {verifying ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Verifying...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-cyan-200" /> Verify &amp; Check In
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    </PortalModal>
  );
}
