// src/pages/Login.tsx

import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import API from "../../services/api";
import Button from "../../components/common/Button";
import MessageOverlay from "../../components/chat/MessageOverlay";
import { Eye, EyeOff, UserRound } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    employee_id: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState("");
  const [overlay, setOverlay] = useState<{
    title: string;
    message?: string;
    loading?: boolean;
  } | null>(null);

  const handleLogin = async () => {
    if (!formData.employee_id || !formData.password) {
      setError("Employee ID and password required");
      return;
    }

    setLoading(true);
    setError("");
    setOverlay({
      title: "Checking credentials",
      message: "Please wait while we verify your employee account.",
      loading: true,
    });

    try {
      const response = await API.post("/employees/login/", {
        employee_id: formData.employee_id,
        password: formData.password,
      });

      if (response.data.success) {
        const empId = response.data.employee_id;
        const empName = response.data.name;
        const token = response.data.access || "authenticated";
        const role = response.data.role || "employee";

        localStorage.setItem("token", token);
        localStorage.setItem("employee_id", empId);
        localStorage.setItem("employee_name", empName);
        localStorage.setItem("role", role);
        localStorage.setItem("profile_img", response.data.profile_img || "");
        localStorage.setItem("cv_file", response.data.cv_file || "");

        setSuccess("Login successful. Choose your verification method...");

        setOverlay({
          title: "Login successful",
          message: "Choose face or email OTP verification.",
          loading: true,
        });

        setTimeout(() => {
          navigate("/verify-choice", { replace: true });
        }, 1000);
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || "Invalid credentials");
      setOverlay(null);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleLogin();
    }
  };

  return (
    <div className="relative flex flex-col min-h-screen items-center justify-center overflow-hidden bg-linear-to-br from-[#020617] via-[#0f172a] to-[#111827] p-6">
      {overlay && (
        <MessageOverlay
          title={overlay.title}
          message={overlay.message}
          loading={overlay.loading}
          tone="info"
        />
      )}

      <div className="w-80 mb-5 grid grid-cols-2 gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-2">
        <Button
          text="Employee"
          className="bg-linear-to-r from-blue-600 to-cyan-500 py-3 text-white shadow-lg shadow-blue-500/20 cursor-pointer"
        />

        <Button
          text="Admin"
          onClick={() => navigate("/admin-login", { replace: true })}
          className="bg-slate-800/80 py-3 text-slate-300 hover:bg-slate-700 cursor-pointer"
        />
      </div>

      {/* <div className="absolute -left-25 -top-30 h-87.5 w-87.5 rounded-full bg-blue-500/20 blur-3xl" />
      <div className="absolute -bottom-30 -right-25 h-87.5 w-87.5 rounded-full bg-cyan-500/20 blur-3xl" /> */}

      <div className="relative grid w-full max-w-3xl gap-5 rounded-[36px] border border-white/15 bg-white/8 p-5 shadow-2xl backdrop-blur-2xl lg:grid-cols-[270px_1fr]">
        <section className="rounded-[28px] border border-white/12 bg-white/8 p-4 text-center shadow-inner">
          <p className="text-lg font-semibold text-slate-100">Selected User</p>

          <div className="relative mx-auto mt-5 flex h-36 w-36 items-center justify-center rounded-full border border-cyan-300/30 bg-slate-950/70 shadow-xl shadow-cyan-500/10">
            <div className="absolute left-5 top-5 h-6 w-6 border-l-2 border-t-2 border-cyan-300" />
            <div className="absolute right-5 top-5 h-6 w-6 border-r-2 border-t-2 border-cyan-300" />
            <div className="absolute bottom-5 left-5 h-6 w-6 border-b-2 border-l-2 border-cyan-300" />
            <div className="absolute bottom-5 right-5 h-6 w-6 border-b-2 border-r-2 border-cyan-300" />
            <div className="absolute h-0.5 w-28 bg-cyan-300/80 shadow-lg shadow-cyan-300" />
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-linear-to-br from-slate-700 to-slate-900 text-cyan-100">
              <UserRound size={58} strokeWidth={1.6} />
            </div>
          </div> 
          <h1 className="mt-4 text-3xl font-bold text-white">Attendance</h1>
          <p className="mt-1 text-xs text-slate-400">
            Smart Face Recognition System
          </p>
        </section>

        <section className="rounded-[28px] border border-white/12 bg-white/8 p-5 shadow-inner">
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
          >
            <div>
              <label className="mb-2 block text-sm text-slate-200">
                Employee ID
              </label>
              <input
                type="text"
                placeholder="Enter employee ID"
                value={formData.employee_id}
                autoComplete="username"
                name="username"
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    employee_id: e.target.value,
                  })
                }
                onKeyDown={handleKeyPress}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 p-4 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-200">
                Password
              </label>

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter password"
                  value={formData.password}
                  autoComplete="current-password"
                  name="password"
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      password: e.target.value,
                    })
                  }
                  onKeyDown={handleKeyPress}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 p-4 pr-14 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500"
                />

                <Button
                  text={showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  text="Forgot Password?"
                  onClick={() => navigate("/forgot-password")}
                  className="mt-2 text-sm text-blue-300 hover:text-blue-200 cursor-pointer"
                />
              </div>
            </div>
            {success && (
              <div className="mb-5 rounded-2xl border border-green-500/30 bg-green-500/10 p-4 text-center text-sm text-green-300">
                {success}
              </div>
            )}

            {error && (
              <div className="mb-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-center text-sm text-red-300">
                {error}
              </div>
            )}

            <Button
              text={loading ? "Verifying..." : "Login"}
              type="submit"
              disabled={loading}
              className="w-full bg-linear-to-r from-blue-600 to-cyan-500 p-4 text-white font-bold hover:scale-[1.01] hover:shadow-xl hover:shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            />
          </form>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-center">
            <p className="text-sm text-slate-400">Don't have an account?</p>

            <Link
              to="/register"
              className="text-sm font-semibold text-blue-300 transition hover:text-blue-200"
            >
              Register Here
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
