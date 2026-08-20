import { useCallback, useEffect, useState, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Webcam from "react-webcam";
import API, { FACE_REQUEST_TIMEOUT_MS } from "../../services/api";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import PasswordField from "../../components/common/PasswordField";
import Toast from "../../components/common/Toast";
import ProfilePhotoCropModal from "../../components/common/ProfilePhotoCropModal";
import ProfileAvatarImg from "../../components/common/ProfileAvatarImg";
import AdminSidebar from "../../components/AdminSidebar";
import MobileMenuButton from "../../components/common/MobileMenuButton";
import LogOutModal from "../../components/modal/LogOutModal";
import { getMediaUrl } from "../../utils/chatHelpers";
import { clearAuthSession } from "../../utils/auth";
import {
  ArrowLeft,
  Camera,
  User,
  Lock,
  Shield,
  CheckCircle2,
  Mail,
  Phone,
  Building2,
  BadgeCheck,
  Briefcase,
  Fingerprint,
  Sparkles,
  LayoutDashboard,
  Users,
  UserRoundPen,
  ScanLine,
} from "lucide-react";
import {
  isAppLockEnabled,
  registerBiometricCredential,
  setAppLockEnabled,
} from "../../utils/biometricLock";
import AnimatedBackground from "../../components/motion/AnimatedBackground";
import ThreeDCardContainer from "../../components/motion/ThreeDCardContainer";

interface EmployeeProfile {
  employee_id: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  profile_img: string;
  date_of_birth?: string;
  join_date?: string;
  role?: string;
}

const getError = (err: unknown, fallback: string) => {
  const e = err as { response?: { data?: { error?: string } } };
  return e.response?.data?.error || fallback;
};

export default function Profile() {
  const navigate = useNavigate();
  const location = useLocation();
  const webcamRef = useRef<Webcam>(null);

  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showFaceEnrollment, setShowFaceEnrollment] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [appLock, setAppLock] = useState(() => isAppLockEnabled());
  const [faceSaving, setFaceSaving] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"general" | "biometrics" | "security">("general");

  const [showMenu, setShowMenu] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const employeeId = localStorage.getItem("employee_id") || "";
  const employeeName = profile?.name || localStorage.getItem("employee_name") || "Employee";
  const profileImg = getMediaUrl(profile?.profile_img || localStorage.getItem("profile_img") || "");

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const handleLogout = () => {
    clearAuthSession();
    navigate("/", { replace: true });
  };

  const sidebarItems = useMemo(
    () => [
      {
        icon: <LayoutDashboard size={18} />,
        label: "Dashboard",
        onClick: () => navigate("/dashboard"),
        active: location.pathname === "/dashboard",
      },
      {
        icon: <Users size={18} />,
        label: "Team",
        onClick: () => navigate("/team"),
        active: location.pathname === "/team",
      },
      {
        icon: <UserRoundPen size={18} />,
        label: "Profile",
        onClick: () => navigate("/profile"),
        active: location.pathname === "/profile",
      },
      {
        icon: <ScanLine size={18} />,
        label: "Check Out",
        onClick: () => navigate("/check-out"),
        active: location.pathname === "/check-out",
      },
    ],
    [location.pathname, navigate],
  );

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
      if (data.profile_img) {
        localStorage.setItem("profile_img", data.profile_img);
      }
    } catch (err) {
      showToast(getError(err, "Could not load profile"), false);
    } finally {
      setLoading(false);
    }
  }, [employeeId, navigate]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const saveProfileDetails = async () => {
    if (!name.trim()) {
      showToast("Name is required", false);
      return;
    }
    try {
      setSaving(true);
      await API.post("/employees/update-profile/", {
        employee_id: employeeId,
        name,
        phone,
      });
      showToast("Profile details updated successfully!");
      if (profile) {
        setProfile({ ...profile, name, phone });
      }
      localStorage.setItem("employee_name", name);
    } catch (err) {
      showToast(getError(err, "Failed to update profile"), false);
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (!currentPassword || !newPassword) {
      showToast("Please enter current and new password", false);
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("New passwords do not match", false);
      return;
    }
    try {
      setSaving(true);
      await API.post("/employees/update-profile/", {
        employee_id: employeeId,
        name,
        phone,
        current_password: currentPassword,
        new_password: newPassword,
      });
      showToast("Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      showToast(getError(err, "Password update failed"), false);
    } finally {
      setSaving(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
        setShowImageModal(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCroppedImageSave = async (croppedBase64: string) => {
    setShowImageModal(false);
    try {
      setSaving(true);
      const res = await API.post("/employees/update-profile/", {
        employee_id: employeeId,
        profile_img: croppedBase64,
      });
      const updatedImg =
        res.data?.employee?.profile_img ||
        res.data?.profile_img ||
        "";
      if (updatedImg) {
        localStorage.setItem("profile_img", updatedImg);
        setProfile((prev) => (prev ? { ...prev, profile_img: updatedImg } : null));
      }
      showToast("Profile picture updated!");
      await loadProfile();
    } catch (err) {
      showToast(getError(err, "Failed to update profile picture"), false);
    } finally {
      setSaving(false);
    }
  };

  const handleCaptureFace = () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        setCapturedImage(imageSrc);
      }
    }
  };

  const handleUpdateFace = async () => {
    if (!capturedImage) return;
    try {
      setFaceSaving(true);
      await API.post(
        "/employees/update-face/",
        {
          employee_id: employeeId,
          image: capturedImage,
        },
        { timeout: FACE_REQUEST_TIMEOUT_MS }
      );
      showToast("Face biometric dataset updated successfully!");
      setShowFaceEnrollment(false);
      setCapturedImage(null);
    } catch (err) {
      showToast(getError(err, "Failed to update face biometric model"), false);
    } finally {
      setFaceSaving(false);
    }
  };

  const handleToggleAppLock = async (enabled: boolean) => {
    if (enabled) {
      const ok = await registerBiometricCredential(employeeId);
      if (ok) {
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent mx-auto mb-4" />
          <p className="text-slate-400 text-sm font-medium">Loading Employee Profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-slate-50 text-slate-900 dark:bg-[#080d1a] dark:text-slate-100 pb-16 px-4 py-5 sm:px-6 lg:pl-24 transition-colors duration-300">
      {/* Interactive 3D Background */}
      <AnimatedBackground particleColor={0x38bdf8} secondaryColor={0x818cf8} />

      {toast && <Toast message={toast.msg} ok={toast.ok} />}

      {/* Navigation Sidebar */}
      <AdminSidebar
        items={sidebarItems}
        onLogout={() => setShowLogoutModal(true)}
        mobileOpen={showMenu}
        onMobileClose={() => setShowMenu(false)}
        adminName={employeeName}
        adminRole={employeeId}
        profileImg={profileImg}
      />

      <MobileMenuButton onClick={() => setShowMenu(true)} />

      {/* Main Content Area */}
      <div className="relative z-10 mx-auto max-w-5xl pt-12 sm:pt-5 lg:pt-0">
        {/* Sticky Header */}
        <header className="sticky top-0 z-30 mb-6 flex items-center justify-between border-b border-slate-200/80 dark:border-white/10 bg-white/75 dark:bg-slate-950/70 backdrop-blur-xl px-4 py-3.5 sm:px-6 shadow-sm dark:shadow-xl rounded-2xl">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-cyan-500" /> Back
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-500 animate-pulse" />
            <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
              My Profile
            </h1>
          </div>
          <div className="hidden sm:block text-right">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              Active Account
            </span>
          </div>
        </header>

        <main className="space-y-6">
          {/* Hero Profile Summary Card */}
          <ThreeDCardContainer maxDegrees={4}>
            <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 dark:border-white/15 bg-white/90 dark:bg-slate-950/80 p-6 sm:p-8 shadow-xl backdrop-blur-xl transition-colors">
              {/* Subtle ambient lighting */}
              <div className="pointer-events-none absolute -top-24 -left-24 h-48 w-48 rounded-full bg-cyan-500/10 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-24 -right-24 h-48 w-48 rounded-full bg-blue-500/10 blur-3xl" />

              <div className="relative flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
                  {/* Avatar Upload */}
                  <div className="relative group shrink-0">
                    <div className="h-28 w-28 sm:h-32 sm:w-32 rounded-full overflow-hidden border-3 border-cyan-500/40 bg-slate-100 dark:bg-slate-900 shadow-xl">
                      <ProfileAvatarImg
                        src={profileImg}
                        alt={profile?.name || "Employee"}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <label
                      htmlFor="avatar-upload"
                      className="absolute bottom-1 right-1 p-2.5 bg-gradient-to-tr from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 rounded-full text-white cursor-pointer shadow-lg transition transform hover:scale-110 border border-white/30"
                      title="Update Profile Photo"
                    >
                      <Camera className="w-4 h-4" />
                    </label>
                    <input
                      id="avatar-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                  </div>

                  {/* Profile Metadata */}
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                        {profile?.name || "Employee"}
                      </h2>
                      <BadgeCheck className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-500 shrink-0" />
                    </div>

                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300">
                      <span className="flex items-center gap-1.5 text-blue-600 dark:text-cyan-300">
                        <Briefcase className="w-4 h-4 text-cyan-500" />
                        {profile?.designation || "Staff Member"}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1.5 text-slate-600 dark:text-indigo-300">
                        <Building2 className="w-4 h-4 text-indigo-500" />
                        {profile?.department || "General"}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1 text-xs text-slate-500 dark:text-slate-400">
                      <span className="bg-slate-100 dark:bg-slate-900 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-800 font-mono font-semibold">
                        ID: {profile?.employee_id}
                      </span>
                      <span className="flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        {profile?.email}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status Pill */}
                <div className="w-full sm:w-auto">
                  <div className="p-4 rounded-2xl bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-white/10 backdrop-blur-md text-center sm:text-right">
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Status</p>
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-center sm:justify-end gap-1.5 mt-0.5">
                      <CheckCircle2 className="w-4 h-4" /> Active Employee
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </ThreeDCardContainer>

          {/* Tab Navigation Controls */}
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-3 overflow-x-auto">
            <button
              onClick={() => setActiveTab("general")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition cursor-pointer whitespace-nowrap ${activeTab === "general"
                ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md shadow-cyan-500/20"
                : "bg-white dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-transparent"
                }`}
            >
              <User className="w-4 h-4" /> Personal Information
            </button>
            <button
              onClick={() => setActiveTab("biometrics")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition cursor-pointer whitespace-nowrap ${activeTab === "biometrics"
                ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md shadow-cyan-500/20"
                : "bg-white dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-transparent"
                }`}
            >
              <Fingerprint className="w-4 h-4" /> Biometrics &amp; Face AI
            </button>
            <button
              onClick={() => setActiveTab("security")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition cursor-pointer whitespace-nowrap ${activeTab === "security"
                ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md shadow-cyan-500/20"
                : "bg-white dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-transparent"
                }`}
            >
              <Lock className="w-4 h-4" /> Password &amp; Security
            </button>
          </div>

          {/* ── TAB 1: PERSONAL DETAILS ── */}
          {activeTab === "general" && (
            <div className="rounded-3xl border border-slate-200/80 dark:border-white/15 bg-white/90 dark:bg-slate-950/80 p-6 sm:p-8 backdrop-blur-xl space-y-6 shadow-lg">
              <div className="flex items-center gap-2.5 text-slate-900 dark:text-white font-bold text-base sm:text-lg border-b border-slate-200 dark:border-white/10 pb-4">
                <User className="w-5 h-5 text-cyan-500" />
                Personal Details
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 tracking-wider uppercase mb-1.5 block">
                    Full Name <span className="text-cyan-500">*</span>
                  </label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter full name"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/90 py-2.5 px-3.5 text-sm text-slate-900 dark:text-white outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 tracking-wider uppercase mb-1.5 block">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Enter phone number"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/90 py-2.5 pl-3.5 pr-10 text-sm text-slate-900 dark:text-white outline-none focus:border-cyan-500"
                    />
                    <Phone className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-1.5 block">
                    Official Email (Read Only)
                  </label>
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium flex items-center justify-between">
                    <span>{profile?.email || "--"}</span>
                    <Mail className="w-4 h-4 text-slate-400" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-1.5 block">
                    Employee ID (Read Only)
                  </label>
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-sm font-mono flex items-center justify-between">
                    <span>{profile?.employee_id || "--"}</span>
                    <BadgeCheck className="w-4 h-4 text-slate-400" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-1.5 block">
                    Department
                  </label>
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium">
                    {profile?.department || "General"}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-1.5 block">
                    Job Designation
                  </label>
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium">
                    {profile?.designation || "Staff Member"}
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  onClick={saveProfileDetails}
                  disabled={saving}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-sm shadow-md shadow-cyan-500/20 cursor-pointer disabled:opacity-50"
                >
                  {saving ? "Saving Changes..." : "Save Profile Details"}
                </Button>
              </div>
            </div>
          )}

          {/* ── TAB 2: BIOMETRICS & FACE AI ── */}
          {activeTab === "biometrics" && (
            <div className="rounded-3xl border border-slate-200/80 dark:border-white/15 bg-white/90 dark:bg-slate-950/80 p-6 sm:p-8 backdrop-blur-xl space-y-6 shadow-lg">
              <div className="flex items-center gap-2.5 text-slate-900 dark:text-white font-bold text-base sm:text-lg border-b border-slate-200 dark:border-white/10 pb-4">
                <Shield className="w-5 h-5 text-cyan-500" />
                Biometric &amp; Security Settings
              </div>

              <div className="space-y-4">
                {/* App Lock Toggle */}
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Fingerprint className="w-5 h-5 text-cyan-500" /> App Lock (Device Biometrics)
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Prompt for Touch ID / Face ID / Windows Hello when opening the app.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={appLock}
                      onChange={(e) => handleToggleAppLock(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-12 h-6.5 bg-slate-300 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2.5px] after:left-[2.5px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                  </label>
                </div>

                {/* Face Enrollment */}
                <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Camera className="w-5 h-5 text-cyan-500" /> Face Recognition Model
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Re-enroll or update your AI facial biometric dataset for attendance authentication.
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      setShowFaceEnrollment(!showFaceEnrollment);
                      setCapturedImage(null);
                    }}
                    className="px-4 py-2.5 text-xs font-bold rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-600 dark:text-cyan-300 hover:bg-cyan-500/25 transition cursor-pointer"
                  >
                    {showFaceEnrollment ? "Close Camera" : "Re-enroll Face Data"}
                  </Button>
                </div>

                {showFaceEnrollment && (
                  <div className="p-6 rounded-2xl bg-slate-100 dark:bg-slate-900/90 border border-cyan-500/40 space-y-4">
                    <h5 className="text-xs font-bold text-slate-700 dark:text-slate-200 text-center uppercase tracking-wider">
                      Live Face Capture Preview
                    </h5>
                    <div className="relative mx-auto w-full max-w-sm aspect-video overflow-hidden rounded-2xl bg-slate-950 border-2 border-cyan-500/40 shadow-2xl">
                      {capturedImage ? (
                        <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
                      ) : (
                        <Webcam
                          audio={false}
                          ref={webcamRef}
                          screenshotFormat="image/jpeg"
                          onUserMedia={() => setCameraReady(true)}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>

                    <div className="flex justify-center gap-3">
                      {!capturedImage ? (
                        <Button
                          onClick={handleCaptureFace}
                          disabled={!cameraReady}
                          className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs py-2.5 px-5 rounded-xl cursor-pointer"
                        >
                          <Camera className="w-4 h-4 mr-1.5" /> Capture Photo
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="secondary"
                            onClick={() => setCapturedImage(null)}
                            className="cursor-pointer text-xs py-2.5 px-4 rounded-xl"
                          >
                            Retake
                          </Button>
                          <Button
                            onClick={handleUpdateFace}
                            disabled={faceSaving}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2.5 px-5 rounded-xl cursor-pointer"
                          >
                            {faceSaving ? "Saving Face Model..." : "Save Face Model"}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB 3: PASSWORD & SECURITY ── */}
          {activeTab === "security" && (
            <div className="rounded-3xl border border-slate-200/80 dark:border-white/15 bg-white/90 dark:bg-slate-950/80 p-6 sm:p-8 backdrop-blur-xl space-y-6 shadow-lg">
              <div className="flex items-center gap-2.5 text-slate-900 dark:text-white font-bold text-base sm:text-lg border-b border-slate-200 dark:border-white/10 pb-4">
                <Lock className="w-5 h-5 text-cyan-500" />
                Password &amp; Credentials
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 tracking-wider uppercase mb-1.5 block">
                    Current Password
                  </label>
                  <PasswordField
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/90 py-2.5 px-3.5 text-sm text-slate-900 dark:text-white outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 tracking-wider uppercase mb-1.5 block">
                    New Password
                  </label>
                  <PasswordField
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/90 py-2.5 px-3.5 text-sm text-slate-900 dark:text-white outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 tracking-wider uppercase mb-1.5 block">
                    Confirm New Password
                  </label>
                  <PasswordField
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/90 py-2.5 px-3.5 text-sm text-slate-900 dark:text-white outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  onClick={changePassword}
                  disabled={saving}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-sm shadow-md shadow-cyan-500/20 cursor-pointer disabled:opacity-50"
                >
                  {saving ? "Updating Password..." : "Update Account Password"}
                </Button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Logout Confirmation Modal */}
      <LogOutModal
        open={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onLogout={handleLogout}
      />

      {/* Image Crop Modal */}
      {showImageModal && selectedImage && (
        <ProfilePhotoCropModal
          imageSrc={selectedImage}
          onClose={() => setShowImageModal(false)}
          onSave={handleCroppedImageSave}
        />
      )}
    </div>
  );
}
