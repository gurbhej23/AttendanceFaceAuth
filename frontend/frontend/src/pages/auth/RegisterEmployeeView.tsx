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
  KeyRound,
  Mail,
  Phone,
  ScanFace,
  UserRound,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import type { RefObject } from "react";
import { useMemo } from "react";
import {
  DEPARTMENTS,
  getJobRolesForDepartment,
  pickDesignationForDepartment,
} from "../../constants/departments";

type Step = "form" | "otp" | "method" | "face" | "pin";
type VerifyMethod = "email" | "phone";
type RegistrationMethod = "face" | "pin";
type BorderStatus = "idle" | "scanning" | "success" | "error";

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
  onBackToMethod: () => void;
  registrationMethod: RegistrationMethod;
  setRegistrationMethod: (m: RegistrationMethod) => void;
  attendancePin: string;
  setAttendancePin: (v: string) => void;
  confirmPin: string;
  setConfirmPin: (v: string) => void;
  onSelectMethod: (method: RegistrationMethod) => void;
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
    onBackToMethod,
    attendancePin,
    setAttendancePin,
    confirmPin,
    setConfirmPin,
    onSelectMethod,
    webcamRef,
    canvasRef,
    overlay,
  } = props;

  const jobRoleOptions = useMemo(
    () => getJobRolesForDepartment(formData.department, formData.designation),
    [formData.department, formData.designation],
  );

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
        {/* ─── STEP 1: EMPLOYEE DETAILS ─────────────────────────────────── */}
        {step === "form" && (
          <div className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Full Name <span className="text-cyan-400">*</span>
                </label>
                <div className="relative">
                  <UserRound
                    size={15}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <Input
                    type="text"
                    placeholder="e.g. John Doe"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/90 py-2.5 pl-10 pr-3 text-xs sm:text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30"
                  />
                </div>
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Email Address <span className="text-cyan-400">*</span>
                </label>
                <div className="relative">
                  <Mail
                    size={15}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <Input
                    type="email"
                    placeholder="john.doe@company.com"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/90 py-2.5 pl-10 pr-3 text-xs sm:text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30"
                  />
                </div>
              </div>

              {/* Department */}
              <div>
                <SearchableSelect
                  label="Department *"
                  value={formData.department}
                  options={[...DEPARTMENTS]}
                  onChange={(department) =>
                    setFormData((prev) => ({
                      ...prev,
                      department,
                      designation: pickDesignationForDepartment(
                        department,
                        prev.designation,
                      ),
                    }))
                  }
                  icon={<BriefcaseBusiness size={15} />}
                  placeholder="Select department..."
                />
              </div>

              {/* Job Role */}
              <div>
                <SearchableSelect
                  label="Job Designation / Role *"
                  value={formData.designation}
                  options={jobRoleOptions}
                  onChange={(designation) =>
                    setFormData((prev) => ({ ...prev, designation }))
                  }
                  icon={<BriefcaseBusiness size={15} />}
                  placeholder="Select role..."
                />
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Phone Number <span className="text-slate-500 font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <Phone
                    size={15}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <Input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/90 py-2.5 pl-10 pr-3 text-xs sm:text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30"
                  />
                </div>
              </div>

              {/* CV Upload */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Resume / CV (PDF) <span className="text-cyan-400">*</span>
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
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                <AlertCircle size={15} className="shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            <Button
              text={loading ? "Sending OTP..." : "Continue to Verification"}
              onClick={onContinue}
              disabled={loading}
              className="mt-2 w-full rounded-2xl bg-gradient-to-r from-blue-600 via-cyan-600 to-cyan-500 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-500/20 transition hover:from-blue-500 hover:to-cyan-400 disabled:opacity-50 cursor-pointer"
            />

            <div className="flex items-center justify-center gap-1.5 pt-1 text-center text-xs text-slate-400">
              <span>Already registered?</span>
              <Link
                to="/"
                className="font-semibold text-cyan-400 hover:text-cyan-300 transition underline underline-offset-2"
              >
                Sign In here
              </Link>
            </div>
          </div>
        )}

        {/* ─── STEP 2: EMAIL OTP VERIFICATION ─────────────────────────── */}
        {step === "otp" && (
          <div className="flex flex-col items-center text-center py-2">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 shadow-inner">
              <Mail size={24} />
            </div>
            <h2 className="text-xl font-bold text-white sm:text-2xl">
              Verify Your Email
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              We sent a 6-digit verification code to
            </p>
            <p className="mt-0.5 font-mono text-sm font-semibold text-cyan-300">
              {formData.email}
            </p>

            {otpVerified && (
              <div className="mt-4 flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs font-semibold text-emerald-300">
                <CheckCircle2 size={16} className="text-emerald-400" />
                Verified successfully! Advancing...
              </div>
            )}

            {error && (
              <div className="mt-4 flex items-center justify-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-300">
                <AlertCircle size={15} className="text-red-400" />
                {error}
              </div>
            )}

            <div className="mt-5 w-full max-w-xs">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                autoFocus
                placeholder="••••••"
                value={otp}
                onChange={(e) => {
                  setOtp(e.target.value.replace(/\D/g, ""));
                  setError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onVerifyOtp();
                }}
                className="w-full rounded-2xl border border-slate-700 bg-slate-900/90 py-3.5 text-center font-mono text-2xl tracking-[0.4em] text-white outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
              />

              <Button
                text={loading ? "Verifying..." : "Verify Code"}
                onClick={onVerifyOtp}
                disabled={loading || otpVerified || otp.length < 6}
                className="mt-4 w-full rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 py-3 text-sm font-bold text-white shadow-md shadow-cyan-500/20 hover:from-blue-500 hover:to-cyan-400 disabled:opacity-50 cursor-pointer"
              />

              <div className="mt-3.5">
                {resendCooldown > 0 ? (
                  <p className="text-xs text-slate-500">
                    Resend code in <span className="font-semibold text-cyan-400">{resendCooldown}s</span>
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={onResendOtp}
                    disabled={loading}
                    className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition cursor-pointer disabled:opacity-50"
                  >
                    Resend OTP Code
                  </button>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onBackToForm}
              className="mt-6 inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition cursor-pointer"
            >
              <ArrowLeft size={14} /> Back to details
            </button>
          </div>
        )}

        {/* ─── STEP 3: SELECT SETUP METHOD ────────────────────────────── */}
        {step === "method" && (
          <div className="py-2 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 mx-auto shadow-inner">
              <ShieldCheck size={24} />
            </div>
            <h2 className="text-xl font-bold text-white sm:text-2xl">
              Account Security Setup
            </h2>
            <p className="mt-1 text-xs text-slate-400 mb-6">
              Choose your primary verification method for daily attendance
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-left">
              {/* Face Enrollment Option */}
              <button
                type="button"
                onClick={() => onSelectMethod("face")}
                className="group relative flex flex-col justify-between rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-5 transition-all hover:border-cyan-400 hover:bg-cyan-900/30 hover:shadow-lg hover:shadow-cyan-500/10 cursor-pointer"
              >
                <div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md mb-3 group-hover:scale-105 transition-transform">
                    <ScanFace size={22} />
                  </div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-base">Face Enrollment</h3>
                    <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold text-cyan-300 border border-cyan-500/30">
                      Recommended
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                    AI biometric face recognition for touchless and secure check-in.
                  </p>
                </div>
                <span className="mt-4 inline-flex items-center text-xs font-semibold text-cyan-400 group-hover:translate-x-0.5 transition-transform">
                  Setup Face Scan →
                </span>
              </button>

              {/* PIN Option */}
              <button
                type="button"
                onClick={() => onSelectMethod("pin")}
                className="group relative flex flex-col justify-between rounded-2xl border border-amber-500/30 bg-amber-950/20 p-5 transition-all hover:border-amber-400 hover:bg-amber-900/30 hover:shadow-lg hover:shadow-amber-500/10 cursor-pointer"
              >
                <div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md mb-3 group-hover:scale-105 transition-transform">
                    <KeyRound size={22} />
                  </div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-base">Attendance PIN</h3>
                    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30">
                      Fast
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
                    Create a confidential 4–6 digit security PIN code.
                  </p>
                </div>
                <span className="mt-4 inline-flex items-center text-xs font-semibold text-amber-400 group-hover:translate-x-0.5 transition-transform">
                  Setup PIN Code →
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={onBackToOtp}
              className="mt-6 inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition cursor-pointer"
            >
              <ArrowLeft size={14} /> Back to email step
            </button>
          </div>
        )}

        {/* ─── STEP 4A: PIN REGISTRATION ───────────────────────────────── */}
        {step === "pin" && (
          <div className="flex flex-col items-center text-center py-2">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-400 shadow-inner">
              <KeyRound size={24} />
            </div>
            <h2 className="text-xl font-bold text-white sm:text-2xl">
              Set Attendance PIN
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Create a 4–6 digit PIN for daily verification
            </p>

            {error && (
              <div className="mt-4 flex items-center justify-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-300">
                <AlertCircle size={15} className="text-red-400" />
                {error}
              </div>
            )}

            <div className="mt-5 w-full max-w-xs space-y-3.5 text-left">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Create PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  autoFocus
                  placeholder="••••••"
                  value={attendancePin}
                  onChange={(e) => {
                    setAttendancePin(e.target.value.replace(/\D/g, "").slice(0, 6));
                    setError("");
                  }}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-900/90 py-3 text-center font-mono text-2xl tracking-[0.35em] text-white outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Confirm PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="••••••"
                  value={confirmPin}
                  onChange={(e) => {
                    setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6));
                    setError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onRegisterSubmit();
                  }}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-900/90 py-3 text-center font-mono text-2xl tracking-[0.35em] text-white outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/20"
                />
              </div>

              <Button
                text={loading ? "Creating Account..." : "Complete Registration"}
                onClick={onRegisterSubmit}
                disabled={loading || attendancePin.length < 4}
                loading={loading}
                className="mt-2 w-full rounded-2xl bg-gradient-to-r from-amber-600 to-orange-500 py-3 text-sm font-bold text-white shadow-md shadow-amber-500/20 hover:from-amber-500 hover:to-orange-400 disabled:opacity-50 cursor-pointer"
              />
            </div>

            <button
              type="button"
              onClick={onBackToMethod}
              className="mt-5 inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition cursor-pointer"
            >
              <ArrowLeft size={14} /> Choose another method
            </button>
          </div>
        )}

        {/* ─── STEP 4B: FACE ENROLLMENT ───────────────────────────────── */}
        {step === "face" && (
          <div className="flex flex-col items-center text-center py-1">
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 shadow-inner">
              <ScanFace size={20} />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white">
              Enroll Face Profile
            </h2>
            <p className="text-xs text-slate-400 mb-3">
              Position your face clearly within the frame
            </p>

            {/* Viewport Frame */}
            <div
              className={`relative mx-auto aspect-video w-full max-w-sm overflow-hidden rounded-2xl border-2 transition-all duration-300 ${
                borderStatus === "success"
                  ? "border-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.3)]"
                  : borderStatus === "error"
                  ? "border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.3)]"
                  : borderStatus === "scanning"
                  ? "border-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.3)]"
                  : "border-slate-700 shadow-xl"
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
                width={450}
                height={300}
                className="absolute inset-0 h-full w-full"
              />
            </div>

            <p
              className={`mt-2.5 text-xs font-semibold ${
                borderStatus === "success"
                  ? "text-emerald-400"
                  : borderStatus === "error"
                  ? "text-red-400"
                  : borderStatus === "scanning"
                  ? "text-cyan-300"
                  : "text-slate-300"
              }`}
            >
              {message}
            </p>

            {error && (
              <div className="mt-2 flex items-center justify-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                <AlertCircle size={14} className="text-red-400 shrink-0" />
                {error}
              </div>
            )}

            <div className="mt-4 flex w-full max-w-xs flex-col items-center gap-2">
              {borderStatus === "success" ? (
                <Button
                  onClick={onRegisterSubmit}
                  disabled={loading}
                  loading={loading}
                  text={loading ? "Registering..." : "Complete Registration"}
                  className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 hover:from-emerald-500 hover:to-teal-400 cursor-pointer"
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
                  text={borderStatus === "scanning" ? "Scanning..." : "Capture Photo"}
                  className="w-full rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-500/25 hover:from-cyan-500 hover:to-blue-500 cursor-pointer"
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
                  className="text-xs text-slate-400 hover:text-white transition cursor-pointer"
                >
                  Retake photo
                </button>
              )}

              <button
                type="button"
                onClick={onBackToMethod}
                className="mt-1 text-xs text-slate-500 hover:text-slate-300 transition cursor-pointer"
              >
                ← Choose another method
              </button>
            </div>
          </div>
        )}
      </RegisterWizardLayout>
    </>
  );
}
