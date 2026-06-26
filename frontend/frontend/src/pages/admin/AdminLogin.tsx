import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../services/api";
import { notifyAuthChanged } from "../../hooks/useEmployeeSession";
import Button from "../../components/common/Button";
import {
  LOGIN_EYE_BUTTON,
  LOGIN_FIELD_ICON,
  LOGIN_INNER_PANEL,
  LOGIN_INPUT_WITH_LEADING_ICON,
  LOGIN_OUTER_SHELL,
  LOGIN_PASSWORD_INPUT,
  LOGIN_ROLE_TOGGLE_SHELL,
  LOGIN_SUBMIT_BUTTON,
} from "../../components/auth/loginStyles";
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
          setLoading(false);
          return;
        }

        localStorage.setItem("token", token);
        localStorage.setItem("employee_id", empId);
        localStorage.setItem("employee_name", empName);
        localStorage.setItem("role", role);
        notifyAuthChanged();

        navigate("/attendance-sheet", { replace: true });
      } else {
        setError(response.data.error || "Admin login failed");
      }
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { error?: string } };
        message?: string;
      };
      if (!error.response) {
        setError(
          "Cannot reach the server. Confirm the backend is running on Render, then redeploy the frontend.",
        );
      } else {
        setError(error.response.data?.error || "Invalid credentials");
      }
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
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-5 overflow-hidden bg-linear-to-br from-[#020617] via-[#0f172a] to-[#111827] p-6">
      <div className={LOGIN_ROLE_TOGGLE_SHELL}>
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

      <div className={`${LOGIN_OUTER_SHELL} xl:grid-cols-[250px_1.45fr]`}>
        <section
          className={`${LOGIN_INNER_PANEL} flex flex-col items-center justify-evenly gap-5 p-4 text-center`}
        >
          <h1 className="text-3xl font-bold text-white">Attendance</h1>
          <div className="rounded-full border border-cyan-300/30 bg-slate-950/70 p-2 text-white shadow-xl shadow-cyan-500/10">
            <ShieldUser size={150} strokeWidth={0.5} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Admin Portal Login</h2> 
          </div>
        </section>

        <section
          className={`${LOGIN_INNER_PANEL} flex flex-col justify-center p-5`}
        >
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
          >
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-200">
                Administrator ID
              </label>
              <div className="relative">
                <UserRound size={20} className={LOGIN_FIELD_ICON} />
                <input
                  type="text"
                  placeholder="Enter admin ID"
                  value={formData.employee_id}
                  autoComplete="username"
                  name="username"
                  onChange={(e) =>
                    setFormData({ ...formData, employee_id: e.target.value })
                  }
                  onKeyDown={handleKeyPress}
                  className={LOGIN_INPUT_WITH_LEADING_ICON}
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-200">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  placeholder="Enter password"
                  value={formData.password}
                  autoComplete="current-password"
                  name="password"
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  onKeyDown={handleKeyPress}
                  className={LOGIN_PASSWORD_INPUT}
                />
                <Button
                  text={showPass ? <EyeOff size={20} /> : <Eye size={20} />}
                  type="button"
                  unstyled
                  onClick={() => setShowPass(!showPass)}
                  className={LOGIN_EYE_BUTTON}
                  aria-label={showPass ? "Hide password" : "Show password"}
                />
              </div>
            </div>

            {error && (
              <div className="dash-squircle border border-red-500/30 bg-red-500/10 p-4 text-center text-sm text-red-300">
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
              type="submit"
              disabled={loading}
              className={LOGIN_SUBMIT_BUTTON}
            />
          </form>
        </section>
      </div>
    </div>
  );
}
