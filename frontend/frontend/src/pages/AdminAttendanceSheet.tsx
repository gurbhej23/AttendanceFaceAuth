// src/pages/AdminAttendanceSheet.tsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import Button from "../components/Button";
import axios from "axios";

interface SheetRecord {
  serial_no: number;
  employee_id: string;
  employee_name: string;
  email: string;
  department: string;
  designation: string;
  date: string;
  status: string;
  check_in: string;
  check_out: string;
  duration: string;
  reason: string;
  half_day_until: string;
  minutes_late: number;
  profile_img?: string;
  cv_file?: string;
}

interface SheetResponse {
  sheet_name: string;
  date: string;
  total_employees: number;
  present_count: number;
  absent_count: number;
  half_day_count: number;
  not_marked_count: number;
  leave_count: number;
  late_count: number;
  records: SheetRecord[];
}

interface LeaveRequest {
  id: string;
  employee_id: string;
  employee_name: string;
  department: string;
  designation: string;
  profile_img?: string;
  date: string;
  status: string;
  reason: string;
  leave_type: string;
}

type StatusFilter = "all" | "present" | "absent" | "half_day";
type ActiveTab = "attendance" | "leaves";

const getLocalDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const statusClass = (status: string) => {
  switch (status) {
    case "present":
      return "bg-green-500/20 text-green-300";
    case "late":
      return "bg-yellow-500/20 text-yellow-300";
    case "half day":
    case "half_day":
      return "bg-orange-500/20 text-orange-300";
    case "absent":
      return "bg-red-500/20 text-red-300";
    case "leave":
    case "leave_approved":
      return "bg-purple-500/20 text-purple-300";
    case "leave_pending":
      return "bg-slate-500/20 text-slate-300";
    case "leave_rejected":
      return "bg-red-500/20 text-red-300";
    case "not_marked":
      return "bg-slate-600/20 text-slate-400";
    default:
      return "bg-slate-500/20 text-slate-300";
  }
};

const statusLabel = (status: string) =>
  status
    .split("_")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");

const leaveTypeBadge = (t: string) => {
  switch (t) {
    case "sick":
      return "bg-red-500/20 text-red-300";
    case "emergency":
      return "bg-orange-500/20 text-orange-300";
    default:
      return "bg-blue-500/20 text-blue-300";
  }
};

const leaveTypeIcon = (t: string) => {
  switch (t) {
    case "sick":
      return "🤒";
    case "emergency":
      return "🚨";
    default:
      return "😊";
  }
};

const getMediaUrl = (path?: string | null) => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `http://localhost:8000${path.startsWith("/") ? path : `/${path}`}`;
};

