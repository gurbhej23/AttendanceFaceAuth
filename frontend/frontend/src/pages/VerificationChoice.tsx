import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, ScanFace } from "lucide-react";
import Button from "../components/common/Button";

export default function VerificationChoice() {
  const navigate = useNavigate();
  const employeeName = localStorage.getItem("employee_name") || "Employee";

  useEffect(() => {
    const id = localStorage.getItem("employee_id");
    if (!id || id === "undefined") {
      localStorage.clear();
      navigate("/", { replace: true });
    }
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center overflow-hidden bg-linear-to-br from-[#020617] via-[#0f172a] to-[#111827] p-6">
      {/* <div className="absolute -left-25 -top-30 h-87.5 w-87.5 rounded-full bg-blue-500/20 blur-3xl" />
      <div className="absolute -bottom-30 -right-25 h-87.5 w-87.5 rounded-full bg-cyan-500/20 blur-3xl" /> */}

      <div className="relative w-full max-w-lg rounded-[36px] border border-white/15 bg-white/8 p-8 shadow-2xl backdrop-blur-2xl">
        <div className="text-center">
          <p className="text-sm text-slate-400">Welcome back</p>
          <h1 className="mt-2 text-3xl font-bold text-white">{employeeName}</h1>
          <p className="mt-3 text-slate-400">
            Choose how you want to verify your attendance login
          </p>
        </div>

        <div className="mt-8 grid gap-4">
          <button
            type="button"
            onClick={() => navigate("/verify-face", { replace: true })}
            className="flex items-center gap-4 rounded-3xl border border-cyan-500/30 bg-cyan-600/15 p-5 text-left transition hover:border-cyan-400 hover:bg-cyan-600/25 cursor-pointer"
          >
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-cyan-600 text-white">
              <ScanFace size={28} />
            </div>
            <div>
              <p className="text-lg font-bold text-white">Face Verification</p>
              <p className="mt-1 text-sm text-slate-400">
                Use your camera and face profile
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate("/verify-otp", { replace: true })}
            className="flex items-center gap-4 rounded-3xl border border-violet-500/30 bg-violet-600/15 p-5 text-left transition hover:border-violet-400 hover:bg-violet-600/25 cursor-pointer"
          >
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-violet-600 text-white">
              <Mail size={28} />
            </div>
            <div>
              <p className="text-lg font-bold text-white">Email OTP Verify</p>
              <p className="mt-1 text-sm text-slate-400">
                Receive a code on your registered email
              </p>
            </div>
          </button>
        </div>

        <Button
          type="button"
          onClick={() => {
            localStorage.clear();
            navigate("/", { replace: true });
          }}
          text="Back to login"
          className="mt-6 w-full border border-slate-700 py-3 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-200"
        />
      </div>
    </div>
  );
}
