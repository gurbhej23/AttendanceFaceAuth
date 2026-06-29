import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../services/api";
import { notifyAuthChanged } from "../../hooks/useEmployeeSession";
import MessageOverlay from "../../components/chat/MessageOverlay";
import Button from "../../components/common/Button";
import { ArrowLeft, Mail } from "lucide-react";

const getApiError = (err: unknown, fallback: string): string => {
  const e = err as { response?: { data?: { error?: string } } };
  return e.response?.data?.error || fallback;
};

export default function EmailOtpVerification() {
  const navigate = useNavigate();
  const employeeId = localStorage.getItem("employee_id") || "";
  const employeeName = localStorage.getItem("employee_name") || "Employee";

  const [otp, setOtp] = useState("");
  const [emailHint, setEmailHint] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [overlay, setOverlay] = useState<{
    title: string;
    message?: string;
    tone?: "info" | "success" | "error";
    loading?: boolean;
  } | null>(null);

  useEffect(() => {
    if (!employeeId || employeeId === "undefined") {
      localStorage.clear();
      navigate("/", { replace: true });
    }
  }, [employeeId, navigate]);

  const sendOtp = useCallback(async () => {
    setSending(true);
    setError("");
    try {
      const res = await API.post("/attendance/send-verify-otp/", {
        employee_id: employeeId,
      });
      if (res.data.success) {
        setOtpSent(true);
        setEmailHint(res.data.email_hint || "");
      } else {
        setError(res.data.error || "Could not send OTP");
      }
    } catch (err) {
      setError(getApiError(err, "Could not send OTP"));
    } finally {
      setSending(false);
    }
  }, [employeeId]);

  useEffect(() => {
    if (employeeId) void sendOtp();
  }, [employeeId, sendOtp]);

  const verifyOtp = async () => {
    const code = otp.trim();
    if (!code) {
      setError("Please enter the OTP from your email");
      return;
    }

    setLoading(true);
    setError("");
    setOverlay({
      title: "Verifying OTP",
      message: "Please wait...",
      loading: true,
    });

    try {
      const res = await API.post("/attendance/verify-otp/", {
        employee_id: employeeId,
        otp: code,
      });

      if (res.data.success) {
        if (res.data.employee_id) {
          localStorage.setItem("employee_id", res.data.employee_id);
        }
        if (res.data.employee_name) {
          localStorage.setItem("employee_name", res.data.employee_name);
        }
        if (res.data.profile_img) {
          localStorage.setItem("profile_img", res.data.profile_img);
        }
        if (res.data.cv_file) {
          localStorage.setItem("cv_file", res.data.cv_file);
        }
        notifyAuthChanged();

        setOverlay({
          title: "Email verified",
          message: "Welcome back. Opening your dashboard.",
          tone: "success",
          loading: true,
        });
        setTimeout(() => navigate("/dashboard", { replace: true }), 1600);
      } else {
        setError(res.data.error || "Invalid OTP");
        setOverlay(null);
      }
    } catch (err) {
      setError(getApiError(err, "Verification failed"));
      setOverlay(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center overflow-hidden bg-linear-to-br from-[#020617] via-[#0f172a] to-[#111827] p-6">
      {overlay && (
        <MessageOverlay
          title={overlay.title}
          message={overlay.message}
          tone={overlay.tone}
          loading={overlay.loading}
        />
      )}

      <div className="relative w-full max-w-md rounded-[36px] border border-white/15 bg-white/8 p-8 shadow-2xl backdrop-blur-2xl">
        <button
          type="button"
          onClick={() => navigate("/verify-choice", { replace: true })}
          className="mb-4 flex items-center gap-2 text-sm text-slate-400 hover:text-white cursor-pointer"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        <div className="text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-violet-600 text-white">
            <Mail size={30} />
          </div>
          <h1 className="text-2xl font-bold text-white">Email OTP Verification</h1>
          <p className="mt-2 text-sm text-slate-400">{employeeName}</p>
          {emailHint && (
            <p className="mt-2 text-xs text-violet-300">
              Code sent to {emailHint}
            </p>
          )}
        </div>

        {error && (
          <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-center text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="mt-6 space-y-4">
          <div>
            <label className="mb-2 block text-sm text-slate-300">
              Enter 6-digit OTP
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) =>
                setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  verifyOtp();
                }
              }}
              placeholder="000000"
              className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 p-4 text-center text-2xl tracking-[0.4em] text-white outline-none focus:border-violet-500"
            />
          </div>

          <Button
            type="button"
            onClick={verifyOtp}
            disabled={loading || otp.length < 6}
            loading={loading}
            text={loading ? "Verifying..." : "Verify & Continue"}
            className="w-full bg-violet-600 py-4 text-white hover:bg-violet-700"
          />

          <Button
            type="button"
            onClick={sendOtp}
            disabled={sending}
            loading={sending}
            text={sending ? "Sending..." : otpSent ? "Resend OTP" : "Send OTP"}
            className="w-full border border-slate-700 py-3 text-sm text-slate-300 hover:bg-slate-800"
          />
        </div>
      </div>
    </div>
  );
}
