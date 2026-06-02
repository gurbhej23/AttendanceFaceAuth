import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SyntheticEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import Webcam from "react-webcam";
import API from "../services/api";
import Button from "../components/Button";
import Input from "../components/Input";
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  type Crop,
  type PixelCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { X } from "lucide-react";

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

const getMediaUrl = (path?: string | null) => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `http://localhost:8000${path.startsWith("/") ? path : `/${path}`}`;
};

const getError = (err: unknown, fallback: string) => {
  const e = err as { response?: { data?: { error?: string } } };
  return e.response?.data?.error || fallback;
};

export default function AdminProfile() {
  const navigate = useNavigate();
  const webcamRef = useRef<Webcam>(null);
  const cropImageRef = useRef<HTMLImageElement>(null);
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
  const [showFaceEnrollment, setShowFaceEnrollment] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [faceSaving, setFaceSaving] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  const [showImageModal, setShowImageModal] = useState(false);

  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
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

  const saveProfile = async () => {
    if (!name.trim()) {
      showToast("Name is required", false);
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
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
        cv_file: cvFile,
        cv_file_name: cvFileName,
      });
      const data = res.data.employee as EmployeeProfile;
      setProfile(data);
      localStorage.setItem("employee_name", data.name);
      localStorage.setItem("cv_file", data.cv_file || "");
      setDepartment(data.department || "IT");
      setDesignation(data.designation || "Software Engineer");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setCvFile("");
      setCvFileName("");
      showToast(res.data.message || "Profile updated");
    } catch (err) {
      showToast(getError(err, "Profile update failed"), false);
    } finally {
      setSaving(false);
    }
  };

  const uploadCv = (file: File) => {
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    const allowedExtensions = [".pdf", ".doc", ".docx"];
    const lowerName = file.name.toLowerCase();

    if (
      !allowedTypes.includes(file.type) &&
      !allowedExtensions.some((extension) => lowerName.endsWith(extension))
    ) {
      showToast("Please choose a PDF, DOC, or DOCX file", false);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCvFile(String(reader.result));
      setCvFileName(file.name);
      showToast("CV selected. Click Save profile to upload it.");
    };
    reader.onerror = () => showToast("Could not read CV file", false);
    reader.readAsDataURL(file);
  };

  const uploadProfilePhoto = (file: File) => {
    if (!file.type.startsWith("image/")) {
      showToast("Please choose an image file", false);
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      setSelectedImage(String(reader.result));
      setCrop(undefined);
      setCompletedCrop(undefined);
    };

    reader.readAsDataURL(file);
  };

  const getCroppedImg = async () => {
    const image = cropImageRef.current;
    if (!image || !completedCrop?.width || !completedCrop?.height) {
      showToast("Please crop the image first", false);
      return;
    }

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = completedCrop.width;
    canvas.height = completedCrop.height;
    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      completedCrop.width,
      completedCrop.height,
    );

    const croppedBase64 = canvas.toDataURL("image/jpeg", 0.92);

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
      setCrop(undefined);
      setCompletedCrop(undefined);
    } catch (err) {
      showToast(getError(err, "Upload failed"), false);
    } finally {
      setSaving(false);
    }
  };

  const onCropImageLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = event.currentTarget;
    const centered = centerCrop(
      makeAspectCrop({ unit: "%", width: 80 }, 1, width, height),
      width,
      height,
    );
    setCrop(centered);
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
      const res = await API.post("/employees/update-face/", {
        employee_id: employeeId,
        image: capturedImage,
      });
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-300">
        Loading profile...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      {toast && (
        <div
          className={`fixed top-5 left-1/2 z-50 -translate-x-1/2 rounded-2xl border px-5 py-3 text-sm font-semibold shadow-xl ${
            toast.ok
              ? "border-green-500/30 bg-green-500/15 text-green-300"
              : "border-red-500/30 bg-red-500/15 text-red-300"
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div className="mx-auto max-w-6xl"> 

        <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
          <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <div
              onClick={() => setShowImageModal(true)}
              className="mx-auto mb-5 h-28 w-28 overflow-hidden rounded-full border border-slate-700 bg-slate-800 cursor-pointer"
            >
              {profile?.profile_img ? (
                <img
                  src={getMediaUrl(profile.profile_img)}
                  alt={profile.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-blue-600 text-4xl font-bold">
                  {profile?.name?.charAt(0) || "E"}
                </div>
              )}
            </div>
            <label className="mx-auto mb-5 block w-fit cursor-pointer rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-300 hover:bg-blue-500/20">
              Change profile photo
              <Input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadProfilePhoto(file);
                  e.target.value = "";
                }}
              />
            </label>
            <h2 className="text-center text-2xl font-bold">{profile?.name}</h2>
            <p className="text-center text-sm text-slate-400">
              {profile?.employee_id}
            </p>
            <div className="mt-6 space-y-3 text-sm">
              <div className="rounded-2xl bg-slate-950 p-3">
                <p className="text-slate-500">Email</p>
                <p className="font-medium">{profile?.email}</p>
              </div>
              <div className="rounded-2xl bg-slate-950 p-3">
                <p className="text-slate-500">Department / Job Role</p>
                <p className="font-medium">
                  {department || "IT"} / {designation || "Software Engineer"}
                </p>
              </div>
              {profile?.cv_file && (
                <a
                  href={getMediaUrl(profile.cv_file)}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-2xl border border-blue-500/30 bg-blue-500/10 p-3 text-center font-semibold text-blue-300"
                >
                  View CV
                </a>
              )}
              {!profile?.cv_file && (
                <div className="rounded-2xl border border-slate-700 bg-slate-950 p-3 text-center text-slate-400">
                  No CV uploaded
                </div>
              )}
            </div>
          </section>

          <div className="grid gap-5">
            <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="mb-4 text-xl font-bold">Profile details</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm text-slate-400">
                  Full name
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 p-3 text-white outline-none focus:border-blue-500"
                  />
                </label>

                <label className="text-sm text-slate-400">
                  Phone
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 p-3 text-white outline-none focus:border-blue-500"
                  />
                </label>

                <label className="text-sm text-slate-400">
                  Department
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 p-3 text-white outline-none focus:border-blue-500"
                  >
                    {DEPARTMENTS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                
                <label className="text-sm text-slate-400">
                  Job Role
                  <select
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 p-3 text-white outline-none focus:border-blue-500"
                  >
                    {JOB_ROLES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block cursor-pointer rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-center font-semibold text-cyan-300 hover:bg-cyan-500/20">
                  {cvFileName
                    ? `Selected: ${cvFileName}`
                    : "Upload / Replace CV"}
                  <Input
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadCv(file);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              <Button
                text={saving ? "Saving..." : "Save profile"}
                onClick={saveProfile}
                disabled={saving}
                className="mt-5 rounded-2xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              />
            </section>

            <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="mb-2 text-xl font-bold">Password</h2>
              <p className="mb-4 text-sm text-slate-400">
                Enter your current password only when you want to set a new one.
              </p>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="text-sm text-slate-400">
                  Current password
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 p-3 text-white outline-none focus:border-blue-500"
                  />
                </label>
                <label className="text-sm text-slate-400">
                  New password
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 p-3 text-white outline-none focus:border-blue-500"
                  />
                </label>
                <label className="text-sm text-slate-400">
                  Confirm new password
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 p-3 text-white outline-none focus:border-blue-500"
                  />
                </label>
              </div>
              <Button
                text={saving ? "Saving..." : "Update password"}
                onClick={saveProfile}
                disabled={saving}
                className="mt-5 rounded-2xl bg-indigo-600 px-5 py-3 font-bold text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
              />
            </section>

            <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-bold">Face re-enrollment</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Use this when face verification is failing repeatedly.
                  </p>
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
                  className="rounded-2xl bg-cyan-600 px-5 py-3 font-bold hover:bg-cyan-700 cursor-pointer"
                />
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
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-5">
          <div className="bg-slate-900 p-5 rounded-3xl w-full max-w-lg">
            <div className="relative max-h-[65vh] w-full overflow-auto rounded-2xl bg-slate-950">
              <ReactCrop
                crop={crop}
                aspect={1}
                circularCrop
                keepSelection
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(pixelCrop) => setCompletedCrop(pixelCrop)}
                className="max-h-[65vh]"
              >
                <img
                  ref={cropImageRef}
                  src={selectedImage}
                  alt="Crop profile"
                  onLoad={onCropImageLoad}
                  className="max-h-[65vh] w-full object-contain"
                />
              </ReactCrop>
            </div>

            <div className="flex gap-3 mt-5">
              <Button
                text="Cancel"
                onClick={() => setSelectedImage(null)}
                className="flex-1 bg-slate-700 text-white"
              />

              <Button
                text="Crop & Save"
                onClick={getCroppedImg}
                className="flex-1 bg-blue-600 text-white"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
