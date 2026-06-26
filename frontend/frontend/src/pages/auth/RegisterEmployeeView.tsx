import { Link } from "react-router-dom";
import Webcam from "react-webcam";
import Input from "../../components/common/Input";
import Button from "../../components/common/Button";
import MessageOverlay from "../../components/chat/MessageOverlay";
import RegisterWizardLayout from "../../components/auth/RegisterWizardLayout";
import SearchableSelect from "../../components/auth/SearchableSelect";
import CvDropZone from "../../components/auth/CvDropZone";
import {
  BriefcaseBusiness,
  Mail,
  Phone,
  ScanFace,
  UserRound,
} from "lucide-react";
import type { RefObject } from "react";

type Step = "form" | "otp" | "face";
type VerifyMethod = "email" | "phone";
type BorderStatus = "idle" | "scanning" | "success" | "error";

const DEPARTMENTS = [
  "IT",
  "HR",
  "Finance",
  "Operations",
  "Sales",
  "Marketing",
];

const JOB_ROLES = [
  "Software Engineer",
  "Frontend Developer",
  "Backend Developer",
  "QA Engineer",
  "HR Executive",
  "Accountant",
  "Operations Executive",
  "Sales Executive",
  "Full Stack Developer",
  "DevOps Engineer",
  "UI/UX Designer",
  "Intern",
  "Project Manager",
];

export interface RegisterViewProps {
  step: Step;
  stepAnim: "wizard-step-forward" | "wizard-step-back";
  verifyMethod: VerifyMethod;
  setVerifyMethod: (m: VerifyMethod) => void;
  loading: boolean;
  error: string;
  setError: (v: string) => void;
  formData: {
    name: string;
    email: string;
    phone: string;
    department: string;
    designation: string;
  };
  setFormData: React.Dispatch<
    React.SetStateAction<{
      name: string;
      email: string;
      phone: string;
      department: string;
      designation: string;
    }>
  >;
  cvFileName: string;
  setCvFile: (v: string) => void;
  setCvFileName: (v: string) => void;
  fileToDataUrl: (file: File) => Promise<string>;
  isPdfFile: (file: File) => boolean;
  onContinue: () => void;
  otp: string;
  setOtp: (v: string) => void;
  otpVerified: boolean;
  resendCooldown: number;
  onVerifyOtp: () => void;
  onResendOtp: () => void;
  onBackToForm: () => void;
  borderStatus: BorderStatus;
  message: string;
  cameraReady: boolean;
  setCameraReady: (v: boolean) => void;
  capturedImage: string | null;
  setCapturedImage: (v: string | null) => void;
  setBorderStatus: (s: BorderStatus) => void;
  setMessage: (m: string) => void;
  captureFace: () => void;
  onRegisterSubmit: () => void;
  onBackToOtp: () => void;
  webcamRef: RefObject<Webcam | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  overlay: {
    title: string;
    message?: string;
    tone?: "info" | "success" | "error";
    loading?: boolean;
  } | null;
}

