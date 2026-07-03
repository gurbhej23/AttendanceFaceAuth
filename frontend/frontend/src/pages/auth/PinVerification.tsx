import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../services/api";
import { notifyAuthChanged } from "../../hooks/useEmployeeSession";
import MessageOverlay from "../../components/chat/MessageOverlay";
import Button from "../../components/common/Button";
import { ArrowLeft, KeyRound } from "lucide-react";

const getApiError = (err: unknown, fallback: string): string => {
  const e = err as { response?: { data?: { error?: string } } };
  return e.response?.data?.error || fallback;
};

export default function PinVerification() {
  const navigate = useNavigate();
  const employeeId = localStorage.getItem("employee_id") || "";
  const employeeName = localStorage.getItem("employee_name") || "Employee";

  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
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
      return;
    }
    if (localStorage.getItem("has_pin") !== "1") {
      navigate("/verify-choice", { replace: true });
    }
  }, [employeeId, navigate]);

  const verifyPin = async () => {
    const code = pin.trim();
    if (!code || code.length < 4) {
      setError("Enter your 4–6 digit attendance PIN");
      return;
    }

    setLoading(true);
    setError("");
    setOverlay({
      title: "Verifying PIN",
      message: "Please wait...",
      loading: true,
    });

    try {
      const res = await API.post("/attendance/verify-pin/", {
        employee_id: employeeId,
        pin: code,
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
          title: "PIN verified",
          message: "Welcome back. Opening your dashboard.",
          tone: "success",
          loading: true,
        });
        setTimeout(() => navigate("/dashboard", { replace: true }), 1400);
      } else {
        setError(res.data.error || "Invalid PIN");
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
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-amber-600 text-white">
            <KeyRound size={30} />
          </div>
          <h1 className="text-2xl font-bold text-white">Attendance PIN</h1>
          <p className="mt-2 text-sm text-slate-400">{employeeName}</p>
          <p className="mt-2 text-xs text-amber-200/80">
            Enter the PIN you set during registration
          </p>
        </div>

        {error && (
          <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-center text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="mt-6 space-y-4">
          <div>
            <label className="mb-2 block text-sm text-slate-300">Attendance PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              autoComplete="off"
              value={pin}
              onChange={(e) =>
                setPin(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") verifyPin();
              }}
              placeholder="••••••"
              className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 p-4 text-center font-mono text-2xl tracking-[0.4em] text-white outline-none focus:border-amber-500"
            />
          </div>

          <Button
            text={loading ? "Verifying..." : "Verify & continue"}
            onClick={verifyPin}
            disabled={loading}
            className="w-full bg-linear-to-r from-amber-600 to-orange-500 py-3.5 font-bold text-white disabled:opacity-50"
          />
        </div>
      </div>
    </div>
  );
}
