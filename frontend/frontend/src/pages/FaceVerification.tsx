// src/pages/VerifyFace.tsx

import { useRef, useEffect, useState, useCallback } from "react";
import Webcam from "react-webcam";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import MessageOverlay from "../components/MessageOverlay";

type BorderStatus = "idle" | "scanning" | "success" | "error";

export default function VerifyFace() {
  const navigate     = useNavigate();
  const webcamRef    = useRef<Webcam>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const verifyingRef = useRef(false); // prevent double-trigger

  const [cameraReady,  setCameraReady]  = useState(false);
  const [capturedImage,setCapturedImage]= useState<string | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [message,      setMessage]      = useState("Initializing camera...");
  const [borderStatus, setBorderStatus] = useState<BorderStatus>("idle");
  const [retryCount,   setRetryCount]   = useState(0);
  const [overlay, setOverlay] = useState<{
    title: string;
    message?: string;
    tone?: "info" | "success" | "error";
    loading?: boolean;
  } | null>(null);

  // ── Guard: redirect if no employee_id ─────────────────────────────────────
  useEffect(() => {
    const id = localStorage.getItem("employee_id");
    if (!id || id === "undefined") {
      localStorage.clear();
      navigate("/", { replace: true });
    }
  }, [navigate]);

  // ── Image quality check ───────────────────────────────────────────────────
  const checkImageQuality = (src: string): Promise<{ passed: boolean; reason: string }> =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const W = 160, H = 120;
        const cv  = document.createElement("canvas");
        cv.width  = W; cv.height = H;
        const ctx = cv.getContext("2d")!;
        ctx.drawImage(img, 0, 0, W, H);
        const { data } = ctx.getImageData(0, 0, W, H);

        // Brightness
        let lum = 0;
        for (let i = 0; i < data.length; i += 4)
          lum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const avg = lum / (data.length / 4);
        if (avg < 28)  return resolve({ passed: false, reason: "Too dark — find better lighting" });
        if (avg > 220) return resolve({ passed: false, reason: "Too bright — reduce glare" });

        // Blur (Laplacian)
        let blur = 0;
        for (let y = 1; y < H - 1; y++)
          for (let x = 1; x < W - 1; x++) {
            const idx = (y * W + x) * 4;
            blur += Math.abs(
              -4 * data[idx] +
              data[((y - 1) * W + x) * 4] +
              data[((y + 1) * W + x) * 4] +
              data[(y * W + (x - 1)) * 4] +
              data[(y * W + (x + 1)) * 4]
            );
          }
        if (blur / (W * H) < 4.5)
          return resolve({ passed: false, reason: "Too blurry — hold still" });

        resolve({ passed: true, reason: "" });
      };
      img.src = src;
    });

  // ── Canvas overlay ─────────────────────────────────────────────────────────
  const drawOverlay = (bs: BorderStatus, scanOffset: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const ovalX = W / 2, ovalY = H * 0.45, ovalRX = W * 0.38, ovalRY = H * 0.42;

    // Dark mask with oval cutout
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.ellipse(ovalX, ovalY, ovalRX, ovalRY, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const color =
      bs === "success" ? "#22c55e" :
      bs === "error"   ? "#ef4444" :
      bs === "scanning"? "#facc15" : "#ffffff";

    const glow =
      bs === "success" ? "rgba(34,197,94,0.4)"  :
      bs === "error"   ? "rgba(239,68,68,0.4)"  :
      bs === "scanning"? "rgba(250,204,21,0.3)" : "rgba(255,255,255,0.2)";

    // Oval border
    ctx.save();
    ctx.shadowColor = glow;
    ctx.shadowBlur  = 18;
    ctx.strokeStyle = color;
    ctx.lineWidth   = 3.5;
    ctx.beginPath();
    ctx.ellipse(ovalX, ovalY, ovalRX, ovalRY, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Scan line
    if (bs === "scanning") {
      const lineY = ovalY - ovalRY + scanOffset * ovalRY * 2;
      const halfW = Math.sqrt(
        Math.max(0, 1 - Math.pow((lineY - ovalY) / ovalRY, 2)) * ovalRX * ovalRX
      );
      ctx.save();
      const g = ctx.createLinearGradient(ovalX - halfW, lineY, ovalX + halfW, lineY);
      g.addColorStop(0,   "rgba(250,204,21,0)");
      g.addColorStop(0.5, "rgba(250,204,21,0.8)");
      g.addColorStop(1,   "rgba(250,204,21,0)");
      ctx.strokeStyle = g;
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.moveTo(ovalX - halfW, lineY);
      ctx.lineTo(ovalX + halfW, lineY);
      ctx.stroke();
      ctx.restore();
    }

    // Corner tick marks
    [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].forEach((angle) => {
      const cx = ovalX + ovalRX * Math.cos(angle);
      const cy = ovalY + ovalRY * Math.sin(angle);
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth   = 3;
      ctx.lineCap     = "round";
      ctx.beginPath();
      ctx.moveTo(cx + Math.sin(angle) * 18, cy - Math.cos(angle) * 18);
      ctx.lineTo(cx - Math.sin(angle) * 18, cy + Math.cos(angle) * 18);
      ctx.stroke();
      ctx.restore();
    });
  };

  // ── Animation loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    let offset = 0, dir = 1;
    const loop = () => {
      if (borderStatus === "scanning") {
        offset += 0.008 * dir;
        if (offset >= 1) dir = -1;
        if (offset <= 0) dir =  1;
      }
      drawOverlay(borderStatus, offset);
      animationRef.current = requestAnimationFrame(loop);
    };
    animationRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationRef.current);
  }, [borderStatus]);

  // ── Core face verification ─────────────────────────────────────────────────
  const handleFaceVerification = useCallback(async () => {
    // Prevent multiple simultaneous calls
    if (verifyingRef.current) return;
    verifyingRef.current = true;

    setBorderStatus("scanning");
    setMessage("Scanning face...");
    setCapturedImage(null);
    setOverlay({
      title: "Scanning face",
      message: "Please hold still while we compare your face.",
      tone: "info",
      loading: true,
    });

    const employee_id = localStorage.getItem("employee_id");
    if (!employee_id || employee_id === "undefined") {
      localStorage.clear();
      navigate("/", { replace: true });
      verifyingRef.current = false;
      return;
    }

    // ── Quality check with up to 3 attempts ──────────────────────────────────
    let imageSrc: string | null = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      // Wait a moment so the webcam stream stabilises on first attempt
      if (attempt === 1) await new Promise((r) => setTimeout(r, 300));

      const snap = webcamRef.current?.getScreenshot({ width: 1280, height: 720 });

      if (!snap) {
        if (attempt === 3) {
          setBorderStatus("error");
          setMessage("Failed to capture image — check camera permissions");
          verifyingRef.current = false;
          return;
        }
        await new Promise((r) => setTimeout(r, 600));
        continue;
      }

      const { passed, reason } = await checkImageQuality(snap);

      if (!passed) {
        setBorderStatus("error");
        setMessage(reason);
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 900));
          setBorderStatus("scanning");
          setMessage("Scanning face...");
          continue;
        }
        // All 3 quality attempts failed — let user retry manually
        verifyingRef.current = false;
        return;
      }

      imageSrc = snap;
      break;
    }

    if (!imageSrc) {
      verifyingRef.current = false;
      return;
    }

    // Show the captured frame
    setCapturedImage(imageSrc);
    setLoading(true);
    setBorderStatus("scanning");
    setMessage("Verifying face...");

    // ── Send to backend ───────────────────────────────────────────────────────
    try {
      console.log("📤 Sending face to backend...");

      const response = await API.post("/attendance/verify-face/", {
        employee_id,
        image: imageSrc,
      });

      console.log("✅ Backend response:", response.data);

      if (response.data.success) {
        setBorderStatus("success");
        setMessage(`✅ ${response.data.message || "Face verified!"}`);

        // Update stored data if backend returns refreshed info
        if (response.data.employee_id)
          localStorage.setItem("employee_id", response.data.employee_id);
        if (response.data.employee_name)
          localStorage.setItem("employee_name", response.data.employee_name);
        if (response.data.profile_img)
          localStorage.setItem("profile_img", response.data.profile_img);
        if (response.data.cv_file)
          localStorage.setItem("cv_file", response.data.cv_file);

        setOverlay({
          title: "Face verified",
          message: "Welcome back. Opening your dashboard.",
          tone: "success",
          loading: true,
        });

        setTimeout(() => navigate("/dashboard", { replace: true }), 2000);
      } else {
        // Backend said face not recognised — show error and allow retry
        setBorderStatus("error");
        setMessage(response.data.error || "Face not recognised. Please try again.");
        setCapturedImage(null); // Clear so webcam shows again
        setOverlay(null);
      }
    } catch (err: unknown) {
      console.error("❌ Face verification error:", err);
      const e = err as { response?: { data?: { error?: string } } };
      const msg = e.response?.data?.error || "Face verification failed. Please try again.";
      setBorderStatus("error");
      setMessage(msg);
      setCapturedImage(null);
      setOverlay(null);
    } finally {
      setLoading(false);
      verifyingRef.current = false;
    }
  }, [navigate]);

  // ── Auto-verify when camera is ready ──────────────────────────────────────
  useEffect(() => {
    if (!cameraReady) return;

    setBorderStatus("scanning");
    setMessage("Scanning face...");

    // Give the webcam 2 s to warm up before auto-capturing
    const timer = setTimeout(() => {
      handleFaceVerification();
    }, 2000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraReady]); // only run once when camera becomes ready

  // ── Ring colour helper ─────────────────────────────────────────────────────
  const ringColor =
    borderStatus === "success" ? "ring-green-500 shadow-green-500/40"    :
    borderStatus === "error"   ? "ring-red-500 shadow-red-500/40"        :
    borderStatus === "scanning"? "ring-yellow-400 shadow-yellow-400/30" : "ring-white/30";

  const msgColor =
    borderStatus === "success" ? "text-green-400" :
    borderStatus === "error"   ? "text-red-400"   :
    borderStatus === "scanning"? "text-yellow-300" : "text-white";

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-5">
      {overlay && (
        <MessageOverlay
          title={overlay.title}
          message={overlay.message}
          tone={overlay.tone}
          loading={overlay.loading}
        />
      )}
      <h1 className="text-3xl text-white mb-2 font-semibold">Face Verification</h1>
      <p className="text-gray-400 mb-6 text-sm">Position your face inside the oval</p>

      {/* Camera / snapshot */}
      <div className={`relative w-90 h-90 rounded-full overflow-hidden ring-4 shadow-lg transition-all ${ringColor}`}>
        {!capturedImage ? (
          <Webcam
            ref={webcamRef}
            audio={false}
            mirrored
            screenshotFormat="image/jpeg"
            screenshotQuality={0.95}
            onUserMedia={() => {
              console.log("📷 Camera ready");
              setCameraReady(true);
            }}
            onUserMediaError={(err) => {
              console.error("Camera error:", err);
              setBorderStatus("error");
              setMessage("Camera access denied — please allow camera and refresh");
            }}
            videoConstraints={{
              facingMode: "user",
              width: { ideal: 1280 },
              height: { ideal: 720 },
            }}
            style={{
              position: "absolute",
              width: "150%",
              height: "130%",
              top: "-30%",
              left: "0%",
              objectFit: "cover",
            }}
          />
        ) : (
          <img
            src={capturedImage}
            alt="Captured frame"
            style={{
              position: "absolute",
              width: "150%",
              height: "130%",
              top: "-30%",
              left: "0%",
              objectFit: "cover",
            }}
          />
        )}

        <canvas
          ref={canvasRef}
          width={600}
          height={400}
          className="absolute inset-0 w-full h-full"
        />
      </div>

      {/* Status dots */}
      <div className="flex gap-2 mt-6">
        {(["idle", "scanning", "success", "error"] as BorderStatus[]).map((s) => (
          <div
            key={s}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              borderStatus === s
                ? s === "success"  ? "bg-green-500 scale-125"
                : s === "error"    ? "bg-red-500 scale-125"
                : s === "scanning" ? "bg-yellow-400 scale-125"
                :                    "bg-white scale-125"
                : "bg-white/20"
            }`}
          />
        ))}
      </div>

      {/* Status message */}
      <p className={`mt-4 text-center text-lg font-medium transition-colors duration-300 ${msgColor}`}>
        {message}
      </p>

      {/* Loading spinner text */}
      {loading && (
        <p className="text-slate-400 text-sm mt-1 animate-pulse">
          Comparing with registered face...
        </p>
      )}

      {/* Retry button — only shown on error, not while loading */}
      {borderStatus === "error" && !loading && (
        <button
          onClick={() => {
            setRetryCount((c) => c + 1);
            setCapturedImage(null);
            handleFaceVerification();
          }}
          className="mt-5 px-8 py-3 border border-white/30 text-white rounded-2xl hover:bg-white/10 transition font-semibold cursor-pointer"
        >
          🔄 Try Again {retryCount > 0 ? `(${retryCount})` : ""}
        </button>
      )}

      {/* Back to login */}
      <button
        onClick={() => {
          localStorage.clear();
          navigate("/", { replace: true });
        }}
        className="mt-4 text-gray-500 hover:text-white text-sm transition cursor-pointer"
      >
        ← Back to login
      </button>
    </div>
  );
}