export default function RegisterEmployeeView(props: RegisterViewProps) {
  const {
    step,
    stepAnim,
    verifyMethod,
    setVerifyMethod,
    loading,
    error,
    setError,
    formData,
    setFormData,
    cvFileName,
    setCvFile,
    setCvFileName,
    fileToDataUrl,
    isPdfFile,
    onContinue,
    otp,
    setOtp,
    otpVerified,
    resendCooldown,
    onVerifyOtp,
    onResendOtp,
    onBackToForm,
    borderStatus,
    message,
    cameraReady,
    setCameraReady,
    capturedImage,
    setCapturedImage,
    setBorderStatus,
    setMessage,
    captureFace,
    onRegisterSubmit,
    onBackToOtp,
    webcamRef,
    canvasRef,
    overlay,
  } = props;

  return (
    <>
      {overlay && (
        <MessageOverlay
          title={overlay.title}
          message={overlay.message}
          tone={overlay.tone}
          loading={overlay.loading}
        />
      )}

      <RegisterWizardLayout step={step} animClass={stepAnim}>
        {step === "form" && (
          <div className="flex h-full flex-col">
            <header className="mb-6">
              <h2 className="text-2xl font-bold text-white sm:text-3xl">
                Create Employee Account
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Enter your details to begin secure onboarding
              </p>
            </header>

            <div className="grid flex-1 gap-4">
              <label className="block text-sm text-slate-300">
                Full Name *
                <div className="relative mt-2">
                  <UserRound
                    size={20}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <Input
                    type="text"
                    placeholder="Enter full name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 p-4 pl-12 text-white outline-none transition duration-300 placeholder:text-slate-500 focus:border-blue-500"
                  />
                </div>
              </label>

              <label className="block text-sm text-slate-300">
                Email Address *
                <div className="relative mt-2">
                  <Mail
                    size={20}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <Input
                    type="email"
                    placeholder="employee@company.com"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 p-4 pl-12 text-white outline-none transition duration-300 placeholder:text-slate-500 focus:border-blue-500"
                  />
                </div>
              </label>

              <label className="block text-sm text-slate-300">
                Phone Number
                <span className="ml-1 text-xs text-slate-500">(optional)</span>
                <div className="relative mt-2">
                  <Phone
                    size={20}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <Input
                    type="tel"
                    placeholder="+91 9876543210"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 p-4 pl-12 text-white outline-none transition duration-300 placeholder:text-slate-500 focus:border-blue-500"
                  />
                </div>
              </label>

              <CvDropZone
                fileName={cvFileName}
                onFileReady={(dataUrl, name) => {
                  setCvFile(dataUrl);
                  setCvFileName(name);
                  setError("");
                }}
                onClear={() => {
                  setCvFile("");
                  setCvFileName("");
                }}
                onError={setError}
                isPdfFile={isPdfFile}
                fileToDataUrl={fileToDataUrl}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <SearchableSelect
                  label="Department *"
                  value={formData.department}
                  options={DEPARTMENTS}
                  onChange={(department) =>
                    setFormData({ ...formData, department })
                  }
                  icon={<BriefcaseBusiness size={18} />}
                  placeholder="Search department..."
                />
                <SearchableSelect
                  label="Job Role *"
                  value={formData.designation}
                  options={JOB_ROLES}
                  onChange={(designation) =>
                    setFormData({ ...formData, designation })
                  }
                  icon={<BriefcaseBusiness size={18} />}
                  placeholder="Search role..."
                />
              </div>

              <div>
                <p className="mb-3 text-sm text-slate-300">Verify via</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setVerifyMethod("email")}
                    className={`verify-pill flex items-center gap-3 rounded-2xl border p-4 text-left text-sm font-semibold ${
                      verifyMethod === "email"
                        ? "verify-pill-active border-blue-400/60 bg-blue-500/15 text-blue-100"
                        : "border-slate-700 bg-slate-950/50 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    <Mail size={20} />
                    <span>
                      Email OTP
                      <span className="mt-0.5 block text-xs font-normal text-slate-400">
                        Recommended
                      </span>
                    </span>
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
                    className={`verify-pill flex items-center gap-3 rounded-2xl border p-4 text-left text-sm font-semibold ${
                      verifyMethod === "phone"
                        ? "verify-pill-active border-cyan-400/60 bg-cyan-500/15 text-cyan-100"
                        : "border-slate-700 bg-slate-950/50 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    <Phone size={20} />
                    <span>
                      SMS OTP
                      <span className="mt-0.5 block text-xs font-normal text-slate-500">
                        Coming soon
                      </span>
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-center text-sm text-red-300">
                {error}
              </div>
            )}

            <Button
              text={loading ? "Sending OTP..." : "Continue to verification"}
              onClick={onContinue}
              disabled={loading}
              className="mt-6 w-full bg-linear-to-r from-blue-600 to-cyan-500 p-4 font-bold text-white transition duration-300 hover:scale-[1.01] hover:shadow-xl hover:shadow-blue-500/30 disabled:cursor-not-allowed disabled:opacity-50"
            />

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-center">
              <p className="text-sm text-slate-400">Already registered?</p>
              <Link
                to="/"
                className="text-sm font-semibold text-blue-300 transition hover:text-blue-200"
              >
                Login
              </Link>
            </div>
          </div>
        )}

        {step === "otp" && (
          <div className="flex h-full flex-col justify-center">
            <header className="mb-6 text-center">
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-blue-500/30 bg-blue-500/10 text-blue-300">
                <Mail size={26} />
              </div>
              <h2 className="text-2xl font-bold text-white sm:text-3xl">
                Verify your email
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                We sent a 6-digit code to
              </p>
              <p className="mt-1 font-semibold text-blue-300">{formData.email}</p>
            </header>

            {otpVerified && (
              <div className="mb-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center text-sm text-emerald-300">
                Verified. Preparing face enrollment…
              </div>
            )}

            {error && (
              <div className="mb-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-center text-sm text-red-300">
                {error}
              </div>
            )}

            <label className="block text-sm text-slate-300">
              Enter OTP
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
                  if (e.key === "Enter") onVerifyOtp();
                }}
                className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950/80 p-4 text-center font-mono text-2xl tracking-[0.5em] text-white outline-none transition duration-300 focus:border-blue-500"
              />
            </label>

            <Button
              text={loading ? "Verifying..." : "Verify & continue"}
              onClick={onVerifyOtp}
              disabled={loading || otpVerified}
              className="mt-5 w-full bg-linear-to-r from-blue-600 to-cyan-500 p-4 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            />

            <div className="mt-4 text-center">
              {resendCooldown > 0 ? (
                <p className="text-sm text-slate-500">
                  Resend in{" "}
                  <span className="font-semibold text-blue-400">
                    {resendCooldown}s
                  </span>
                </p>
              ) : (
                <button
                  type="button"
                  onClick={onResendOtp}
                  disabled={loading}
                  className="text-sm font-semibold text-blue-400 transition hover:text-blue-300 disabled:opacity-50"
                >
                  Resend OTP
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onBackToForm}
              className="mt-6 text-sm text-slate-400 transition hover:text-white"
            >
              ← Back to employee details
            </button>
          </div>
        )}

        {step === "face" && (
          <div className="flex h-full flex-col">
            <header className="mb-5 text-center">
              <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                <ScanFace size={26} />
              </div>
              <h2 className="text-2xl font-bold text-white">Face enrollment</h2>
              <p className="mt-1 text-sm text-slate-400">
                Position your face inside the oval guide
              </p>
            </header>

            <div
              className={`relative mx-auto aspect-video w-full max-w-2xl overflow-hidden rounded-3xl ring-4 shadow-xl transition-all duration-300 ${
                borderStatus === "success"
                  ? "ring-emerald-500 shadow-emerald-500/30"
                  : borderStatus === "error"
                    ? "ring-red-500 shadow-red-500/30"
                    : borderStatus === "scanning"
                      ? "ring-amber-400 shadow-amber-400/25"
                      : "ring-white/20"
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
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <img
                  src={capturedImage}
                  alt="Captured face"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}
              <canvas
                ref={canvasRef}
                width={600}
                height={400}
                className="absolute inset-0 h-full w-full"
              />
            </div>

            <p
              className={`mt-4 text-center text-sm font-medium ${
                borderStatus === "success"
                  ? "text-emerald-400"
                  : borderStatus === "error"
                    ? "text-red-400"
                    : borderStatus === "scanning"
                      ? "text-amber-300"
                      : "text-slate-300"
              }`}
            >
              {message}
            </p>

            {error && (
              <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-center text-sm text-red-300">
                {error}
              </div>
            )}

            <div className="mt-5 flex flex-col items-center gap-3">
              {borderStatus === "success" ? (
                <Button
                  onClick={onRegisterSubmit}
                  disabled={loading}
                  loading={loading}
                  text={loading ? "Registering..." : "Complete registration"}
                  className="w-full max-w-md bg-emerald-600 px-8 py-3 text-white hover:bg-emerald-500 sm:w-auto"
                />
              ) : (
                <Button
                  onClick={() => {
                    setBorderStatus("scanning");
                    setMessage("Position your face in the oval");
                    captureFace();
                  }}
                  disabled={!cameraReady || borderStatus === "scanning"}
                  loading={borderStatus === "scanning"}
                  text={borderStatus === "scanning" ? "Checking..." : "Capture face"}
                  className="w-full max-w-md bg-blue-600 px-8 py-3 text-white hover:bg-blue-500 sm:w-auto"
                />
              )}

              {capturedImage && borderStatus !== "success" && (
                <button
                  type="button"
                  onClick={() => {
                    setCapturedImage(null);
                    setBorderStatus("idle");
                    setMessage("Position your face in the oval");
                  }}
                  className="text-sm text-slate-400 transition hover:text-white"
                >
                  Retake photo
                </button>
              )}

              <button
                type="button"
                onClick={onBackToOtp}
                className="text-sm text-slate-500 transition hover:text-slate-300"
              >
                ← Back to verification
              </button>
            </div>
          </div>
        )}
      </RegisterWizardLayout>
    </>
  );
}
