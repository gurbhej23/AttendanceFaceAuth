// src/pages/Dashboard.tsx
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import Button from "../components/Button";
import Input from "../components/Input";
import Table from "../components/Table";

interface AttendanceRecord {
  employee_id: string;
  employee_name: string;
  date: string;
  check_in: string;
  check_out: string;
  duration: string;
  status: string;
  reason?: string;
  half_day_until?: string;
  profile_img?: string;
  cv_file?: string;
}

const getLocalDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getApiError = (err: unknown, fallback: string): string => {
  const e = err as { response?: { data?: { error?: string } } };
  return e?.response?.data?.error || fallback;
};

const getMediaUrl = (path?: string | null) => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `http://localhost:8000${path.startsWith("/") ? path : `/${path}`}`;
};

// Returns Tailwind classes for the status badge in the table
const getStatusBadgeClass = (status: string): string => {
  switch (status) {
    case "present":
      return "bg-green-500/20 text-green-300";
    case "absent":
    case "leave":
      return "bg-red-500/20 text-red-300";
    case "half day":
      return "bg-orange-500/20 text-orange-300";
    default:
      return "bg-slate-500/20 text-slate-400";
  }
};

// Returns styles for the Today's Status card
const getStatusCardStyle = (status: string) => {
  switch (status) {
    case "present":
      return {
        bg: "from-green-500/20 to-emerald-500/10",
        border: "border-green-500/20",
        text: "text-green-300",
        icon: "✅",
      };
    case "absent":
    case "leave":
      return {
        bg: "from-red-500/20 to-red-500/10",
        border: "border-red-500/20",
        text: "text-red-300",
        icon: "",
      };
    case "half day":
      return {
        bg: "from-orange-500/20 to-orange-500/10",
        border: "border-orange-500/20",
        text: "text-orange-300",
        icon: "🌗",
      };
    default:
      return {
        bg: "from-slate-500/20 to-slate-500/10",
        border: "border-slate-500/20",
        text: "text-slate-300",
        icon: "⏳",
      };
  }
};

