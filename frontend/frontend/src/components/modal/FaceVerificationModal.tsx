import { useRef, useState, useCallback, useEffect } from "react";
import Webcam from "react-webcam";
import PortalModal from "../common/PortalModal";
import Button from "../common/Button";
import API, { FACE_REQUEST_TIMEOUT_MS } from "../../services/api";
import { getCurrentLocation } from "../../services/attendanceSecurity";
import {
  Camera,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Scan,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  X,
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

  useEffect(() => {
    if (open) {
      setErrorMsg("");
      setSuccessMsg("");
      setVerifying(false);
      setCapturedImage(null);
    }
  }, [open]);

  // Step 1: Capture snapshot from webcam
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

  // Reset captured image to retake photo
  const handleRetake = useCallback(() => {
    setCapturedImage(null);
    setErrorMsg("");
    setSuccessMsg("");
  }, []);

  // Step 2: Scan & Verify captured image with backend API
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
        setSuccessMsg("✅ Face Verified! Attendance Marked.");
        setTimeout(() => {
          onSuccess(
            res.data.message || "Present marked successfully!",
            res.data.is_late,
            res.data.minutes_late
          );
          onClose();
        }, 1000);
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
      <div className="dash-modal-card relative w-full overflow-hidden rounded-3xl border border-cyan-500/30 bg-slate-950/95 p-5 sm:p-6 shadow-[0_0_50px_rgba(6,182,212,0.18)] backdrop-blur-2xl text-center">
        {/* Glow ambient background accents */}
        <div className="pointer-events-none absolute -top-20 -left-20 h-44 w-44 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-44 w-44 rounded-full bg-blue-600/15 blur-3xl" />

        {/* Modal Header */}
        <div className="relative flex items-center justify-between border-b border-white/10 pb-3 mb-4">
          <div className="flex items-center gap-2.5 text-white font-bold text-base sm:text-lg">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
              <Scan className="w-5 h-5 animate-pulse" />
            </div>
            <div className="text-left">
              <h3 className="leading-tight text-white font-bold">Face Verification</h3>
              <p className="text-[11px] text-cyan-400/90 font-medium">
                {capturedImage ? "Step 2: Review & Scan" : "Step 1: Capture Photo"}
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

        {/* Status guidance pill */}
        <div className="relative mb-4 flex items-center justify-center">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
            successMsg
              ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
              : capturedImage
              ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300"
              : "bg-slate-800/80 border-slate-700 text-slate-300"
          }`}>
            {successMsg ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : capturedImage ? (
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            ) : (
              <Camera className="w-3.5 h-3.5 text-slate-400" />
            )}
            {successMsg || (capturedImage ? (verifying ? "Biometric Scanning in progress..." : "Photo Captured! Ready to scan.") : "Align your face in the oval frame")}
          </span>
        </div>

        {/* Viewport Frame (Live Webcam or Captured Image) */}
        <div className="relative mx-auto w-full max-w-xs aspect-4/3 overflow-hidden rounded-2xl border-2 border-cyan-500/40 bg-slate-900 shadow-2xl group">
          {/* Tech Corner Brackets */}
          <div className="pointer-events-none absolute top-2 left-2 h-4 w-4 border-t-2 border-l-2 border-cyan-400 z-20" />
          <div className="pointer-events-none absolute top-2 right-2 h-4 w-4 border-t-2 border-r-2 border-cyan-400 z-20" />
          <div className="pointer-events-none absolute bottom-2 left-2 h-4 w-4 border-b-2 border-l-2 border-cyan-400 z-20" />
          <div className="pointer-events-none absolute bottom-2 right-2 h-4 w-4 border-b-2 border-r-2 border-cyan-400 z-20" />

          {!capturedImage ? (
            /* Live Webcam Feed */
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              onUserMedia={() => setCameraReady(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            /* Captured Snapshot Preview */
            <img
              src={capturedImage}
              alt="Captured face preview"
              className="w-full h-full object-cover"
            />
          )}

          {/* Oval Face Alignment Reticle */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-10">
            <div className={`h-40 w-28 sm:h-44 sm:w-32 rounded-[50%] border-2 ${
              capturedImage
                ? "border-emerald-400/90 shadow-[0_0_25px_rgba(52,211,153,0.4)]"
                : "border-dashed border-cyan-400/80 shadow-[0_0_25px_rgba(56,189,248,0.3)] animate-pulse"
            }`} />
          </div>

          {/* Holographic Laser Scan Beam Effect */}
          {(verifying || capturedImage) && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden z-15">
              <div className={`w-full bg-linear-to-r from-transparent via-cyan-400 to-transparent ${
                verifying
                  ? "h-1.5 shadow-[0_0_20px_#38bdf8] animate-bounce mt-10"
                  : "h-1 opacity-70 shadow-[0_0_10px_#38bdf8] animate-pulse mt-16"
              }`} />
              <div className="absolute inset-0 bg-cyan-500/5 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px] opacity-30" />
            </div>
          )}

          {/* Viewport Live Badge */}
          <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 z-20">
            <span className="px-2.5 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[10px] font-mono tracking-wider text-cyan-300 uppercase border border-cyan-500/30">
              {capturedImage ? "PREVIEW: SNAPSHOT" : "LIVE CAMERA"}
            </span>
          </div>
        </div>

        {/* Error message card */}
        {errorMsg && (
          <div className="mt-4 p-3 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2 text-left">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span className="flex-1">{errorMsg}</span>
          </div>
        )}

        {/* Action Button Bar */}
        <div className="mt-5 flex items-center gap-3">
          {!capturedImage ? (
            /* Step 1 Buttons */
            <>
              <Button
                variant="secondary"
                onClick={onClose}
                className="flex-1 py-3 rounded-2xl cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCapture}
                disabled={!cameraReady}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/20 disabled:opacity-40"
              >
                <Camera className="w-4 h-4" /> Capture Photo
              </Button>
            </>
          ) : (
            /* Step 2 Buttons */
            <>
              <Button
                variant="secondary"
                onClick={handleRetake}
                disabled={verifying}
                className="flex-1 py-3 rounded-2xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-medium flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
              >
                <RotateCcw className="w-4 h-4 text-slate-400" /> Retake
              </Button>
              <Button
                onClick={handleVerify}
                disabled={verifying}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/25 disabled:opacity-40"
              >
                {verifying ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-cyan-200" /> Scanning...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-emerald-200" /> Scan &amp; Verify
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
