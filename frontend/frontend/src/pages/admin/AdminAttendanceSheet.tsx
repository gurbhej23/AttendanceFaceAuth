// src/pages/AdminAttendanceSheet.tsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import API from "../../services/api";
import Button from "../../components/common/Button";
import AdminSidebar from "../../components/AdminSidebar";
import MobileMenuButton from "../../components/common/MobileMenuButton";
import NotificationPanel from "../../components/common/NotificationPanel";
import LogOutModal from "../../components/modal/LogOutModal";
import {
  useDashboardNotifications,
  type DashboardNotification,
} from "../../hooks/useDashboardNotifications";
import { dispatchNotificationAction } from "../../utils/notificationActions";
import { getMediaUrl } from "../../utils/chatHelpers";
import { DASH_CELL_EMPTY, isEmptyCellValue } from "../../utils/dashboardUi";
import axios from "axios";
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  FileText,
  IdCardLanyard,
  List,
  Stethoscope,
  User,
  X,
  XCircle,
} from "lucide-react";
import Input from "../../components/common/Input";
import DashboardDatePicker from "../../components/common/DashboardDatePicker";
import AttendanceTableSkeleton from "../../components/admin/AttendanceTableSkeleton";

interface SheetRecord {
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
  location_status?: string;
  location_distance_meters?: number;
  location_maps_url?: string;
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
      return "bg-slate-600/20 text-slate-400 status-not-marked-pulse";
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
      return "bg-red-500/15 text-red-300 border border-red-500/25";
    case "emergency":
      return "bg-orange-500/15 text-orange-300 border border-orange-500/25";
    default:
      return "bg-blue-500/15 text-blue-300 border border-blue-500/25";
  }
};

