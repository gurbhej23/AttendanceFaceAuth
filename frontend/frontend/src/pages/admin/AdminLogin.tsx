import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../services/api";
import Button from "../../components/common/Button";
import { Eye, EyeOff, ShieldUser, UserRound } from "lucide-react";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ employee_id: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);

  const handleLogin = async () => {
    if (!formData.employee_id || !formData.password) {
      setError("Administrator ID and password required");
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
    <div className="relative flex flex-col gap-5 min-h-screen items-center justify-center overflow-hidden bg-linear-to-br from-[#020617] via-[#0f172a] to-[#111827] p-6">
      {/* <div className="absolute -left-45 -top-40 h-87.5 w-87.5 rounded-full bg-blue-500/20 blur-3xl" />
      <div className="absolute -bottom-30 -right-25 h-87.5 w-87.5 rounded-full bg-cyan-500/20 blur-3xl" /> */}

      <div className="w-80 grid grid-cols-2 gap-2 rounded-2xl border border-slate-800 bg-slate-950/70 p-2">
        <Button
          text="Employee"
          onClick={() => navigate("/", { replace: true })}
          className="bg-slate-800/80 py-3 text-slate-400 hover:bg-slate-700 cursor-pointer"
        />

        <Button
          text="Admin"
          className="bg-linear-to-r from-blue-600 to-cyan-500 py-3 text-white shadow-lg shadow-cyan-500/20 cursor-pointer"
        />
      </div>

      <div className="relative grid w-full max-w-3xl gap-5 rounded-[36px] border border-white/15 bg-white/8 p-5 shadow-2xl backdrop-blur-2xl xl:grid-cols-[250px_1.45fr]">
        <section className="flex flex-col gap-5 justify-evenly items-center rounded-[28px] border border-white/12 bg-white/8 p-4 text-center shadow-inner">
          <h1 className="text-3xl font-bold text-white">Attendance</h1>
          <div className="text-white  rounded-full border border-cyan-300/30 bg-slate-950/70 shadow-xl shadow-cyan-500/10">
            <ShieldUser size={150} strokeWidth={0.5} />
          </div>
          <h2 className="text-center text-xl font-medium text-white">
            Admin Portal Login
          </h2>
        </section>

        <section className="flex flex-col justify-center rounded-[28px] border border-white/12 bg-white/8 p-4 shadow-inner">
          <form
            className="mt-2 space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
          >
            <div>
              <label className="mb-2 block text-sm text-slate-200">
                Administrator ID
              </label>
              <div className="relative">
                <UserRound
                  size={22}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  placeholder="Enter Admin ID"
                  value={formData.employee_id}
                  autoComplete="username"
                  name="username"
                  onChange={(e) =>
                    setFormData({ ...formData, employee_id: e.target.value })
                  }
                  onKeyDown={handleKeyPress}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 p-4 pl-12 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="mb-2">
              <label className="mb-2 block text-sm text-slate-200">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  placeholder="Enter Password"
                  value={formData.password}
                  autoComplete="current-password"
                  name="password"
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  onKeyDown={handleKeyPress}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 p-4 pr-14 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500"
                />
                <Button
                  text={showPass ? <EyeOff size={20} /> : <Eye size={20} />}
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                />
              </div>
            </div>

            {error && (
              <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-center text-sm text-red-300">
                {error}
              </div>
            )}

            <div className="text-right">
              <Button
                text="Forgot Password?"
                onClick={() => navigate("/forgot-password")}
                className="text-sm text-blue-300 hover:text-blue-200 cursor-pointer"
              />
            </div>
            <Button
              text={loading ? "Verifying..." : "Secure Login"}
              onClick={handleLogin}
              disabled={loading}
              className="w-full bg-linear-to-r from-blue-600 to-cyan-500 p-4 text-lg font-bold text-white shadow-xl shadow-cyan-500/20 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            />
          </form>
        </section>
      </div>
    </div>
  );
}
