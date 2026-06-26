import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import Webcam from "react-webcam";
import API, { FACE_REQUEST_TIMEOUT_MS } from "../../services/api";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import PasswordField from "../../components/common/PasswordField";
import Toast from "../../components/common/Toast";
import ProfilePhotoCropModal from "../../components/common/ProfilePhotoCropModal";
import SearchableSelect from "../../components/auth/SearchableSelect";
import CvDropZone from "../../components/auth/CvDropZone";
import { getMediaUrl } from "../../utils/chatHelpers";
import { ArrowLeft, BriefcaseBusiness, Camera, Download, FileText, X } from "lucide-react";

const DEPARTMENTS = ["IT", "HR", "Finance", "Operations", "Sales", "Marketing"];
const JOB_ROLES = [
  "Software Engineer",
  "Frontend Developer",
  "Backend Developer",
  "QA Engineer",
  "HR Executive",
  "Accountant",
  "Operations Executive",
  "Sales Executive",
  "Full Stack Developer",
  "DevOps Engineer",
  "UI/UX Designer",
  "Intern",
  "Project Manager",
];

interface EmployeeProfile {
  employee_id: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  profile_img: string;
  cv_file: string;
}

const fieldClass =
  "profile-field mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 p-3 text-white outline-none";

const getError = (err: unknown, fallback: string) => {
  const e = err as { response?: { data?: { error?: string } } };
  return e.response?.data?.error || fallback;
};

