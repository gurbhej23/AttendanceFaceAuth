// src/pages/Register.tsx
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Webcam from "react-webcam";
import API, { FACE_REQUEST_TIMEOUT_MS } from "../../services/api";
import RegisterEmployeeView from "./RegisterEmployeeView";

type Step = "form" | "otp" | "face";
type VerifyMethod = "email" | "phone";
type BorderStatus = "idle" | "scanning" | "success" | "error";

export default function Register() {
  const navigate = useNavigate();
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  const [step, setStep] = useState<Step>("form");
  const [stepAnim, setStepAnim] = useState<"wizard-step-forward" | "wizard-step-back">(
    "wizard-step-forward",
  );
  const [verifyMethod, setVerifyMethod] = useState<VerifyMethod>("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [borderStatus, setBorderStatus] = useState<BorderStatus>("idle");
  const [cameraReady, setCameraReady] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [message, setMessage] = useState("Position your face in the oval");

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

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    department: "IT",
    designation: "Software Engineer",
  });

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

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

  const isPdfFile = (file: File) =>
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

  const goToStep = (next: Step, direction: "forward" | "back" = "forward") => {
    setStepAnim(
      direction === "forward" ? "wizard-step-forward" : "wizard-step-back",
    );
    setStep(next);
  };

  const sendOtp = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await API.post("/employees/send-registration-otp/", {
        email: formData.email,
      });

      if (response.data.success) {
        setResendCooldown(60);
        goToStep("otp", "forward");
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
        setTimeout(() => goToStep("face", "forward"), 800);
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
    if (step !== "face") return undefined;
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
  }, [borderStatus, step]);

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
      setMessage("Face captured successfully");
      return;
    }
  };

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
      const response = await API.post(
        "/employees/register/",
        {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          department: formData.department,
          designation: formData.designation,
          image: capturedImage,
          cv_file: cvFile,
          cv_file_name: cvFileName,
        },
        { timeout: FACE_REQUEST_TIMEOUT_MS },
      );
      if (response.data.success) {
        const credentials = response.data.credentials;
        const successMessage = credentials
          ? `${response.data.message}\n\nEmployee ID: ${credentials.employee_id}\nTemporary password: ${credentials.password}`
          : response.data.message ||
          `Your Employee ID and password have been sent to ${formData.email}.`;
        setOverlay({
          title: "Registration successful",
          message: successMessage,
          tone: "success",
          loading: !credentials,
        });
        if (!credentials) {
          setTimeout(() => navigate("/"), 2000);
        }
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

  const handleRegistrationContinue = () => {
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
        setError("Please enter a valid phone number (10-15 digits)");
        return;
      }
    }
    setError("");
    sendOtp();
  };

  return (
    <RegisterEmployeeView
      step={step}
      stepAnim={stepAnim}
      verifyMethod={verifyMethod}
      setVerifyMethod={setVerifyMethod}
      loading={loading}
      error={error}
      setError={setError}
      formData={formData}
      setFormData={setFormData}
      cvFileName={cvFileName}
      setCvFile={setCvFile}
      setCvFileName={setCvFileName}
      fileToDataUrl={fileToDataUrl}
      isPdfFile={isPdfFile}
      onContinue={handleRegistrationContinue}
      otp={otp}
      setOtp={setOtp}
      otpVerified={otpVerified}
      resendCooldown={resendCooldown}
      onVerifyOtp={verifyOtp}
      onResendOtp={() => {
        setOtp("");
        setError("");
        sendOtp();
      }}
      onBackToForm={() => {
        goToStep("form", "back");
        setOtp("");
        setError("");
        setOtpVerified(false);
      }}
      borderStatus={borderStatus}
      message={message}
      cameraReady={cameraReady}
      setCameraReady={setCameraReady}
      capturedImage={capturedImage}
      setCapturedImage={setCapturedImage}
      setBorderStatus={setBorderStatus}
      setMessage={setMessage}
      captureFace={captureFace}
      onRegisterSubmit={handleRegisterSubmit}
      onBackToOtp={() => {
        setCapturedImage(null);
        setBorderStatus("idle");
        setMessage("Position your face in the oval");
        goToStep("otp", "back");
      }}
      webcamRef={webcamRef}
      canvasRef={canvasRef}
      overlay={overlay}
    />
  );
}
