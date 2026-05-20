// src/pages/AdminCreateEmployee.tsx
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Webcam from "react-webcam";
import API from "../services/api";
import Button from "../components/Button";

type BorderStatus = "idle" | "scanning" | "success" | "error";

const DEPARTMENTS = [
  "IT",
  "HR",
  "Finance",
  "Operations",
  "Sales",
  "Marketing",
  "General",
];
const DESIGNATIONS = [
  "Software Engineer",
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "DevOps Engineer",
  "QA Engineer",
  "UI/UX Designer",
  "Project Manager",
  "HR Executive",
  "Accountant",
  "Operations Executive",
  "Sales Executive",
  "Intern",
  "Team Lead",
  "Manager",
];

interface CreatedEmployee {
  employee_id: string;
  password: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  role: string;
}

export default function AdminCreateEmployee() {
  const navigate = useNavigate();
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<CreatedEmployee | null>(null);
  const [copied, setCopied] = useState(false);

  // Face capture
  const [showCamera, setShowCamera] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [borderStatus, setBorderStatus] = useState<BorderStatus>("idle");
  const [faceMsg, setFaceMsg] = useState("Position your face in the oval");

  // CV
  const [cvFile, setCvFile] = useState("");
  const [cvFileName, setCvFileName] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    department: "IT",
    designation: "Software Engineer",
    role: "employee",
  });

  // ── Route guard ────────────────────────────────────────────────────────
