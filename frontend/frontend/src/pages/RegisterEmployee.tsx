// src/pages/Register.tsx
import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import Webcam from "react-webcam";
import API from "../services/api";
import Input from "../components/Input";
import Button from "../components/Button";
import MessageOverlay from "../components/MessageOverlay";

type Step = "form" | "otp" | "face";
type VerifyMethod = "email" | "phone";
type BorderStatus = "idle" | "scanning" | "success" | "error";

export default function Register() {
  const navigate = useNavigate();
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  const [step, setStep] = useState<Step>("form");
  const [verifyMethod, setVerifyMethod] = useState<VerifyMethod>("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [borderStatus, setBorderStatus] = useState<BorderStatus>("idle");
  const [cameraReady, setCameraReady] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [message, setMessage] = useState("Position your face in the oval");

  // OTP state
  const [otp, setOtp] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [cvFileName, setCvFileName] = useState("");
  const [cvFile, setCvFile] = useState("");
  const [overlay, setOverlay] = useState<{
    title: string;
    message?: string;
    tone?: "info" | "success" | "error";
    loading?: boolean;
  } | null>(null);

  // Form — only name + email + optional phone
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
  });

  // ── Resend cooldown ───────────────────────────────────────────────────────
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // ── Validators ────────────────────────────────────────────────────────────
  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const isValidPhone = (v: string) =>
    /^\+?[0-9]{10,15}$/.test(v.replace(/\s/g, ""));

  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });

  // ── Send OTP ──────────────────────────────────────────────────────────────
  const sendOtp = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await API.post("/employees/send-registration-otp/", {
        email: formData.email,
      });

      if (response.data.success) {
        setResendCooldown(60);
        setStep("otp");
      } else {
        setError(response.data.error || "Failed to send OTP");
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  // ── Verify OTP ────────────────────────────────────────────────────────────
  const verifyOtp = async () => {
    if (!otp.trim() || otp.length < 6) {
      setError("Please enter the 6-digit OTP");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await API.post("/employees/verify-registration-otp/", {
        email: formData.email,
        otp: otp.trim(),
      });

      if (response.data.success) {
        setOtpVerified(true);
        setError("");
        setTimeout(() => setStep("face"), 800);
      } else {
        setError(response.data.error || "Invalid OTP");
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  // ── Image quality check ───────────────────────────────────────────────────
  const checkImageQuality = (
    imageSrc: string,
  ): Promise<{ passed: boolean; reason: string }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const W = 160,
          H = 120;
        const canvas = document.createElement("canvas");
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, W, H);
        const { data } = ctx.getImageData(0, 0, W, H);

        let lum = 0;
        for (let i = 0; i < data.length; i += 4)
          lum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const avg = lum / (data.length / 4);
        if (avg < 28)
          return resolve({
            passed: false,
            reason: "Too dark — improve lighting",
          });
        if (avg > 220)
          return resolve({
            passed: false,
            reason: "Too bright — reduce glare",
          });

        let blur = 0;
        for (let y = 1; y < H - 1; y++)
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
        if (blur / (W * H) < 4.5)
          return resolve({ passed: false, reason: "Too blurry — hold still" });

        resolve({ passed: true, reason: "" });
      };
      img.src = imageSrc;
    });
  };

  // ── Canvas overlay ────────────────────────────────────────────────────────
  const drawOverlay = (status: BorderStatus, scanOffset: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width,
      H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const ovalX = W / 2,
      ovalY = H * 0.45,
      ovalRX = W * 0.38,
      ovalRY = H * 0.42;

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
  };

  useEffect(() => {
    let scanOffset = 0,
      direction = 1;
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
  }, [borderStatus]);

  // ── Capture face ──────────────────────────────────────────────────────────
  const captureFace = async () => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const imageSrc = webcamRef.current?.getScreenshot({
        width: 1280,
        height: 720,
      });
      if (!imageSrc) {
        setMessage("Failed to capture image");
        setBorderStatus("error");
        return;
      }
      const { passed, reason } = await checkImageQuality(imageSrc);
      if (!passed) {
        setBorderStatus("error");
        setMessage(reason);
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 800));
          setBorderStatus("scanning");
          setMessage("Position your face in the oval");
          continue;
        }
        return;
      }
      setCapturedImage(imageSrc);
      setBorderStatus("success");
      setMessage("✅ Face captured successfully!");
      return;
    }
  };

  // ── Register submit ───────────────────────────────────────────────────────
  const handleRegisterSubmit = async () => {
    if (!capturedImage) {
      setError("Please capture your face");
      return;
    }
    if (!cvFile) {
      setError("Please upload your CV");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await API.post("/employees/register/", {
        name: formData.name,
        email: formData.email,
        image: capturedImage,
        cv_file: cvFile,
        cv_file_name: cvFileName,
      });
      if (response.data.success) {
        setOverlay({
          title: "Registration successful",
          message: `Your Employee ID and password have been sent to ${formData.email}.`,
          tone: "success",
          loading: true,
        });
        setTimeout(() => navigate("/"), 2000);
      } else {
        setError(response.data.error || "Registration failed");
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  // ════════════════════════════════════════════════════════════════════════════
  // STEP 1 — FORM
  // ════════════════════════════════════════════════════════════════════════════
  if (step === "form") {
    return (
      <div className="min-h-screen bg-linear-to-br from-[#020617] via-[#0f172a] to-[#111827] flex items-center justify-center p-6 relative overflow-hidden">
        {overlay && (
          <MessageOverlay
            title={overlay.title}
            message={overlay.message}
            tone={overlay.tone}
            loading={overlay.loading}
          />
        )}
        <div className="absolute -top-30 -left-25 w-87.5 h-87.5 bg-blue-500/20 blur-3xl rounded-full" />
        <div className="absolute -bottom-30 -right-25 w-87.5 h-87.5 bg-cyan-500/20 blur-3xl rounded-full" />

        <div className="relative w-full max-w-md bg-white/5 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-[36px] p-8">
          <div className="text-center mb-6">
            <h1 className="text-4xl font-bold text-white">Register</h1>
            <p className="text-slate-400 mt-2 text-sm">
              Create your employee account
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-4 rounded-2xl mb-5 text-center text-sm">
              {error}
            </div>
          )}

          <div className="space-y-5">
            {/* NAME */}
            <div>
              <label className="text-slate-300 text-sm mb-2 block">
                Full Name
              </label>
              <Input
                type="text"
                placeholder="Enter full name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full p-4 rounded-2xl bg-slate-900/70 border border-slate-700 text-white placeholder-slate-500 outline-none focus:border-blue-500 transition"
              />
            </div>

            {/* EMAIL */}
            <div>
              <label className="text-slate-300 text-sm mb-2 block">
                Email Address
              </label>
              <Input
                type="email"
                placeholder="Enter email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="w-full p-4 rounded-2xl bg-slate-900/70 border border-slate-700 text-white placeholder-slate-500 outline-none focus:border-blue-500 transition"
              />
            </div>

            <div>
              <label className="text-slate-300 text-sm mb-2 block">
                CV / Resume
              </label>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) {
                    setCvFile("");
                    setCvFileName("");
                    return;
                  }
                  if (file.size > 5 * 1024 * 1024) {
                    setError("CV file must be 5MB or smaller");
                    e.target.value = "";
                    return;
                  }
                  try {
                    setCvFile(await fileToDataUrl(file));
                    setCvFileName(file.name);
                    setError("");
                  } catch {
                    setError("Could not read selected CV");
                  }
                }}
                className="w-full rounded-2xl border border-slate-700 bg-slate-900/70 p-4 text-sm text-slate-300 file:mr-4 file:rounded-xl file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-blue-700"
              />
              {cvFileName && (
                <p className="mt-2 truncate text-xs text-blue-300">
                  {cvFileName}
                </p>
              )}
            </div>

            {/* PHONE (optional) */}
            <div>
              <label className="text-slate-300 text-sm mb-2 block">
                Phone Number{" "}
                <span className="text-slate-500 text-xs">(optional)</span>
              </label>
              <Input
                type="tel"
                placeholder="+91 9876543210"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                className="w-full p-4 rounded-2xl bg-slate-900/70 border border-slate-700 text-white placeholder-slate-500 outline-none focus:border-blue-500 transition"
              />
            </div>

            {/* VERIFICATION METHOD */}
            <div>
              <label className="text-slate-300 text-sm mb-3 block">
                Verify via
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setVerifyMethod("email")}
                  className={`p-3 rounded-2xl border text-sm font-medium transition-all ${
                    verifyMethod === "email"
                      ? "border-blue-500 bg-blue-500/20 text-blue-300"
                      : "border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-500"
                  }`}
                >
                  📧 Email OTP
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!formData.phone) {
                      setError(
                        "Enter a phone number first to use SMS verification",
                      );
                      return;
                    }
                    setError(
                      "SMS verification is not available yet. Please use Email OTP.",
                    );
                  }}
                  className={`p-3 rounded-2xl border text-sm font-medium transition-all ${
                    verifyMethod === "phone"
                      ? "border-cyan-500 bg-cyan-500/20 text-cyan-300"
                      : "border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-500"
                  }`}
                >
                  📱 SMS OTP
                </button>
              </div>
            </div>

            {/* Info banner */}
            <div className="bg-blue-500/10 border border-blue-500/30 text-blue-300 p-4 rounded-2xl text-sm text-center leading-relaxed">
              🔐 Your <span className="font-semibold">Employee ID</span> and{" "}
              <span className="font-semibold">Password</span> will be
              auto-generated and sent to your{" "}
              {verifyMethod === "email" ? "email" : "phone"} after registration.
            </div>

            {/* CONTINUE */}
            <Button
              text={loading ? "Sending OTP..." : "Verify & Continue →"}
              onClick={() => {
                if (!formData.name.trim()) {
                  setError("Please enter your name");
                  return;
                }
                if (!formData.email.trim()) {
                  setError("Please enter your email");
                  return;
                }
                if (!isValidEmail(formData.email)) {
                  setError("Please enter a valid email");
                  return;
                }
                if (!cvFile) {
                  setError("Please upload your CV");
                  return;
                }
                if (verifyMethod === "phone") {
                  if (!formData.phone.trim()) {
                    setError("Please enter your phone number");
                    return;
                  }
                  if (!isValidPhone(formData.phone)) {
                    setError(
                      "Please enter a valid phone number (10–15 digits)",
                    );
                    return;
                  }
                }
                setError("");
                sendOtp();
              }}
              disabled={loading}
              className="w-full bg-linear-to-r from-blue-600 to-cyan-500 hover:scale-[1.02] hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-300 p-4 rounded-2xl text-white font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            />

            <div className="text-center pt-2 flex gap-2 items-center justify-center">
              <p className="text-slate-400 text-sm">Already have an account?</p>
              <Link
                to="/"
                className="text-blue-400 hover:text-blue-300 font-semibold transition"
              >
                Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // STEP 2 — OTP
  // ════════════════════════════════════════════════════════════════════════════
  if (step === "otp") {
    const contactDisplay =
      verifyMethod === "email" ? formData.email : formData.phone;
    const methodLabel = verifyMethod === "email" ? "📧 Email" : "📱 SMS";

    return (
      <div className="min-h-screen bg-linear-to-br from-[#020617] via-[#0f172a] to-[#111827] flex items-center justify-center p-6 relative overflow-hidden">
        {overlay && (
          <MessageOverlay
            title={overlay.title}
            message={overlay.message}
            tone={overlay.tone}
            loading={overlay.loading}
          />
        )}
        <div className="absolute -top-30 -left-25 w-87.5 h-87.5 bg-blue-500/20 blur-3xl rounded-full" />
        <div className="absolute -bottom-30 -right-25 w-87.5 h-87.5 bg-cyan-500/20 blur-3xl rounded-full" />

        <div className="relative w-full max-w-md bg-white/5 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-[36px] p-8">
          <div className="text-center mb-6">
            <div className="w-20 h-20 rounded-3xl bg-blue-500/20 flex items-center justify-center text-4xl mx-auto mb-4">
              {verifyMethod === "email" ? "📧" : "📱"}
            </div>
            <h1 className="text-3xl font-bold text-white">
              Verify {methodLabel}
            </h1>
            <p className="text-slate-400 mt-2 text-sm">
              We sent a 6-digit OTP to
            </p>
            <p className="text-blue-400 font-semibold mt-1">{contactDisplay}</p>
          </div>

          {otpVerified && (
            <div className="bg-green-500/10 border border-green-500/30 text-green-300 p-4 rounded-2xl mb-5 text-center text-sm">
              ✅ Verified! Opening camera...
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-4 rounded-2xl mb-5 text-center text-sm">
              {error}
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label className="text-slate-300 text-sm mb-2 block">
                Enter OTP
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="_ _ _ _ _ _"
                value={otp}
                onChange={(e) => {
                  setOtp(e.target.value.replace(/\D/g, ""));
                  setError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") verifyOtp();
                }}
                className="w-full p-4 rounded-2xl bg-slate-900/70 border border-slate-700 text-white placeholder-slate-500 outline-none focus:border-blue-500 transition text-center text-2xl tracking-[0.5em] font-mono"
              />
            </div>

            <Button
              text={loading ? "Verifying..." : "Verify OTP"}
              onClick={verifyOtp}
              disabled={loading || otpVerified}
              className="w-full bg-linear-to-r from-blue-600 to-cyan-500 hover:scale-[1.02] transition-all duration-300 p-4 rounded-2xl text-white font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            />

            <div className="text-center">
              {resendCooldown > 0 ? (
                <p className="text-slate-500 text-sm">
                  Resend in{" "}
                  <span className="text-blue-400 font-semibold">
                    {resendCooldown}s
                  </span>
                </p>
              ) : (
                <button
                  onClick={() => {
                    setOtp("");
                    setError("");
                    sendOtp();
                  }}
                  disabled={loading}
                  className="text-blue-400 hover:text-blue-300 text-sm font-semibold transition cursor-pointer disabled:opacity-50"
                >
                  Resend OTP
                </button>
              )}
            </div>

            {/* Switch method */}
            {formData.phone && (
              <div className="text-center">
                <button
                  onClick={() => {
                    setVerifyMethod(
                      verifyMethod === "email" ? "phone" : "email",
                    );
                    setOtp("");
                    setError("");
                    setStep("form");
                  }}
                  className="text-slate-500 hover:text-slate-300 text-xs transition"
                >
                  Switch to {verifyMethod === "email" ? "SMS" : "Email"}{" "}
                  verification
                </button>
              </div>
            )}

            <button
              onClick={() => {
                setStep("form");
                setOtp("");
                setError("");
                setOtpVerified(false);
              }}
              className="w-full text-slate-400 hover:text-white text-sm transition cursor-pointer"
            >
              ← Back to form
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // STEP 3 — FACE CAPTURE
  // ════════════════════════════════════════════════════════════════════════════
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
        Capture Your Face
      </h1>
      <p className="text-gray-400 mb-2 text-sm">
        Position your face inside the oval
      </p>

      <div className="mb-5 bg-blue-500/10 border border-blue-500/30 text-blue-300 px-5 py-3 rounded-2xl text-sm text-center max-w-sm">
        After capture, your <span className="font-semibold">Employee ID</span>{" "}
        &amp; <span className="font-semibold">Password</span> will be sent to{" "}
        <span className="font-semibold">
          {verifyMethod === "email" ? formData.email : formData.phone}
        </span>
      </div>

      <div
        className={`relative w-90 h-90 rounded-full overflow-hidden ring-4 shadow-lg transition-all ${
          borderStatus === "success"
            ? "ring-green-500 shadow-green-500/40"
            : borderStatus === "error"
              ? "ring-red-500 shadow-red-500/40"
              : borderStatus === "scanning"
                ? "ring-yellow-400 shadow-yellow-400/30"
                : "ring-white/30"
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
            alt="Captured face"
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

      <p
        className={`mt-4 text-lg font-medium ${
          borderStatus === "success"
            ? "text-green-400"
            : borderStatus === "error"
              ? "text-red-400"
              : borderStatus === "scanning"
                ? "text-yellow-300"
                : "text-white"
        }`}
      >
        {message}
      </p>

      {borderStatus === "success" ? (
        <button
          onClick={handleRegisterSubmit}
          disabled={loading}
          className="mt-6 px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-bold disabled:opacity-50 transition"
        >
          {loading ? "Registering..." : "Complete Registration →"}
        </button>
      ) : (
        <button
          onClick={() => {
            setBorderStatus("scanning");
            setMessage("Position your face in the oval");
            captureFace();
          }}
          disabled={!cameraReady || borderStatus === "scanning"}
          className="mt-6 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold disabled:opacity-50 transition"
        >
          {borderStatus === "scanning" ? "Checking..." : "Capture Face"}
        </button>
      )}

      {capturedImage && borderStatus !== "success" && (
        <button
          onClick={() => {
            setCapturedImage(null);
            setBorderStatus("idle");
            setMessage("Position your face in the oval");
          }}
          className="mt-3 text-gray-400 hover:text-white text-sm transition"
        >
          🔄 Retake photo
        </button>
      )}

      <button
        onClick={() => {
          setCapturedImage(null);
          setBorderStatus("idle");
          setMessage("Position your face in the oval");
          setStep("otp");
        }}
        className="mt-4 text-gray-400 hover:text-white text-sm transition"
      >
        ← Back
      </button>

      {error && (
        <div className="bg-red-500/20 border border-red-500 text-red-300 p-4 rounded-xl mt-4 text-sm max-w-md text-center">
          {error}
        </div>
      )}
    </div>
  );
}
