import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Webcam from "react-webcam";
import { motion, AnimatePresence } from "framer-motion";
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
  Calendar,
  ChartNoAxesCombined,
  IdCardLanyard,
  Lock,
  Shield,
  Mail,
  Phone,
  Building2,
  Fingerprint,
  ScanLine,
} from "lucide-react";
import {
  DEPARTMENTS,
  getJobRolesForDepartment,
  pickDesignationForDepartment,
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
    setDesignation((current) => pickDesignationForDepartment(next, current));
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
    void loadProfile();
  }, [loadProfile]);

  const saveProfile = async () => {
    if (!employeeId) return;
    try {
      setSaving(true);
      const payload: Record<string, unknown> = {
        employee_id: employeeId,
        name,
        phone,
        department,
        designation,
        date_of_birth: dateOfBirth,
        join_date: joinDate,
      };
      if (cvFile) payload.cv_file = cvFile;

      const res = await API.post("/employees/update-profile/", payload);
      const data = res.data.employee as EmployeeProfile;
      setProfile(data);
      localStorage.setItem("employee_name", data.name || name);
      showToast(res.data.message || "Profile updated successfully");
      setCvFile("");
      setCvFileName("");
      setCvReplaceMode(false);
    } catch (err) {
      showToast(getError(err, "Save failed"), false);
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (!currentPassword || !newPassword) {
      showToast("Fill in current and new password", false);
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
      showToast(res.data.message || "Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      showToast(getError(err, "Password change failed"), false);
    }
  };

  const handleToggleAppLock = async () => {
    const nextState = !appLock;
    if (nextState) {
      const ok = await registerBiometricCredential(
        profile?.email || employeeId,
      );
      if (!ok) {
        showToast(
          "Biometric setup failed or not supported on this device.",
          false,
        );
        return;
      }
    }
    setAppLockEnabled(nextState);
    setAppLock(nextState);
    showToast(
      nextState ? "App Lock (Biometric) enabled" : "App Lock disabled",
    );
  };

  const handleCroppedPhoto = async (base64Image: string) => {
    try {
      const res = await API.post(
        "/employees/update-profile-photo/",
        {
          employee_id: employeeId,
          image: base64Image,
        },
        { timeout: FACE_REQUEST_TIMEOUT_MS },
      );
      const data = res.data.employee as EmployeeProfile;
      setProfile(data);
      if (data.profile_img) {
        localStorage.setItem("profile_img", data.profile_img);
      }
      showToast(res.data.message || "Profile picture updated");
      setCropImageSrc(null);
    } catch (err) {
      showToast(getError(err, "Failed to update profile photo"), false);
    }
  };

  const captureFace = () => {
    const snap = webcamRef.current?.getScreenshot();
    if (!snap) {
      showToast("Could not capture image", false);
      return;
    }
    setCapturedImage(snap);
  };

  const saveFace = async () => {
    if (!capturedImage) {
      showToast("Capture your face first", false);
      return;
    }
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
      showToast(res.data.message || "Face profile updated");
    } catch (err) {
      showToast(getError(err, "Face update failed"), false);
    } finally {
      setFaceSaving(false);
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
        icon: <Download size={18} />,
        label: "Attendance",
        onClick: () => navigate("/attendance-sheet"),
        active: location.pathname === "/attendance-sheet",
      },
    ],
    [location.pathname, navigate],
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-blue-500" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 overflow-x-hidden transition-colors duration-300">
      <AnimatedBackground />

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

      <main className="relative z-10 mx-auto max-w-7xl p-4 sm:p-6 lg:p-8 lg:ml-22">
        <AnimatePresence>
          {toast && <Toast key={toast.msg} message={toast.msg} ok={toast.ok} />}
        </AnimatePresence>

        {/* HEADER SECTION */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-3">
            <Button
              type="button"
              onClick={() => navigate(-1)}
              text={<ArrowLeft size={18} />}
              unstyled
              className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-md cursor-pointer transition"
              aria-label="Back"
            />
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 dark:bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/20 mb-1">
                <Shield size={13} />
                <span>Admin Workspace</span>
              </div>
              <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Admin Profile &amp; Settings</h1>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Manage your administrator account credentials, biometrics, and security options
              </p>
            </div>
          </div>
        </motion.div>

        {/* MAIN 3D GRID LAYOUT */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 items-start w-full">
          {/* LEFT AVATAR & QUICK STATS CARD */}
          <div className="space-y-6">
            <ThreeDCardContainer maxDegrees={10}>
              <div className="flex flex-col items-center rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 shadow-xl backdrop-blur-xl text-center">
                <div className="relative mb-4 block h-32 w-32">
                  <div
                    onClick={() => {
                      if (profile?.profile_img) setShowImageModal(true);
                    }}
                    className="h-full w-full overflow-hidden rounded-full border-4 border-blue-500/30 bg-slate-100 dark:bg-slate-800 shadow-md cursor-pointer group"
                    title="Click to view full photo"
                  >
                    {profile?.profile_img ? (
                      <ProfileAvatarImg
                        src={getMediaUrl(profile.profile_img)}
                        alt={profile.name}
                        className="transition duration-300 group-hover:scale-105 h-32 w-32 object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-blue-600 to-cyan-500 text-4xl font-extrabold text-white">
                        {profile?.name?.charAt(0) || "A"}
                      </div>
                    )}
                  </div>
                  <label
                    htmlFor="admin-avatar-upload"
                    className="absolute bottom-0 right-0 p-2.5 bg-blue-600 hover:bg-blue-500 rounded-full text-white cursor-pointer shadow-lg transition transform hover:scale-110 border border-white/20"
                    title="Change Profile Photo"
                  >
                    <Camera size={18} />
                  </label>
                  <input
                    id="admin-avatar-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>

                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{name || profile?.name}</h2>
                <p className="text-xs font-semibold text-blue-600 dark:text-cyan-400 mt-0.5">{profile?.employee_id}</p>

                <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                  <span className="rounded-full bg-blue-100 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 px-3 py-1 text-xs font-bold text-blue-700 dark:text-blue-300">
                    {adminRole}
                  </span>
                  <span className="rounded-full bg-emerald-100 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    {profile?.department || department}
                  </span>
                </div>

                <div className="mt-6 w-full space-y-3 text-left border-t border-slate-200 dark:border-slate-800/80 pt-5">
                  <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300 font-medium">
                    <Mail size={16} className="text-blue-500 shrink-0" />
                    <span className="truncate">{profile?.email}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300 font-medium">
                    <Phone size={16} className="text-emerald-500 shrink-0" />
                    <span>{phone || profile?.phone || "--"}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300 font-medium">
                    <Building2 size={16} className="text-purple-500 shrink-0" />
                    <span>{designation || profile?.designation || "--"}</span>
                  </div>
                </div>
              </div>
            </ThreeDCardContainer>

            {/* RIGHT CONTENT TAB PANELS */}
            <div>
              {/* GENERAL TAB */}
              {activeTab === "general" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xl backdrop-blur-xl"
                >
                  <div className="mb-6 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white">Personal Details</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Update your name, contact details, and department</p>
                    </div>
                    <User className="text-blue-500" size={24} />
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Full Name
                      </label>
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Admin Name"
                        className="mt-1.5 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-slate-900 dark:text-white outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Phone Number
                      </label>
                      <Input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+91 98765 43210"
                        className="mt-1.5 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-slate-900 dark:text-white outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
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
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
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
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Date of Birth
                      </label>
                      <DashboardDatePicker
                        value={dateOfBirth}
                        onChange={setDateOfBirth}
                        placeholder="YYYY-MM-DD"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Date of Joining
                      </label>
                      <DashboardDatePicker
                        value={joinDate}
                        onChange={setJoinDate}
                        placeholder="YYYY-MM-DD"
                      />
                    </div>
                  </div>

                  <div className="mt-8 flex justify-end">
                    <Button
                      onClick={saveProfile}
                      disabled={saving}
                      className="rounded-2xl bg-linear-to-r from-blue-600 to-cyan-600 px-7 py-3 text-sm font-bold text-white hover:from-blue-500 hover:to-cyan-500 disabled:opacity-50 transition shadow-lg shadow-blue-500/25 cursor-pointer"
                    >
                      {saving ? "Saving Changes..." : "Save Profile Details"}
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* SECURITY TAB */}
              {activeTab === "security" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xl backdrop-blur-xl space-y-6"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white">Change Password</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Ensure your administrative credentials remain secure</p>
                    </div>
                    <Lock className="text-cyan-500" size={24} />
                  </div>

                  <div className="space-y-4 max-w-lg">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Current Password
                      </label>
                      <PasswordField
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter current password"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        New Password
                      </label>
                      <PasswordField
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
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
                      className="mt-4 rounded-2xl bg-cyan-600 px-6 py-3 text-sm font-bold text-white hover:bg-cyan-500 transition shadow-md shadow-cyan-500/20 cursor-pointer"
                    >
                      Update Password
                    </Button>
                  </div>

                  {/* APP LOCK TOGGLE */}
                  <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-white">App Lock (Biometrics)</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Require fingerprint / Windows Hello / Face ID to open app</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleToggleAppLock}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${appLock ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700"
                          }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${appLock ? "translate-x-6" : "translate-x-1"
                            }`}
                        />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* BIOMETRICS TAB */}
              {activeTab === "biometrics" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xl backdrop-blur-xl space-y-6"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white">Face Biometrics Re-Enrollment</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Re-enroll 3D facial vectors for automated check-in verification</p>
                    </div>
                    <ScanLine className="text-emerald-500" size={24} />
                  </div>

                  {!showFaceEnrollment ? (
                    <div className="text-center py-6">
                      <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                        Camera capture allows updating your high-precision face recognition profile in real-time.
                      </p>
                      <Button
                        onClick={() => setShowFaceEnrollment(true)}
                        className="rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-500 transition shadow-lg shadow-emerald-500/20 cursor-pointer"
                      >
                        Open Biometric Camera
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="relative mx-auto max-w-md overflow-hidden rounded-2xl border-2 border-emerald-500/40 bg-black aspect-4/3">
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

                      <div className="flex justify-center gap-3">
                        {!capturedImage ? (
                          <Button
                            onClick={captureFace}
                            disabled={!cameraReady}
                            className="rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
                          >
                            Capture Snap
                          </Button>
                        ) : (
                          <Button
                            onClick={() => setCapturedImage(null)}
                            className="rounded-2xl bg-slate-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-600 cursor-pointer"
                          >
                            Retake
                          </Button>
                        )}

                        <Button
                          onClick={saveFace}
                          disabled={!capturedImage || faceSaving}
                          className="rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-50 cursor-pointer"
                        >
                          {faceSaving ? "Saving..." : "Save Face Vector"}
                        </Button>

                        <Button
                          onClick={() => {
                            setShowFaceEnrollment(false);
                            setCapturedImage(null);
                          }}
                          className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
                        >
                          Close Camera
                        </Button>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* CV / DOCUMENT TAB */}
              {activeTab === "cv" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xl backdrop-blur-xl space-y-6"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white">Document / Resume</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Upload or replace your official curriculum vitae</p>
                    </div>
                    <FileText className="text-purple-500" size={24} />
                  </div>

                  {activeCvUrl && !cvReplaceMode ? (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4">
                      <div className="flex items-center gap-3">
                        <div className="grid h-12 w-12 place-items-center rounded-xl bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300">
                          <FileText size={24} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">{cvDisplayName}</p>
                          <p className="text-xs text-slate-500">Document Uploaded</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <a
                          href={activeCvUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500 transition shadow-sm"
                        >
                          <Download size={14} /> Download CV
                        </a>
                        <Button
                          onClick={() => setCvReplaceMode(true)}
                          className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                        >
                          Replace
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
                      <div className="mt-4 flex justify-end gap-3">
                        {cvReplaceMode && (
                          <Button
                            onClick={() => setCvReplaceMode(false)}
                            className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
                          >
                            Cancel
                          </Button>
                        )}
                        <Button
                          onClick={saveProfile}
                          disabled={!cvFile || saving}
                          className="rounded-2xl bg-purple-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-purple-500 disabled:opacity-50 cursor-pointer shadow-md shadow-purple-500/20"
                        >
                          Save CV Document
                        </Button>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          </div>

          {/* TAB SELECTOR NAVIGATION */}
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-2 shadow-lg backdrop-blur-xl flex flex-col gap-1.5">
            {[
              { id: "general", label: "General Information", icon: <User size={16} /> },
              { id: "security", label: "Password & Security", icon: <Lock size={16} /> },
              { id: "biometrics", label: "Face & Biometrics", icon: <Fingerprint size={16} /> },
              { id: "cv", label: "Document / Resume", icon: <FileText size={16} /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition-all cursor-pointer ${activeTab === tab.id
                  ? "bg-linear-to-r from-blue-600 to-cyan-600 text-white shadow-md shadow-blue-500/20"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                  }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

        </div>

        {/* IMAGE PREVIEW MODAL */}
        {showImageModal && profile?.profile_img && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
            <div className="relative max-w-lg overflow-hidden rounded-3xl bg-slate-900 border border-slate-800 p-4 shadow-2xl">
              <button
                onClick={() => setShowImageModal(false)}
                className="absolute right-4 top-4 rounded-full bg-slate-800 p-2 text-slate-400 hover:text-white"
              >
                <X size={20} />
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
      </main>
    </div>
  );
}