const leaveTypeLabel = (t: string) => {
  const type = t || "casual";
  return type.charAt(0).toUpperCase() + type.slice(1);
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

const formatDisplayDate = (dateStr: string) => {
  const date = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

export default function AdminAttendanceSheet() {
  const navigate = useNavigate();
  const location = useLocation();

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

  const [showMenu, setShowMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const today = getLocalDate();
  const adminId = localStorage.getItem("employee_id") || "";
  const adminName = localStorage.getItem("employee_name") || "Admin";
  const adminRoleRaw = localStorage.getItem("role") || "admin";
  const adminRole = adminRoleRaw.toUpperCase();
  const isHr = adminRoleRaw === "hr";
  const dashboardTitle = isHr ? "HR Dashboard" : "Admin Dashboard";
  const adminProfileImg = getMediaUrl(localStorage.getItem("profile_img"));

  const {
    notifications,
    unreadCount,
    markAllRead,
    markOneRead,
    deleteOne,
    refreshNotifications,
  } = useDashboardNotifications(
    adminId,
    adminRoleRaw === "hr" ? "hr" : "admin",
  );

  const handleNotificationSelect = useCallback(
    (item: DashboardNotification) => {
      markOneRead(item.id);
      if (item.type === "leave_request") {
        setActiveTab("leaves");
      } else if (item.group_id) {
        dispatchNotificationAction({
          type: "open_chat",
          chat: { type: "group", id: item.group_id },
        });
      } else if (item.contact_id) {
        dispatchNotificationAction({
          type: "open_chat",
          chat: { type: "direct", id: item.contact_id },
        });
      }
    },
    [markOneRead],
  );

  useEffect(() => {
    if (showNotifications) {
      void refreshNotifications();
    }
  }, [refreshNotifications, showNotifications]);

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
    if (!["admin", "hr"].includes(role || "")) navigate("/", { replace: true });
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

  const tableFilterKey = `${statusFilter}:${searchTerm.trim().toLowerCase()}`;

  const handleLogout = () => {
    localStorage.clear();
    navigate("/", { replace: true });
  };

  const handleLogoutModal = () => {
    setShowLogoutModal(true);
  };

  const exportCsv = useCallback(() => {
    const baseUrl = API.defaults.baseURL || "http://localhost:8000/api";
    window.open(
      `${baseUrl}/attendance/export-csv/?date=${selectedDate}`,
      "_blank",
      "noopener,noreferrer",
    );
  }, [selectedDate]);

  const sidebarItems = useMemo(
    () => [
      {
        icon: <User size={18} />,
        label: "Profile",
        onClick: () => navigate("/admin-profile"),
        active: location.pathname === "/admin-profile",
      },
      {
        icon: <Bell size={18} />,
        label: "Notifications",
        onClick: () => setShowNotifications(true),
        badgeCount: unreadCount,
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
        active:
          location.pathname === "/admin-employees" ||
          location.pathname === "/admin-create-employee",
      },
      {
        icon: <Download size={18} />,
        label: "Export Report",
        onClick: exportCsv,
      },
    ],
    [exportCsv, location.pathname, navigate, unreadCount],
  );

  return (
    <>
      <div className="min-h-screen bg-linear-to-br from-[#020617] via-[#0f172a] to-[#111827] px-3 py-5 pb-24 sm:px-5 lg:px-5 lg:pb-8">
        {/* TOAST */}
        {toast && (
          <div
            className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-6 py-4 rounded-2xl text-sm font-semibold shadow-xl border transition-all ${toast.ok
              ? "bg-green-500/15 border-green-500/30 text-green-300"
              : "bg-red-500/15 border-red-500/30 text-red-300"
              }`}
          >
            {toast.msg}
          </div>
        )}

        <NotificationPanel
          open={showNotifications}
          onClose={() => setShowNotifications(false)}
          notifications={notifications}
          unreadCount={unreadCount}
          onMarkAllRead={markAllRead}
          onMarkRead={markOneRead}
          onDelete={deleteOne}
          onSelect={handleNotificationSelect}
        />

        <AdminSidebar
          items={sidebarItems}
          onLogout={handleLogoutModal}
          mobileOpen={showMenu}
          onMobileClose={() => setShowMenu(false)}
          adminName={adminName}
          adminRole={adminRole}
          profileImg={adminProfileImg}
        />

        <MobileMenuButton onClick={() => setShowMenu(true)} />

        <div className="mx-auto max-w-400 pb-10 pt-12 transition-all duration-500 ease-out sm:pb-12 sm:pt-5 lg:ml-22 lg:pt-0">
          <div>
            {/* HEADER */}
            <div className="dash-shell-panel relative mb-4 overflow-hidden border border-white/10 bg-white/5 shadow-xl backdrop-blur-xl dash-fade-up sm:mb-6 sm:shadow-2xl">
              <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-indigo-500/10 blur-3xl sm:h-40 sm:w-40" />
              <div className="pointer-events-none absolute -bottom-10 left-1/4 h-24 w-24 rounded-full bg-blue-500/10 blur-3xl sm:h-32 sm:w-32" />

              <div className="relative flex flex-col gap-3 p-4 sm:gap-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-center gap-3 sm:items-center sm:gap-4 ">
                  <div className="h-14 w-14 shrink-0 overflow-hidden border border-white/15 bg-slate-800 shadow-md sm:h-20 sm:w-20 sm:shadow-lg rounded-full">
                    {adminProfileImg ? (
                      <img
                        src={adminProfileImg}
                        alt={adminName}
                        className="h-full w-full object-cover rounded-full"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center bg-linear-to-br from-indigo-600 to-blue-500 text-xl font-bold text-white sm:text-2xl">
                        {adminName.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold dash-welcome-muted text-slate-300 sm:text-sm">
                      {getGreeting()}, {adminName}
                    </p>
                    <h1 className="mt-0.5 text-lg font-bold leading-snug text-white sm:text-2xl lg:text-3xl">
                      {dashboardTitle}
                    </h1>
                    <p className="mt-1 line-clamp-2 text-xs font-medium leading-snug dash-welcome-muted text-slate-400 sm:text-sm">
                      {adminRole} Portal
                      {activeTab === "attendance"
                        ? ` • ${formatDisplayDate(selectedDate)}`
                        : ""}
                    </p>
                  </div>
                </div>

                {activeTab === "attendance" && (
                  <div className="flex items-center gap-2.5 sm:flex-col sm:items-end sm:gap-2">
                    <label className="shrink-0 text-xs font-medium text-slate-400 sm:uppercase sm:tracking-wide">
                      Select date
                    </label>
                    <DashboardDatePicker
                      value={selectedDate}
                      max={today}
                      onChange={setSelectedDate}
                      compact
                      className="min-w-0 flex-1 sm:min-w-[280px]"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* TABS */}
            <div className="dash-tab-shell mb-6 flex w-full flex-col gap-2 sm:inline-flex sm:w-auto sm:flex-row sm:rounded-2xl sm:border sm:border-white/10 sm:bg-slate-900/60 sm:p-1 dash-fade-up dash-fade-up-delay-1">
              <button
                type="button"
                onClick={() => setActiveTab("attendance")}
                className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] sm:w-auto ${
                  activeTab === "attendance"
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                    : "dash-tab-inactive border border-slate-700 bg-slate-800 text-slate-400 hover:text-white sm:border-0 sm:bg-transparent"
                }`}
              >
                <ClipboardList className="h-4 w-4" />
                Attendance Sheet
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("leaves")}
                className={`relative inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] sm:w-auto ${
                  activeTab === "leaves"
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                    : "dash-tab-inactive border border-slate-700 bg-slate-800 text-slate-400 hover:text-white sm:border-0 sm:bg-transparent"
                }`}
              >
                <CalendarDays className="h-4 w-4" />
                Leave Requests
                {pendingCount > 0 && (
                  <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">
                    {pendingCount > 99 ? "99+" : pendingCount}
                  </span>
                )}
              </button>
            </div>

            {activeTab === "attendance" && (
              <div key={`attendance-view-${selectedDate}-${loading ? "load" : "ready"}`}>
                {error && (
                  <div className="bg-red-500/20 border border-red-500 text-red-300 p-4 rounded-xl mb-5">
                    {error}
                  </div>
                )}

                {/* Summary cards */}
                <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
                  {[
                    {
                      filter: "all",
                      label: "Total Employees",
                      value: sheet?.total_employees ?? 0,
                      accent: "text-slate-300",
                      ring: "border-slate-600/50",
                      active: "border-slate-400 bg-slate-800/90",
                      delay: "dash-fade-up-delay-1",
                    },
                    {
                      filter: "present",
                      label: "Present Today",
                      value: sheet?.present_count ?? 0,
                      accent: "text-emerald-400",
                      ring: "border-emerald-500/30",
                      active: "border-emerald-500 bg-emerald-500/10",
                      delay: "dash-fade-up-delay-2",
                    },
                    {
                      filter: "absent",
                      label: "Absent Today",
                      value: sheet?.absent_count ?? 0,
                      accent: "text-red-400",
                      ring: "border-red-500/30",
                      active: "border-red-500 bg-red-500/10",
                      delay: "dash-fade-up-delay-3",
                    },
                    {
                      filter: "half_day",
                      label: "Half Day",
                      value: sheet?.half_day_count ?? 0,
                      accent: "text-orange-400",
                      ring: "border-orange-500/30",
                      active: "border-orange-500 bg-orange-500/10",
                      delay: "dash-fade-up-delay-4",
                    },
                  ].map(({ filter, label, value, accent, ring, active, delay }) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setStatusFilter(filter as StatusFilter)}
                      className={`dash-metric-card dash-fade-up ${delay} border bg-slate-900/50 p-4 text-left ${ring} ${
                        statusFilter === filter ? active : "hover:bg-slate-800/80"
                      }`}
                    >
                      <p className="dash-metric-label text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {label}
                      </p>
                      {loading ? (
                        <div className="mt-3 h-9 w-16 skeleton-shimmer rounded-lg" />
                      ) : (
                        <p className={`dash-metric-value mt-2 text-3xl font-bold ${accent}`}>{value}</p>
                      )}
                    </button>
                  ))}
                </div>

                {/* Table */}
                <div className="dash-table-panel overflow-hidden border border-slate-700/80 bg-slate-900/40 shadow-xl dash-fade-up dash-fade-up-delay-5">
                  <div className="flex flex-col gap-4 border-b border-slate-700/80 p-5 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-white sm:text-xl">
                        {sheet?.sheet_name || "Attendance Sheet"}
                      </h2>
                      <p className="mt-1 text-sm font-medium dash-welcome-muted text-slate-400">
                        {filteredRecords.length} employee
                        {filteredRecords.length !== 1 ? "s" : ""} shown
                      </p>
                    </div>
                    <Input
                      type="search"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search employee, ID, department..."
                      className="w-full rounded-xl border border-slate-600 bg-slate-700 p-3 text-white outline-none transition-[border-color,box-shadow,opacity] duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.12)] md:w-96"
                    />
                  </div>

                  {loading ? (
                    <AttendanceTableSkeleton />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="dash-data-table w-full text-left text-white">
                        <thead className="dash-data-table-head border-b border-slate-700 bg-slate-700/50 text-center text-xs uppercase tracking-wider text-slate-400">
                          <tr>
                            <th className="px-5 py-4">Photo</th>
                            <th className="px-5 py-4">Employee</th>
                            <th className="px-5 py-4">ID</th>
                            <th className="px-5 py-4">Department</th>
                            <th className="px-5 py-4">Check In</th>
                            <th className="px-5 py-4">Check Out</th>
                            <th className="px-5 py-4">Duration</th>
                            <th className="px-5 py-4">Status</th>
                            <th className="px-5 py-4">Location</th>
                            <th className="px-5 py-4">Reason</th>
                            <th className="px-5 py-4">CV</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRecords.map((record, rowIndex) => (
                            <tr
                              key={`${tableFilterKey}-${record.employee_id}`}
                              className="dash-table-row dash-row-enter border-b border-slate-700 text-center"
                              style={{
                                animationDelay: `${Math.min(rowIndex, 14) * 35}ms`,
                              }}
                            >
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
                              <td className="px-5 py-4 text-sm text-slate-300 ">
                                {record.employee_id}
                              </td>
                              <td className="px-5 py-4 text-slate-300">
                                <p className="text-sm">{record.department}</p>
                                <p className="text-xs text-slate-500">
                                  {record.designation}
                                </p>
                              </td>
                              <td className="px-5 py-4 font-mono text-sm">
                                {isEmptyCellValue(record.check_in) ? (
                                  <span className={DASH_CELL_EMPTY}>
                                    {record.check_in || "--"}
                                  </span>
                                ) : (
                                  <span className="text-green-300">
                                    {record.check_in}
                                  </span>
                                )}
                              </td>
                              <td className="px-5 py-4 font-mono text-sm">
                                {isEmptyCellValue(record.check_out) ? (
                                  <span className={DASH_CELL_EMPTY}>
                                    {record.check_out || "--"}
                                  </span>
                                ) : (
                                  <span className="text-red-300">
                                    {record.check_out}
                                  </span>
                                )}
                              </td>
                              <td className="px-5 py-4">
                                <span
                                  className={
                                    isEmptyCellValue(record.duration)
                                      ? `text-sm ${DASH_CELL_EMPTY}`
                                      : "text-slate-300"
                                  }
                                >
                                  {record.duration || "--"}
                                </span>
                              </td>
                              <td className="px-5 py-4">
                                <span
                                  className={`flex rounded-full px-3 py-1 text-sm font-medium ${statusClass(record.status)}`}
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
                                {record.location_maps_url ? (
                                  <a
                                    href={record.location_maps_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs font-semibold text-cyan-300 hover:text-cyan-200"
                                  >
                                    {statusLabel(
                                      record.location_status || "captured",
                                    )}
                                    {record.location_distance_meters
                                      ? ` · ${Math.round(record.location_distance_meters)}m`
                                      : ""}
                                  </a>
                                ) : (
                                  <span className="text-xs text-slate-500">
                                    {statusLabel(
                                      record.location_status || "not captured",
                                    )}
                                  </span>
                                )}
                              </td>
                              <td className="px-5 py-4">
                                {record.reason && record.reason !== "--" ? (
                                  <Button
                                    text={record.reason}
                                    onClick={() => setViewReason(record.reason)}
                                    className="text-slate-400 max-w-35 truncate block hover:text-blue-400 underline underline-offset-2 transition cursor-pointer text-sm"
                                  />
                                ) : (
                                  <span className={`text-sm ${DASH_CELL_EMPTY}`}>
                                    --
                                  </span>
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
                                  <span className={`text-xs ${DASH_CELL_EMPTY}`}>
                                    --
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                          {filteredRecords.length === 0 && (
                            <tr>
                              <td
                                colSpan={12}
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
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════
            LEAVE REQUESTS TAB
        ════════════════════════════════════════════════════════════════ */}
            {activeTab === "leaves" && (
              <div className="pb-2">
                {/* Leave filter tabs */}
                <div className="mb-5 flex flex-wrap gap-2">
                  {(
                    [
                      {
                        key: "leave_pending" as const,
                        label: "Pending",
                        icon: <Clock className="h-3.5 w-3.5" />,
                        activeClass: "dash-leave-chip-pending bg-amber-500/15 text-amber-200 border-amber-500/40",
                      },
                      {
                        key: "leave_approved" as const,
                        label: "Approved",
                        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
                        activeClass: "dash-leave-chip-approved bg-emerald-500/15 text-emerald-200 border-emerald-500/40",
                      },
                      {
                        key: "leave_rejected" as const,
                        label: "Rejected",
                        icon: <XCircle className="h-3.5 w-3.5" />,
                        activeClass: "dash-leave-chip-rejected bg-red-500/15 text-red-200 border-red-500/40",
                      },
                      {
                        key: "all" as const,
                        label: "All",
                        icon: <List className="h-3.5 w-3.5" />,
                        activeClass: "dash-leave-chip-all bg-slate-500/15 text-slate-200 border-slate-500/40",
                      },
                    ] as const
                  ).map(({ key, label, icon, activeClass }) => {
                    const active = leaveFilter === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setLeaveFilter(key)}
                        className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                          active
                            ? activeClass
                            : "dash-leave-filter-inactive border-slate-700 bg-slate-800/80 text-slate-400 hover:border-slate-600 hover:text-white"
                        }`}
                      >
                        {icon}
                        {label}
                        {key === "leave_pending" && pendingCount > 0 && (
                          <span className="ml-1 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                            {pendingCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Search */}
                <div className="mb-5">
                  <Input
                    type="search"
                    value={leaveSearch}
                    onChange={(e) => setLeaveSearch(e.target.value)}
                    placeholder="Search by name, ID, department, date..."
                    className="dash-leave-search w-full rounded-xl border border-slate-700 bg-slate-800 p-3 text-white outline-none focus:border-purple-500 md:w-96"
                  />
                </div>

                {
                  leaveLoading ? (
                    <div className="bg-slate-800 border border-slate-700 rounded-3xl p-12 text-center text-slate-400">
                      Loading leave requests...
                    </div>
                  ) : filteredLeaves.length === 0 ? (
                    <div className="dash-shell-panel border border-slate-700/80 bg-slate-900/40 p-12 text-center">
                      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-slate-700 bg-slate-800 text-slate-400">
                        <CalendarDays className="h-7 w-7" />
                      </div>
                      <p className="text-lg font-semibold text-slate-200">
                        No leave requests found
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {leaveFilter === "leave_pending"
                          ? "No pending requests at this time"
                          : "No records matching your filter"}
                      </p>
                    </div>
                  ) : (
                    <div className="dash-table-panel overflow-hidden border border-slate-700/80 bg-slate-900/40 shadow-xl">
                      <div className="flex items-center justify-between border-b border-slate-700/80 p-5">
                        <h2 className="text-xl text-white font-bold">
                          Leave Requests
                        </h2>
                        <span className="text-slate-400 text-sm">
                          {filteredLeaves.length} record
                          {filteredLeaves.length !== 1 ? "s" : ""}
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="dash-data-table w-full text-white">
                          <thead className="dash-data-table-head bg-slate-700/50 border-b border-slate-700 text-xs text-slate-400 uppercase tracking-wider text-center">
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
                                className="dash-table-row border-b border-slate-700 text-center transition-colors"
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
                                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold capitalize ${leaveTypeBadge(record.leave_type)}`}
                                  >
                                    {record.leave_type === "sick" ? (
                                      <Stethoscope className="h-3.5 w-3.5" />
                                    ) : record.leave_type === "emergency" ? (
                                      <AlertTriangle className="h-3.5 w-3.5" />
                                    ) : (
                                      <CalendarDays className="h-3.5 w-3.5" />
                                    )}
                                    {leaveTypeLabel(record.leave_type)}
                                  </span>
                                </td>

                                {/* Reason */}
                                <td className="px-5 py-4 max-w-50">
                                  {record.reason && record.reason !== "--" ? (
                                    <Button
                                      text={record.reason}
                                      onClick={() => setViewReason(record.reason)}
                                      className="text-slate-400 truncate block w-full hover:text-blue-400 underline underline-offset-2 transition cursor-pointer text-sm text-left"
                                      title={record.reason}
                                    />
                                  ) : (
                                    <span className={`text-sm ${DASH_CELL_EMPTY}`}>
                                      --
                                    </span>
                                  )}
                                </td>

                                {/* Status badge */}
                                <td className="px-5 py-4">
                                  <span
                                    className={`px-3 py-3 rounded-full font-semibold ${statusClass(record.status)}`}
                                  >
                                    {statusLabel(record.status)}
                                  </span>
                                </td>

                                {/* Actions — only for pending tab */}
                                {leaveFilter === "leave_pending" && (
                                  <td className="px-5 py-4">
                                    <div className="flex items-center justify-center gap-2">
                                      <Button
                                        text={
                                          actionLoading === record.id + "approve" ? (
                                            "Processing..."
                                          ) : (
                                            <>
                                              <Check className="h-3.5 w-3.5" />
                                              Approve
                                            </>
                                          )
                                        }
                                        onClick={() =>
                                          handleLeaveAction(record.id, "approve")
                                        }
                                        disabled={!!actionLoading}
                                        className="inline-flex items-center gap-1.5 bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                                      />
                                      <Button
                                        text={
                                          actionLoading === record.id + "reject" ? (
                                            "Processing..."
                                          ) : (
                                            <>
                                              <X className="h-3.5 w-3.5" />
                                              Reject
                                            </>
                                          )
                                        }
                                        onClick={() =>
                                          handleLeaveAction(record.id, "reject")
                                        }
                                        disabled={!!actionLoading}
                                        className="inline-flex items-center gap-1.5 bg-red-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-500 disabled:opacity-50"
                                      />
                                    </div>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                }
              </div>
            )}
          </div>
        </div>

        {/* REASON MODAL */}
        {viewReason && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-5 backdrop-blur-md">
            <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-8 shadow-2xl">
              <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl border border-blue-500/30 bg-blue-500/10 text-blue-300">
                <FileText className="h-8 w-8" />
              </div>
              <h2 className="mb-4 text-center text-2xl font-bold text-white">
                Reason Details
              </h2>
              <div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
                <p className="text-sm leading-relaxed whitespace-pre-wrap wrap-break-words text-slate-300">
                  {viewReason}
                </p>
              </div>
              <Button
                text="Close"
                onClick={() => setViewReason(null)}
                className="mt-6 w-full rounded-2xl bg-slate-700 py-3 font-semibold text-white transition hover:bg-slate-600"
              />
            </div>
          </div>
        )}

        <LogOutModal
          open={showLogoutModal}
          onClose={() => setShowLogoutModal(false)}
          onLogout={handleLogout}
        />
      </div>
    </>
  );
}
