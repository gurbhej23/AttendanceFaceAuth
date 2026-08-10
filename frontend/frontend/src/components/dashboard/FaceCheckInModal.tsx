import { useRef, useEffect, useState, useCallback } from "react";
import Webcam from "react-webcam";
import API, { FACE_REQUEST_TIMEOUT_MS } from "../../services/api";
import PortalModal from "../common/PortalModal";
import Button from "../common/Button";
import { getCurrentLocation, pickLivenessPrompt } from "../../services/attendanceSecurity";
import { Camera, RefreshCw, X, ShieldAlert, Sparkles } from "lucide-react";

type BorderStatus = "idle" | "scanning" | "success" | "error";

interface FaceCheckInModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  workMode: "office" | "wfh";
}

export default function FaceCheckInModal({
  open,
  onClose,
  onSuccess,
  workMode,
}: FaceCheckInModalProps) {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const verifyingRef = useRef(false);

  const [cameraReady, setCameraReady] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Position your face inside the circle");
  const [livenessPrompt] = useState(pickLivenessPrompt);
  const [livenessDone, setLivenessDone] = useState(false);
  const [livenessCount, setLivenessCount] = useState(3);
  const [borderStatus, setBorderStatus] = useState<BorderStatus>("idle");
  const [retryCount, setRetryCount] = useState(0);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setCapturedImage(null);
      setBorderStatus("idle");
      setLivenessDone(false);
      setLivenessCount(3);
      setErrorDetails(null);
      verifyingRef.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (!open || !cameraReady || livenessDone) return;
    setMessage(livenessPrompt);
    const timer = window.setInterval(() => {
      setLivenessCount((count) => {
        if (count <= 1) {
          window.clearInterval(timer);
          setLivenessDone(true);
          setMessage("Liveness verified. Ready to Check In!");
          return 0;
        }
        return count - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [open, cameraReady, livenessDone, livenessPrompt]);

  const checkImageQuality = (imageSrc: string): Promise<{ passed: boolean; reason: string }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const W = 160;
        const H = 120;
        const canvas = document.createElement("canvas");
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, W, H);
        const { data } = ctx.getImageData(0, 0, W, H);

        let lum = 0;
        for (let i = 0; i < data.length; i += 4) {
          lum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }
        const avg = lum / (data.length / 4);
        if (avg < 28) {
          resolve({ passed: false, reason: "Lighting is too dark. Please move to a brighter area." });
          return;
        }
        if (avg > 220) {
          resolve({ passed: false, reason: "Too much glare/brightness detected." });
          return;
        }
        resolve({ passed: true, reason: "" });
      };
      img.onerror = () => resolve({ passed: false, reason: "Could not process image" });
      img.src = imageSrc;
    });
  };

  const drawOverlay = useCallback((status: BorderStatus, scanOffset: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const ovalX = W / 2;
    const ovalY = H * 0.48;
    const ovalRX = W * 0.36;
    const ovalRY = H * 0.42;

    ctx.save();
    ctx.fillStyle = "rgba(2, 6, 23, 0.65)";
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.ellipse(ovalX, ovalY, ovalRX, ovalRY, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const borderColor =
      status === "success"
        ? "#10b981"
        : status === "error"
        ? "#ef4444"
        : status === "scanning"
        ? "#3b82f6"
        : "#64748b";

    ctx.save();
    ctx.shadowBlur = 20;
    ctx.shadowColor = borderColor;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.ellipse(ovalX, ovalY, ovalRX, ovalRY, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    if (status === "scanning") {
      const lineY = ovalY - ovalRY + scanOffset * ovalRY * 2;
      const halfW = Math.sqrt(
        Math.max(0, 1 - Math.pow((lineY - ovalY) / ovalRY, 2)) * ovalRX * ovalRX
      );
      ctx.save();
      const grad = ctx.createLinearGradient(ovalX - halfW, lineY, ovalX + halfW, lineY);
      grad.addColorStop(0, "rgba(59, 130, 246, 0)");
      grad.addColorStop(0.5, "rgba(59, 130, 246, 0.9)");
      grad.addColorStop(1, "rgba(59, 130, 246, 0)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(ovalX - halfW, lineY);
      ctx.lineTo(ovalX + halfW, lineY);
      ctx.stroke();
      ctx.restore();
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    let scanOffset = 0;
    let direction = 1;
    const loop = () => {
      if (borderStatus === "scanning") {
        scanOffset += 0.01 * direction;
        if (scanOffset >= 1) direction = -1;
        if (scanOffset <= 0) direction = 1;
      }
      drawOverlay(borderStatus, scanOffset);
      animationRef.current = requestAnimationFrame(loop);
    };
    animationRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationRef.current);
  }, [open, borderStatus, drawOverlay]);

  const handleFaceCheckIn = async () => {
    if (verifyingRef.current) return;
    const employee_id = localStorage.getItem("employee_id");
    if (!employee_id) return;

    verifyingRef.current = true;
    setBorderStatus("scanning");
    setMessage("Capturing face scan...");
    setErrorDetails(null);

    const snap = webcamRef.current?.getScreenshot();
    if (!snap) {
      setBorderStatus("error");
      setMessage("Camera screenshot failed. Check camera connection.");
      verifyingRef.current = false;
      return;
    }

    const { passed, reason } = await checkImageQuality(snap);
    if (!passed) {
      setBorderStatus("error");
      setMessage(reason);
      verifyingRef.current = false;
      return;
    }

    setCapturedImage(snap);
    setLoading(true);
    setMessage("Matching face embedding with system database...");

    try {
      const location = await getCurrentLocation();
      const response = await API.post(
        "/attendance/check-in/",
        {
          employee_id,
          image: snap,
          work_mode: workMode,
          verification_method: "face",
          ...location,
        },
        { timeout: FACE_REQUEST_TIMEOUT_MS }
      );

      if (response.data.success) {
        setBorderStatus("success");
        setMessage("Face Verified! Check-In successful.");
        setTimeout(() => {
          onSuccess(response.data.message || "Attendance marked Present");
          onClose();
        }, 1200);
      } else {
        setBorderStatus("error");
        setMessage("Face Verification Failed");
        setErrorDetails(response.data.error || "Face embedding did not match record.");
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setBorderStatus("error");
      setMessage("Check-In Error");
      setErrorDetails(e.response?.data?.error || "Face matching error. Please try again.");
    } finally {
      setLoading(false);
      verifyingRef.current = false;
    }
  };

  return (
    <PortalModal open={open} onClose={onClose} cardClassName="max-w-xl w-full">
      <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-slate-950/95 p-6 shadow-2xl backdrop-blur-2xl text-left">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 text-slate-950 shadow-md">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Face Recognition Check In</h2>
              <p className="text-xs text-slate-400">Position your face clearly for live verification</p>
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

        {/* Camera Viewport */}
        <div className="relative mx-auto h-72 w-full max-w-md overflow-hidden rounded-2xl border border-white/10 shadow-inner">
          {!capturedImage ? (
            <Webcam
              ref={webcamRef}
              audio={false}
              mirrored
              screenshotFormat="image/jpeg"
              screenshotQuality={0.95}
              onUserMedia={() => setCameraReady(true)}
              onUserMediaError={() => {
                setBorderStatus("error");
                setMessage("Camera access denied. Please allow permissions.");
              }}
              videoConstraints={{ facingMode: "user" }}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <img src={capturedImage} alt="Captured" className="absolute inset-0 h-full w-full object-cover" />
          )}

          <canvas ref={canvasRef} width={450} height={300} className="absolute inset-0 h-full w-full" />
        </div>

        {/* Feedback Message */}
        <div className="mt-4 text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-slate-900/80 px-3.5 py-1 text-xs font-semibold text-slate-200">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            {livenessDone ? "Liveness Verified" : `Liveness Step (${livenessCount}s)`}
          </div>
          <p
            className={`mt-2 text-sm font-bold ${
              borderStatus === "success"
                ? "text-emerald-400"
                : borderStatus === "error"
                ? "text-red-400"
                : "text-slate-200"
            }`}
          >
            {message}
          </p>

          {errorDetails && (
            <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-red-300 bg-red-500/10 py-2 px-3 rounded-xl border border-red-500/20">
              <ShieldAlert size={14} className="shrink-0" />
              <span>{errorDetails}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-5 flex gap-3">
          <Button
            text="Cancel"
            onClick={onClose}
            className="flex-1 rounded-2xl border border-slate-700 bg-slate-800/80 py-3 font-semibold text-slate-300 hover:bg-slate-700 cursor-pointer"
          />

          {borderStatus === "error" || capturedImage ? (
            <Button
              text="Retry Face Scan"
              onClick={() => {
                setCapturedImage(null);
                setBorderStatus("idle");
                setErrorDetails(null);
                setRetryCount((c) => c + 1);
                handleFaceCheckIn();
              }}
              disabled={loading || !cameraReady}
              className="flex-1 rounded-2xl bg-amber-600 py-3 font-semibold text-white hover:bg-amber-500 cursor-pointer"
            />
          ) : (
            <Button
              text={loading ? "Verifying Face..." : "Verify & Check In"}
              onClick={handleFaceCheckIn}
              disabled={loading || !cameraReady || !livenessDone}
              loading={loading}
              className="flex-1 rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 py-3 font-bold text-white hover:from-emerald-500 hover:to-cyan-500 shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
            />
          )}
        </div>
      </div>
    </PortalModal>
  );
}
