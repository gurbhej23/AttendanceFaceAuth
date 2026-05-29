import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import Button from "../components/Button";
import Input from "../components/Input";
import { Eye, EyeOff } from "lucide-react";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ employee_id: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);

  const handleLogin = async () => {
    if (!formData.employee_id || !formData.password) {
      setError("Employee ID and password required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await API.post("/employees/admin-login/", {
        employee_id: formData.employee_id,
        password: formData.password,
      });

      if (response.data.success) {
        const empId = response.data.employee_id;
        const empName = response.data.name;
        const token = response.data.access || "authenticated";
        const role = String(response.data.role || "").toLowerCase();

        if (role !== "admin" && role !== "hr") {
          setError("Access denied. Admin or HR role required.");
          return;
        }

        localStorage.setItem("token", token);
        localStorage.setItem("employee_id", empId);
        localStorage.setItem("employee_name", empName);
        localStorage.setItem("role", role);

        navigate("/attendance-sheet", { replace: true });
      } else {
        setError(response.data.error || "Admin login failed");
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || "Invalid credentials");
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
    <div className="min-h-screen bg-linear-to-br from-[#020617] via-[#0f172a] to-[#111827] flex items-center justify-center p-6 relative overflow-hidden">
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
          <h1 className="text-4xl font-bold text-white mt-1">Admin Panel</h1>
          <div className="flex gap-3 mt-4 bg-slate-900/60 p-2 rounded-2xl border border-white/5">
            {/* EMPLOYEE */}
            <Button
              text="Employee"
              onClick={() => navigate("/", { replace: true })}
              className="flex-1 bg-slate-800 hover:bg-slate-900 text-slate-300 py-3 rounded-xl font-semibold transition cursor-pointer"
            />

            {/* ADMIN */}
            <Button
              text="Admin"
              onClick={() => navigate("/admin-login", { replace: true })}
              className="flex-1 bg-linear-to-r from-blue-600 to-cyan-500 text-white py-3 rounded-xl font-semibold shadow-lg shadow-blue-500/20 cursor-pointer"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-300 p-4 rounded-xl mb-5 text-center">
            {error}
          </div>
        )}

        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            handleLogin();
          }}
        >
          {/* Employee ID */}
          <div>
            <label className="text-white text-sm mb-2 block">Employee ID</label>
            <Input
              type="text"
              placeholder="Enter your employee ID"
              value={formData.employee_id}
              onChange={(e) =>
                setFormData({ ...formData, employee_id: e.target.value })
              }
              onKeyDown={handleKeyPress}
              className="w-full p-4 rounded-2xl bg-slate-900/70 border border-slate-700 text-white placeholder-slate-500 outline-none focus:border-blue-500 transition"
            />
          </div>

          {/* Password */}
          <div>
            <label className="text-white text-sm mb-2 block">Password</label>
            <Input
              type={showPass ? "text" : "password"}
              placeholder="Enter your password"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              onKeyDown={handleKeyPress}
              className="w-full p-4 rounded-2xl bg-slate-900/70 border border-slate-700 text-white placeholder-slate-500 outline-none focus:border-blue-500 transition"
            />

            <Button
              text={showPass ? <EyeOff size={20} /> : <Eye size={20} />}
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute right-9 top-90 -translate-y-1/2 text-slate-400 hover:text-white transition cursor-pointer"
            />
          </div>

          {/* Login Button */}
          <Button
            text={loading ? "Verifying..." : "Login"}
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 transition p-4 rounded-2xl text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed mt-3 cursor-pointer"
          />
        </form>
      </div>
    </div>
  );
}