export default function AdminAttendanceSheet() {
  const navigate = useNavigate();

  // ── Tab state ──────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ActiveTab>("attendance");

  // ── Attendance sheet state ─────────────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState(getLocalDate());
  const [sheet, setSheet] = useState<SheetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [viewReason, setViewReason] = useState<string | null>(null);

  // ── Leave requests state ───────────────────────────────────────────────
  const [leaveRecords, setLeaveRecords] = useState<LeaveRequest[]>([]);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveFilter, setLeaveFilter] = useState<
    "leave_pending" | "leave_approved" | "leave_rejected" | "all"
  >("leave_pending");
  const [leaveSearch, setLeaveSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  const today = getLocalDate();

  // ── Toast helper ───────────────────────────────────────────────────────
  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Fetch attendance sheet ─────────────────────────────────────────────
  useEffect(() => {
    const fetchSheet = async () => {
      try {
        setLoading(true);
        setError("");
        const response = await API.get("/attendance/admin-sheet/", {
          params: { date: selectedDate },
        });
        setSheet(response.data);
      } catch (err: unknown) {
        if (axios.isAxiosError(err)) {
          setError(
            err.response?.data?.error || "Failed to load attendance sheet",
          );
        } else {
          setError("Failed to load attendance sheet");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchSheet();
  }, [selectedDate]);

  // ── Fetch leave requests ───────────────────────────────────────────────
  const fetchLeaveRequests = useCallback(async () => {
    setLeaveLoading(true);
    try {
      const res = await API.get("/attendance/admin-leave-requests/", {
        params: { status: leaveFilter },
      });
      if (res.data.success) {
        setLeaveRecords(res.data.records || []);
      }
    } catch {
      /* silent */
    } finally {
      setLeaveLoading(false);
    }
  }, [leaveFilter]);

  // Fetch pending count for badge
  const fetchPendingCount = useCallback(async () => {
    try {
      const res = await API.get("/attendance/admin-leave-requests/", {
        params: { status: "leave_pending" },
      });
      if (res.data.success) setPendingCount(res.data.total || 0);
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    fetchLeaveRequests();
  }, [fetchLeaveRequests]);

  useEffect(() => {
    fetchPendingCount();
    const interval = setInterval(fetchPendingCount, 30000);
    return () => clearInterval(interval);
  }, [fetchPendingCount]);

  useEffect(() => {
    const role = localStorage.getItem("role");
    if (role !== "admin") navigate("/", { replace: true });
  }, [navigate]);

  // ── Approve / Reject leave ─────────────────────────────────────────────
  const handleLeaveAction = async (
    recordId: string,
    action: "approve" | "reject",
  ) => {
    setActionLoading(recordId + action);
    try {
      const res = await API.post("/attendance/approve-leave/", {
        record_id: recordId,
        action,
      });
      if (res.data.success) {
        showToast(res.data.message, true);
        fetchLeaveRequests();
        fetchPendingCount();
      } else {
        showToast(res.data.error || "Action failed", false);
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        showToast(err.response?.data?.error || "Action failed", false);
      } else {
        showToast("Action failed", false);
      }
    } finally {
      setActionLoading(null);
    }
  };

  // ── Filtered attendance records ────────────────────────────────────────
  const filteredRecords = useMemo(() => {
    const records = sheet?.records || [];
    const search = searchTerm.trim().toLowerCase();
    return records.filter((record) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "present" &&
          ["present", "late"].includes(record.status)) ||
        (statusFilter === "half_day" &&
          ["half_day", "half day"].includes(record.status)) ||
        (statusFilter === "absent" &&
          ["absent", "leave"].includes(record.status)) ||
        record.status === statusFilter;

      const matchesSearch =
        !search ||
        [
          record.employee_name,
          record.employee_id,
          record.email,
          record.department,
          record.designation,
          record.status,
          record.reason,
        ]
          .join(" ")
          .toLowerCase()
          .includes(search);

      return matchesStatus && matchesSearch;
    });
  }, [sheet, searchTerm, statusFilter]);

  // ── Filtered leave records ─────────────────────────────────────────────
  const filteredLeaves = useMemo(() => {
    const search = leaveSearch.trim().toLowerCase();
    if (!search) return leaveRecords;
    return leaveRecords.filter((r) =>
      [
        r.employee_name,
        r.employee_id,
        r.department,
        r.date,
        r.leave_type,
        r.reason,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search),
    );
  }, [leaveRecords, leaveSearch]);

  const handleLogout = () => {
    localStorage.clear();
    navigate("/", { replace: true });
    window.history.pushState(null, "", "/");
  };

  const exportCsv = () => {
    const baseUrl = API.defaults.baseURL || "http://localhost:8000/api";
    window.open(
      `${baseUrl}/attendance/export-csv/?date=${selectedDate}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 p-4 sm:p-6">
      {/* TOAST */}
      {toast && (
        <div
          className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-6 py-4 rounded-2xl text-sm font-semibold shadow-xl border transition-all ${
            toast.ok
              ? "bg-green-500/15 border-green-500/30 text-green-300"
              : "bg-red-500/15 border-red-500/30 text-red-300"
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div className="max-w-8xl mx-auto">
        {/* HEADER */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-3xl text-white font-bold">Admin Dashboard</h1>
            <p className="text-slate-400 mt-1">
              Manage attendance and leave requests
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {activeTab === "attendance" && (
              <input
                type="date"
                value={selectedDate}
                max={today}
                onChange={(e) =>
                  setSelectedDate(
                    e.target.value > today ? today : e.target.value,
                  )
                }
                className="p-3 rounded-xl bg-slate-800 text-white border border-slate-700 focus:border-blue-500 outline-none"
              />
            )}
            {activeTab === "attendance" && (
              <Button
                text="Export CSV"
                onClick={exportCsv}
                className="bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-xl font-semibold cursor-pointer"
              />
            )}
            <Button
              text="Employees"
              onClick={() => navigate("/admin-employees")}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-semibold cursor-pointer"
            />
            <Button
              text="Logout"
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-xl font-semibold cursor-pointer"
            />
          </div>
        </div>

        {/* TABS */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("attendance")}
            className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition cursor-pointer ${
              activeTab === "attendance"
                ? "bg-blue-600 text-white"
                : "bg-slate-800 text-slate-400 hover:text-white border border-slate-700"
            }`}
          >
            📋 Attendance Sheet
          </button>
          <button
            onClick={() => setActiveTab("leaves")}
            className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition cursor-pointer relative ${
              activeTab === "leaves"
                ? "bg-purple-600 text-white"
                : "bg-slate-800 text-slate-400 hover:text-white border border-slate-700"
            }`}
          >
            🏖️ Leave Requests
            {pendingCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                {pendingCount > 9 ? "9+" : pendingCount}
              </span>
            )}
          </button>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            ATTENDANCE TAB
        ════════════════════════════════════════════════════════════════ */}
        {activeTab === "attendance" && (
          <>
            {error && (
              <div className="bg-red-500/20 border border-red-500 text-red-300 p-4 rounded-xl mb-5">
                {error}
              </div>
            )}

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                {
                  filter: "all",
                  label: "Total",
                  value: sheet?.total_employees ?? 0,
                  color: "border-slate-700",
                  text: "text-slate-300",
                },
                {
                  filter: "present",
                  label: "Present",
                  value: sheet?.present_count ?? 0,
                  color: "border-green-500/30",
                  text: "text-green-400",
                },
                {
                  filter: "absent",
                  label: "Absent",
                  value: sheet?.absent_count ?? 0,
                  color: "border-red-500/30",
                  text: "text-red-400",
                },
                {
                  filter: "half_day",
                  label: "Half Day",
                  value: sheet?.half_day_count ?? 0,
                  color: "border-orange-500/30",
                  text: "text-orange-400",
                },
              ].map(({ filter, label, value, color, text }) => (
                <button
                  key={filter}
                  onClick={() => setStatusFilter(filter as StatusFilter)}
                  className={`text-left bg-slate-800 border p-5 rounded-2xl transition hover:scale-[1.02] cursor-pointer ${
                    statusFilter === filter ? color.replace("/30", "") : color
                  }`}
                >
                  <p className={`text-sm ${text}`}>{label}</p>
                  <p className="text-3xl text-white font-bold mt-2">{value}</p>
                </button>
              ))}
            </div>

            {/* Table */}
            <div className="bg-slate-800 border border-slate-700 rounded-3xl overflow-hidden">
              <div className="p-5 border-b border-slate-700 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <h2 className="text-xl text-white font-bold">
                  {sheet?.sheet_name || "Attendance Sheet"}
                </h2>
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search employee, ID, department..."
                  className="w-full md:w-96 p-3 rounded-xl bg-slate-700 text-white border border-slate-600 focus:border-blue-500 outline-none"
                />
              </div>

              {loading ? (
                <div className="p-8 text-center text-slate-300">
                  Loading sheet...
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-white">
                    <thead className="bg-slate-700/50 border-b border-slate-700 text-xs text-slate-400 uppercase tracking-wider text-center">
                      <tr>
                        <th className="px-5 py-4">No.</th>
                        <th className="px-5 py-4">Photo</th>
                        <th className="px-5 py-4">Employee</th>
                        <th className="px-5 py-4">ID</th>
                        <th className="px-5 py-4">Department</th>
                        <th className="px-5 py-4">Check In</th>
                        <th className="px-5 py-4">Check Out</th>
                        <th className="px-5 py-4">Duration</th>
                        <th className="px-5 py-4">Status</th>
                        <th className="px-5 py-4">Reason</th>
                        <th className="px-5 py-4">CV</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecords.map((record) => (
                        <tr
                          key={record.employee_id}
                          className="border-b border-slate-700 hover:bg-slate-700/40 transition text-center"
                        >
                          <td className="px-5 py-4 text-slate-400">
                            {record.serial_no}
                          </td>
                          <td className="px-5 py-4">
                            <div className="mx-auto h-12 w-12 overflow-hidden rounded-full border border-white/10 bg-slate-700">
                              {record.profile_img ? (
                                <img
                                  src={getMediaUrl(record.profile_img)}
                                  alt={record.employee_name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center bg-blue-600 font-bold text-white">
                                  {record.employee_name?.charAt(0)}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-left">
                            <p className="font-medium">
                              {record.employee_name}
                            </p>
                            <p className="text-xs text-slate-400">
                              {record.email}
                            </p>
                          </td>
                          <td className="px-5 py-4 text-slate-300">
                            {record.employee_id}
                          </td>
                          <td className="px-5 py-4 text-slate-300">
                            <p>{record.department}</p>
                            <p className="text-xs text-slate-500">
                              {record.designation}
                            </p>
                          </td>
                          <td className="px-5 py-4 font-mono text-green-300">
                            {record.check_in}
                          </td>
                          <td className="px-5 py-4 font-mono text-red-300">
                            {record.check_out}
                          </td>
                          <td className="px-5 py-4 text-slate-300">
                            {record.duration}
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`px-3 py-1 rounded-full text-sm font-medium ${statusClass(record.status)}`}
                            >
                              {statusLabel(record.status)}
                            </span>
                            {record.minutes_late > 0 && (
                              <p className="text-xs text-yellow-400 mt-1">
                                {record.minutes_late}m late
                              </p>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            {record.reason && record.reason !== "--" ? (
                              <button
                                onClick={() => setViewReason(record.reason)}
                                className="text-slate-400 max-w-35 truncate block hover:text-blue-400 underline underline-offset-2 transition cursor-pointer text-sm"
                              >
                                {record.reason}
                              </button>
                            ) : (
                              <span className="text-slate-600">--</span>
                            )}
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
                      {filteredRecords.length === 0 && (
                        <tr>
                          <td
                            colSpan={11}
                            className="px-5 py-8 text-center text-slate-400"
                          >
                            No records found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            LEAVE REQUESTS TAB
        ════════════════════════════════════════════════════════════════ */}
        {activeTab === "leaves" && (
          <>
            {/* Leave filter tabs */}
            <div className="flex flex-wrap gap-2 mb-5">
              {(
                [
                  "leave_pending",
                  "leave_approved",
                  "leave_rejected",
                  "all",
                ] as const
              ).map((f) => {
                const labels: Record<string, string> = {
                  leave_pending: "⏳ Pending",
                  leave_approved: "✅ Approved",
                  leave_rejected: "❌ Rejected",
                  all: "📋 All",
                };
                const active = leaveFilter === f;
                return (
                  <button
                    key={f}
                    onClick={() => setLeaveFilter(f)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition cursor-pointer ${
                      active
                        ? f === "leave_pending"
                          ? "bg-yellow-500 text-slate-900"
                          : f === "leave_approved"
                            ? "bg-green-600 text-white"
                            : f === "leave_rejected"
                              ? "bg-red-600 text-white"
                              : "bg-slate-600 text-white"
                        : "bg-slate-800 text-slate-400 border border-slate-700 hover:text-white"
                    }`}
                  >
                    {labels[f]}
                    {f === "leave_pending" && pendingCount > 0 && (
                      <span className="ml-1.5 bg-red-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5">
                        {pendingCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Search */}
            <div className="mb-5">
              <input
                type="search"
                value={leaveSearch}
                onChange={(e) => setLeaveSearch(e.target.value)}
                placeholder="Search by name, ID, department, date..."
                className="w-full md:w-96 p-3 rounded-xl bg-slate-800 text-white border border-slate-700 focus:border-purple-500 outline-none"
              />
            </div>

            {leaveLoading ? (
              <div className="bg-slate-800 border border-slate-700 rounded-3xl p-12 text-center text-slate-400">
                Loading leave requests...
              </div>
            ) : filteredLeaves.length === 0 ? (
              <div className="bg-slate-800 border border-slate-700 rounded-3xl p-12 text-center">
                <div className="text-5xl mb-4">🏖️</div>
                <p className="text-slate-300 text-lg font-semibold">
                  No leave requests found
                </p>
                <p className="text-slate-500 mt-1 text-sm">
                  {leaveFilter === "leave_pending"
                    ? "No pending requests at this time"
                    : "No records matching your filter"}
                </p>
              </div>
            ) : (
              <div className="bg-slate-800 border border-slate-700 rounded-3xl overflow-hidden">
                <div className="p-5 border-b border-slate-700 flex items-center justify-between">
                  <h2 className="text-xl text-white font-bold">
                    Leave Requests
                  </h2>
                  <span className="text-slate-400 text-sm">
                    {filteredLeaves.length} record
                    {filteredLeaves.length !== 1 ? "s" : ""}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-white">
                    <thead className="bg-slate-700/50 border-b border-slate-700 text-xs text-slate-400 uppercase tracking-wider text-center">
                      <tr>
                        <th className="px-5 py-4">Employee</th>
                        <th className="px-5 py-4">Department</th>
                        <th className="px-5 py-4">Leave Date</th>
                        <th className="px-5 py-4">Type</th>
                        <th className="px-5 py-4">Reason</th>
                        <th className="px-5 py-4">Status</th>
                        {leaveFilter === "leave_pending" && (
                          <th className="px-5 py-4">Actions</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLeaves.map((record) => (
                        <tr
                          key={record.id}
                          className="border-b border-slate-700 hover:bg-slate-700/40 transition text-center"
                        >
                          {/* Employee */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3 text-left">
                              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-slate-700">
                                {record.profile_img ? (
                                  <img
                                    src={getMediaUrl(record.profile_img)}
                                    alt={record.employee_name}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center bg-purple-600 font-bold text-white text-sm">
                                    {record.employee_name?.charAt(0)}
                                  </div>
                                )}
                              </div>
                              <div>
                                <p className="font-semibold text-sm">
                                  {record.employee_name}
                                </p>
                                <p className="text-xs text-slate-400">
                                  {record.employee_id}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Department */}
                          <td className="px-5 py-4 text-slate-300">
                            <p className="text-sm">
                              {record.department || "--"}
                            </p>
                            <p className="text-xs text-slate-500">
                              {record.designation || ""}
                            </p>
                          </td>

                          {/* Leave Date */}
                          <td className="px-5 py-4">
                            <span className="bg-slate-700 text-slate-200 px-3 py-1 rounded-lg font-mono text-sm">
                              {record.date}
                            </span>
                          </td>

                          {/* Type */}
                          <td className="px-5 py-4">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${leaveTypeBadge(record.leave_type)}`}
                            >
                              {leaveTypeIcon(record.leave_type)}{" "}
                              {record.leave_type || "casual"}
                            </span>
                          </td>

                          {/* Reason */}
                          <td className="px-5 py-4 max-w-50">
                            {record.reason && record.reason !== "--" ? (
                              <button
                                onClick={() => setViewReason(record.reason)}
                                className="text-slate-400 truncate block w-full hover:text-blue-400 underline underline-offset-2 transition cursor-pointer text-sm text-left"
                                title={record.reason}
                              >
                                {record.reason}
                              </button>
                            ) : (
                              <span className="text-slate-600">--</span>
                            )}
                          </td>

                          {/* Status badge */}
                          <td className="px-5 py-4">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold ${statusClass(record.status)}`}
                            >
                              {statusLabel(record.status)}
                            </span>
                          </td>

                          {/* Actions — only for pending tab */}
                          {leaveFilter === "leave_pending" && (
                            <td className="px-5 py-4">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() =>
                                    handleLeaveAction(record.id, "approve")
                                  }
                                  disabled={!!actionLoading}
                                  className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer"
                                >
                                  {actionLoading === record.id + "approve"
                                    ? "..."
                                    : "✅ Approve"}
                                </button>
                                <button
                                  onClick={() =>
                                    handleLeaveAction(record.id, "reject")
                                  }
                                  disabled={!!actionLoading}
                                  className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer"
                                >
                                  {actionLoading === record.id + "reject"
                                    ? "..."
                                    : "❌ Reject"}
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* REASON MODAL */}
      {viewReason && (
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
              onClick={() => setViewReason(null)}
              className="w-full mt-6 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-2xl font-semibold transition cursor-pointer"
            />
          </div>
        </div>
      )}
    </div>
  );
}
