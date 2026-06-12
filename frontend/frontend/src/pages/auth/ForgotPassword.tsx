import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../../services/api";
import MessageOverlay from "../../components/chat/MessageOverlay";
import Button from "../../components/common/Button";

const getApiError = (err: unknown, fallback: string): string => {
  const e = err as { response?: { data?: { error?: string } } };
  return e?.response?.data?.error || fallback;
};

export default function ForgotPassword() {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [overlay, setOverlay] = useState<{
    title: string;
    message?: string;
    tone?: "info" | "success" | "error";
    loading?: boolean;
  } | null>(null);

  const [formData, setFormData] = useState({
    email: "",
    otp: "",
    new_password: "",
    confirm_password: "",
  });

  // SEND OTP
  const sendOTP = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await API.post("/employees/send-otp/", {
        email: formData.email,
      });

      if (response.data.success) {
        setOverlay({
          title: "OTP sent",
          message:
            "Check your email and enter the code to reset your password.",
          tone: "success",
        });
        setStep(2);
      }
    } catch (err: unknown) {
      setError(getApiError(err, "Failed to send OTP"));
    } finally {
      setLoading(false);
    }
  };

  // RESET PASSWORD
  const resetPassword = async () => {
    if (formData.new_password !== formData.confirm_password) {
      setError("Passwords do not match");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await API.post("/employees/reset-password/", {
        email: formData.email,
        otp: formData.otp,
        new_password: formData.new_password,
      });

      if (response.data.success) {
        setOverlay({
          title: "Password updated",
          message: "Taking you back to login.",
          tone: "success",
          loading: true,
        });
        setTimeout(() => navigate("/"), 1500);
      }
    } catch (err: unknown) {
      setError(getApiError(err, "Reset failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center p-6">
      {overlay && (
        <MessageOverlay
          title={overlay.title}
          message={overlay.message}
          tone={overlay.tone}
          loading={overlay.loading}
          onClose={!overlay.loading ? () => setOverlay(null) : undefined}
        />
      )}
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl">
        {/* TOP */}
        <div className="bg-linear-to-r from-blue-600 to-cyan-500 p-8 text-center">
          <div className="text-5xl mb-3">🔐</div>

          <h1 className="text-3xl font-bold text-white">Forgot Password</h1>

          <p className="text-blue-100 mt-2">Reset your password securely</p>
        </div>

        <div className="p-8">
          {error && (
            <div className="bg-red-500/20 border border-red-500 text-red-300 p-4 rounded-2xl mb-5 text-center">
              {error}
            </div>
          )}

          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className="text-white text-sm mb-2 block">
                  Email Address
                </label>

                <input
                  type="email"
                  placeholder="Enter your registered email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      email: e.target.value,
                    })
                  }
                  className="w-full p-4 rounded-2xl bg-slate-800 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <Button
                onClick={sendOTP}
                disabled={loading}
                loading={loading}
                text={loading ? "Sending OTP..." : "Send OTP"}
                className="w-full bg-blue-600 p-4 text-white hover:bg-blue-700"
              />
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <label className="text-white text-sm mb-2 block">OTP</label>

                <input
                  type="text"
                  placeholder="Enter OTP"
                  value={formData.otp}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      otp: e.target.value,
                    })
                  }
                  className="w-full p-4 rounded-2xl bg-slate-800 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-white text-sm mb-2 block">
                  New Password
                </label>

                <input
                  type="password"
                  placeholder="Enter new password"
                  value={formData.new_password}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      new_password: e.target.value,
                    })
                  }
                  className="w-full p-4 rounded-2xl bg-slate-800 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-white text-sm mb-2 block">
                  Confirm Password
                </label>

                <input
                  type="password"
                  placeholder="Confirm password"
                  value={formData.confirm_password}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      confirm_password: e.target.value,
                    })
                  }
                  className="w-full p-4 rounded-2xl bg-slate-800 border border-slate-700 text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <Button
                onClick={resetPassword}
                disabled={loading}
                loading={loading}
                text={loading ? "Updating..." : "Reset Password"}
                className="w-full bg-green-600 p-4 text-white hover:bg-green-700"
              />
            </div>
          )}

          <Link
            to="/"
            className="block text-center text-blue-400 hover:text-blue-300 mt-6"
          >
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