export default function AdminProfile() {
  const navigate = useNavigate();
  const webcamRef = useRef<Webcam>(null);
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("IT");
  const [designation, setDesignation] = useState("Software Engineer");
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
  const [faceSaving, setFaceSaving] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const employeeId = localStorage.getItem("employee_id") || "";

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
      const res = await API.post("/employees/update-profile/", {
        employee_id: employeeId,
        name,
        phone,
        department,
        designation,
        current_password: "",
        new_password: "",
        cv_file: cvFile,
        cv_file_name: cvFileName,
      });
      const data = res.data.employee as EmployeeProfile;
      setProfile(data);
      localStorage.setItem("employee_name", data.name);
      localStorage.setItem("cv_file", data.cv_file || "");
      setDepartment(data.department || "IT");
      setDesignation(data.designation || "Software Engineer");
      setCvFile("");
      setCvFileName("");
      setCvReplaceMode(false);
      showToast(res.data.message || "Profile updated");
    } catch (err) {
      showToast(getError(err, "Profile update failed"), false);
    } finally {
      setSaving(false);
    }
  };

  const updatePassword = async () => {
    if (!currentPassword) {
      showToast("Current password is required", false);
      return;
    }
    if (!newPassword) {
      showToast("Enter a new password", false);
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("New passwords do not match", false);
      return;
    }
    try {
      setSaving(true);
      const res = await API.post("/employees/update-profile/", {
        employee_id: employeeId,
        name,
        phone,
        department,
        designation,
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showToast(res.data.message || "Password updated");
    } catch (err) {
      showToast(getError(err, "Password update failed"), false);
    } finally {
      setSaving(false);
    }
  };

  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });

  const isPdfFile = (file: File) =>
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

  const uploadProfilePhoto = (file: File) => {
    if (!file.type.startsWith("image/")) {
      showToast("Please choose an image file", false);
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      setSelectedImage(String(reader.result));
    };

    reader.readAsDataURL(file);
  };

  const saveCroppedPhoto = async (croppedBase64: string) => {
    try {
      setSaving(true);
      const res = await API.post("/employees/update-profile-photo/", {
        employee_id: employeeId,
        image: croppedBase64,
      });

      const data = res.data.employee;
      setProfile(data);
      localStorage.setItem("profile_img", data.profile_img || "");
      showToast("Profile photo updated");
      setSelectedImage(null);
    } catch (err) {
      showToast(getError(err, "Upload failed"), false);
    } finally {
      setSaving(false);
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-[#0f172a] to-slate-950 px-4 py-6 text-white">
      {toast && <Toast message={toast.msg} ok={toast.ok} />}

      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center gap-3">
          <Button
            type="button"
            onClick={() => navigate("/attendance-sheet")}
            text={<ArrowLeft size={18} />}
            unstyled
            className="rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-slate-300 transition hover:border-slate-600 hover:text-white"
            aria-label="Back to dashboard"
          />
          <div>
            <h1 className="text-2xl font-bold text-white">Profile Details</h1>
            <p className="text-sm text-slate-400">
              Manage your account, credentials, and biometrics
            </p>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
          <section className="flex flex-col rounded-3xl border border-slate-800/80 bg-slate-900/80 p-6 shadow-xl backdrop-blur-sm">
            <label className="group relative mx-auto mb-5 block h-32 w-32 cursor-pointer">
              <div
                onClick={(e) => {
                  e.preventDefault();
                  if (profile?.profile_img) setShowImageModal(true);
                }}
                className="h-full w-full overflow-hidden rounded-full border-2 border-slate-700 bg-slate-800"
              >
                {profile?.profile_img ? (
                  <img
                    src={getMediaUrl(profile.profile_img)}
                    alt={profile.name}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-blue-600 to-cyan-500 text-4xl font-bold">
                    {profile?.name?.charAt(0) || "A"}
                  </div>
                )}
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center rounded-full bg-black/0 px-2 text-center opacity-0 transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:bg-black/60 group-hover:opacity-100">
                <Camera size={22} className="text-white" />
                <span className="mt-1 text-[10px] font-semibold leading-tight text-white">
                  Change profile photo
                </span>
              </div>
              <Input
                type="file"
                accept="image/*"
                className="absolute inset-0 cursor-pointer opacity-0"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadProfilePhoto(file);
                  e.target.value = "";
                }}
              />
            </label>

            <h2 className="text-center text-xl font-bold">{profile?.name}</h2>
            <p className="text-center text-sm text-slate-400">{profile?.employee_id}</p>

            <div className="mt-6 flex-1 space-y-3 text-sm">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3.5">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Email
                </p>
                <p className="mt-1 font-medium text-slate-200">{profile?.email}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3.5">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Department / Role
                </p>
                <p className="mt-1 font-medium text-slate-200">
                  {department} · {designation}
                </p>
              </div>

              {(profile?.cv_file || cvFile) && !cvReplaceMode ? (
                <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-blue-500/30 bg-blue-500/15 text-blue-300">
                      <FileText size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-blue-300/80">
                        Resume / CV
                      </p>
                      <p className="mt-0.5 truncate font-semibold text-white">
                        {cvDisplayName}
                      </p>
                      {cvFile && (
                        <p className="mt-1 text-xs text-amber-300">
                          Pending save — click Save profile
                        </p>
                      )}
                    </div>
                  </div>
                  {activeCvUrl && (
                    <div className="mt-3 flex gap-2">
                      <a
                        href={activeCvUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 rounded-xl border border-blue-500/40 bg-slate-950/60 py-2 text-center text-xs font-semibold text-blue-200 transition hover:bg-blue-500/20"
                      >
                        Preview
                      </a>
                      <a
                        href={activeCvUrl}
                        download={cvDisplayName || "resume.pdf"}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-blue-500/40 bg-slate-950/60 py-2 text-xs font-semibold text-blue-200 transition hover:bg-blue-500/20"
                      >
                        <Download size={14} />
                        Download
                      </a>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setCvReplaceMode(true)}
                    className="mt-3 w-full rounded-xl border border-slate-600/60 bg-slate-950/50 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white"
                  >
                    Replace CV
                  </button>
                </div>
              ) : (
                <div>
                  {cvReplaceMode && (
                    <button
                      type="button"
                      onClick={() => {
                        setCvReplaceMode(false);
                        setCvFile("");
                        setCvFileName("");
                      }}
                      className="mb-2 text-xs font-medium text-slate-400 transition hover:text-white"
                    >
                      Cancel replace
                    </button>
                  )}
                  <CvDropZone
                    fileName={cvFileName}
                    onFileReady={(dataUrl, name) => {
                      setCvFile(dataUrl);
                      setCvFileName(name);
                      setCvReplaceMode(false);
                      showToast("CV selected. Click Save profile to upload.");
                    }}
                    onClear={() => {
                      setCvFile("");
                      setCvFileName("");
                    }}
                    onError={(msg) => showToast(msg, false)}
                    isPdfFile={isPdfFile}
                    fileToDataUrl={fileToDataUrl}
                  />
                </div>
              )}
            </div>
          </section>

          <div className="grid gap-5">
            <section className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-6 shadow-xl backdrop-blur-sm">
              <h2 className="mb-1 text-xl font-bold">Profile details</h2>
              <p className="mb-5 text-sm text-slate-400">
                Update your personal and role information
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm text-slate-400">
                  Full name
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={fieldClass}
                  />
                </label>
                <label className="text-sm text-slate-400">
                  Phone
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={fieldClass}
                  />
                </label>
                <SearchableSelect
                  label="Department *"
                  value={department}
                  options={DEPARTMENTS}
                  onChange={setDepartment}
                  icon={<BriefcaseBusiness size={18} />}
                  placeholder="Search department..."
                />
                <SearchableSelect
                  label="Job Role *"
                  value={designation}
                  options={JOB_ROLES}
                  onChange={setDesignation}
                  icon={<BriefcaseBusiness size={18} />}
                  placeholder="Search role..."
                />
              </div>
              <Button
                text={saving ? "Saving..." : "Save profile"}
                onClick={saveProfileDetails}
                disabled={saving}
                className="mt-6 rounded-2xl bg-blue-600 px-5 py-3 font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </section>

            <section className="rounded-3xl border border-slate-800/80 border-t-indigo-500/20 bg-slate-900/80 p-6 shadow-xl backdrop-blur-sm">
              <div className="mb-5 border-b border-slate-800 pb-5">
                <h2 className="text-xl font-bold">Password</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Change your sign-in password. This section is separate from profile
                  details.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <PasswordField
                  label="Current password"
                  value={currentPassword}
                  onChange={setCurrentPassword}
                  placeholder="••••••••"
                />
                <PasswordField
                  label="New password"
                  value={newPassword}
                  onChange={setNewPassword}
                  placeholder="••••••••"
                />
                <PasswordField
                  label="Confirm new password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder="••••••••"
                />
              </div>
              <Button
                text={saving ? "Updating..." : "Update password"}
                onClick={updatePassword}
                disabled={saving}
                className="mt-6 rounded-2xl bg-indigo-600 px-5 py-3 font-bold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </section>

            <section className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-6 shadow-xl backdrop-blur-sm">
              <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-xl font-bold">Face re-enrollment</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Use this when face verification is failing repeatedly.
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-stretch gap-3 sm:items-end">
                  <div className="inline-flex items-center gap-2.5 self-start rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200 sm:self-end">
                    <span className="biometric-status-dot h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                    Status: Biometrics Enrolled &amp; Active
                  </div>
                  <Button
                    text={
                      showFaceEnrollment
                        ? "Close re-enrollment"
                        : "Start re-enrollment"
                    }
                    onClick={() => {
                      setShowFaceEnrollment((value) => !value);
                      setCapturedImage(null);
                    }}
                    className="rounded-2xl bg-cyan-600 px-5 py-3 font-bold transition hover:bg-cyan-500"
                  />
                </div>
              </div>

              {showFaceEnrollment && (
                <div className="mt-5 grid gap-5 lg:grid-cols-[420px_1fr]">
                  <div className="relative aspect-video overflow-hidden rounded-[28px] border-4 border-slate-700 bg-black">
                    {capturedImage ? (
                      <img
                        src={capturedImage}
                        alt="Captured face"
                        className="h-full w-full object-cover"
                      />
                    ) : (
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
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex flex-col justify-center gap-3">
                    <Button
                      text="Capture new face"
                      onClick={captureFace}
                      disabled={!cameraReady || faceSaving}
                      className="rounded-2xl bg-blue-600 px-5 py-3 font-bold hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                    />

                    <Button
                      text={faceSaving ? "Updating..." : "Save face profile"}
                      onClick={saveFace}
                      disabled={!capturedImage || faceSaving}
                      className="rounded-2xl bg-green-600 px-5 py-3 font-bold hover:bg-green-700 disabled:opacity-50 cursor-pointer"
                    />

                    {capturedImage && (
                      <Button
                        text="Retake photo"
                        onClick={() => setCapturedImage(null)}
                        className="rounded-2xl border border-slate-700 px-5 py-3 font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer"
                      />
                    )}
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      {showImageModal && profile?.profile_img && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-5">
          <div className="relative">
            <Button
              text={<X />}
              onClick={() => setShowImageModal(false)}
              className="absolute top-2 right-2 text-black text-xl cursor-pointer"
            />

            <img
              src={getMediaUrl(profile.profile_img)}
              alt="Profile"
              className="max-h-[90vh] max-w-[90vw] rounded-3xl"
            />
          </div>
        </div>
      )}

      {selectedImage && (
        <ProfilePhotoCropModal
          imageSrc={selectedImage}
          onCancel={() => setSelectedImage(null)}
          onSave={saveCroppedPhoto}
          saving={saving}
        />
      )}
    </div>
  );
}
