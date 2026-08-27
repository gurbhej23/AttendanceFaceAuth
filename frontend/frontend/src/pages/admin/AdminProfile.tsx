import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Webcam from "react-webcam";
import { AnimatePresence } from "framer-motion";
import API, { FACE_REQUEST_TIMEOUT_MS } from "../../services/api";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import PasswordField from "../../components/common/PasswordField";
import Toast from "../../components/common/Toast";
import ProfilePhotoCropModal from "../../components/common/ProfilePhotoCropModal";
import ProfileAvatarImg from "../../components/common/ProfileAvatarImg";
import SearchableSelect from "../../components/auth/SearchableSelect";
import CvDropZone from "../../components/auth/CvDropZone";
import DashboardDatePicker from "../../components/common/DashboardDatePicker";
import AdminSidebar from "../../components/AdminSidebar";
import MobileMenuButton from "../../components/common/MobileMenuButton";
import AnimatedBackground from "../../components/motion/AnimatedBackground";
import ThreeDCardContainer from "../../components/motion/ThreeDCardContainer";
import LogOutModal from "../../components/modal/LogOutModal";
import { getMediaUrl } from "../../utils/chatHelpers";
import { clearAuthSession, isAdminOrHR } from "../../utils/auth";
import {
  isAppLockEnabled,
  registerBiometricCredential,
  setAppLockEnabled,
} from "../../utils/biometricLock";
import {
  ArrowLeft,
  Camera,
  Download,
  FileText,
  X,
  User,
  Lock,
  Mail,
  Building2,
  Fingerprint,
  ScanLine,
  BadgeCheck,
  Briefcase,
  CheckCircle2,
  Sparkles,
  IdCardLanyard,
  ChartNoAxesCombined,
  Calendar,
  ShieldAlert,
  LayoutDashboard,
} from "lucide-react";
import {
  DEPARTMENTS,
  getJobRolesForDepartment,
} from "../../constants/departments";

interface EmployeeProfile {
  employee_id: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  profile_img: string;
  cv_file: string;
  date_of_birth?: string;
  join_date?: string;
  role?: string;
}

const getError = (err: unknown, fallback: string) => {
  const e = err as { response?: { data?: { error?: string } } };
  return e.response?.data?.error || fallback;
};

const isPdfFile = (file: File) =>
  file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