//   useEffect(() => {
//     const role = localStorage.getItem("role");
//     if (role !== "admin" && role !== "hr") navigate("/");
//   }, [navigate]);

  // ── Canvas animation ───────────────────────────────────────────────────
  const drawOverlay = (status: BorderStatus, scanOffset: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width,
      H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const ovalX = W / 2,
      ovalY = H * 0.45,
      ovalRX = W * 0.38,
      ovalRY = H * 0.42;

    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.ellipse(ovalX, ovalY, ovalRX, ovalRY, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const color =
      status === "success"
        ? "#22c55e"
        : status === "error"
          ? "#ef4444"
          : status === "scanning"
            ? "#facc15"
            : "#ffffff";
    ctx.save();
    ctx.shadowBlur = 18;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.ellipse(ovalX, ovalY, ovalRX, ovalRY, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    if (status === "scanning") {
      const lineY = ovalY - ovalRY + scanOffset * ovalRY * 2;
      const halfW = Math.sqrt(
        Math.max(0, 1 - Math.pow((lineY - ovalY) / ovalRY, 2)) *
          ovalRX *
          ovalRX,
      );
      ctx.save();
      const grad = ctx.createLinearGradient(
        ovalX - halfW,
        lineY,
        ovalX + halfW,
        lineY,
      );
      grad.addColorStop(0, "rgba(250,204,21,0)");
      grad.addColorStop(0.5, "rgba(250,204,21,0.9)");
      grad.addColorStop(1, "rgba(250,204,21,0)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ovalX - halfW, lineY);
      ctx.lineTo(ovalX + halfW, lineY);
      ctx.stroke();
      ctx.restore();
    }
  };

  useEffect(() => {
    if (!showCamera) return;
    let scanOffset = 0,
      direction = 1;
    const loop = () => {
      if (borderStatus === "scanning") {
        scanOffset += 0.008 * direction;
        if (scanOffset >= 1) direction = -1;
        if (scanOffset <= 0) direction = 1;
      }
      drawOverlay(borderStatus, scanOffset);
      animationRef.current = requestAnimationFrame(loop);
    };
    animationRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationRef.current);
  }, [borderStatus, showCamera]);

  // ── Image quality check ────────────────────────────────────────────────
  const checkQuality = (
    src: string,
  ): Promise<{ passed: boolean; reason: string }> =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const W = 160,
          H = 120;
        const canvas = document.createElement("canvas");
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, W, H);
        const { data } = ctx.getImageData(0, 0, W, H);
        let lum = 0;
        for (let i = 0; i < data.length; i += 4)
          lum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const avg = lum / (data.length / 4);
        if (avg < 28)
          return resolve({
            passed: false,
            reason: "Too dark — improve lighting",
          });
        if (avg > 220)
          return resolve({
            passed: false,
            reason: "Too bright — reduce glare",
          });
        let blur = 0;
        for (let y = 1; y < H - 1; y++)
          for (let x = 1; x < W - 1; x++) {
            const idx = (y * W + x) * 4;
            blur += Math.abs(
              -4 * data[idx] +
                data[((y - 1) * W + x) * 4] +
                data[((y + 1) * W + x) * 4] +
                data[(y * W + (x - 1)) * 4] +
                data[(y * W + (x + 1)) * 4],
            );
          }
        if (blur / (W * H) < 4.5)
          return resolve({ passed: false, reason: "Too blurry — hold still" });
        resolve({ passed: true, reason: "" });
      };
      img.src = src;
    });

  const captureFace = async () => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const src = webcamRef.current?.getScreenshot({
        width: 1280,
        height: 720,
      });
      if (!src) {
        setFaceMsg("Failed to capture");
        setBorderStatus("error");
        return;
      }
      const { passed, reason } = await checkQuality(src);
      if (!passed) {
        setBorderStatus("error");
        setFaceMsg(reason);
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 800));
          setBorderStatus("scanning");
          setFaceMsg("Position your face in the oval");
          continue;
        }
        return;
      }
      setCapturedImage(src);
      setBorderStatus("success");
      setFaceMsg("✅ Face captured!");
      return;
    }
  };

  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });

  // ── Submit ─────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }
    if (!form.email.trim()) {
      setError("Email is required");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError("Invalid email");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await API.post("/employees/create-employee/", {
        name: form.name,
        email: form.email,
        phone: form.phone,
        department: form.department,
        designation: form.designation,
        role: form.role,
        image: capturedImage || "",
        cv_file: cvFile,
        cv_file_name: cvFileName,
      });

      if (res.data.success) {
        setCreated({
          employee_id: res.data.employee_id,
          password: res.data.password,
          name: res.data.name,
          email: res.data.email,
          department: res.data.department,
          designation: res.data.designation,
          role: res.data.role,
        });
        // Reset form
        setForm({
          name: "",
          email: "",
          phone: "",
          department: "IT",
          designation: "Software Engineer",
          role: "employee",
        });
        setCapturedImage(null);
        setBorderStatus("idle");
        setShowCamera(false);
        setCvFile("");
        setCvFileName("");
      } else {
        setError(res.data.error || "Failed to create employee");
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || "Failed to create employee");
    } finally {
      setLoading(false);
    }
  };

  const copyCredentials = () => {
    if (!created) return;
    navigator.clipboard.writeText(
      `Employee ID: ${created.employee_id}\nPassword: ${created.password}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Render: credentials screen ─────────────────────────────────────────
  if (created) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="bg-slate-800 border border-slate-700 rounded-4xl p-8 w-full max-w-md shadow-2xl text-center">
          <div className="w-20 h-20 rounded-3xl bg-green-500/20 flex items-center justify-center text-4xl mx-auto mb-5">
            🎉
          </div>
          <h2 className="text-2xl text-white font-bold mb-1">
            Employee Created!
          </h2>
          <p className="text-slate-400 text-sm mb-6">
            Share these credentials with{" "}
            <span className="text-white font-semibold">{created.name}</span>
          </p>

          {/* Credentials box */}
          <div className="bg-slate-900 border border-slate-600 rounded-3xl p-6 mb-6 text-left space-y-4">
            <div>
              <p className="text-slate-500 text-xs uppercase tracking-widest mb-1">
                Name
              </p>
              <p className="text-white font-semibold">{created.name}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs uppercase tracking-widest mb-1">
                Email
              </p>
              <p className="text-blue-300">{created.email}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs uppercase tracking-widest mb-1">
                Department
              </p>
              <p className="text-white">
                {created.department} — {created.designation}
              </p>
            </div>
            <hr className="border-slate-700" />
            <div>
              <p className="text-slate-500 text-xs uppercase tracking-widest mb-1">
                Employee ID
              </p>
              <p className="text-2xl font-bold text-cyan-300 font-mono tracking-wider">
                {created.employee_id}
              </p>
            </div>
            <div>
              <p className="text-slate-500 text-xs uppercase tracking-widest mb-1">
                Password
              </p>
              <p className="text-2xl font-bold text-yellow-300 font-mono tracking-wider">
                {created.password}
              </p>
            </div>
          </div>

          <p className="text-red-400 text-xs mb-5">
            ⚠️ Note this down now — the password won't be shown again.
          </p>

          <div className="flex gap-3">
            <button
              onClick={copyCredentials}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-2xl font-semibold transition cursor-pointer"
            >
              {copied ? "✅ Copied!" : "📋 Copy Credentials"}
            </button>
            <button
              onClick={() => setCreated(null)}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-2xl font-semibold transition cursor-pointer"
            >
              ➕ Add Another
            </button>
          </div>

          <button
            onClick={() => navigate("/attendance-sheet")}
            className="w-full mt-3 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-2xl font-semibold transition cursor-pointer"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── Render: form ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl text-white font-bold">Create Employee</h1>
            <p className="text-slate-400 mt-1">
              Fill the form — ID and password will be auto-generated
            </p>
          </div>
          <button
            onClick={() => navigate("/attendance-sheet")}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer border border-slate-700"
          >
            ← Back
          </button>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-3xl p-8 space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-4 rounded-2xl text-sm text-center">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="text-slate-300 text-sm mb-2 block">
              Full Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Gurbhej Singh"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full p-4 rounded-2xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 outline-none focus:border-blue-500 transition"
            />
          </div>

          {/* Email */}
          <div>
            <label className="text-slate-300 text-sm mb-2 block">
              Email Address <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              placeholder="employee@company.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full p-4 rounded-2xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 outline-none focus:border-blue-500 transition"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="text-slate-300 text-sm mb-2 block">
              Phone <span className="text-slate-500 text-xs">(optional)</span>
            </label>
            <input
              type="tel"
              placeholder="+91 9876543210"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full p-4 rounded-2xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 outline-none focus:border-blue-500 transition"
            />
          </div>

          {/* Department + Designation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-slate-300 text-sm mb-2 block">
                Department <span className="text-red-400">*</span>
              </label>
              <select
                value={form.department}
                onChange={(e) =>
                  setForm({ ...form, department: e.target.value })
                }
                className="w-full p-4 rounded-2xl bg-slate-900 border border-slate-700 text-white outline-none focus:border-blue-500 transition"
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-slate-300 text-sm mb-2 block">
                Designation <span className="text-red-400">*</span>
              </label>
              <select
                value={form.designation}
                onChange={(e) =>
                  setForm({ ...form, designation: e.target.value })
                }
                className="w-full p-4 rounded-2xl bg-slate-900 border border-slate-700 text-white outline-none focus:border-blue-500 transition"
              >
                {DESIGNATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Role */}
          <div>
            <label className="text-slate-300 text-sm mb-2 block">Role</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { v: "employee", l: "Employee", e: "👤" },
                { v: "hr", l: "HR", e: "🧑‍💼" },
                { v: "admin", l: "Admin", e: "🔑" },
              ].map(({ v, l, e }) => (
                <button
                  key={v}
                  onClick={() => setForm({ ...form, role: v })}
                  className={`py-3 rounded-2xl text-sm font-semibold border transition cursor-pointer flex flex-col items-center gap-1 ${form.role === v ? "bg-blue-600 border-blue-500 text-white" : "bg-slate-900 border-slate-700 text-slate-400 hover:border-blue-500"}`}
                >
                  <span>{e}</span>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* CV Upload */}
          <div>
            <label className="text-slate-300 text-sm mb-2 block">
              CV / Resume{" "}
              <span className="text-slate-500 text-xs">
                (optional, PDF/DOC max 5MB)
              </span>
            </label>
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) {
                  setCvFile("");
                  setCvFileName("");
                  return;
                }
                if (file.size > 5 * 1024 * 1024) {
                  setError("CV must be 5MB or smaller");
                  e.target.value = "";
                  return;
                }
                try {
                  setCvFile(await fileToDataUrl(file));
                  setCvFileName(file.name);
                  setError("");
                } catch {
                  setError("Could not read CV file");
                }
              }}
              className="w-full rounded-2xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-300 file:mr-4 file:rounded-xl file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-blue-700"
            />
            {cvFileName && (
              <p className="mt-2 text-xs text-blue-300 truncate">
                {cvFileName}
              </p>
            )}
          </div>

          {/* Face Capture (optional) */}
          <div>
            <label className="text-slate-300 text-sm mb-2 block">
              Face Photo{" "}
              <span className="text-slate-500 text-xs">
                (optional — can be added later via profile)
              </span>
            </label>

            {!showCamera && !capturedImage && (
              <button
                onClick={() => {
                  setShowCamera(true);
                  setBorderStatus("idle");
                  setFaceMsg("Position your face in the oval");
                }}
                className="w-full py-4 rounded-2xl border border-dashed border-slate-600 text-slate-400 hover:border-blue-500 hover:text-blue-400 transition text-sm cursor-pointer"
              >
                📷 Open Camera to Capture Face
              </button>
            )}

            {capturedImage && (
              <div className="flex items-center gap-4 bg-slate-900 border border-green-500/30 rounded-2xl p-4">
                <img
                  src={capturedImage}
                  alt="captured"
                  className="w-16 h-16 rounded-xl object-cover border border-slate-700"
                />
                <div className="flex-1">
                  <p className="text-green-300 text-sm font-semibold">
                    ✅ Face captured
                  </p>
                  <button
                    onClick={() => {
                      setCapturedImage(null);
                      setBorderStatus("idle");
                      setShowCamera(true);
                    }}
                    className="text-xs text-slate-400 hover:text-white mt-1 cursor-pointer"
                  >
                    Retake
                  </button>
                </div>
              </div>
            )}

            {showCamera && !capturedImage && (
              <div className="flex flex-col items-center gap-4">
                <div
                  className={`relative w-72 h-72 rounded-full overflow-hidden ring-4 transition-all ${borderStatus === "success" ? "ring-green-500" : borderStatus === "error" ? "ring-red-500" : borderStatus === "scanning" ? "ring-yellow-400" : "ring-white/30"}`}
                >
                  <Webcam
                    ref={webcamRef}
                    audio={false}
                    mirrored
                    screenshotFormat="image/jpeg"
                    screenshotQuality={0.95}
                    onUserMedia={() => setCameraReady(true)}
                    videoConstraints={{
                      facingMode: "user",
                      width: { ideal: 1280 },
                      height: { ideal: 720 },
                    }}
                    style={{
                      position: "absolute",
                      width: "150%",
                      height: "130%",
                      top: "-30%",
                      left: "0%",
                      objectFit: "cover",
                    }}
                  />
                  <canvas
                    ref={canvasRef}
                    width={600}
                    height={400}
                    className="absolute inset-0 w-full h-full"
                  />
                </div>

                <p
                  className={`text-sm font-medium ${borderStatus === "success" ? "text-green-400" : borderStatus === "error" ? "text-red-400" : borderStatus === "scanning" ? "text-yellow-300" : "text-white"}`}
                >
                  {faceMsg}
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setBorderStatus("scanning");
                      setFaceMsg("Scanning...");
                      captureFace();
                    }}
                    disabled={!cameraReady || borderStatus === "scanning"}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
                  >
                    {borderStatus === "scanning" ? "Checking..." : "Capture"}
                  </button>
                  <button
                    onClick={() => {
                      setShowCamera(false);
                      setBorderStatus("idle");
                    }}
                    className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Info box */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 text-sm text-blue-300">
            🔐 <span className="font-semibold">Employee ID</span> and{" "}
            <span className="font-semibold">Password</span> will be
            auto-generated and shown on the next screen. You can also note them
            down to give to the employee directly.
          </div>

          {/* Submit */}
          <Button
            text={loading ? "Creating..." : "Create Employee →"}
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-2xl font-bold transition cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}
