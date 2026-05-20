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

interface MonthlySummary {
  present_count: number;
  late_count: number;
  absent_count: number;
  half_day_count: number;
  leave_count: number;
  total_working_hours: string;
}

interface LeaveRequest {
  date: string;
  status: string;
  reason: string;
  leave_type: string;
}

const getLocalDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
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

const getStatusBadgeClass = (s: string) => {
  switch (s) {
    case "present":
      return "bg-green-500/20 text-green-300";
    case "late":
      return "bg-yellow-500/20 text-yellow-300";
    case "absent":
      return "bg-red-500/20 text-red-300";
    case "half_day":
    case "half day":
      return "bg-orange-500/20 text-orange-300";
    case "leave":
    case "leave_approved":
      return "bg-purple-500/20 text-purple-300";
    case "leave_pending":
      return "bg-slate-500/20 text-slate-300";
    case "leave_rejected":
      return "bg-red-500/20 text-red-300";
    default:
      return "bg-slate-500/20 text-slate-400";
  }
};

const getStatusCardStyle = (s: string) => {
  switch (s) {
    case "present":
      return {
        bg: "from-green-500/20 to-emerald-500/10",
        border: "border-green-500/20",
        text: "text-green-300",
        icon: "✅",
      };
    case "late":
      return {
        bg: "from-yellow-500/20 to-yellow-500/10",
        border: "border-yellow-500/20",
        text: "text-yellow-300",
        icon: "⚠️",
      };
    case "absent":
      return {
        bg: "from-red-500/20 to-red-500/10",
        border: "border-red-500/20",
        text: "text-red-300",
        icon: "❌",
      };
    case "half_day":
    case "half day":
      return {
        bg: "from-orange-500/20 to-orange-500/10",
        border: "border-orange-500/20",
        text: "text-orange-300",
        icon: "🌗",
      };
    case "leave":
    case "leave_approved":
      return {
        bg: "from-purple-500/20 to-purple-500/10",
        border: "border-purple-500/20",
        text: "text-purple-300",
        icon: "🏖️",
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

const leaveStatusBadge = (s: string) => {
  switch (s) {
    case "leave_pending":
      return "bg-yellow-500/20 text-yellow-300";
    case "leave_approved":
      return "bg-green-500/20 text-green-300";
    case "leave_rejected":
      return "bg-red-500/20 text-red-300";
    default:
      return "bg-slate-500/20 text-slate-400";
  }
};

const leaveStatusLabel = (s: string) => {
  switch (s) {
    case "leave_pending":
      return "Pending";
    case "leave_approved":
      return "Approved";
    case "leave_rejected":
      return "Rejected";
    default:
      return s;
  }
};

export default function Dashboard() {
  const navigate = useNavigate();

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAttendancePrompt, setShowAttendancePrompt] = useState(true);
  const [showAbsentModal, setShowAbsentModal] = useState(false);
  const [showHalfDayModal, setShowHalfDayModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showLeavesModal, setShowLeavesModal] = useState(false);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [viewReason, setViewReason] = useState<string | null>(null);

  const [absentReason, setAbsentReason] = useState("");
  const [halfDayReason, setHalfDayReason] = useState("");
  const [halfDayUntil, setHalfDayUntil] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveType, setLeaveType] = useState("casual");
  const [leaveDate, setLeaveDate] = useState(getLocalDate());

  const [selectedDate, setSelectedDate] = useState(getLocalDate());
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary | null>(
    null,
  );
  const [myLeaveRequests, setMyLeaveRequests] = useState<LeaveRequest[]>([]);

  // Late alert state
  const [lateAlert, setLateAlert] = useState<{
    show: boolean;
    minutesLate: number;
  }>({ show: false, minutesLate: 0 });

  const employeeName = localStorage.getItem("employee_name");
  const employeeId = localStorage.getItem("employee_id");
  const profileImg = getMediaUrl(localStorage.getItem("profile_img"));
  const today = getLocalDate();

  const todayRecord = records.find((r) => r.date === today);
  const todayStatus = todayRecord?.status || "";
  const cardStyle = getStatusCardStyle(todayStatus);

  const anyModalOpen =
    showAbsentModal ||
    showHalfDayModal ||
    showLeaveModal ||
    showSummaryModal ||
    showLeavesModal ||
    showReasonModal;

  const showWelcomePrompt =
    showAttendancePrompt &&
    selectedDate === today &&
    !loading &&
    !todayRecord &&
    !anyModalOpen;

  // ── Auto-dismiss alerts ───────────────────────────────────────────────
  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setErrorMessage("");
    setTimeout(() => setSuccessMessage(""), 4000);
  };
  const showError = (msg: string) => {
    setErrorMessage(msg);
    setSuccessMessage("");
    setTimeout(() => setErrorMessage(""), 4000);
  };

  // ── Fetch records ─────────────────────────────────────────────────────
  const fetchRecords = useCallback(async () => {
    try {
      const response = await API.get("/attendance/mark-report/", {
        params: { date: selectedDate, employee_id: employeeId },
      });
      setRecords(response.data.records || []);
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, [employeeId, selectedDate]);

  // ── Fetch monthly summary ─────────────────────────────────────────────
  const fetchMonthlySummary = useCallback(async () => {
    const now = new Date();
    try {
      const res = await API.get("/attendance/monthly-summary/", {
        params: {
          employee_id: employeeId,
          year: now.getFullYear(),
          month: now.getMonth() + 1,
        },
      });
      if (res.data.success) setMonthlySummary(res.data);
    } catch {
      /* silent */
    }
  }, [employeeId]);

  // ── Fetch leave requests ──────────────────────────────────────────────
  const fetchLeaveRequests = useCallback(async () => {
    try {
      const res = await API.get("/attendance/my-leave-requests/", {
        params: { employee_id: employeeId },
      });
      if (res.data.success) setMyLeaveRequests(res.data.records || []);
    } catch {
      /* silent */
    }
  }, [employeeId]);

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
    fetchMonthlySummary();
    fetchLeaveRequests();
    const interval = setInterval(fetchRecords, 5000);
    return () => clearInterval(interval);
  }, [
    selectedDate,
    employeeId,
    fetchRecords,
    fetchMonthlySummary,
    fetchLeaveRequests,
    navigate,
  ]);

  // ── Handlers ──────────────────────────────────────────────────────────
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
      const res = await API.post("/attendance/mark-present/", {
        employee_id: employeeId,
      });
      showSuccess(res.data.message || "✅ Marked as present");
      setShowAttendancePrompt(false);
      // Show late alert if applicable
      if (res.data.is_late && res.data.minutes_late > 0) {
        setLateAlert({ show: true, minutesLate: res.data.minutes_late });
      }
      fetchRecords();
    } catch (err: unknown) {
      showError(getApiError(err, "Failed to mark present"));
    }
  };

  const markAbsent = async () => {
    if (!requireEmployeeId()) return;
    if (!absentReason.trim()) {
      showError("Please enter reason for absence");
      return;
    }
    try {
      await API.post("/attendance/mark-absent/", {
        employee_id: employeeId,
        reason: absentReason,
      });
      setShowAbsentModal(false);
      setAbsentReason("");
      setShowAttendancePrompt(false);
      showSuccess("Marked as absent");
      fetchRecords();
    } catch (err: unknown) {
      showError(getApiError(err, "Failed to mark absent"));
    }
  };

  const markHalfDay = async () => {
    if (!requireEmployeeId()) return;
    if (!halfDayReason.trim() || !halfDayUntil) {
      showError("Please enter half day reason and until time");
      return;
    }
    try {
      const res = await API.post("/attendance/mark-half-day/", {
        employee_id: employeeId,
        reason: halfDayReason,
        half_day_until: halfDayUntil,
      });
      setShowHalfDayModal(false);
      setHalfDayReason("");
      setHalfDayUntil("");
      setShowAttendancePrompt(false);
      showSuccess(res.data.message || "Marked as half day");
      fetchRecords();
    } catch (err: unknown) {
      showError(getApiError(err, "Failed to mark half day"));
    }
  };

  const requestLeave = async () => {
    if (!requireEmployeeId()) return;
    if (!leaveReason.trim()) {
      showError("Please enter reason for leave");
      return;
    }
    if (!leaveDate) {
      showError("Please select leave date");
      return;
    }
    try {
      const res = await API.post("/attendance/request-leave/", {
        employee_id: employeeId,
        reason: leaveReason,
        leave_date: leaveDate,
        leave_type: leaveType,
      });
      setShowLeaveModal(false);
      setLeaveReason("");
      setLeaveType("casual");
      setShowAttendancePrompt(false);
      showSuccess(res.data.message || "Leave requested");
      fetchRecords();
      fetchLeaveRequests();
    } catch (err: unknown) {
      showError(getApiError(err, "Failed to request leave"));
    }
  };

  const now = new Date();
  const monthLabel = now.toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-linear-to-br from-[#020617] via-[#0f172a] to-[#111827] px-3 py-4 sm:px-5 lg:px-6">
      {/* LATE ALERT BANNER */}
      {lateAlert.show && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500/95 text-slate-900 px-6 py-3 flex items-center justify-between shadow-xl">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-bold">You checked in late!</p>
              <p className="text-sm">
                {lateAlert.minutesLate} minutes late today. Please be on time
                tomorrow.
              </p>
            </div>
          </div>
          <Button
            text="✕ "
            onClick={() => setLateAlert({ show: false, minutesLate: 0 })}
            className="text-slate-900 font-bold text-xl hover:opacity-70 cursor-pointer"
          />
        </div>
      )}

      {/* SUCCESS / ERROR TOASTS */}
      {successMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-green-500/15 border border-green-500/30 text-green-300 px-5 py-4 rounded-2xl text-center font-medium shadow-lg">
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-red-500/15 border border-red-500/30 text-red-300 px-5 py-4 rounded-2xl text-center font-medium shadow-lg">
          {errorMessage}
        </div>
      )}

      <aside className="hidden lg:flex fixed left-1 top-5 bottom-5 z-30 w-70 flex-col rounded-4xl border border-white/10 bg-slate-950/80 p-5 shadow-2xl backdrop-blur-xl">
        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="h-15 w-15 overflow-hidden rounded-full bg-slate-800">
            {profileImg ? (
              <img
                src={profileImg}
                alt={employeeName || "Employee"}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-blue-600 font-bold text-white">
                {employeeName?.charAt(0) || "E"}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate font-bold text-white">{employeeName}</p>
            <p className="text-xs text-slate-400">{employeeId}</p>
          </div>
        </div>

        <nav className="space-y-2">
          <Button
            text="Check Out"
            onClick={() => navigate("/check-out")}
            className="w-full rounded-2xl bg-blue-600 px-4 py-4 text-center text-sm font-bold text-white hover:bg-blue-700 cursor-pointer"
          />

          <Button
            text="Half Day"
            onClick={() => setShowHalfDayModal(true)}
            className="w-full rounded-2xl bg-orange-600 px-4 py-4 text-center text-sm font-bold text-white hover:bg-orange-700 cursor-pointer"
          />

          <Button
            text="Summary"
            onClick={() => setShowSummaryModal(true)}
            className="w-full rounded-2xl bg-indigo-600 px-4 py-4 text-center text-sm font-bold text-white hover:bg-indigo-700 cursor-pointer"
          />

          <Button
            text="My Leaves"
            onClick={() => setShowLeavesModal(true)}
            className="w-full rounded-2xl bg-purple-600 px-4 py-4 text-center text-sm font-bold text-white hover:bg-purple-700 cursor-pointer"
          />

          <Button
            text="Profile"
            onClick={() => navigate("/profile")}
            className="w-full rounded-2xl bg-slate-700 px-4 py-4 text-center text-sm font-bold text-white hover:bg-slate-600 cursor-pointer"
          />
        </nav>

        <Button
        text="Logout"
          onClick={handleLogout}
          className="mt-auto w-full rounded-2xl bg-red-600 px-4 py-4 text-center text-sm font-bold text-white hover:bg-red-700 cursor-pointer"
        />  
      </aside>

      <div
        className={`max-w-6xl mx-auto transition-all duration-300 lg:ml-72 ${anyModalOpen || showWelcomePrompt ? "blur-sm pointer-events-none select-none" : ""}`}
      >
        {/* HEADER */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-4xl p-6 shadow-2xl mb-8">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div>
                <p className="text-slate-400 text-sm">Attendance Dashboard</p>
                <h1 className="text-2xl font-bold text-white">Welcome back,</h1>
                <h2 className="text-xl font-bold bg-linear-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
                  {employeeName}
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:hidden">
              <Button
                text="Check Out"
                onClick={() => navigate("/check-out")}
                className="bg-blue-600 text-white cursor-pointer"
              />
              <Button
                text="Half Day"
                onClick={() => setShowHalfDayModal(true)}
                className="bg-orange-600 text-white cursor-pointer"
              />
              <Button
                text="Summary"
                onClick={() => setShowSummaryModal(true)}
                className="bg-indigo-600 text-white"
              />
              <Button
                text="My Leaves"
                onClick={() => setShowLeavesModal(true)}
                className="bg-purple-600 text-white"
              />
              <Button
                text="Profile"
                onClick={() => navigate("/profile")}
                className="bg-slate-700 text-white"
              />
              <Button
                text="Logout"
                onClick={handleLogout}
                className="bg-red-600 text-white"
              />
            </div>
          </div>
        </div>

        {/* TOP CARDS */}
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-5 mb-8">
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

          <div
            className={`bg-linear-to-br ${cardStyle.bg} border ${cardStyle.border} rounded-3xl p-5 shadow-xl`}
          >
            <p className={`${cardStyle.text} text-sm`}>Today's Status</p>
            <div className="flex items-center justify-between mt-3">
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white capitalize">
                {todayStatus || "Not Marked"}
              </h2>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl">
                {cardStyle.icon}
              </div>
            </div>
          </div>

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

        {/* MONTHLY MINI STATS */}
        {monthlySummary && (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-8">
            {[
              {
                label: "Present",
                value: monthlySummary.present_count,
                color: "text-green-300",
              },
              {
                label: "Late",
                value: monthlySummary.late_count,
                color: "text-yellow-300",
              },
              {
                label: "Absent",
                value: monthlySummary.absent_count,
                color: "text-red-300",
              },
              {
                label: "Half Day",
                value: monthlySummary.half_day_count,
                color: "text-orange-300",
              },
              {
                label: "Leave",
                value: monthlySummary.leave_count,
                color: "text-purple-300",
              },
              {
                label: "Hours",
                value: monthlySummary.total_working_hours,
                color: "text-blue-300",
              },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="bg-white/5 border border-white/10 rounded-2xl p-3 text-center cursor-pointer hover:bg-white/10 transition"
                onClick={() => setShowSummaryModal(true)}
              >
                <p className="text-slate-400 text-xs mb-1">{label}</p>
                <p className={`text-lg font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* TABLE */}
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
            <div className="w-full overflow-x-auto">
              <Table
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
                  "CV",
                ]}
              >
                {records.map((record, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-white/5 hover:bg-white/5 transition-all duration-200 text-center"
                  >
                    <td className="px-4 py-4">
                      <div className="mx-auto h-10 w-10 overflow-hidden rounded-full border border-white/10 bg-slate-800">
                        {record.profile_img ? (
                          <img
                            src={getMediaUrl(record.profile_img)}
                            alt={record.employee_name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-blue-500 to-cyan-400 text-white font-bold text-sm">
                            {record.employee_name?.charAt(0)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-left">
                      <p className="text-white font-semibold">
                        {record.employee_name}
                      </p>
                      <p className="text-xs text-slate-400">Employee</p>
                    </td>
                    <td className="px-4 py-4 text-slate-300 font-medium">
                      {record.employee_id}
                    </td>
                    <td className="px-4 py-4">
                      <span className="bg-green-500/10 text-green-300 px-3 py-1.5 rounded-xl font-mono text-sm">
                        {record.check_in}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="bg-red-500/10 text-red-300 px-3 py-1.5 rounded-xl font-mono text-sm">
                        {record.check_out}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-slate-300 font-semibold">
                      {record.duration}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-semibold capitalize ${getStatusBadgeClass(record.status)}`}
                      >
                        {record.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {record.reason && record.reason !== "--" ? (
                        <button
                          onClick={() => {
                            setViewReason(record.reason ?? null);
                            setShowReasonModal(true);
                          }}
                          className="text-slate-400 max-w-30 truncate block hover:text-blue-400 underline underline-offset-2 transition cursor-pointer text-sm"
                        >
                          {record.reason}
                        </button>
                      ) : (
                        <span className="text-slate-600">--</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-slate-500 font-medium">
                      {record.date}
                    </td>
                    <td className="px-5 py-4">
                      {record.cv_file ? (
                        <a
                          href={getMediaUrl(record.cv_file)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-blue-400 hover:text-blue-300"
                        >
                          View CV
                        </a>
                      ) : (
                        <span className="text-slate-600 text-xs">--</span>
                      )}
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
            <div className="grid grid-cols-2 gap-3">
              <Button
                text="✅ Present"
                onClick={markPresent}
                className="bg-green-600 hover:bg-green-700 text-white py-4 rounded-2xl font-semibold transition cursor-pointer"
              />
              <Button
                text="❌ Absent"
                onClick={() => setShowAbsentModal(true)}
                className="bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl font-semibold transition cursor-pointer"
              />
              <Button
                text="🌗 Half Day"
                onClick={() => setShowHalfDayModal(true)}
                className="bg-orange-600 hover:bg-orange-700 text-white py-4 rounded-2xl font-semibold transition cursor-pointer"
              />
              <Button
                text="🏖️ Request Leave"
                onClick={() => setShowLeaveModal(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-2xl font-semibold transition cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── ABSENT MODAL ── */}
      {showAbsentModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-5">
          <div className="bg-[#111827] border border-white/10 rounded-4xl p-8 w-full max-w-md shadow-2xl">
            <div className="w-16 h-16 rounded-3xl bg-red-500/20 flex items-center justify-center text-3xl mx-auto mb-5">
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
              className="w-full h-32 p-4 rounded-2xl bg-slate-900/70 text-white border border-slate-700 focus:border-red-500 outline-none resize-none"
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
            <div className="w-16 h-16 rounded-3xl bg-orange-500/20 flex items-center justify-center text-3xl mx-auto mb-5">
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
              className="w-full h-28 p-4 rounded-2xl bg-slate-900/70 text-white border border-slate-700 focus:border-orange-500 outline-none resize-none"
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

      {/* ── LEAVE REQUEST MODAL ── */}
      {showLeaveModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-5">
          <div className="bg-[#111827] border border-white/10 rounded-4xl p-8 w-full max-w-md shadow-2xl">
            <div className="w-16 h-16 rounded-3xl bg-purple-500/20 flex items-center justify-center text-3xl mx-auto mb-5">
              🏖️
            </div>
            <h2 className="text-2xl text-white font-bold text-center mb-2">
              Request Leave
            </h2>
            <p className="text-slate-400 text-center text-sm mb-6">
              Leave will be sent for admin approval
            </p>

            <label className="text-slate-400 text-sm mb-2 block">
              Leave Date
            </label>
            <Input
              type="date"
              value={leaveDate}
              min={today}
              onChange={(e) => setLeaveDate(e.target.value)}
              className="w-full p-4 rounded-2xl bg-slate-900/70 text-white border border-slate-700 focus:border-purple-500 outline-none mb-4"
            />

            <label className="text-slate-400 text-sm mb-2 block">
              Leave Type
            </label>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { v: "casual", l: "Casual", e: "😊" },
                { v: "sick", l: "Sick", e: "🤒" },
                { v: "emergency", l: "Emergency", e: "🚨" },
              ].map(({ v, l, e }) => (
                <button
                  key={v}
                  onClick={() => setLeaveType(v)}
                  className={`py-2.5 rounded-2xl text-sm font-semibold border transition cursor-pointer flex flex-col items-center gap-1 ${leaveType === v ? "bg-purple-600 border-purple-500 text-white" : "bg-slate-800 border-slate-700 text-slate-400 hover:border-purple-500"}`}
                >
                  <span>{e}</span>
                  {l}
                </button>
              ))}
            </div>

            <label className="text-slate-400 text-sm mb-2 block">Reason</label>
            <textarea
              value={leaveReason}
              onChange={(e) => setLeaveReason(e.target.value)}
              placeholder="Enter reason for leave..."
              className="w-full h-28 p-4 rounded-2xl bg-slate-900/70 text-white border border-slate-700 focus:border-purple-500 outline-none resize-none"
            />

            <div className="flex gap-3 mt-6">
              <Button
                text="Cancel"
                onClick={() => {
                  setShowLeaveModal(false);
                  setLeaveReason("");
                  setLeaveType("casual");
                }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-2xl font-semibold transition cursor-pointer"
              />
              <Button
                text="Submit Request"
                onClick={requestLeave}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-2xl font-semibold transition cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── MONTHLY SUMMARY MODAL ── */}
      {showSummaryModal && monthlySummary && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-5">
          <div className="bg-[#111827] border border-white/10 rounded-4xl p-8 w-full max-w-md shadow-2xl">
            <div className="w-16 h-16 rounded-3xl bg-indigo-500/20 flex items-center justify-center text-3xl mx-auto mb-4">
              📊
            </div>
            <h2 className="text-2xl text-white font-bold text-center mb-1">
              Monthly Summary
            </h2>
            <p className="text-indigo-300 text-center text-sm mb-6">
              {monthLabel}
            </p>

            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                {
                  label: "Present Days",
                  value: monthlySummary.present_count,
                  color: "text-green-300",
                  bg: "bg-green-500/10 border-green-500/20",
                },
                {
                  label: "Late Arrivals",
                  value: monthlySummary.late_count,
                  color: "text-yellow-300",
                  bg: "bg-yellow-500/10 border-yellow-500/20",
                },
                {
                  label: "Absent Days",
                  value: monthlySummary.absent_count,
                  color: "text-red-300",
                  bg: "bg-red-500/10 border-red-500/20",
                },
                {
                  label: "Half Days",
                  value: monthlySummary.half_day_count,
                  color: "text-orange-300",
                  bg: "bg-orange-500/10 border-orange-500/20",
                },
                {
                  label: "Leave Days",
                  value: monthlySummary.leave_count,
                  color: "text-purple-300",
                  bg: "bg-purple-500/10 border-purple-500/20",
                },
                {
                  label: "Total Hours",
                  value: monthlySummary.total_working_hours,
                  color: "text-blue-300",
                  bg: "bg-blue-500/10 border-blue-500/20",
                },
              ].map(({ label, value, color, bg }) => (
                <div key={label} className={`border rounded-2xl p-4 ${bg}`}>
                  <p className="text-slate-400 text-xs mb-1">{label}</p>
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                </div>
              ))}
            </div>

            <Button
              text="Close"
              onClick={() => setShowSummaryModal(false)}
              className="w-full bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-2xl font-semibold transition cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* ── MY LEAVE REQUESTS MODAL ── */}
      {showLeavesModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-5">
          <div className="bg-[#111827] border border-white/10 rounded-4xl p-8 w-full max-w-lg shadow-2xl">
            <div className="w-16 h-16 rounded-3xl bg-purple-500/20 flex items-center justify-center text-3xl mx-auto mb-4">
              🏖️
            </div>
            <h2 className="text-2xl text-white font-bold text-center mb-6">
              My Leave Requests
            </h2>

            {myLeaveRequests.length === 0 ? (
              <p className="text-slate-500 text-center py-6">
                No leave requests yet
              </p>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {myLeaveRequests.map((r, i) => (
                  <div
                    key={i}
                    className="bg-slate-800 border border-slate-700 rounded-2xl p-4 flex items-start justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-medium text-sm">
                          {r.date}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${leaveStatusBadge(r.status)}`}
                        >
                          {leaveStatusLabel(r.status)}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-xs bg-purple-500/20 text-purple-300 capitalize">
                          {r.leave_type}
                        </span>
                      </div>
                      <p className="text-slate-400 text-sm wrap-break-words">
                        {r.reason}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Button
              text="Close"
              onClick={() => setShowLeavesModal(false)}
              className="w-full mt-6 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-2xl font-semibold transition cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* ── REASON MODAL ── */}
      {showReasonModal && viewReason && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-5">
          <div className="bg-[#111827] border border-white/10 rounded-4xl p-8 w-full max-w-md shadow-2xl">
            <div className="w-16 h-16 rounded-3xl bg-blue-500/20 flex items-center justify-center text-3xl mx-auto mb-5">
              📝
            </div>
            <h2 className="text-2xl text-white font-bold text-center mb-4">
              Full Reason
            </h2>
            <div className="bg-slate-900/70 border border-slate-700 rounded-2xl p-4">
              <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap wrap-break-words">
                {viewReason}
              </p>
            </div>
            <Button
              text="Close"
              onClick={() => {
                setShowReasonModal(false);
                setViewReason(null);
              }}
              className="w-full mt-6 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-2xl font-semibold transition cursor-pointer"
            />
          </div>
        </div>
      )}
    </div>
  );
}
