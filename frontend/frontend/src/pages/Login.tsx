// src/pages/Login.tsx

import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import API from "../services/api";
import Button from "../components/Button";
import MessageOverlay from "../components/MessageOverlay";

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

        setSuccess("✅ Login successful! Redirecting to face verification...");

        setOverlay({
          title: "Login successful",
          message: "Opening face verification now.",
          loading: true,
        });

        setTimeout(() => {
          navigate("/verify-face", { replace: true });
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
      handleLogin();
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-[#020617] via-[#0f172a] to-[#111827] flex items-center justify-center p-6 relative overflow-hidden">
      {overlay && (
        <MessageOverlay
          title={overlay.title}
          message={overlay.message}
          loading={overlay.loading}
          tone="info"
        />
      )}
      {/* BACKGROUND GLOW */}
      <div className="absolute -top-30 -left-25 w-87.5 h-87.5 bg-blue-500/20 blur-3xl rounded-full"></div>

      <div className="absolute -bottom-30px -right-25px w-87.5 h-87.5 bg-cyan-500/20 blur-3xl rounded-full"></div>

      {/* LOGIN CARD */}
      <div className="relative w-full max-w-md bg-white/5 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-[36px] p-5">
        {/* LOGO */}
        <div className="text-center mb-5">
          <div className="mx-auto rounded-[28px] flex items-center justify-center text-2xl ">
            🏢
          </div>

          <h1 className="text-4xl font-bold text-white mt-1">Attendance</h1>

          <p className="text-slate-400 mt-1 text-sm">
            Smart Face Recognition System
          </p>

          {/* LOGIN SWITCH */}
          <div className="flex gap-3 mt-4 bg-slate-900/60 p-2 rounded-2xl border border-white/5">
            {/* EMPLOYEE */}
            <Button
              text="Employee"
              className="flex-1 bg-linear-to-r from-blue-600 to-cyan-500 text-white py-3 rounded-xl font-semibold shadow-lg shadow-blue-500/20 cursor-pointer"
            />

            {/* ADMIN */}
            <Button
              text="Admin"
              onClick={() => navigate("/admin-login", { replace: true })}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-xl font-semibold transition cursor-pointer"
            />
          </div>
        </div>

        {/* SUCCESS */}
        {success && (
          <div className="bg-green-500/10 border border-green-500/30 text-green-300 p-4 rounded-2xl mb-5 text-center text-sm">
            {success}
          </div>
        )}

        {/* ERROR */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-4 rounded-2xl mb-5 text-center text-sm">
            {error}
          </div>
        )}

        {/* FORM */}
        <div className="space-y-5">
          <form className="mb-0">
            <label className="text-slate-300 text-sm mb-2 block">
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
              className="w-full p-4 rounded-2xl bg-slate-900/70 border border-slate-700 text-white placeholder-slate-500 outline-none focus:border-blue-500 transition"
            />

            {/* PASSWORD */}
            <div className="mb-0">
              <label className="text-slate-300 text-sm mb-2 block">
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
                  className="w-full p-4 rounded-2xl bg-slate-900/70 border border-slate-700 text-white placeholder-slate-500 outline-none focus:border-blue-500 transition pr-14"
                />

                {/* SHOW PASSWORD */}
                <Button
                  text={showPassword ? "🙈" : "👁️"}
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition cursor-pointer"
                />
              </div>

              {/* FORGOT PASSWORD */}
              <div className="flex justify-end">
                <Button
                  text="Forgot Password?"
                  onClick={() => navigate("/forgot-password")}
                  className="text-sm text-blue-400 hover:text-blue-300 transition cursor-pointer"
                />
              </div>
            </div>
          </form>

          {/* LOGIN BUTTON */}
          <Button
            text={loading ? "Verifying..." : "Login"}
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-linear-to-r from-blue-600 to-cyan-500 hover:scale-[1.02] hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-300 p-4 rounded-2xl text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed mt-2 cursor-pointer"
          />

          {/* FACE VERIFY INFO */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 text-center">
            <p className="text-blue-300 text-sm">
              ℹ️ Face verification required after login
            </p>
          </div>

          {/* REGISTER */}
          <div className="text-center pt-2 flex gap-2 items-center justify-center">
            <p className="text-slate-400 text-sm">Don't have an account?</p>

            <Link
              to="/admin-create-employee"
              className="text-blue-400 hover:text-blue-300 font-semibold transition"
            >
              Register Here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
