import { useRef, useEffect, useState } from "react";
import Webcam from "react-webcam";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  ScanFace,
  ArrowLeft,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  Clock,
  RotateCcw,
} from "lucide-react";
import API, { FACE_REQUEST_TIMEOUT_MS } from "../../services/api";
import { notifyAuthChanged } from "../../hooks/useEmployeeSession";
import MessageOverlay from "../../components/chat/MessageOverlay";
import Button from "../../components/common/Button";
import AnimatedBackground from "../../components/motion/AnimatedBackground";
import {
  getCurrentLocation,
  pickLivenessPrompt,
} from "../../services/attendanceSecurity";

type BorderStatus = "idle" | "scanning" | "success" | "error";

export default function VerifyFace() {
  const navigate = useNavigate();
  const webcamRef = useRef<Webcam>(null);
  const verifyingRef = useRef(false);

  const [cameraReady, setCameraReady] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Align your face in the oval frame");
  const [livenessPrompt] = useState(pickLivenessPrompt);
  const [livenessDone, setLivenessDone] = useState(false);
  const [livenessCount, setLivenessCount] = useState(3);
  const [borderStatus, setBorderStatus] = useState<BorderStatus>("idle");
  const [currentTime, setCurrentTime] = useState(() =>
    new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    })
  );

  const [overlay, setOverlay] = useState<{
    title: string;
    message?: string;
    tone?: "info" | "success" | "error";
    loading?: boolean;
  } | null>(null);

  // Live clock ticker
  useEffect(() => {
    const clockTimer = setInterval(() => {
      setCurrentTime(
        new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
    }, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  useEffect(() => {
    const id = localStorage.getItem("employee_id");
    if (!id || id === "undefined") {
      localStorage.clear();
      navigate("/", { replace: true });
    }
  }, [navigate]);

  // Liveness countdown
  useEffect(() => {
    if (!cameraReady || livenessDone) return;
    setMessage(livenessPrompt);
    const timer = window.setInterval(() => {
      setLivenessCount((count) => {
        if (count <= 1) {
          window.clearInterval(timer);
          setLivenessDone(true);
          setMessage("Liveness verified! Face confirmed active.");
          return 0;
        }
        return count - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cameraReady, livenessDone, livenessPrompt]);

  const checkImageQuality = (
    imageSrc: string,
  ): Promise<{ passed: boolean; reason: string }> => {
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
          resolve({ passed: false, reason: "Lighting too dark — improve lighting" });
          return;
        }
        if (avg > 220) {
          resolve({ passed: false, reason: "Too bright — reduce glare" });
          return;
        }

        let blur = 0;
        for (let y = 1; y < H - 1; y++) {
          for (let x = 1; x < W - 1; x++) {
            const idx = (y * W + x) * 4;
            blur += Math.abs(
              -4 * data[idx] +
              data[((y - 1) * W + x) * 4] +
              data[((y + 1) * W + x) * 4] +
              data[(y * W + (x - 1)) * 4] +
              data[(y * W + (x + 1)) * 4],
            );
          }
        }
        if (blur / (W * H) < 4.5) {
          resolve({ passed: false, reason: "Image too blurry — please hold still" });
          return;
        }

        resolve({ passed: true, reason: "" });
      };
      img.onerror = () =>
        resolve({ passed: false, reason: "Could not process camera image" });
      img.src = imageSrc;
    });
  };

  const handleFaceVerification = async () => {
    if (verifyingRef.current) return;
    if (!livenessDone) {
      setBorderStatus("error");
      setMessage("Please complete the liveness prompt first");
      return;
    }

    const employee_id = localStorage.getItem("employee_id");
    if (!employee_id || employee_id === "undefined") {
      localStorage.clear();
      navigate("/", { replace: true });
      return;
    }

    verifyingRef.current = true;
    setLoading(true);
    setBorderStatus("scanning");
    setMessage("Checking biometric frame quality...");

    let imageSrc: string | null = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      const snap = webcamRef.current?.getScreenshot();

      if (!snap) {
        if (attempt === 3) {
          setBorderStatus("error");
          setMessage("Failed to capture image snapshot");
          verifyingRef.current = false;
          setLoading(false);
          return;
        }
        await new Promise((r) => setTimeout(r, 700));
        continue;
      }

      const { passed, reason } = await checkImageQuality(snap);
      if (!passed) {
        setBorderStatus("error");
        setMessage(reason);
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 800));
          continue;
        }
        verifyingRef.current = false;
        setLoading(false);
        return;
      }

      imageSrc = snap;
      setCapturedImage(snap);
      break;
    }

    if (!imageSrc) {
      setBorderStatus("error");
      setMessage("Could not capture suitable face image");
      verifyingRef.current = false;
      setLoading(false);
      return;
    }

    setMessage("Verifying biometric signature...");
    setOverlay({
      title: "Verifying Face Identity",
      message: "Comparing live biometric embeddings against registered profile...",
      tone: "info",
      loading: true,
    });

    try {
      const location = await getCurrentLocation();
      const response = await API.post(
        "/employees/verify-face/",
        {
          employee_id,
          image: imageSrc,
          ...location,
        },
        { timeout: FACE_REQUEST_TIMEOUT_MS },
      );

      if (response.data.success) {
        setBorderStatus("success");
        setMessage("Biometric face match confirmed!");

        if (response.data.token) {
          localStorage.setItem("token", response.data.token);
        }
        if (response.data.role) {
          localStorage.setItem("role", response.data.role);
        }
        if (response.data.name) {
          localStorage.setItem("employee_name", response.data.name);
        }
        if (response.data.profile_img) {
          localStorage.setItem("profile_img", response.data.profile_img);
        }
        if (response.data.cv_file) {
          localStorage.setItem("cv_file", response.data.cv_file);
        }
        notifyAuthChanged();

        setOverlay({
          title: "Face Verified!",
          message: "Authentication successful. Entering your dashboard...",
          tone: "success",
          loading: true,
        });
        setTimeout(() => navigate("/dashboard", { replace: true }), 1500);
      } else {
        setBorderStatus("error");
        setMessage(response.data.error || "Face not recognized. Please try again.");
        setOverlay(null);
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setBorderStatus("error");
      setMessage(e.response?.data?.error || "Face verification failed. Please try again.");
      setOverlay(null);
    } finally {
      setLoading(false);
      verifyingRef.current = false;
    }
  };

  const resetCamera = () => {
    setCapturedImage(null);
    setBorderStatus("idle");
    setMessage("Align your face in the oval frame");
    setOverlay(null);
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#020617] via-[#091124] to-[#0f172a] p-4 sm:p-6">
      {/* 3D Particle Ambient Background */}
      <AnimatedBackground particleColor={0x38bdf8} secondaryColor={0x818cf8} />

      {/* Ambient glow */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-cyan-500/15 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-indigo-600/15 blur-[120px]" />

      {overlay && (
        <MessageOverlay
          title={overlay.title}
          message={overlay.message}
          tone={overlay.tone}
          loading={overlay.loading}
        />
      )}

      {/* Main Glassmorphic Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
        className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-white/15 bg-slate-950/85 p-5 sm:p-7 shadow-[0_0_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl text-center"
      >
        {/* Header */}
        <div className="mb-5 flex flex-col items-center">
          <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">
            <Sparkles size={13} className="text-cyan-400" />
            <span>AI Biometric Check-In</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            Face Verification
          </h1>

          <div className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-slate-400 font-mono">
            <Clock size={13} className="text-cyan-400" />
            <span>Current Time: {currentTime}</span>
          </div>
        </div>

        {/* Camera Viewport with Futuristic AI Scanner Overlay */}
        <div
          className={`relative mx-auto aspect-video w-full overflow-hidden rounded-2xl border-2 shadow-2xl transition-all duration-300 ${borderStatus === "success"
              ? "border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.3)]"
              : borderStatus === "error"
                ? "border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.3)]"
                : livenessDone
                  ? "border-cyan-400 shadow-[0_0_30px_rgba(6,182,212,0.25)]"
                  : "border-cyan-500/50 shadow-[0_0_25px_rgba(6,182,212,0.2)]"
            }`}
        >
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
                setMessage("Camera access denied - please enable camera permissions");
              }}
              videoConstraints={{
                facingMode: "user",
              }}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <img
              src={capturedImage}
              alt="Captured face preview"
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}

          {/* Holographic Target Brackets */}
          <div className="pointer-events-none absolute inset-3 z-10">
            <div className="absolute top-0 left-0 h-5 w-5 border-t-2 border-l-2 border-cyan-400 rounded-tl-md shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
            <div className="absolute top-0 right-0 h-5 w-5 border-t-2 border-r-2 border-cyan-400 rounded-tr-md shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
            <div className="absolute bottom-0 left-0 h-5 w-5 border-b-2 border-l-2 border-cyan-400 rounded-bl-md shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
            <div className="absolute bottom-0 right-0 h-5 w-5 border-b-2 border-r-2 border-cyan-400 rounded-br-md shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
          </div>

          {/* Oval Face Guide Reticle */}
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div
              className={`h-[78%] w-[56%] rounded-[50%] border-2 transition-all duration-300 ${borderStatus === "success"
                  ? "border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.6)]"
                  : borderStatus === "error"
                    ? "border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.6)]"
                    : livenessDone
                      ? "border-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.4)]"
                      : "border-dashed border-cyan-300/70 shadow-[0_0_20px_rgba(6,182,212,0.3)] animate-pulse"
                }`}
            />
          </div>

          {/* Animated Gliding Laser Scan Bar */}
          {(!capturedImage || borderStatus === "scanning") && (
            <motion.div
              className="pointer-events-none absolute left-0 right-0 z-20 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_rgba(34,211,238,1)]"
              animate={{ top: ["8%", "92%", "8%"] }}
              transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
            />
          )}

          {/* Active AI Status Pill inside Camera */}
          <div className="absolute top-2.5 right-2.5 z-20">
            <div
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold backdrop-blur-md border ${borderStatus === "success"
                  ? "border-emerald-500/50 bg-emerald-950/80 text-emerald-300"
                  : borderStatus === "error"
                    ? "border-red-500/50 bg-red-950/80 text-red-300"
                    : livenessDone
                      ? "border-cyan-500/50 bg-slate-950/80 text-cyan-300"
                      : "border-cyan-500/50 bg-slate-950/80 text-cyan-300"
                }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${borderStatus === "success"
                    ? "bg-emerald-400 animate-pulse"
                    : borderStatus === "error"
                      ? "bg-red-400"
                      : livenessDone
                        ? "bg-emerald-400 animate-pulse"
                        : "bg-cyan-400 animate-ping"
                  }`}
              />
              {borderStatus === "success"
                ? "MATCHED"
                : borderStatus === "error"
                  ? "RETRY"
                  : livenessDone
                    ? "READY"
                    : `LIVENESS: ${livenessCount}s`}
            </div>
          </div>
        </div>

        {/* Status Prompt Banner */}
        <AnimatePresence mode="wait">
          {message && (
            <motion.div
              key={message}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className={`mt-4 flex items-center justify-center gap-2 rounded-2xl border p-3 text-xs font-semibold ${borderStatus === "success"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : borderStatus === "error"
                    ? "border-red-500/30 bg-red-500/10 text-red-300"
                    : livenessDone
                      ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-200"
                      : "border-cyan-500/30 bg-cyan-500/10 text-cyan-200"
                }`}
            >
              {borderStatus === "success" ? (
                <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
              ) : borderStatus === "error" ? (
                <AlertCircle size={16} className="shrink-0 text-red-400" />
              ) : (
                <ShieldCheck size={16} className="shrink-0 text-cyan-400 animate-pulse" />
              )}
              <span>{message}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Button */}
        {borderStatus === "success" ? (
          <Button
            disabled
            text="Opening Dashboard..."
            className="mt-5 w-full rounded-2xl py-3.5 text-sm font-bold text-white bg-emerald-600 shadow-lg shadow-emerald-500/25"
          />
        ) : (
          <Button
            onClick={handleFaceVerification}
            disabled={!cameraReady || !livenessDone || loading || borderStatus === "scanning"}
            loading={loading || borderStatus === "scanning"}
            text={
              loading || borderStatus === "scanning" ? (
                "Verifying Face Signature..."
              ) : !livenessDone ? (
                `Scanning Liveness (${livenessCount}s)`
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <ScanFace size={16} /> Verify &amp; Check In
                </span>
              )
            }
            className={`mt-5 w-full rounded-2xl py-3.5 text-sm font-bold text-white shadow-lg transition-all duration-300 cursor-pointer ${livenessDone && !loading
                ? "bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 shadow-cyan-500/25 hover:from-cyan-500 hover:to-indigo-500"
                : "bg-slate-800 text-slate-400 opacity-60 cursor-not-allowed"
              }`}
          />
        )}

        {/* Secondary Links */}
        <div className="mt-3.5 flex items-center justify-center gap-4 text-xs">
          {capturedImage && borderStatus !== "success" && (
            <button
              type="button"
              onClick={resetCamera}
              className="inline-flex items-center gap-1 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <RotateCcw size={12} /> Retake snapshot
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              localStorage.clear();
              navigate("/", { replace: true });
            }}
            className="inline-flex items-center gap-1 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <ArrowLeft size={12} /> Back to login
          </button>
        </div>
      </motion.div>
    </div>
  );
}