export default function Dashboard() {
  const navigate = useNavigate();

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAttendancePrompt, setShowAttendancePrompt] = useState(true);
  const [showAbsentModal, setShowAbsentModal] = useState(false);
  const [showHalfDayModal, setShowHalfDayModal] = useState(false);
  const [absentReason, setAbsentReason] = useState("");
  const [halfDayReason, setHalfDayReason] = useState("");
  const [halfDayUntil, setHalfDayUntil] = useState("");
  const [selectedDate, setSelectedDate] = useState(getLocalDate());
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [showMobileActions, setShowMobileActions] = useState(false);

  const employeeName = localStorage.getItem("employee_name");
  const employeeId = localStorage.getItem("employee_id");
  const profileImg = getMediaUrl(localStorage.getItem("profile_img"));
  const cvFile = getMediaUrl(localStorage.getItem("cv_file"));
  const today = getLocalDate();

  const todayRecord = records.find((r) => r.date === today);
  const todayStatus = todayRecord?.status || "";
  const cardStyle = getStatusCardStyle(todayStatus);

  const showWelcomePrompt =
    showAttendancePrompt &&
    selectedDate === today &&
    !loading &&
    !todayRecord &&
    !showAbsentModal &&
    !showHalfDayModal;

  // ── Fetch records ────────────────────────────────────────────────────
  const fetchRecords = useCallback(async () => {
    try {
      const response = await API.get("/attendance/mark-report/", {
        params: { date: selectedDate, employee_id: employeeId },
      });
      setRecords(response.data.records || []);
      setLoading(false);
    } catch (error: unknown) {
      console.error("❌ Failed to fetch attendance:", error);
      setLoading(false);
    }
  }, [employeeId, selectedDate]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (
      !token ||
      token === "undefined" ||
      !employeeId ||
      employeeId === "undefined"
    ) {
      localStorage.clear();
      navigate("/", { replace: true });
      return;
    }
    fetchRecords();
    const interval = setInterval(fetchRecords, 5000);
    return () => clearInterval(interval);
  }, [selectedDate, employeeId, fetchRecords, navigate]);

  // ── Handlers ─────────────────────────────────────────────────────────
  const handleLogout = () => {
    localStorage.clear();
    navigate("/", { replace: true });
  };

  const requireEmployeeId = () => {
    if (!employeeId || employeeId === "undefined") {
      localStorage.clear();
      navigate("/", { replace: true });
      return false;
    }
    return true;
  };

  const markPresent = async () => {
    if (!requireEmployeeId()) return;

    try {
      const response = await API.post("/attendance/mark-present/", {
        employee_id: employeeId,
      });

      setSuccessMessage(
        response.data.message || "✅ Attendance marked successfully",
      );

      setErrorMessage("");

      setShowAttendancePrompt(false);

      fetchRecords();

      // auto hide message after 4 sec
      setTimeout(() => {
        setSuccessMessage("");
      }, 4000);
    } catch (err: unknown) {
      setErrorMessage(getApiError(err, "Failed to mark present"));

      setSuccessMessage("");

      setTimeout(() => {
        setErrorMessage("");
      }, 4000);
    }
  };

  const markAbsent = async () => {
    if (!requireEmployeeId()) return;
    if (!absentReason.trim()) {
      setSuccessMessage("Please enter a reason for absence");
      return;
    }
    try {
      await API.post("/attendance/mark-absent/", {
        employee_id: employeeId,
        reason: absentReason,
      });
      setSuccessMessage("Attendance marked as absent");
      setShowAbsentModal(false);
      setAbsentReason("");
      setShowAttendancePrompt(false);
      fetchRecords();
    } catch (err: unknown) {
      setErrorMessage(getApiError(err, "Failed to mark absent"));
    }
  };

  const markHalfDay = async () => {
    if (!requireEmployeeId()) return;
    if (!halfDayReason.trim() || !halfDayUntil) {
      setSuccessMessage("Please enter half day reason and until time");
      return;
    }
    try {
      const response = await API.post("/attendance/mark-half-day/", {
        employee_id: employeeId,
        reason: halfDayReason,
        half_day_until: halfDayUntil,
      });
      setShowHalfDayModal(false);
      setHalfDayReason("");
      setHalfDayUntil("");
      setShowAttendancePrompt(false);
      setSuccessMessage(response.data.message || "Marked as half day");
      fetchRecords();
    } catch (err: unknown) {
      setErrorMessage(getApiError(err, "Failed to mark half day"));
    }
  };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-linear-to-br from-[#020617] via-[#0f172a] to-[#111827] px-3 py-4 sm:px-5 lg:px-6">
      <div
        className={`max-w-7xl mx-auto transition-all duration-300 ${
          showWelcomePrompt || showAbsentModal || showHalfDayModal
            ? "blur-sm pointer-events-none select-none scale-[0.99]"
            : ""
        }`}
      >
        {/* SUCCESS MESSAGE */}
        {successMessage && (
          <div className="w-[90%] sm:w-auto max-w-md bg-green-500/15 border border-green-500/30 text-green-300 px-5 py-4 rounded-2xl text-center font-medium shadow-lg animate-pulse fixed top-5 left-1/2 -translate-x-1/2 z-50">
            {successMessage}
          </div>
        )}

        {/* ERROR MESSAGE */}
        {errorMessage && (
          <div className="mb-5 bg-red-500/15 border border-red-500/30 text-red-300 px-5 py-4 rounded-2xl text-center font-medium shadow-lg absolute top-5 left-1/2 transform -translate-x-1/2 z-50">
            {errorMessage}
          </div>
        )}
        {/* ── HEADER ── */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-4xl p-6 shadow-2xl mb-8">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-center sm:text-left">
              <div className="h-20 w-20 sm:h-18 sm:w-18 mx-auto sm:mx-0 overflow-hidden rounded-full border border-white/10 bg-slate-800 flex flex-col shrink-0">
                {profileImg ? (
                  <img
                    src={profileImg}
                    alt={employeeName || "Employee"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-blue-500 to-cyan-400 text-2xl font-bold text-white">
                    {employeeName?.charAt(0) || "E"}
                  </div>
                )}
                {cvFile && (
                  <a
                    href={cvFile}
                    target="_blank"
                    rel="noreferrer"
                    className="px-5 bg-blue-500/10 text-sm font-semibold text-blue-300 hover:bg-blue-500/20"
                  >
                    View
                  </a>
                )}
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  Welcome,
                </h1>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <h2 className="text-xl sm:text-2xl font-bold bg-linear-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent mt-1 ">
                    {employeeName}
                  </h2>
                </div>
              </div>
            </div>

            <div className="w-full xl:w-auto">
              {/* Mobile Toggle Button */}
              <div className="flex xl:hidden justify-end">
                <button
                  onClick={() => setShowMobileActions(!showMobileActions)}
                  className="bg-slate-800 border border-white/10 text-white p-3 rounded-2xl shadow-lg absolute top-2.5"
                >
                  {showMobileActions ? "✖" : "☰"}
                </button>
              </div>

              {/* Buttons */}
              <div
                className={`grid grid-cols-1 sm:grid-cols-3 gap-3 transition-all duration-300 ${
                  showMobileActions
                    ? "max-h-96 opacity-100"
                    : "max-h-0 opacity-0 overflow-hidden xl:max-h-none xl:opacity-100"
                } xl:grid xl:grid-cols-3`}
              >
                <Button
                  text="Check Out"
                  onClick={() => navigate("/check-out")}
                  className="w-full bg-linear-to-r from-blue-600 to-blue-500 hover:scale-105 shadow-lg transition-all duration-300 text-white px-6 py-4 rounded-2xl font-semibold cursor-pointer"
                />

                <Button
                  text="Half Day"
                  onClick={() => setShowHalfDayModal(true)}
                  className="w-full bg-linear-to-r from-orange-500 to-orange-400 hover:scale-105 shadow-lg transition-all duration-300 text-white px-6 py-4 rounded-2xl font-semibold cursor-pointer"
                />

                <Button
                  text="Logout"
                  onClick={handleLogout}
                  className="w-full bg-linear-to-r from-red-600 to-red-500 hover:scale-105 shadow-lg transition-all duration-300 text-white px-6 py-4 rounded-2xl font-semibold cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── TOP CARDS ── */}
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-5 mb-8">
          {/* Date picker card */}
          <div className="col-span-2 xl:col-span-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-4 sm:p-5 shadow-xl">
            <p className="text-slate-400 text-sm mb-3">Selected Date</p>
            <Input
              type="date"
              value={selectedDate}
              max={today}
              onChange={(e) =>
                setSelectedDate(e.target.value > today ? today : e.target.value)
              }
              className="w-full p-4 rounded-2xl bg-slate-900/70 text-white border border-slate-700 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Status card — dynamic color */}
          <div
            className={`bg-linear-to-br ${cardStyle.bg} border ${cardStyle.border} rounded-3xl p-5 shadow-xl`}
          >
            <p className={`${cardStyle.text} text-sm`}>Today's Status</p>
            <div className="flex items-center justify-between mt-3">
              <h2 className="text-2xl sm:text-3xl font-bold text-white capitalize">
                {todayStatus || "Not Marked"}
              </h2>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl">
                {cardStyle.icon}
              </div>
            </div>
          </div>

          {/* Working hours card */}
          <div className="bg-linear-to-br from-blue-500/20 to-cyan-500/10 border border-blue-500/20 rounded-3xl p-5 shadow-xl">
            <p className="text-blue-300 text-sm">Working Hours</p>
            <div className="flex items-center justify-between mt-3">
              <h2 className="text-2xl sm:text-3xl font-bold text-white">
                {todayRecord?.duration || "--"}
              </h2>
              <div className="w-14 h-14 rounded-2xl bg-blue-500/20 flex items-center justify-center text-2xl">
                ⏰
              </div>
            </div>
          </div>
        </div>

        {/* ── TABLE ── */}
        <div className="bg-white/5 backdrop-blur-xl rounded-4xl shadow-2xl border border-white/10 overflow-hidden">
          <div className="p-6 border-b border-white/10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-2xl sm:text-3xl text-white font-bold">
                Attendance Records
              </h2>
              <p className="text-slate-400 mt-1">
                Your daily attendance history
              </p>
            </div>
            <div className="bg-slate-900/70 border border-slate-700 px-4 py-3 rounded-2xl text-slate-300 text-sm">
              Total Records:{" "}
              <span className="text-white font-bold">{records.length}</span>
            </div>
          </div>

          {loading ? (
            <div className="p-10 text-center">
              <div className="animate-spin rounded-full h-14 w-14 border-b-2 border-blue-500 mx-auto" />
              <p className="text-slate-400 mt-5 text-lg">Loading records...</p>
            </div>
          ) : records.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-slate-300 text-xl font-semibold">
                No attendance records
              </p>
              <p className="text-slate-500 mt-2">
                No attendance found for selected date
              </p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto scrollbar-thin scrollbar-thumb-slate-700">
              <Table
                className="min-w-250"
                headers={[
                  "Profile",
                  "Employee",
                  "ID",
                  "Check In",
                  "Check Out",
                  "Duration",
                  "Status",
                  "Reason",
                  "Date",
                ]}
              >
                {records.map((record, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-white/5 hover:bg-white/5 transition-all duration-200 text-center"
                  >
                    <td className="px-3 sm:px-6 py-4 sm:py-5">
                      <div className="mx-auto h-12 w-12 overflow-hidden rounded-full border border-white/10 bg-slate-800">
                        {record.profile_img ? (
                          <img
                            src={getMediaUrl(record.profile_img)}
                            alt={record.employee_name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-blue-500 to-cyan-400 text-white font-bold">
                            {record.employee_name?.charAt(0)}
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="text-white font-semibold">
                            {record.employee_name}
                          </p>
                          <p className="text-xs text-slate-400 text-left">
                            Employee
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-5 text-slate-300 font-medium">
                      {record.employee_id}
                    </td>

                    <td className="px-6 py-5">
                      <span className="bg-green-500/10 text-green-300 px-4 py-2 rounded-xl font-mono text-sm">
                        {record.check_in}
                      </span>
                    </td>

                    <td className="px-6 py-5">
                      <span className="bg-red-500/10 text-red-300 px-4 py-2 rounded-xl font-mono text-sm">
                        {record.check_out}
                      </span>
                    </td>

                    <td className="px-6 py-5 text-slate-300 font-semibold">
                      {record.duration}
                    </td>

                    {/* ✅ Status badge with correct dynamic color */}
                    <td className="px-6 py-5">
                      <span
                        className={`px-4 py-2 rounded-full text-sm font-semibold capitalize ${getStatusBadgeClass(record.status)}`}
                      >
                        {record.status}
                      </span>
                    </td>

                    <td className="px-6 py-5 text-slate-400">
                      <div className="flex flex-col gap-1">
                        <span>{record.reason || "--"}</span>
                      </div>
                    </td>

                    <td className="px-6 py-5 text-slate-500 font-medium">
                      {record.date}
                    </td>
                  </tr>
                ))}
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* ── WELCOME MODAL ── */}
      {showWelcomePrompt && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-5">
          <div className="bg-[#111827] border border-white/10 rounded-4xl p-8 w-full max-w-lg shadow-2xl text-center">
            <div className="w-20 h-20 rounded-3xl bg-linear-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-4xl mx-auto mb-5">
              👋
            </div>
            <p className="text-slate-400 text-sm mb-2">Welcome back</p>
            <h2 className="text-2xl sm:text-3xl text-white font-bold mb-3">
              {employeeName}
            </h2>
            <p className="text-slate-400 mb-8">
              Mark your attendance for today
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Button
                text="Present"
                onClick={markPresent}
                className="bg-green-600 hover:bg-green-700 text-white py-4 rounded-2xl font-semibold transition cursor-pointer"
              />
              <Button
                text="Leave"
                onClick={() => setShowAbsentModal(true)}
                className="bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl font-semibold transition cursor-pointer"
              />
              <Button
                text="Half Day"
                onClick={() => setShowHalfDayModal(true)}
                className="bg-orange-600 hover:bg-orange-700 text-white py-4 rounded-2xl font-semibold transition cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── ABSENT MODAL ── */}
      {showAbsentModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-5">
          <div className="bg-[#111827] border border-white/10 rounded-3xl sm:rounded-4xl p-5 sm:p-8 w-full max-w-md shadow-2xl">
            <div className="w-16 h-16 rounded-3xl bg-red-500/20 flex items-center justify-center text-2xl sm:text-3xl mx-auto mb-5">
              🤒
            </div>
            <h2 className="text-2xl text-white font-bold text-center mb-2">
              Reason for Absence
            </h2>
            <p className="text-slate-400 text-center text-sm mb-6">
              Please provide a reason before submitting
            </p>

            <textarea
              value={absentReason}
              onChange={(e) => setAbsentReason(e.target.value)}
              placeholder="Enter reason..."
              className="w-full min-h-30 p-4 rounded-2xl bg-slate-900/70 text-white border border-slate-700 focus:border-red-500 outline-none resize-none"
            />

            <div className="flex gap-3 mt-6">
              <Button
                text="Cancel"
                onClick={() => {
                  setShowAbsentModal(false);
                  setAbsentReason("");
                }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-2xl font-semibold transition cursor-pointer"
              />
              <Button
                text="Submit"
                onClick={markAbsent}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-2xl font-semibold transition cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── HALF DAY MODAL ── */}
      {showHalfDayModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-5">
          <div className="bg-[#111827] border border-white/10 rounded-4xl p-8 w-full max-w-md shadow-2xl">
            <div className="w-16 h-16 rounded-3xl bg-orange-500/20 flex items-center justify-center text-2xl sm:text-3xl mx-auto mb-5">
              🌗
            </div>
            <h2 className="text-2xl text-white font-bold text-center mb-2">
              Half Day Details
            </h2>
            <p className="text-slate-400 text-center text-sm mb-6">
              Enter your half day time and reason
            </p>

            <label className="text-slate-400 text-sm mb-2 block">
              Half day until
            </label>
            <Input
              type="time"
              value={halfDayUntil}
              onChange={(e) => setHalfDayUntil(e.target.value)}
              className="w-full p-4 rounded-2xl bg-slate-900/70 text-white border border-slate-700 focus:border-orange-500 outline-none mb-4"
            />

            <label className="text-slate-400 text-sm mb-2 block">Reason</label>
            <textarea
              value={halfDayReason}
              onChange={(e) => setHalfDayReason(e.target.value)}
              placeholder="Enter reason..."
              className="w-full h-32 p-4 rounded-2xl bg-slate-900/70 text-white border border-slate-700 focus:border-orange-500 outline-none resize-none"
            />

            <div className="flex gap-3 mt-6">
              <Button
                text="Cancel"
                onClick={() => {
                  setShowHalfDayModal(false);
                  setHalfDayReason("");
                  setHalfDayUntil("");
                }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-2xl font-semibold transition cursor-pointer"
              />
              <Button
                text="Submit"
                onClick={markHalfDay}
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-2xl font-semibold transition cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
