import { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import { useNavigate } from "react-router-dom";
import API, { FACE_REQUEST_TIMEOUT_MS } from "../services/api";
import MessageOverlay from "../components/MessageOverlay";
import {
  getCurrentLocation,
  pickLivenessPrompt,
} from "../services/attendanceSecurity";

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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-linear-to-br from-[#020617] via-[#0f172a] to-[#111827] p-6">
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

        <div className="overflow-hidden rounded-3xl border border-slate-700 bg-slate-950">
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
          <div className="mt-5 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4 text-center text-sm text-blue-300">
            {message}
          </div>
        )}

        <button
          onClick={handleCheckOut}
          disabled={loading || !livenessDone}
          className="mt-6 w-full cursor-pointer rounded-2xl bg-linear-to-r from-blue-600 to-cyan-500 p-4 font-bold text-white transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-blue-500/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading
            ? "Verifying..."
            : livenessDone
              ? "Verify & Check Out"
              : `Complete Liveness (${livenessCount})`}
        </button>

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
