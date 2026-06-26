import { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import { useNavigate } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import API, { FACE_REQUEST_TIMEOUT_MS } from "../../services/api";
import MessageOverlay from "../../components/chat/MessageOverlay";
import Button from "../../components/common/Button";
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
  const [overlay, setOverlay] = useState<{
    title: string;
    message?: string;
    tone?: "info" | "success" | "error";
    loading?: boolean;
  } | null>(null);

  useEffect(() => {
    if (!cameraReady || livenessDone) return;
    setMessage(livenessPrompt);
    const timer = window.setInterval(() => {
      setLivenessCount((count) => {
        if (count <= 1) {
          window.clearInterval(timer);
          setLivenessDone(true);
          setMessage("Liveness check complete. You can check out now.");
          return 0;
        }
        return count - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cameraReady, livenessDone, livenessPrompt]);

  const handleCheckOut = async () => {
    if (!livenessDone) {
      setMessage("Complete the liveness prompt first");
      return;
    }

    const imageSrc = webcamRef.current?.getScreenshot();

    if (!imageSrc) {
      setMessage("Failed to capture image");
      return;
    }

    try {
      setLoading(true);
      setOverlay({
        title: "Verifying face",
        message: "Please wait while we confirm your identity.",
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
          title: "Check-out complete",
          message: response.data.message,
          tone: "success",
          loading: true,
        });

        setTimeout(() => {
          navigate("/dashboard");
        }, 2000);
      } else {
        setMessage(response.data.error);
        setOverlay(null);
      }
    } catch (error: unknown) {
      setMessage(getApiError(error, "Check-out failed"));
      setOverlay(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-linear-to-br from-[#020617] via-[#0f172a] to-[#111827] p-6 z-99">
      {overlay && (
        <MessageOverlay
          title={overlay.title}
          message={overlay.message}
          tone={overlay.tone}
          loading={overlay.loading}
        />
      )}
      <div className="absolute -top-30 -left-25 h-87.5 w-87.5 rounded-full bg-blue-500/20 blur-3xl" />
      <div className="absolute -bottom-30 -right-25 h-87.5 w-87.5 rounded-full bg-cyan-500/20 blur-3xl" />

      <div className="relative w-full max-w-lg rounded-[36px] border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-2xl">
        <div className="mb-5 text-center">
          <p className="text-sm text-slate-400">Attendance</p>
          <h1 className="mt-1 text-4xl font-bold text-white">Face Check-Out</h1>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-950 shadow-inner">
          <Webcam
            ref={webcamRef}
            audio={false}
            mirrored
            screenshotFormat="image/jpeg"
            screenshotQuality={0.95}
            onUserMedia={() => setCameraReady(true)}
            className="aspect-video w-full object-cover"
          />
        </div>

        {message && (
          <div
            className={`mt-5 rounded-2xl border p-4 text-center text-sm ${
              livenessDone
                ? "border-green-500/25 bg-green-500/10 text-green-300"
                : "border-blue-500/20 bg-blue-500/10 text-blue-300"
            }`}
            role="status"
            aria-live="polite"
          >
            <span className="inline-flex items-center justify-center gap-2.5">
              {livenessDone && (
                <span
                  className="relative flex h-5 w-5 shrink-0 items-center justify-center"
                  aria-hidden
                >
                  <span className="absolute inline-flex h-2.5 w-2.5 animate-ping rounded-full bg-green-400/50" />
                  <CheckCircle2
                    className="relative h-5 w-5 text-green-400"
                    strokeWidth={2.25}
                  />
                </span>
              )}
              <span>{message}</span>
            </span>
          </div>
        )}

        <Button
          onClick={handleCheckOut}
          disabled={loading || !livenessDone}
          loading={loading}
          text={
            loading
              ? "Verifying..."
              : livenessDone
                ? "Verify & Check Out"
                : `Complete Liveness (${livenessCount})`
          }
          className="mt-6 w-full transform-gpu bg-linear-to-r from-blue-600 to-cyan-500 p-4 text-white transition-[transform,filter,box-shadow] duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] hover:brightness-110 hover:shadow-xl hover:shadow-blue-500/30 active:scale-[0.98] disabled:hover:brightness-100 disabled:active:scale-100"
        />

        <button
          onClick={() => navigate("/dashboard")}
          className="mt-4 w-full cursor-pointer text-sm text-slate-400 transition hover:text-white"
        >
          Back to dashboard
        </button>
      </div>
    </div>
  );
}
