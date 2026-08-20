import { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  LogOut,
  ArrowLeft,
  ShieldCheck,
  Sparkles,
  Clock,
} from "lucide-react";
import API, { FACE_REQUEST_TIMEOUT_MS } from "../../services/api";
import MessageOverlay from "../../components/chat/MessageOverlay";
import Button from "../../components/common/Button";
import AnimatedBackground from "../../components/motion/AnimatedBackground";
import {
  getCurrentLocation,
  pickLivenessPrompt,
} from "../../services/attendanceSecurity";

const getApiError = (err: unknown, fallback: string): string => {
  const e = err as { response?: { data?: { error?: string } } };
  return e?.response?.data?.error || fallback;
};

export default function CheckOut() {
  const webcamRef = useRef<Webcam>(null);
  const navigate = useNavigate();

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [livenessPrompt] = useState(pickLivenessPrompt);
  const [livenessDone, setLivenessDone] = useState(false);
  const [livenessCount, setLivenessCount] = useState(3);
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

  const handleCheckOut = async () => {
    if (!livenessDone) {
      setMessage("Please complete the liveness prompt first");
      return;
    }

    const imageSrc = webcamRef.current?.getScreenshot();

    if (!imageSrc) {
      setMessage("Failed to capture webcam snapshot");
      return;
    }

    try {
      setLoading(true);
      setOverlay({
        title: "Verifying Identity",
        message: "Matching facial biometric signature with registered profile...",
        tone: "info",
        loading: true,
      });

      const employee_id = localStorage.getItem("employee_id");
      if (!employee_id || employee_id === "undefined") {
        localStorage.clear();
        navigate("/", { replace: true });
        return;
      }

      const location = await getCurrentLocation();
      const response = await API.post(
        "/attendance/check-out/",
        {
          employee_id,
          image: imageSrc,
          ...location,
        },
        { timeout: FACE_REQUEST_TIMEOUT_MS },
      );

      if (response.data.success) {
        setMessage(response.data.message);
        setOverlay({
          title: "Check-Out Successful!",
          message: response.data.message || "Your check-out time has been recorded.",
          tone: "success",
          loading: false,
        });

        setTimeout(() => {
          navigate("/dashboard");
        }, 1800);
      } else {
        setMessage(response.data.error || "Check-out failed.");
        setOverlay(null);
      }
    } catch (error: unknown) {
      setMessage(getApiError(error, "Check-out verification failed"));
      setOverlay(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-50 text-slate-900 dark:bg-gradient-to-br dark:from-[#020617] dark:via-[#091124] dark:to-[#0f172a] dark:text-slate-100 p-4 sm:p-6 transition-colors duration-300">
      {/* Interactive 3D particle background */}
      <AnimatedBackground particleColor={0x38bdf8} secondaryColor={0x818cf8} />

      {/* Ambient glowing orbs */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-cyan-500/10 dark:bg-cyan-500/15 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-indigo-600/10 dark:bg-indigo-600/15 blur-[120px]" />

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
        className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-slate-200/90 dark:border-white/15 bg-white/90 dark:bg-slate-950/85 p-5 sm:p-7 shadow-2xl dark:shadow-[0_0_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl text-center transition-colors duration-300"
      >
        {/* Header */}
        <div className="mb-5 flex flex-col items-center">
          <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-600 dark:text-cyan-300">
            <Sparkles size={13} className="text-cyan-500 dark:text-cyan-400" />
            <span>End of Shift Check-Out</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            Face Check-Out
          </h1>

          {/* Live system clock badge */}
          <div className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono">
            <Clock size={13} className="text-cyan-500 dark:text-cyan-400" />
            <span>Current Time: {currentTime}</span>
          </div>
        </div>

        {/* Camera Viewport with Futuristic AI Scanner Overlay */}
        <div
          className={`relative mx-auto aspect-video w-full overflow-hidden rounded-2xl border-2 shadow-2xl transition-all duration-300 ${livenessDone
              ? "border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.25)]"
              : "border-cyan-500/50 shadow-[0_0_30px_rgba(6,182,212,0.2)]"
            }`}
        >
          <Webcam
            ref={webcamRef}
            audio={false}
            mirrored
            screenshotFormat="image/jpeg"
            screenshotQuality={0.95}
            onUserMedia={() => setCameraReady(true)}
            videoConstraints={{
              facingMode: "user",
            }}
            className="absolute inset-0 h-full w-full object-cover"
          />

          {/* Holographic Target Brackets */}
          <div className="pointer-events-none absolute inset-3 z-10">
            {/* Top-Left */}
            <div className="absolute top-0 left-0 h-5 w-5 border-t-2 border-l-2 border-cyan-400 rounded-tl-md shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
            {/* Top-Right */}
            <div className="absolute top-0 right-0 h-5 w-5 border-t-2 border-r-2 border-cyan-400 rounded-tr-md shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
            {/* Bottom-Left */}
            <div className="absolute bottom-0 left-0 h-5 w-5 border-b-2 border-l-2 border-cyan-400 rounded-bl-md shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
            {/* Bottom-Right */}
            <div className="absolute bottom-0 right-0 h-5 w-5 border-b-2 border-r-2 border-cyan-400 rounded-br-md shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
          </div>

          {/* Oval Face Guide Reticle */}
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div
              className={`h-[78%] w-[56%] rounded-[50%] border-2 border-dashed transition-all duration-300 ${livenessDone
                  ? "border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.5)]"
                  : "border-cyan-300/70 shadow-[0_0_20px_rgba(6,182,212,0.3)] animate-pulse"
                }`}
            />
          </div>

          {/* Animated Laser Scanning Bar */}
          {!livenessDone && cameraReady && (
            <motion.div
              className="pointer-events-none absolute left-0 right-0 z-20 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_rgba(34,211,238,1)]"
              animate={{ top: ["8%", "92%", "8%"] }}
              transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
            />
          )}

          {/* Active AI Status Pill inside Camera */}
          <div className="absolute top-2.5 right-2.5 z-20">
            <div
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold backdrop-blur-md border ${livenessDone
                  ? "border-emerald-500/50 bg-emerald-950/80 text-emerald-300"
                  : "border-cyan-500/50 bg-slate-950/80 text-cyan-300"
                }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${livenessDone ? "bg-emerald-400 animate-pulse" : "bg-cyan-400 animate-ping"
                  }`}
              />
              {livenessDone ? "Ready" : `Liveness: ${livenessCount}s`}
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
              className={`mt-4 flex items-center justify-center gap-2 rounded-2xl border p-3 text-xs font-semibold ${livenessDone
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-200"
                }`}
            >
              {livenessDone ? (
                <CheckCircle2 size={16} className="shrink-0 text-emerald-500 dark:text-emerald-400" />
              ) : (
                <ShieldCheck size={16} className="shrink-0 text-cyan-500 dark:text-cyan-400 animate-pulse" />
              )}
              <span>{message}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Primary Verification Button */}
        <Button
          onClick={handleCheckOut}
          disabled={loading || !livenessDone}
          loading={loading}
          text={
            loading ? (
              "Recording Check-Out..."
            ) : livenessDone ? (
              <span className="flex items-center justify-center gap-2">
                <LogOut size={16} /> Verify &amp; Check Out
              </span>
            ) : (
              `Scanning Liveness (${livenessCount}s)`
            )
          }
          className={`mt-5 w-full rounded-2xl py-3.5 text-sm font-bold text-white shadow-lg transition-all duration-300 cursor-pointer ${livenessDone
              ? "bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 shadow-emerald-500/25 hover:from-emerald-500 hover:to-teal-500"
              : "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 opacity-70 cursor-not-allowed"
            }`}
        />

        {/* Back Link */}
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="mt-3.5 inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition cursor-pointer"
        >
          <ArrowLeft size={13} /> Back to Dashboard
        </button>
      </motion.div>
    </div>
  );
}