export default function AdminProfile() {
  const navigate = useNavigate();
  const location = useLocation();
  const webcamRef = useRef<Webcam>(null);

  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("IT");
  const [designation, setDesignation] = useState("Software Engineer");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [joinDate, setJoinDate] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [cvFile, setCvFile] = useState("");
  const [cvFileName, setCvFileName] = useState("");
  const [cvReplaceMode, setCvReplaceMode] = useState(false);
  const [showFaceEnrollment, setShowFaceEnrollment] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [appLock, setAppLock] = useState(() => isAppLockEnabled());
  const [faceSaving, setFaceSaving] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  const [showImageModal, setShowImageModal] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"general" | "security" | "biometrics" | "cv">("general");

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setCropImageSrc(reader.result as string);
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    }
  };

  const employeeId = localStorage.getItem("employee_id") || "";
  const adminRole = localStorage.getItem("role") || "Administrator";
  const adminName = localStorage.getItem("employee_name") || profile?.name || "Admin";
  const adminProfileImg = getMediaUrl(localStorage.getItem("profile_img") || profile?.profile_img);

  useEffect(() => {
    if (!isAdminOrHR()) {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  const jobRoleOptions = useMemo(
    () => getJobRolesForDepartment(department, designation),
    [department, designation],
  );

  const handleDepartmentChange = (next: string) => {
    setDepartment(next);
    const roles = getJobRolesForDepartment(next);
    setDesignation(roles[0] || "Staff");
  };

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const loadProfile = useCallback(async () => {
    if (!employeeId) {
      navigate("/", { replace: true });
      return;
    }
    try {
      setLoading(true);
      const res = await API.get("/employees/profile/", {
        params: { employee_id: employeeId },
      });
      const data = res.data.employee as EmployeeProfile;
      setProfile(data);
      setName(data.name || "");
      setPhone(data.phone || "");
      setDepartment(data.department || "IT");
      setDesignation(data.designation || "Software Engineer");
      setDateOfBirth(data.date_of_birth || "");
      setJoinDate(data.join_date || "");
    } catch (err) {
      showToast(getError(err, "Could not load admin profile"), false);
    } finally {
      setLoading(false);
    }
  }, [employeeId, navigate]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const saveProfile = async () => {
    if (!employeeId) return;
    try {
      setSaving(true);
      const payload: Record<string, string> = {
        employee_id: employeeId,
        name: name.trim(),
        phone: phone.trim(),
        department: department.trim(),
        designation: designation.trim(),
        date_of_birth: dateOfBirth,
        join_date: joinDate,
      };
      if (cvFile) {
        payload.cv_file = cvFile;
        payload.cv_file_name = cvFileName;
      }
      const res = await API.post("/employees/update-profile/", payload);
      const updated = res.data.employee as EmployeeProfile;
      setProfile(updated);
      setName(updated.name || "");
      setPhone(updated.phone || "");
      setDepartment(updated.department || "IT");
      setDesignation(updated.designation || "Software Engineer");
      setDateOfBirth(updated.date_of_birth || "");
      setJoinDate(updated.join_date || "");
      localStorage.setItem("employee_name", updated.name || name);
      setCvFile("");
      setCvFileName("");
      setCvReplaceMode(false);
      showToast(res.data.message || "Profile updated successfully");
    } catch (err) {
      showToast(getError(err, "Failed to update profile"), false);
    } finally {
      setSaving(false);
    }
  };

  const handleCroppedPhoto = async (dataUrl: string) => {
    if (!employeeId) return;
    try {
      setSaving(true);
      const res = await API.post("/employees/update-profile/", {
        employee_id: employeeId,
        profile_img: dataUrl,
      });
      const updated = res.data.employee as EmployeeProfile;
      setProfile(updated);
      setCropImageSrc(null);
      if (updated.profile_img) {
        localStorage.setItem("profile_img", updated.profile_img);
      }
      showToast("Profile photo updated");
    } catch (err) {
      showToast(getError(err, "Photo update failed"), false);
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (!employeeId) return;
    if (!currentPassword || !newPassword) {
      showToast("Please fill password fields", false);
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("New passwords do not match", false);
      return;
    }
    try {
      const res = await API.post("/employees/change-password/", {
        employee_id: employeeId,
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showToast(res.data.message || "Password updated");
    } catch (err) {
      showToast(getError(err, "Password update failed"), false);
    }
  };

  const captureFace = () => {
    const snap = webcamRef.current?.getScreenshot();
    if (snap) {
      setCapturedImage(snap);
    } else {
      showToast("Could not capture image", false);
    }
  };

  const saveFace = async () => {
    if (!employeeId || !capturedImage) return;
    try {
      setFaceSaving(true);
      const res = await API.post(
        "/employees/update-face/",
        {
          employee_id: employeeId,
          image: capturedImage,
        },
        { timeout: FACE_REQUEST_TIMEOUT_MS },
      );
      const data = res.data.employee as EmployeeProfile;
      setProfile(data);
      localStorage.setItem("profile_img", data.profile_img || "");
      setCapturedImage(null);
      setShowFaceEnrollment(false);
      showToast(res.data.message || "Face profile updated");
    } catch (err) {
      showToast(getError(err, "Face update failed"), false);
    } finally {
      setFaceSaving(false);
    }
  };

  const handleToggleAppLock = async () => {
    const nextState = !appLock;
    if (nextState) {
      const success = await registerBiometricCredential(adminName || employeeId);
      if (success) {
        setAppLockEnabled(true);
        setAppLock(true);
        showToast("Biometric lock enabled");
      } else {
        setAppLockEnabled(false);
        setAppLock(false);
        showToast("Failed to register WebAuthn credential", false);
      }
    } else {
      setAppLockEnabled(false);
      setAppLock(false);
      showToast("Biometric lock disabled");
    }
  };

  const activeCvUrl = profile?.cv_file ? getMediaUrl(profile.cv_file) : "";
  const cvDisplayName =
    cvFileName ||
    (profile?.cv_file
      ? profile.cv_file.split("/").pop()?.replace(/^\w+_/, "") || "Resume.pdf"
      : "");

  const handleLogout = () => {
    clearAuthSession();
    navigate("/", { replace: true });
  };

  const sidebarItems = useMemo(
    () => [
      {
        icon: <User size={18} />,
        label: "Profile",
        onClick: () => navigate("/admin-profile"),
        active: location.pathname === "/admin-profile",
      },
      {
        icon: <LayoutDashboard size={18} />,
        label: "Dashboard",
        onClick: () => navigate("/attendance-sheet"),
        active: location.pathname === "/attendance-sheet",
      },
      {
        icon: <Calendar size={18} />,
        label: "HR Center",
        onClick: () => navigate("/admin-hr"),
        active: location.pathname === "/admin-hr",
      },
      {
        icon: <ChartNoAxesCombined size={18} />,
        label: "Analytics",
        onClick: () => navigate("/admin-analytics"),
        active: location.pathname === "/admin-analytics",
      },
      {
        icon: <IdCardLanyard size={18} />,
        label: "Employees",
        onClick: () => navigate("/admin-employees"),
        active: location.pathname === "/admin-employees",
      },
      {
        icon: <ShieldAlert size={18} />,
        label: "Security & Occupancy",
        onClick: () => navigate("/admin-security"),
        active: location.pathname === "/admin-security",
      },
    ],
    [location.pathname, navigate],
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent mx-auto mb-4" />
          <p className="text-slate-400 text-sm font-medium">Loading Admin Profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-linear-to-br from-[#020617] via-[#0f172a] to-[#111827] text-slate-100 pb-16 px-4 py-5 sm:px-5 lg:pl-24 lg:pr-6">
      {/* 3D WebGL Particle Background Canvas */}
      <AnimatedBackground particleColor={0x38bdf8} secondaryColor={0x818cf8} />

      <AnimatePresence>
        {toast && <Toast key={toast.msg} message={toast.msg} ok={toast.ok} />}
      </AnimatePresence>

      {/* Navigation Sidebar */}
      <AdminSidebar
        items={sidebarItems}
        onLogout={() => setShowLogoutModal(true)}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        adminName={adminName}
        adminRole={adminRole}
        profileImg={adminProfileImg}
      />

      <MobileMenuButton onClick={() => setMobileSidebarOpen(true)} />

      {/* Main Content Layout offset by sidebar */}
      <div className="relative z-10 mx-auto max-w-5xl pt-12 sm:pt-5 lg:pt-0">
        {/* Sticky Top Header */}
        <header className="sticky top-0 z-30 mb-6 flex items-center justify-between border-b border-white/10 bg-transparent backdrop-blur-xl px-4 py-4 sm:px-6 shadow-xl rounded-b-2xl">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-cyan-400" /> Back
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400 animate-pulse" />
            <h1 className="text-base sm:text-lg font-bold text-white tracking-wide">
              Admin Profile &amp; Settings
            </h1>
          </div>
          <div className="hidden sm:block text-right">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Verified Administrator
            </span>
          </div>
        </header>

        <main className="space-y-8">
          {/* Executive Profile Card wrapped in 3D Card Container */}
          <ThreeDCardContainer maxDegrees={5}>
            <div className="dash-shell-panel p-6 sm:p-8 border border-white/15 bg-transparent rounded-3xl backdrop-blur-xl relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xl">
              <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
                <div className="relative group shrink-0">
                  <div className="h-28 w-28 sm:h-32 sm:w-32 rounded-full overflow-hidden border-2 border-cyan-400/40 bg-slate-900 shadow-2xl">
                    <ProfileAvatarImg
                      src={adminProfileImg}
                      alt={profile?.name || "Admin"}
                      className="h-full w-full object-cover cursor-pointer"
                      onClick={() => {
                        if (profile?.profile_img) setShowImageModal(true);
                      }}
                    />
                  </div>
                  <label
                    htmlFor="admin-avatar-upload"
                    className="absolute bottom-1 right-1 p-2.5 bg-cyan-600 hover:bg-cyan-500 rounded-full text-white cursor-pointer shadow-lg transition transform hover:scale-110 border border-white/20"
                    title="Change Profile Photo"
                  >
                    <Camera className="w-4 h-4" />
                  </label>
                  <input
                    id="admin-avatar-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                      {name || profile?.name || "Admin"}
                    </h2>
                    <BadgeCheck className="w-6 h-6 text-cyan-400 shrink-0" />
                  </div>

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs sm:text-sm text-slate-300">
                    <span className="flex items-center gap-1.5 font-medium text-cyan-300">
                      <Briefcase className="w-4 h-4 text-cyan-400" />
                      {designation || profile?.designation || "Administrator"}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1.5 font-medium text-indigo-300">
                      <Building2 className="w-4 h-4 text-indigo-400" />
                      {department || profile?.department || "Management"}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-1 text-xs text-slate-400">
                    <span className="bg-slate-800/80 px-3 py-1 rounded-lg border border-slate-700/60 font-mono">
                      ID: {profile?.employee_id || employeeId}
                    </span>
                    <span className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      {profile?.email}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 w-full sm:w-auto">
                <div className="p-4 rounded-2xl bg-transparent border border-white/15 backdrop-blur-md text-center sm:text-right">
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Role</p>
                  <p className="text-sm font-bold text-emerald-400 flex items-center justify-center sm:justify-end gap-1.5 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" /> {adminRole}
                  </p>
                </div>
              </div>
            </div>
          </ThreeDCardContainer>

          {/* Tab Navigation Controls */}
          <div className="flex items-center justify-center sm:justify-start gap-2 border-b border-white/10 pb-4 overflow-x-auto">
            <button
              onClick={() => setActiveTab("general")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-semibold text-sm transition cursor-pointer whitespace-nowrap ${activeTab === "general"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg"
                : "bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-transparent"
                }`}
            >
              <User className="w-4 h-4" /> Personal Details
            </button>
            <button
              onClick={() => setActiveTab("biometrics")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-semibold text-sm transition cursor-pointer whitespace-nowrap ${activeTab === "biometrics"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg"
                : "bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-transparent"
                }`}
            >
              <Fingerprint className="w-4 h-4" /> Biometrics &amp; Face AI
            </button>
            <button
              onClick={() => setActiveTab("security")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-semibold text-sm transition cursor-pointer whitespace-nowrap ${activeTab === "security"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg"
                : "bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-transparent"
                }`}
            >
              <Lock className="w-4 h-4" /> Password &amp; Security
            </button>
            <button
              onClick={() => setActiveTab("cv")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-semibold text-sm transition cursor-pointer whitespace-nowrap ${activeTab === "cv"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg"
                : "bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-transparent"
                }`}
            >
              <FileText className="w-4 h-4" /> Resume &amp; Credentials
            </button>
          </div>

          {/* TAB 1: GENERAL PERSONAL DETAILS */}
          {activeTab === "general" && (
            <ThreeDCardContainer maxDegrees={5}>
              <div className="dash-shell-panel p-6 sm:p-8 border border-white/15 bg-transparent rounded-3xl backdrop-blur-xl shadow-2xl space-y-6">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white">Personal Details</h3>
                    <p className="text-xs text-slate-400 mt-1">Update your name, contact details, and department</p>
                  </div>
                  <User className="w-6 h-6 text-cyan-400" />
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                      Full Name
                    </label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Admin Name"
                      className="w-full rounded-2xl border border-white/15 bg-slate-900/60 p-3.5 text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                      Phone Number
                    </label>
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full rounded-2xl border border-white/15 bg-slate-900/60 p-3.5 text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                      Department
                    </label>
                    <SearchableSelect
                      options={DEPARTMENTS}
                      value={department}
                      onChange={handleDepartmentChange}
                      placeholder="Select Department"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                      Designation / Role
                    </label>
                    <SearchableSelect
                      options={jobRoleOptions}
                      value={designation}
                      onChange={setDesignation}
                      placeholder="Select Job Role"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                      Date of Birth
                    </label>
                    <DashboardDatePicker
                      value={dateOfBirth}
                      onChange={setDateOfBirth}
                      placeholder="YYYY-MM-DD"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                      Date of Joining
                    </label>
                    <DashboardDatePicker
                      value={joinDate}
                      onChange={setJoinDate}
                      placeholder="YYYY-MM-DD"
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <Button
                    onClick={saveProfile}
                    disabled={saving}
                    className="rounded-2xl bg-cyan-600 hover:bg-cyan-500 px-7 py-3 text-sm font-bold text-white disabled:opacity-50 transition shadow-lg shadow-cyan-500/25 cursor-pointer"
                  >
                    {saving ? "Saving Changes..." : "Save Profile Details"}
                  </Button>
                </div>
              </div>
            </ThreeDCardContainer>
          )}

          {/* TAB 2: BIOMETRICS */}
          {activeTab === "biometrics" && (
            <ThreeDCardContainer maxDegrees={5}>
              <div className="dash-shell-panel p-6 sm:p-8 border border-white/15 bg-transparent rounded-3xl backdrop-blur-xl shadow-2xl space-y-6">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white">Face Biometrics Re-Enrollment</h3>
                    <p className="text-xs text-slate-400 mt-1">Re-enroll 3D facial vectors for automated check-in verification</p>
                  </div>
                  <ScanLine className="w-6 h-6 text-emerald-400" />
                </div>

                {!showFaceEnrollment ? (
                  <div className="text-center py-8 space-y-4">
                    <p className="text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">
                      Camera capture allows updating your high-precision face recognition profile in real-time. Position your face in front of the lens with clear lighting.
                    </p>
                    <Button
                      onClick={() => setShowFaceEnrollment(true)}
                      className="rounded-2xl bg-emerald-600 hover:bg-emerald-500 px-7 py-3 text-sm font-bold text-white transition shadow-lg shadow-emerald-500/25 cursor-pointer"
                    >
                      Open Biometric Camera
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6 max-w-xl mx-auto">
                    <div className="relative mx-auto overflow-hidden rounded-3xl border-2 border-emerald-500/40 bg-black aspect-4/3 shadow-2xl">
                      {!capturedImage ? (
                        <Webcam
                          ref={webcamRef}
                          audio={false}
                          screenshotFormat="image/jpeg"
                          onUserMedia={() => setCameraReady(true)}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <img
                          src={capturedImage}
                          alt="Captured face"
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>

                    <div className="flex flex-wrap justify-center gap-3">
                      {!capturedImage ? (
                        <Button
                          onClick={captureFace}
                          disabled={!cameraReady}
                          className="rounded-2xl bg-emerald-600 hover:bg-emerald-500 px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50 cursor-pointer shadow-lg shadow-emerald-500/20"
                        >
                          Capture Snap
                        </Button>
                      ) : (
                        <Button
                          onClick={() => setCapturedImage(null)}
                          className="rounded-2xl bg-slate-800 hover:bg-slate-700 px-6 py-2.5 text-sm font-bold text-white cursor-pointer"
                        >
                          Retake
                        </Button>
                      )}

                      <Button
                        onClick={saveFace}
                        disabled={!capturedImage || faceSaving}
                        className="rounded-2xl bg-cyan-600 hover:bg-cyan-500 px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50 cursor-pointer shadow-lg shadow-cyan-500/20"
                      >
                        {faceSaving ? "Saving Model..." : "Save Face Model"}
                      </Button>

                      <Button
                        onClick={() => {
                          setShowFaceEnrollment(false);
                          setCapturedImage(null);
                        }}
                        className="rounded-2xl border border-white/20 bg-white/10 hover:bg-white/15 px-5 py-2.5 text-sm font-bold text-slate-300 hover:text-white cursor-pointer"
                      >
                        Close Camera
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </ThreeDCardContainer>
          )}

          {/* TAB 3: PASSWORD & SECURITY */}
          {activeTab === "security" && (
            <ThreeDCardContainer maxDegrees={5}>
              <div className="dash-shell-panel p-6 sm:p-8 border border-white/15 bg-transparent rounded-3xl backdrop-blur-xl shadow-2xl space-y-6">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white">Change Password</h3>
                    <p className="text-xs text-slate-400 mt-1">Ensure your administrative credentials remain secure</p>
                  </div>
                  <Lock className="w-6 h-6 text-cyan-400" />
                </div>

                <div className="space-y-5 max-w-lg">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                      Current Password
                    </label>
                    <PasswordField
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                      New Password
                    </label>
                    <PasswordField
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                      Confirm New Password
                    </label>
                    <PasswordField
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                    />
                  </div>

                  <Button
                    onClick={changePassword}
                    className="mt-4 rounded-2xl bg-cyan-600 hover:bg-cyan-500 px-7 py-3 text-sm font-bold text-white transition shadow-lg shadow-cyan-500/20 cursor-pointer"
                  >
                    Update Password
                  </Button>
                </div>

                {/* APP LOCK TOGGLE */}
                <div className="border-t border-white/10 pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-white text-base">App Lock (Biometrics)</h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Require fingerprint or face ID device prompt when opening the application.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleAppLock}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${appLock ? "bg-cyan-500" : "bg-slate-700"
                        }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${appLock ? "translate-x-6" : "translate-x-1"
                          }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </ThreeDCardContainer>
          )}

          {/* TAB 4: DOCUMENT / RESUME */}
          {activeTab === "cv" && (
            <ThreeDCardContainer maxDegrees={5}>
              <div className="dash-shell-panel p-6 sm:p-8 border border-white/15 bg-transparent rounded-3xl backdrop-blur-xl shadow-2xl space-y-6">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white">Document / Resume</h3>
                    <p className="text-xs text-slate-400 mt-1">Upload or replace your official curriculum vitae</p>
                  </div>
                  <FileText className="w-6 h-6 text-purple-400" />
                </div>

                {activeCvUrl && !cvReplaceMode ? (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-white/15 bg-slate-900/60 p-5">
                    <div className="flex items-center gap-4">
                      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-md">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-bold text-white">{cvDisplayName}</p>
                        <p className="text-xs text-slate-400">Document Uploaded &amp; Active</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <a
                        href={activeCvUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 rounded-2xl bg-cyan-600 hover:bg-cyan-500 px-5 py-2.5 text-xs font-bold text-white transition shadow-lg shadow-cyan-500/20"
                      >
                        <Download className="w-4 h-4" /> Download CV
                      </a>
                      <Button
                        onClick={() => setCvReplaceMode(true)}
                        className="rounded-2xl border border-white/20 bg-white/10 hover:bg-white/15 px-5 py-2.5 text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
                      >
                        Replace Document
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <CvDropZone
                      fileName={cvFileName}
                      onFileReady={(b64, fname) => {
                        setCvFile(b64);
                        setCvFileName(fname);
                      }}
                      onClear={() => {
                        setCvFile("");
                        setCvFileName("");
                      }}
                      onError={(msg) => setToast({ ok: false, msg })}
                      isPdfFile={isPdfFile}
                      fileToDataUrl={fileToDataUrl}
                    />
                    <div className="mt-6 flex justify-end gap-3">
                      {cvReplaceMode && (
                        <Button
                          onClick={() => setCvReplaceMode(false)}
                          className="rounded-2xl border border-white/20 bg-white/10 hover:bg-white/15 px-5 py-2.5 text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
                        >
                          Cancel
                        </Button>
                      )}
                      <Button
                        onClick={saveProfile}
                        disabled={!cvFile || saving}
                        className="rounded-2xl bg-purple-600 hover:bg-purple-500 px-6 py-2.5 text-xs font-bold text-white disabled:opacity-50 cursor-pointer shadow-lg shadow-purple-500/20"
                      >
                        Save CV Document
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </ThreeDCardContainer>
          )}
        </main>

        {/* IMAGE PREVIEW MODAL */}
        {showImageModal && profile?.profile_img && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
            <div className="relative max-w-lg overflow-hidden rounded-3xl bg-slate-900 border border-white/15 p-4 shadow-2xl">
              <button
                onClick={() => setShowImageModal(false)}
                className="absolute right-4 top-4 rounded-full bg-slate-800 p-2 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <img
                src={getMediaUrl(profile.profile_img)}
                alt={profile.name}
                className="w-full rounded-2xl object-cover"
              />
            </div>
          </div>
        )}

        {/* PROFILE PHOTO CROP MODAL */}
        {cropImageSrc && (
          <ProfilePhotoCropModal
            imageSrc={cropImageSrc}
            onCancel={() => setCropImageSrc(null)}
            onSave={handleCroppedPhoto}
            saving={saving}
          />
        )}

        {/* LOGOUT CONFIRMATION MODAL */}
        <LogOutModal
          open={showLogoutModal}
          onClose={() => setShowLogoutModal(false)}
          onLogout={handleLogout}
        />
      </div>
    </div>
  );
}
