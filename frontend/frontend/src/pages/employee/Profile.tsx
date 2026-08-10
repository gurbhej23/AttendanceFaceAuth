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
  const [activeTab, setActiveTab] = useState<"general" | "security" | "biometrics">("general");

  const [showMenu, setShowMenu] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const employeeId = localStorage.getItem("employee_id") || "";
  const employeeName = localStorage.getItem("employee_name") || profile?.name || "Employee";
  const profileImg = getMediaUrl(localStorage.getItem("profile_img") || profile?.profile_img);

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
      showToast("Profile updated successfully!");
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
      await API.post("/employees/update-profile/", {
        employee_id: employeeId,
        profile_img: croppedBase64,
      });
      showToast("Profile picture updated!");
      loadProfile();
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
      showToast("Face verification model updated successfully!");
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
      <div className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent mx-auto mb-4" />
          <p className="text-slate-400 text-sm font-medium">Loading Employee Profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-linear-to-br from-[#020617] via-[#0f172a] to-[#111827] text-slate-100 pb-16 px-4 py-5 sm:px-5 lg:px-5">
      {/* 3D WebGL Particle Background Canvas */}
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

      {/* Main Content Layout offset by sidebar */}
      <div className="relative z-10 mx-auto max-w-7xl pt-12 sm:pt-5 lg:ml-22 lg:pt-0">
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
              Employee Profile
            </h1>
          </div>
          <div className="hidden sm:block text-right">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Verified Account
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
                      src={profileImg}
                      alt={profile?.name || "Employee"}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <label
                    htmlFor="avatar-upload"
                    className="absolute bottom-1 right-1 p-2.5 bg-cyan-600 hover:bg-cyan-500 rounded-full text-white cursor-pointer shadow-lg transition transform hover:scale-110 border border-white/20"
                    title="Change Profile Photo"
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

                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                      {profile?.name || "Employee"}
                    </h2>
                    <BadgeCheck className="w-6 h-6 text-cyan-400 shrink-0" />
                  </div>

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs sm:text-sm text-slate-300">
                    <span className="flex items-center gap-1.5 font-medium text-cyan-300">
                      <Briefcase className="w-4 h-4 text-cyan-400" />
                      {profile?.designation || "Staff Member"}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1.5 font-medium text-indigo-300">
                      <Building2 className="w-4 h-4 text-indigo-400" />
                      {profile?.department || "General"}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-1 text-xs text-slate-400">
                    <span className="bg-slate-800/80 px-3 py-1 rounded-lg border border-slate-700/60 font-mono">
                      ID: {profile?.employee_id}
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
                  <p className="text-xs text-slate-400 font-medium">Status</p>
                  <p className="text-sm font-bold text-emerald-400 flex items-center justify-center sm:justify-end gap-1.5 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" /> Active Employee
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
              <Fingerprint className="w-4 h-4" /> Biometrics & Face AI
            </button>
            <button
              onClick={() => setActiveTab("security")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-semibold text-sm transition cursor-pointer whitespace-nowrap ${activeTab === "security"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg"
                : "bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-transparent"
                }`}
            >
              <Lock className="w-4 h-4" /> Password & Security
            </button>
          </div>

          {/* TAB 1: GENERAL PERSONAL DETAILS */}
          {activeTab === "general" && (
            <div className="dash-shell-panel p-6 sm:p-8 border border-white/15 bg-transparent rounded-3xl backdrop-blur-xl space-y-6 shadow-xl">
              <div className="flex items-center gap-3 text-white font-bold text-lg border-b border-white/10 pb-4">
                <User className="w-5 h-5 text-cyan-400" />
                Personal & Professional Profile
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="text-xs font-semibold text-slate-300 tracking-wider uppercase">
                    Full Name
                  </label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter full name"
                    className="mt-2"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 tracking-wider uppercase">
                    Phone Number
                  </label>
                  <div className="relative mt-2">
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Enter phone number"
                    />
                    <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-3.5 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 tracking-wider uppercase">
                    Official Email (Read Only)
                  </label>
                  <div className="mt-2 p-3.5 rounded-2xl bg-slate-900/60 border border-slate-700/80 text-slate-200 text-sm font-medium flex items-center justify-between light:bg-slate-100 light:text-slate-900 light:border-slate-300">
                    <span>{profile?.email || "--"}</span>
                    <Mail className="w-4 h-4 text-slate-500" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 tracking-wider uppercase">
                    Employee ID (Read Only)
                  </label>
                  <div className="mt-2 p-3.5 rounded-2xl bg-slate-900/60 border border-slate-700/80 text-slate-200 text-sm font-mono flex items-center justify-between light:bg-slate-100 light:text-slate-900 light:border-slate-300">
                    <span>{profile?.employee_id || "--"}</span>
                    <BadgeCheck className="w-4 h-4 text-slate-500" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 tracking-wider uppercase">
                    Department
                  </label>
                  <div className="mt-2 p-3.5 rounded-2xl bg-slate-900/60 border border-slate-700/80 text-slate-200 text-sm font-medium light:bg-slate-100 light:text-slate-900 light:border-slate-300">
                    {profile?.department || "General"}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 tracking-wider uppercase">
                    Designation
                  </label>
                  <div className="mt-2 p-3.5 rounded-2xl bg-slate-900/60 border border-slate-700/80 text-slate-200 text-sm font-medium light:bg-slate-100 light:text-slate-900 light:border-slate-300">
                    {profile?.designation || "Staff Member"}
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <Button onClick={saveProfileDetails} disabled={saving} className="px-6 py-3 rounded-2xl bg-cyan-600 hover:bg-cyan-500 font-semibold cursor-pointer">
                  {saving ? "Saving Changes..." : "Save Profile Details"}
                </Button>
              </div>
            </div>
          )}

          {/* TAB 2: BIOMETRICS & FACE AI */}
          {activeTab === "biometrics" && (
            <div className="dash-shell-panel p-6 sm:p-8 border border-white/15 bg-transparent rounded-3xl backdrop-blur-xl space-y-6 shadow-xl">
              <div className="flex items-center gap-3 text-white font-bold text-lg border-b border-white/10 pb-4">
                <Shield className="w-5 h-5 text-cyan-400" />
                Biometric Authentication Settings
              </div>

              <div className="space-y-6">
                {/* App Lock Toggle */}
                <div className="p-5 rounded-2xl bg-transparent border border-white/15 flex items-center justify-between gap-4 backdrop-blur-md">
                  <div className="space-y-1">
                    <h4 className="text-base font-bold text-white flex items-center gap-2">
                      <Fingerprint className="w-5 h-5 text-cyan-400" /> App Lock (Passkey / Device Biometrics)
                    </h4>
                    <p className="text-xs text-slate-300">
                      Require fingerprint or face ID device prompt when opening the application.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={appLock}
                      onChange={(e) => handleToggleAppLock(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-12 h-6.5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2.5px] after:left-[2.5px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                  </label>
                </div>

                {/* Face Enrollment */}
                <div className="p-5 rounded-2xl bg-transparent border border-white/15 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 backdrop-blur-md">
                  <div className="space-y-1">
                    <h4 className="text-base font-bold text-white flex items-center gap-2">
                      <Camera className="w-5 h-5 text-cyan-400" /> Face Recognition Model
                    </h4>
                    <p className="text-xs text-slate-300">
                      Re-enroll or update your high-accuracy facial biometric dataset for attendance check-ins.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowFaceEnrollment(!showFaceEnrollment);
                      setCapturedImage(null);
                    }}
                    className="px-4 py-2.5 text-xs font-semibold cursor-pointer"
                  >
                    {showFaceEnrollment ? "Close Camera" : "Re-enroll Face Data"}
                  </Button>
                </div>

                {showFaceEnrollment && (
                  <div className="p-6 rounded-2xl bg-slate-900/90 border border-cyan-500/30 space-y-5 backdrop-blur-md">
                    <h5 className="text-sm font-bold text-slate-200 text-center sm:text-left">
                      Live Face Capture Preview
                    </h5>
                    <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-2xl bg-slate-950 border border-slate-700 shadow-2xl">
                      {capturedImage ? (
                        <img src={capturedImage} alt="Captured" className="w-full h-auto" />
                      ) : (
                        <Webcam
                          audio={false}
                          ref={webcamRef}
                          screenshotFormat="image/jpeg"
                          onUserMedia={() => setCameraReady(true)}
                          className="w-full h-auto"
                        />
                      )}
                    </div>

                    <div className="flex justify-center gap-4">
                      {!capturedImage ? (
                        <Button onClick={handleCaptureFace} disabled={!cameraReady} className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold cursor-pointer">
                          <Camera className="w-4 h-4 mr-2" /> Capture Frame
                        </Button>
                      ) : (
                        <>
                          <Button variant="secondary" onClick={() => setCapturedImage(null)} className="cursor-pointer">
                            Retake
                          </Button>
                          <Button onClick={handleUpdateFace} disabled={faceSaving} className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer">
                            {faceSaving ? "Saving Biometric Model..." : "Save Face Model"}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: PASSWORD & SECURITY */}
          {activeTab === "security" && (
            <div className="dash-shell-panel p-6 sm:p-8 border border-white/15 bg-transparent rounded-3xl backdrop-blur-xl space-y-6 shadow-xl">
              <div className="flex items-center gap-3 text-white font-bold text-lg border-b border-white/10 pb-4">
                <Lock className="w-5 h-5 text-cyan-400" />
                Password & Account Credentials
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div>
                  <label className="text-xs font-semibold text-slate-300 tracking-wider uppercase">
                    Current Password
                  </label>
                  <PasswordField
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="mt-2"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 tracking-wider uppercase">
                    New Password
                  </label>
                  <PasswordField
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="mt-2"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 tracking-wider uppercase">
                    Confirm New Password
                  </label>
                  <PasswordField
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="mt-2"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <Button onClick={changePassword} disabled={saving} className="px-6 py-3 rounded-2xl bg-cyan-600 hover:bg-cyan-500 font-semibold cursor-pointer">
                  Update Account Password
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
