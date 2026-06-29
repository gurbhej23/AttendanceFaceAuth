import { useRef, useEffect, useState, useCallback } from "react";
import Webcam from "react-webcam";
import { useNavigate } from "react-router-dom";
import API, { FACE_REQUEST_TIMEOUT_MS } from "../../services/api";
import { notifyAuthChanged } from "../../hooks/useEmployeeSession";
import MessageOverlay from "../../components/chat/MessageOverlay";
import Button from "../../components/common/Button";
import {
  getCurrentLocation,
  pickLivenessPrompt,
} from "../../services/attendanceSecurity";

type BorderStatus = "idle" | "scanning" | "success" | "error";

export default function VerifyFace() {
  const navigate = useNavigate();
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const verifyingRef = useRef(false);

  const [cameraReady, setCameraReady] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Position your face in the oval");
  const [livenessPrompt] = useState(pickLivenessPrompt);
  const [livenessDone, setLivenessDone] = useState(false);
  const [livenessCount, setLivenessCount] = useState(3);
  const [borderStatus, setBorderStatus] = useState<BorderStatus>("idle");
  const [retryCount, setRetryCount] = useState(0);
  const [overlay, setOverlay] = useState<{
    title: string;
    message?: string;
    tone?: "info" | "success" | "error";
    loading?: boolean;
  } | null>(null);

  useEffect(() => {
    const id = localStorage.getItem("employee_id");
    if (!id || id === "undefined") {
      localStorage.clear();
      navigate("/", { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    if (!cameraReady || livenessDone) return;
    setMessage(livenessPrompt);
    const timer = window.setInterval(() => {
      setLivenessCount((count) => {
        if (count <= 1) {
          window.clearInterval(timer);
          setLivenessDone(true);
          setMessage("Liveness check complete. You can verify now.");
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
          resolve({ passed: false, reason: "Too dark - improve lighting" });
          return;
        }
        if (avg > 220) {
          resolve({ passed: false, reason: "Too bright - reduce glare" });
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
          resolve({ passed: false, reason: "Too blurry - hold still" });
          return;
        }

        resolve({ passed: true, reason: "" });
      };
      img.onerror = () =>
        resolve({ passed: false, reason: "Could not read camera image" });
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
    const ovalY = H * 0.45;
    const ovalRX = W * 0.38;
    const ovalRY = H * 0.42;

    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.ellipse(ovalX, ovalY, ovalRX, ovalRY, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const borderColor =
      status === "success"
        ? "#22c55e"
        : status === "error"
          ? "#ef4444"
          : status === "scanning"
            ? "#facc15"
            : "#ffffff";

    ctx.save();
    ctx.shadowBlur = 18;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.ellipse(ovalX, ovalY, ovalRX, ovalRY, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    if (status === "scanning") {
      const lineY = ovalY - ovalRY + scanOffset * ovalRY * 2;
      const halfW = Math.sqrt(
        Math.max(0, 1 - Math.pow((lineY - ovalY) / ovalRY, 2)) *
          ovalRX *
          ovalRX,
      );
      ctx.save();
      const grad = ctx.createLinearGradient(
        ovalX - halfW,
        lineY,
        ovalX + halfW,
        lineY,
      );
      grad.addColorStop(0, "rgba(250,204,21,0)");
      grad.addColorStop(0.5, "rgba(250,204,21,0.9)");
      grad.addColorStop(1, "rgba(250,204,21,0)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ovalX - halfW, lineY);
      ctx.lineTo(ovalX + halfW, lineY);
      ctx.stroke();
      ctx.restore();
    }
  }, []);

  useEffect(() => {
    let scanOffset = 0;
    let direction = 1;
    const loop = () => {
      if (borderStatus === "scanning") {
        scanOffset += 0.008 * direction;
        if (scanOffset >= 1) direction = -1;
        if (scanOffset <= 0) direction = 1;
      }
      drawOverlay(borderStatus, scanOffset);
      animationRef.current = requestAnimationFrame(loop);
    };
    animationRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationRef.current);
  }, [borderStatus, drawOverlay]);

  const resetCamera = () => {
    setCapturedImage(null);
    setBorderStatus("idle");
    setMessage(livenessDone ? "Position your face in the oval" : livenessPrompt);
    setOverlay(null);
  };

  const handleFaceVerification = async () => {
    if (verifyingRef.current) return;
    if (!livenessDone) {
      setBorderStatus("error");
      setMessage("Complete the liveness prompt first");
      return;
    }

    const employee_id = localStorage.getItem("employee_id");
    if (!employee_id || employee_id === "undefined") {
      localStorage.clear();
      navigate("/", { replace: true });
      return;
    }

    verifyingRef.current = true;
    setBorderStatus("scanning");
    setMessage("Checking image quality...");
    setCapturedImage(null);

    let imageSrc: string | null = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      const snap = webcamRef.current?.getScreenshot();

      if (!snap) {
        if (attempt === 3) {
          setBorderStatus("error");
          setMessage("Failed to capture image");
          verifyingRef.current = false;
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
          setBorderStatus("scanning");
          setMessage("Position your face in the oval");
          continue;
        }
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

    setCapturedImage(imageSrc);
    setLoading(true);
    setBorderStatus("scanning");
    setMessage("Verifying face...");
    setOverlay({
      title: "Verifying face",
      message: "Please hold still while we compare your face.",
      tone: "info",
      loading: true,
    });

    try {
      const location = await getCurrentLocation();
      const response = await API.post(
        "/attendance/verify-face/",
        {
          employee_id,
          image: imageSrc,
          ...location,
        },
        { timeout: FACE_REQUEST_TIMEOUT_MS },
      );

      if (response.data.success) {
        setBorderStatus("success");
        setMessage(response.data.message || "Face verified");

        if (response.data.employee_id) {
          localStorage.setItem("employee_id", response.data.employee_id);
        }
        if (response.data.employee_name) {
          localStorage.setItem("employee_name", response.data.employee_name);
        }
        if (response.data.profile_img) {
          localStorage.setItem("profile_img", response.data.profile_img);
        }
        if (response.data.cv_file) {
          localStorage.setItem("cv_file", response.data.cv_file);
        }
        notifyAuthChanged();

        setOverlay({
          title: "Face verified",
          message: "Welcome back. Opening your dashboard.",
          tone: "success",
          loading: true,
        });
        setTimeout(() => navigate("/dashboard", { replace: true }), 1600);
      } else {
        setBorderStatus("error");
        setMessage(response.data.error || "Face not recognised. Please try again.");
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

  const ringColor =
    borderStatus === "success"
      ? "ring-green-500 shadow-green-500/40"
      : borderStatus === "error"
        ? "ring-red-500 shadow-red-500/40"
        : borderStatus === "scanning"
          ? "ring-yellow-400 shadow-yellow-400/30"
          : "ring-white/30";

  const messageColor =
    borderStatus === "success"
      ? "text-green-400"
      : borderStatus === "error"
        ? "text-red-400"
        : borderStatus === "scanning"
          ? "text-yellow-300"
          : "text-white";

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

      <h1 className="text-3xl text-white mb-1 font-semibold">
        Face Verification
      </h1>
      <p className="text-gray-400 mb-6 text-sm">
        {livenessDone
          ? "Keep your full face visible with a little space around it"
          : `${livenessPrompt} (${livenessCount})`}
      </p>

      <div
        className={`relative w-full h-110 max-w-xl aspect-video rounded-4xl overflow-hidden ring-4 shadow-lg transition-all ${ringColor}`}
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
              setMessage("Camera access denied - please allow camera and refresh");
            }}
            videoConstraints={{
              facingMode: "user",
              width: { ideal: 800 },
              height: { ideal: 720 },
            }}
            style={{
              position: "absolute", 
              top: "0",
              left: "0",
              objectFit: "cover",
            }}
          />
        ) : (
          <img
            src={capturedImage}
            alt="Captured face"
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              top: "0",
              left: "0",
              objectFit: "cover",
            }}
          />
        )}

        <canvas
          ref={canvasRef}
          width={600}
          height={400}
          className="absolute inset-0 w-full h-120"
        />
      </div>

      <p className={`mt-4 text-center text-lg font-medium ${messageColor}`}>
        {message}
      </p>

      {borderStatus === "success" ? (
        <Button
          disabled
          text="Opening Dashboard..."
          className="mt-6 bg-green-600 px-8 py-3 text-white opacity-90"
        />
      ) : (
        <Button
          onClick={() => {
            setRetryCount((c) => c + 1);
            handleFaceVerification();
          }}
          disabled={
            !cameraReady || !livenessDone || loading || borderStatus === "scanning"
          }
          loading={loading || borderStatus === "scanning"}
          text={
            loading || borderStatus === "scanning"
              ? "Checking..."
              : !livenessDone
                ? "Complete Liveness..."
                : retryCount > 0
                  ? "Try Again"
                  : "Verify Face"
          }
          className="mt-6 bg-blue-600 px-8 py-3 text-white hover:bg-blue-700"
        />
      )}

      {capturedImage && borderStatus !== "success" && (
        <button
          onClick={resetCamera}
          className="mt-3 text-gray-400 hover:text-white text-sm transition"
        >
          Retake photo
        </button>
      )}

      <button
        onClick={() => {
          localStorage.clear();
          navigate("/", { replace: true });
        }}
        className="mt-4 text-gray-400 hover:text-white text-sm transition"
      >
        Back to login
      </button>
    </div>
  );
}
