// src/pages/Dashboard.tsx
import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import API from "../../services/api";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import MobileMenuButton from "../../components/common/MobileMenuButton";
import AdminSidebar from "../../components/AdminSidebar";
import NotificationPanel from "../../components/common/NotificationPanel";
import {
  useDashboardNotifications,
  type DashboardNotification,
} from "../../hooks/useDashboardNotifications";
import { dispatchNotificationAction } from "../../utils/notificationActions";
import { clearAuthSession } from "../../utils/auth";
// import { getCurrentLocation } from "../../services/attendanceSecurity";
import { getMediaUrl } from "../../utils/chatHelpers";
import LogOutModal from "../../components/modal/LogOutModal";
import {
  Bell,
  CalendarDays,
  ScanLine,
  TimerOff,
  TriangleAlert,
  User,
  UserRoundPen,
  Users,
  X,
} from "lucide-react";
import WelcomeCard from "../../components/dashboard/WelcomeCard";
import StatusCard from "../../components/dashboard/StatusCards";
import AttendanceTable from "../../components/dashboard/AttendanceTable";
import HRPanel from "../../components/dashboard/HRPanel";
import DashboardExtras from "../../components/dashboard/DashboardExtras";
import {
  fetchDashboardExtras,
  type DashboardExtrasData,
} from "../../services/dashboardExtras";
import DashboardDatePicker from "../../components/common/DashboardDatePicker";
import {
  // enqueueMarkPresent,
  flushOfflineQueue,
} from "../../utils/offlineQueue";
import InstallPwaButton from "../../components/common/InstallPwaButton";
import PortalModal from "../../components/common/PortalModal";
import EmptyState from "../../components/common/EmptyState";
import { formatLateDuration } from "../../utils/formatLateDuration";
import { getAttendanceStatusLabel } from "../../utils/dashboardUi";
import AnimatedBackground from "../../components/motion/AnimatedBackground";
import FaceVerificationModal from "../../components/modal/FaceVerificationModal";
import PinVerificationModal from "../../components/modal/PinVerificationModal";
import PresentChoiceModal from "../../components/modal/PresentChoiceModal";

interface AttendanceRecord {
  employee_id: string;
  employee_name: string;
  date: string;
  check_in: string;
  check_out: string;
  duration: string;
  status: string;
  minutes_late?: number;
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
  leave_end_date?: string;
}

const getLocalDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const getLateAlertDismissedKey = (employeeId: string, date: string) =>
  `late_alert_dismissed_${employeeId}_${date}`;

const getLateAlertState = (
  employeeId: string | null,
  date: string,
  record: AttendanceRecord | undefined,
) => {
  if (!employeeId || !record) {
    return { show: false, minutesLate: 0 };
  }

  const mins = record.minutes_late ?? 0;
  const isLateToday = record.status === "late" || mins > 0;

  if (!isLateToday || isLateAlertDismissed(employeeId, date)) {
    return { show: false, minutesLate: 0 };
  }

  return { show: true, minutesLate: mins };
};

const isLateAlertDismissed = (employeeId: string, date: string) => {
  if (!employeeId) return false;
  try {
    return (
      localStorage.getItem(getLateAlertDismissedKey(employeeId, date)) === "1"
    );
  } catch {
    return false;
  }
};

const setLateAlertDismissed = (employeeId: string, date: string) => {
  if (!employeeId) return;
  try {
    localStorage.setItem(getLateAlertDismissedKey(employeeId, date), "1");
  } catch {
    // silent
  }
};

const getApiError = (err: unknown, fallback: string): string => {
  const e = err as { response?: { data?: { error?: string } } };
  return e?.response?.data?.error || fallback;
};

const getStatusBadgeClass = (s: string) => {
  switch (s) {
    case "present":
      return "  text-green-500";
    case "late":
      return "bg-yellow-500/20 text-yellow-300";
    case "absent":
      return "bg-red-500/20 text-red-500";
    case "half_day":
    case "half day":
      return "bg-orange-500/20 text-orange-500";
    case "leave":
    case "leave_approved":
      return "bg-purple-500/20 text-purple-500";
    case "leave_pending":
      return "bg-slate-500/20 text-slate-500";
    case "leave_rejected":
      return "bg-red-500/20 text-red-500";
    default:
      return "bg-slate-500/20 text-slate-500";
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
        text: "text-yellow-400",
        icon: <TriangleAlert color="#febd1e" />,
      };
    case "absent":
      return {
        bg: "from-red-500/20 to-red-500/10",
        border: "border-red-500/20",
        text: "text-red-300",
        icon: <X />,
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

// const leaveStatusBadge = (s: string) => {
//   switch (s) {
//     case "leave_pending":
//       return "bg-yellow-500/20 text-yellow-500";
//     case "leave_approved":
//       return "bg-green-500/20 text-green-500";
//     case "leave_rejected":
//       return "bg-red-500/20 text-red-500";
//     default:
//       return "bg-slate-500/20 text-slate-400";
//   }
// };

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
  const location = useLocation();

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  // const [showAttendancePrompt, setShowAttendancePrompt] = useState(true);
  const [showPresentChoiceModal, setShowPresentChoiceModal] = useState(false);
  const [showFaceVerificationModal, setShowFaceVerificationModal] =
    useState(false);
  const [showPinVerificationModal, setShowPinVerificationModal] =
    useState(false);
  const [showAbsentModal, setShowAbsentModal] = useState(false);
  const [showHalfDayModal, setShowHalfDayModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showLeavesModal, setShowLeavesModal] = useState(false);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [showRegularizationModal, setShowRegularizationModal] = useState(false);
  const [workMode, setWorkMode] = useState<"office" | "wfh">("office");
  const [dashboardExtras, setDashboardExtras] =
    useState<DashboardExtrasData | null>(null);
  const [regDate, setRegDate] = useState(getLocalDate());
  const [regStatus, setRegStatus] = useState("present");
  const [regReason, setRegReason] = useState("");
  const [viewReason, setViewReason] = useState<string | null>(null);

  const [absentReason, setAbsentReason] = useState("");
  const [halfDayReason, setHalfDayReason] = useState("");
  const [halfDayUntil, setHalfDayUntil] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveType, setLeaveType] = useState("casual");
  const [leaveDate, setLeaveDate] = useState(getLocalDate());
  const [leaveEndDate, setLeaveEndDate] = useState(getLocalDate());

  const [selectedDate, setSelectedDate] = useState(getLocalDate());
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary | null>(
    null,
  );
  const [myLeaveRequests, setMyLeaveRequests] = useState<LeaveRequest[]>([]);
  const [employeeDepartment, setEmployeeDepartment] = useState("");
  const [employeeDesignation, setEmployeeDesignation] = useState("");
  const [dashboardProfileImg, setDashboardProfileImg] = useState(
    () => localStorage.getItem("profile_img") || "",
  );
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  // const [markingAttendance, setMarkingAttendance] = useState(false);

  // Late alert state
  const [lateAlert, setLateAlert] = useState<{
    show: boolean;
    minutesLate: number;
  }>({ show: false, minutesLate: 0 });

  const employeeId = localStorage.getItem("employee_id");
  const employeeName = localStorage.getItem("employee_name");
  const userRole = (localStorage.getItem("role") || "employee") as
    | "employee"
    | "admin"
    | "hr";

  const {
    notifications,
    unreadCount,
    markAllRead,
    markOneRead,
    deleteOne,
    refreshNotifications,
  } = useDashboardNotifications(employeeId || "", userRole);

  const handleNotificationSelect = useCallback(
    (item: DashboardNotification) => {
      markOneRead(item.id);
      if (item.group_id) {
        dispatchNotificationAction({
          type: "open_chat",
          chat: { type: "group", id: item.group_id },
        });
      } else if (item.contact_id) {
        dispatchNotificationAction({
          type: "open_chat",
          chat: { type: "direct", id: item.contact_id },
        });
      } else if (item.type === "leave_status") {
        setShowLeavesModal(true);
      }
    },
    [markOneRead],
  );

  const [dismissedBanners, setDismissedBanners] = useState<Record<string, boolean>>({});
  const [holidaysList, setHolidaysList] = useState<
    { id: string; date: string; name: string; applies_to: string }[]
  >([]);
  const [announcementsList, setAnnouncementsList] = useState<
    { id: string; title: string; body: string; created_by_name?: string }[]
  >([]);

  const fetchHolidaysAndAnnouncements = useCallback(async () => {
    try {
      const [hRes, aRes] = await Promise.all([
        API.get("/attendance/hr/holidays/"),
        API.get("/employees/announcements/", { params: { active: "1" } }),
      ]);
      if (hRes.data?.success) {
        setHolidaysList(hRes.data.holidays || []);
      }
      if (aRes.data?.success) {
        setAnnouncementsList(aRes.data.announcements || []);
      }
    } catch {
      /* silent */
    }
  }, []);

  const today = getLocalDate();

  const isTodayHoliday = useMemo(() => {
    return holidaysList.find(
      (h) =>
        h.date === today &&
        (!h.applies_to ||
          h.applies_to === "all" ||
          h.applies_to.toLowerCase() === employeeDepartment.toLowerCase()),
    );
  }, [holidaysList, today, employeeDepartment]);

  const upcomingHolidays = useMemo(() => {
    return holidaysList
      .filter((h) => h.date >= today && !dismissedBanners[`holiday-${h.id || h.date}`])
      .filter(
        (h) =>
          !h.applies_to ||
          h.applies_to === "all" ||
          h.applies_to.toLowerCase() === employeeDepartment.toLowerCase(),
      )
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [holidaysList, today, dismissedBanners, employeeDepartment]);

  const activeAnnouncements = useMemo(() => {
    return announcementsList.filter(
      (a) => !dismissedBanners[`announcement-${a.id}`],
    );
  }, [announcementsList, dismissedBanners]);

  useEffect(() => {
    if (showNotifications) {
      void refreshNotifications();
    }
  }, [refreshNotifications, showNotifications]);
  const profileImg = getMediaUrl(dashboardProfileImg || localStorage.getItem("profile_img"));
  const storedProfilePath = dashboardProfileImg || localStorage.getItem("profile_img") || "";

  const todayRecord = records.find((r) => r.date === today);
  const todayStatus = todayRecord?.status || "";
  const isAttendanceMarkedToday = Boolean(
    todayRecord && todayStatus && todayStatus.toLowerCase() !== "not_marked",
  );
  const cardStyle = getStatusCardStyle(todayStatus);

  const anyModalOpen =
    showFaceVerificationModal ||
    showAbsentModal ||
    showHalfDayModal ||
    showLeaveModal ||
    showLeavesModal ||
    showReasonModal;

  // const showWelcomePrompt =
  //   showAttendancePrompt &&
  //   selectedDate === today &&
  //   !loading &&
  //   !todayRecord &&
  //   !anyModalOpen;

  const dismissLateAlert = useCallback(() => {
    setLateAlert({ show: false, minutesLate: 0 });
    if (employeeId) {
      setLateAlertDismissed(employeeId, today);
    }
  }, [employeeId, today]);

  // ── Auto-dismiss alerts ───────────────────────────────────────────────
  const showSuccess = useCallback((msg: string) => {
    setSuccessMessage(msg);
    setErrorMessage("");
    setTimeout(() => setSuccessMessage(""), 4000);
  }, []);
  const showError = useCallback((msg: string) => {
    setErrorMessage(msg);
    setSuccessMessage("");
    setTimeout(() => setErrorMessage(""), 4000);
  }, []);

  // ── Fetch records ─────────────────────────────────────────────────────
  const fetchRecords = useCallback(async () => {
    try {
      const response = await API.get("/attendance/mark-report/", {
        params: { date: selectedDate, employee_id: employeeId },
      });
      const rows = (response.data.records || []) as AttendanceRecord[];
      const enrichedRows = rows.map((record) =>
        record.employee_id === employeeId && storedProfilePath
          ? { ...record, profile_img: storedProfilePath }
          : record,
      );
      setRecords(enrichedRows);
      if (selectedDate === today) {
        const todayRecordForAlert = enrichedRows.find(
          (record) =>
            record.date === today && record.employee_id === employeeId,
        );
        setLateAlert(getLateAlertState(employeeId, today, todayRecordForAlert));
      }
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, [employeeId, selectedDate, storedProfilePath, today]);

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

  const fetchProfile = useCallback(async () => {
    if (!employeeId) return;
    try {
      const res = await API.get("/employees/profile/", {
        params: { employee_id: employeeId },
      });
      const data = res.data.employee;
      if (data?.department) setEmployeeDepartment(data.department);
      if (data?.designation) setEmployeeDesignation(data.designation);
      if (data?.profile_img) {
        localStorage.setItem("profile_img", data.profile_img);
        setDashboardProfileImg(data.profile_img);
      }
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
      clearAuthSession();
      navigate("/", { replace: true });
      return;
    }

    const loadDashboardData = async () => {
      await Promise.all([
        fetchRecords(),
        fetchMonthlySummary(),
        fetchLeaveRequests(),
        fetchProfile(),
        fetchHolidaysAndAnnouncements(),
      ]);
    };

    void loadDashboardData();
    const interval = window.setInterval(() => {
      void fetchRecords();
    }, 5000);
    return () => window.clearInterval(interval);
  }, [
    selectedDate,
    employeeId,
    fetchRecords,
    fetchMonthlySummary,
    fetchLeaveRequests,
    fetchProfile,
    fetchHolidaysAndAnnouncements,
    navigate,
  ]);

  useEffect(() => {
    if (!employeeId) return;
    void fetchDashboardExtras(employeeId).then(setDashboardExtras);
    const onOnline = () => {
      void flushOfflineQueue((body) =>
        API.post("/attendance/mark-present/", body),
      ).then((n) => {
        if (n > 0) fetchRecords();
      });
    };
    window.addEventListener("online", onOnline);
    void onOnline();
    return () => window.removeEventListener("online", onOnline);
  }, [employeeId, fetchRecords]);

  useEffect(() => {
    if (!employeeId || todayStatus === "present" || todayStatus === "late")
      return;
    const hour = new Date().getHours();
    if (hour >= 10) return;
    const key = `att_reminder_${employeeId}_${today}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    if (Notification.permission === "granted") {
      new Notification("Mark attendance", {
        body: "You have not marked attendance today.",
      });
    } else if (Notification.permission !== "denied") {
      void Notification.requestPermission();
    }
  }, [employeeId, today, todayStatus]);

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleLogout = () => {
    clearAuthSession();
    navigate("/", { replace: true });
  };

  const handleLogoutModal = () => {
    setShowLogoutModal(true);
  };

  const requireEmployeeId = () => {
    if (!employeeId || employeeId === "undefined") {
      clearAuthSession();
      navigate("/", { replace: true });
      return false;
    }
    return true;
  };

  // const markPresent = async () => {
  //   if (!requireEmployeeId() || markingAttendance) return;
  //   setMarkingAttendance(true);
  //   try {
  //     const location = await getCurrentLocation();
  //     const res = await API.post("/attendance/mark-present/", {
  //       employee_id: employeeId,
  //       work_mode: workMode,
  //       ...location,
  //     });
  //     showSuccess(res.data.message || "✅ Marked as present");
  //     setShowAttendancePrompt(false);
  //     if (res.data.is_late && res.data.minutes_late > 0) {
  //       setLateAlert({ show: true, minutesLate: res.data.minutes_late });
  //     } else {
  //       setLateAlert({ show: false, minutesLate: 0 });
  //     }
  //     fetchRecords();
  //   } catch (err: unknown) {
  //     if (!navigator.onLine) {
  //       enqueueMarkPresent({
  //         employee_id: employeeId as string,
  //         work_mode: workMode,
  //       });
  //       showSuccess("Saved offline — will sync when back online");
  //       return;
  //     }
  //     showError(getApiError(err, "Failed to mark present"));
  //   } finally {
  //     setMarkingAttendance(false);
  //   }
  // };

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
      // setShowAttendancePrompt(false);
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
      // setShowAttendancePrompt(false);
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
      showError("Please select leave start date");
      return;
    }
    if (leaveEndDate < leaveDate) {
      showError("Leave end date cannot be before the start date");
      return;
    }
    try {
      const res = await API.post("/attendance/request-leave/", {
        employee_id: employeeId,
        reason: leaveReason,
        leave_date: leaveDate,
        leave_end_date: leaveEndDate,
        leave_type: leaveType,
      });
      setShowLeaveModal(false);
      setLeaveReason("");
      setLeaveType("casual");
      setLeaveDate(getLocalDate());
      setLeaveEndDate(getLocalDate());
      // setShowAttendancePrompt(false);
      showSuccess(res.data.message || "Leave requested");
      fetchRecords();
      fetchLeaveRequests();
    } catch (err: unknown) {
      showError(getApiError(err, "Failed to request leave"));
    }
  };

  const requestRegularization = async () => {
    if (!requireEmployeeId()) return;
    if (!regReason.trim()) {
      showError("Please enter a reason");
      return;
    }
    try {
      const res = await API.post("/attendance/hr/regularization/request/", {
        employee_id: employeeId,
        date: regDate,
        requested_status: regStatus,
        reason: regReason,
      });
      setShowRegularizationModal(false);
      setRegReason("");
      showSuccess(res.data.message || "Request submitted");
    } catch (err: unknown) {
      showError(getApiError(err, "Failed to submit request"));
    }
  };

  const now = new Date();
  const monthLabel = now.toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });
  const sidebarItems = useMemo(
    () => [
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
        icon: <Bell size={18} />,
        label: "Notifications",
        onClick: () => setShowNotifications(true),
        badgeCount: unreadCount,
      },
      {
        icon: <ScanLine size={18} />,
        label: "Check Out",
        onClick: () => navigate("/check-out"),
        active: location.pathname === "/check-out",
      },
      {
        icon: <TimerOff size={18} />,
        label: "Half Day",
        onClick: () => setShowHalfDayModal(true),
      },
      {
        icon: <CalendarDays size={18} />,
        label: "Leave Request",
        onClick: () => setShowLeaveModal(true),
      },
      {
        icon: <User size={18} />,
        label: "My Leaves",
        onClick: () => setShowLeavesModal(true),
      },
    ],
    [location.pathname, navigate, unreadCount],
  );

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="relative min-h-screen bg-linear-to-br from-[#020617] via-[#0f172a] to-[#111827] px-4 py-5 sm:px-5 lg:px-5">
      {/* 3D WebGL Particle Constellation & Ambient Mesh Background */}
      <AnimatedBackground particleColor={0x38bdf8} secondaryColor={0x818cf8} />

      {/* LATE ALERT BANNER */}
      {lateAlert.show && (
        <div className="fixed top-5 left-0 right-0 z-99 bg-yellow-500/95 text-slate-900 px-6 py-3 flex items-center justify-between shadow-xl w-150 mx-auto">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-bold">You checked in late!</p>
              <p className="text-sm">
                You are{" "}
                <span className="font-semibold">
                  {formatLateDuration(lateAlert.minutesLate)}
                </span>{" "}
                late today. Please be on time tomorrow.
              </p>
            </div>
          </div>
          <Button
            text="✕ "
            onClick={dismissLateAlert}
            className="text-slate-900 font-bold text-xl hover:opacity-70 cursor-pointer"
          />
        </div>
      )}

      {/* SUCCESS / ERROR TOASTS */}
      {successMessage && (
        <div className="fixed top-5 left-1/2 z-260 -translate-x-1/2 bg-green-500/15 border border-green-500/30 text-green-500 px-5 py-4 rounded-2xl text-center font-medium shadow-lg">
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="fixed top-5 left-1/2 z-260 -translate-x-1/2 bg-red-500/15 border border-red-500/30 text-red-500 px-5 py-4 rounded-2xl text-center font-medium shadow-lg">
          {errorMessage}
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
        adminName={employeeName || "Employee"}
        adminRole={employeeId || "Employee"}
        profileImg={profileImg}
      />

      <MobileMenuButton onClick={() => setShowMenu(true)} />

      <div
        className={`relative z-10 mx-auto max-w-8xl pt-12 sm:pt-5 lg:ml-22 lg:pt-0 transition-all duration-500 ease-out ${anyModalOpen ? "blur-sm pointer-events-none select-none" : ""}`}
      >
        <WelcomeCard
          employeeName={employeeName}
          employeeId={employeeId}
          employeeDepartment={employeeDepartment}
          employeeDesignation={employeeDesignation}
          profileImg={profileImg}
        />

        {/* TODAY IS A HOLIDAY BANNER */}
        {isTodayHoliday && (
          <div className="mb-4 rounded-3xl border-2 border-amber-500/50 bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-amber-500/20 p-4 shadow-xl backdrop-blur-xl animate-pulse">
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500 text-white font-bold text-2xl shadow-md shrink-0">
                🌴
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-amber-500 px-2 py-0.5 text-[10px] font-black uppercase text-white tracking-wider">
                    Official Holiday Today
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-900 dark:text-amber-300">
                    {isTodayHoliday.date}
                  </span>
                </div>
                <p className="text-base font-extrabold text-amber-950 dark:text-amber-100 mt-0.5">
                  Today is {isTodayHoliday.name}
                </p>
                <p className="text-xs text-amber-800/90 dark:text-amber-300/90">
                  Office is closed today. Standard attendance requirements are exempt for all staff.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* UPCOMING HOLIDAYS BANNER */}
        {upcomingHolidays.length > 0 && !isTodayHoliday && (
          <div className="mb-4 space-y-2">
            {upcomingHolidays.map((h) => (
              <div
                key={h.id || h.date}
                className="flex items-center justify-between gap-3 rounded-3xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-amber-500/10 dark:bg-slate-900/90 p-3.5 backdrop-blur-xl shadow-md"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0 text-lg">
                    🌴
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-extrabold text-amber-900 dark:text-amber-200 truncate">
                      Upcoming Company Holiday: {h.name}
                    </p>
                    <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 truncate font-mono">
                      📅 Scheduled on {h.date} • Office Closed ({h.applies_to || "All"})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setDismissedBanners((prev) => ({
                      ...prev,
                      [`holiday-${h.id || h.date}`]: true,
                    }))
                  }
                  className="rounded-lg p-1.5 text-amber-700 dark:text-amber-400 hover:bg-amber-500/15 cursor-pointer shrink-0"
                  title="Dismiss notice"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* HR ANNOUNCEMENTS BANNER */}
        {activeAnnouncements.length > 0 && (
          <div className="mb-4 space-y-2">
            {activeAnnouncements.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 rounded-3xl border border-indigo-500/30 bg-gradient-to-r from-indigo-500/10 via-violet-500/5 to-indigo-500/10 dark:bg-slate-900/90 p-3.5 backdrop-blur-xl shadow-md"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 shrink-0 text-lg">
                    📢
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-extrabold text-indigo-900 dark:text-indigo-200 truncate">
                      {a.title}
                    </p>
                    <p className="text-[11px] text-indigo-800/80 dark:text-indigo-300/80 truncate">
                      {a.body}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setDismissedBanners((prev) => ({
                      ...prev,
                      [`announcement-${a.id}`]: true,
                    }))
                  }
                  className="rounded-lg p-1.5 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-500/15 cursor-pointer shrink-0"
                  title="Dismiss announcement"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* CHECK-IN OPTIONS BAR */}
        <div className="dash-shell-panel mb-4 p-4.5 rounded-3xl border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-900/80 backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ScanLine className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />{" "}
              Attendance Check-In Options
            </h3>
            <p
              className={`text-xs font-semibold ${isAttendanceMarkedToday ? "text-emerald-600 dark:text-emerald-400" : "text-slate-600 dark:text-slate-300"}`}
            >
              {isAttendanceMarkedToday
                ? `✅ Attendance marked for today (${getAttendanceStatusLabel(todayStatus)})`
                : `Choose your check-in status for today (${today})`}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full sm:w-auto">
            <button
              onClick={() => setShowPresentChoiceModal(true)}
              disabled={isAttendanceMarkedToday}
              title={
                isAttendanceMarkedToday
                  ? "Attendance already marked for today"
                  : "Mark Present"
              }
              className="px-4 py-2.5 rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 hover:bg-emerald-200 dark:hover:bg-emerald-500/30 border border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
            >
              ✅ Present
            </button>

            <button
              onClick={() => setShowAbsentModal(true)}
              disabled={isAttendanceMarkedToday}
              title={
                isAttendanceMarkedToday
                  ? "Attendance already marked for today"
                  : "Mark Absent"
              }
              className="px-4 py-2.5 rounded-2xl bg-rose-100 dark:bg-red-500/20 hover:bg-rose-200 dark:hover:bg-red-500/30 border border-rose-300 dark:border-red-500/40 text-rose-800 dark:text-red-300 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
            >
              ❌ Absent
            </button>

            <button
              onClick={() => setShowHalfDayModal(true)}
              disabled={isAttendanceMarkedToday}
              title={
                isAttendanceMarkedToday
                  ? "Attendance already marked for today"
                  : "Mark Half Day"
              }
              className="px-4 py-2.5 rounded-2xl bg-amber-100 dark:bg-orange-500/20 hover:bg-amber-200 dark:hover:bg-orange-500/30 border border-amber-300 dark:border-orange-500/40 text-amber-800 dark:text-orange-300 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
            >
              🌗 Half Day
            </button>

            <button
              onClick={() => setShowLeaveModal(true)}
              disabled={isAttendanceMarkedToday}
              title={
                isAttendanceMarkedToday
                  ? "Attendance already marked for today"
                  : "Request Leave"
              }
              className="px-4 py-2.5 rounded-2xl bg-purple-100 dark:bg-purple-500/20 hover:bg-purple-200 dark:hover:bg-purple-500/30 border border-purple-300 dark:border-purple-500/40 text-purple-800 dark:text-purple-300 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
            >
              🏖️ Leave
            </button>
          </div>
        </div>

        <div className="mb-3 flex justify-end">
          <InstallPwaButton />
        </div>

        <DashboardExtras data={dashboardExtras} />

        <HRPanel
          employeeId={employeeId || ""}
          workMode={workMode}
          onWorkModeChange={setWorkMode}
          onRegularization={() => setShowRegularizationModal(true)}
        />

        {/* TOP CARDS */}

        <StatusCard
          selectedDate={selectedDate}
          today={today}
          setSelectedDate={setSelectedDate}
          todayStatus={todayStatus}
          todayRecord={todayRecord}
          cardStyle={cardStyle}
        />

        {/* TABLE */}
        <AttendanceTable
          records={records}
          loading={loading}
          setViewReason={setViewReason}
          setShowReasonModal={setShowReasonModal}
          getStatusBadgeClass={getStatusBadgeClass}
          getMediaUrl={getMediaUrl}
          selfEmployeeId={employeeId}
          selfProfileImg={profileImg}
        />

        {monthlySummary && (
          <div className="dash-table-panel dash-fade-up border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/80 shadow-2xl backdrop-blur-xl mt-5 pt-5 px-4 rounded-3xl">
            <div className="dash-monthly-summary pt-3 pb-4">
              <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-1">
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                    Monthly Summary
                  </h3>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    {monthLabel}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 lg:w-full">
                {[
                  {
                    label: "Present Days",
                    value: monthlySummary.present_count,
                    color: "text-emerald-700 dark:text-green-400",
                    bg: "bg-emerald-50 dark:bg-green-500/10 border-emerald-200 dark:border-green-500/20",
                  },
                  {
                    label: "Late Arrivals",
                    value: monthlySummary.late_count,
                    color: "text-amber-700 dark:text-yellow-400",
                    bg: "bg-amber-50 dark:bg-yellow-500/10 border-amber-200 dark:border-yellow-500/20",
                  },
                  {
                    label: "Absent Days",
                    value: monthlySummary.absent_count,
                    color: "text-rose-700 dark:text-red-400",
                    bg: "bg-rose-50 dark:bg-red-500/10 border-rose-200 dark:border-red-500/20",
                  },
                  {
                    label: "Half Days",
                    value: monthlySummary.half_day_count,
                    color: "text-indigo-700 dark:text-orange-400",
                    bg: "bg-indigo-50 dark:bg-orange-500/10 border-indigo-200 dark:border-orange-500/20",
                  },
                  {
                    label: "Leave Days",
                    value: monthlySummary.leave_count,
                    color: "text-purple-700 dark:text-purple-400",
                    bg: "bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20",
                  },
                  {
                    label: "Total Hours",
                    value: monthlySummary.total_working_hours,
                    color: "text-blue-700 dark:text-blue-400",
                    bg: "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20",
                  },
                ].map(({ label, value, color, bg }) => (
                  <div
                    key={label}
                    className={`dash-metric-card border p-4 rounded-2xl ${bg}`}
                  >
                    <p className="dash-metric-label text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {label}
                    </p>
                    <p
                      className={`dash-metric-value mt-1 text-2xl font-black ${color}`}
                    >
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <LogOutModal
        open={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onLogout={handleLogout}
      />

      <PresentChoiceModal
        open={showPresentChoiceModal}
        onClose={() => setShowPresentChoiceModal(false)}
        onSelectFace={() => setShowFaceVerificationModal(true)}
        onSelectPin={() => setShowPinVerificationModal(true)}
      />

      <FaceVerificationModal
        open={showFaceVerificationModal}
        onClose={() => setShowFaceVerificationModal(false)}
        employeeId={employeeId || ""}
        workMode={workMode}
        onSuccess={(msg, isLate, minutesLate) => {
          showSuccess(msg);
          if (isLate && minutesLate && minutesLate > 0) {
            setLateAlert({ show: true, minutesLate });
          }
          fetchRecords();
        }}
      />

      <PinVerificationModal
        open={showPinVerificationModal}
        onClose={() => setShowPinVerificationModal(false)}
        employeeId={employeeId || ""}
        workMode={workMode}
        onSuccess={(msg, isLate, minutesLate) => {
          showSuccess(msg);
          if (isLate && minutesLate && minutesLate > 0) {
            setLateAlert({ show: true, minutesLate });
          }
          fetchRecords();
        }}
      />

      {/* ── ABSENT MODAL ── */}
      <PortalModal
        open={showAbsentModal}
        onClose={() => {
          setShowAbsentModal(false);
          setAbsentReason("");
        }}
      >
        <div className="dash-modal-card w-full rounded-4xl border border-white/10 bg-[#111827] p-8 shadow-2xl">
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
      </PortalModal>

      {/* ── HALF DAY MODAL ── */}
      <PortalModal
        open={showHalfDayModal}
        onClose={() => {
          setShowHalfDayModal(false);
          setHalfDayReason("");
          setHalfDayUntil("");
        }}
      >
        <div className="dash-modal-card relative w-full overflow-hidden rounded-3xl border border-amber-500/30 bg-slate-950/95 p-6 sm:p-7 shadow-[0_0_50px_rgba(245,158,11,0.15)] backdrop-blur-2xl">
          <div className="pointer-events-none absolute -top-20 -left-20 h-40 w-40 rounded-full bg-amber-500/15 blur-3xl" />
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/30 text-2xl shadow-inner">
            🌗
          </div>
          <h2 className="text-xl sm:text-2xl text-white font-extrabold text-center mb-1 tracking-tight">
            Half Day Request
          </h2>
          <p className="text-slate-400 text-center text-xs sm:text-sm mb-5">
            Specify your departure/arrival time and brief reason
          </p>

          <div className="space-y-4 text-left">
            <div>
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 block">
                Half Day Until (Time)
              </label>
              <Input
                type="time"
                value={halfDayUntil}
                onChange={(e) => setHalfDayUntil(e.target.value)}
                className="w-full p-3 rounded-xl bg-slate-900/90 text-white border border-slate-700 focus:border-amber-500 outline-none text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 block">
                Reason for Half Day
              </label>
              <textarea
                value={halfDayReason}
                onChange={(e) => setHalfDayReason(e.target.value)}
                placeholder="Explain the reason for half day..."
                className="w-full h-24 p-3 rounded-xl bg-slate-900/90 text-white border border-slate-700 focus:border-amber-500 outline-none resize-none text-sm"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <Button
              text="Cancel"
              onClick={() => {
                setShowHalfDayModal(false);
                setHalfDayReason("");
                setHalfDayUntil("");
              }}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 py-3 rounded-2xl font-semibold transition cursor-pointer text-xs sm:text-sm"
            />
            <Button
              text="Submit Half Day"
              onClick={markHalfDay}
              className="flex-1 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white py-3 rounded-2xl font-bold transition cursor-pointer shadow-lg shadow-amber-500/25 text-xs sm:text-sm"
            />
          </div>
        </div>
      </PortalModal>

      {/* ── LEAVE REQUEST MODAL ── */}
      <PortalModal
        open={showLeaveModal}
        onClose={() => setShowLeaveModal(false)}
      >
        <div className="dash-modal-card relative w-full overflow-hidden rounded-3xl border border-purple-500/30 bg-slate-950/95 p-6 sm:p-7 shadow-[0_0_50px_rgba(168,85,247,0.15)] backdrop-blur-2xl">
          <div className="pointer-events-none absolute -top-20 -left-20 h-40 w-40 rounded-full bg-purple-500/15 blur-3xl" />
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/15 border border-purple-500/30 text-2xl shadow-inner">
            🏖️
          </div>
          <h2 className="mb-1 text-center text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            Apply For Leave
          </h2>
          <p className="mb-5 text-center text-xs sm:text-sm text-slate-400">
            Submit leave dates for manager approval
          </p>

          <div className="space-y-4 text-left">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Start Date
                </label>
                <DashboardDatePicker
                  value={leaveDate}
                  min={today}
                  onChange={(ymd) => {
                    setLeaveDate(ymd);
                    if (leaveEndDate < ymd) setLeaveEndDate(ymd);
                  }}
                  placeholder="Select start date"
                  className="w-full"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  End Date
                </label>
                <DashboardDatePicker
                  value={leaveEndDate}
                  min={leaveDate}
                  onChange={setLeaveEndDate}
                  placeholder="Select end date"
                  className="w-full"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-300 uppercase tracking-wider">
                Leave Type
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { v: "casual", l: "Casual", e: "😊" },
                  { v: "sick", l: "Sick", e: "🤒" },
                  { v: "emergency", l: "Emergency", e: "🚨" },
                ].map(({ v, l, e }) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setLeaveType(v)}
                    className={`flex cursor-pointer flex-col items-center gap-1 rounded-2xl border py-2 text-xs sm:text-sm font-semibold transition ${leaveType === v
                        ? "border-purple-500 bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/20"
                        : "border-slate-700/80 bg-slate-900/80 text-slate-400 hover:border-purple-500/50 hover:text-white"
                      }`}
                  >
                    <span>{e}</span>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-300 uppercase tracking-wider">
                Reason
              </label>
              <textarea
                value={leaveReason}
                onChange={(e) => setLeaveReason(e.target.value)}
                placeholder="Enter detailed reason for leave..."
                className="h-22 w-full resize-none rounded-xl border border-slate-700 bg-slate-900/90 p-3 text-sm text-white outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <Button
              text="Cancel"
              onClick={() => {
                setShowLeaveModal(false);
                setLeaveReason("");
                setLeaveType("casual");
              }}
              className="flex-1 cursor-pointer rounded-2xl border border-slate-700 bg-slate-800 hover:bg-slate-700 py-3 font-semibold text-slate-200 transition text-xs sm:text-sm"
            />
            <Button
              text="Submit Leave Request"
              onClick={requestLeave}
              className="flex-1 cursor-pointer rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 py-3 font-bold text-white transition shadow-lg shadow-purple-500/25 text-xs sm:text-sm"
            />
          </div>
        </div>
      </PortalModal>

      {/* ── MY LEAVE REQUESTS SCROLLABLE MODAL ── */}
      <PortalModal
        open={showLeavesModal}
        onClose={() => setShowLeavesModal(false)}
        cardClassName="max-w-lg"
      >
        <div className="dash-modal-card relative w-full overflow-hidden rounded-3xl border border-purple-500/30 bg-slate-950/95 p-5 sm:p-7 shadow-[0_0_60px_rgba(168,85,247,0.15)] backdrop-blur-2xl">
          <div className="pointer-events-none absolute -top-20 -left-20 h-40 w-40 rounded-full bg-purple-500/15 blur-3xl" />

          <div className="flex items-center justify-between border-b border-white/10 pb-3.5 mb-4">
            <div className="flex items-center gap-2.5 text-left">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/15 border border-purple-500/30 text-xl">
                🏖️
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white leading-tight">
                  My Leave Requests
                </h2>
                <p className="text-xs text-slate-400">
                  Track the approval status of your leave submissions
                </p>
              </div>
            </div>
            <span className="rounded-full bg-purple-500/20 px-2.5 py-0.5 text-xs font-bold text-purple-300 border border-purple-500/30">
              {myLeaveRequests.length} Total
            </span>
          </div>

          {myLeaveRequests.length === 0 ? (
            <EmptyState
              icon={<span className="text-3xl">🏖️</span>}
              title="No leave requests yet"
            />
          ) : (
            <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
              {myLeaveRequests.map((r, i) => (
                <div
                  key={i}
                  className="dash-leave-item group relative overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/90 p-4 transition-all duration-300 hover:border-slate-600 hover:bg-slate-800/90 shadow-md text-left"
                >
                  {/* Status Left Accent Indicator */}
                  <div
                    className={`absolute top-0 left-0 bottom-0 w-1.5 ${r.status === "approved"
                        ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"
                        : r.status === "rejected"
                          ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]"
                          : "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]"
                      }`}
                  />
                  <div className="pl-2 flex flex-col gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-200">
                          📅 {r.date}
                        </span>
                        <span className="rounded-md bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 text-[10px] font-bold text-purple-300 uppercase tracking-wide">
                          {r.leave_type}
                        </span>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize border ${r.status === "approved"
                            ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                            : r.status === "rejected"
                              ? "bg-rose-500/15 border-rose-500/40 text-rose-300"
                              : "bg-amber-400/15 border-amber-400/40 text-amber-300"
                          }`}
                      >
                        {leaveStatusLabel(r.status)}
                      </span>
                    </div>
                    {r.reason && (
                      <p className="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-xl border border-white/5 wrap-break-words leading-relaxed">
                        {r.reason}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <Button
            text="Close"
            onClick={() => setShowLeavesModal(false)}
            className="dash-modal-cancel-btn mt-5 w-full cursor-pointer rounded-2xl border border-slate-700 bg-slate-800 py-3 font-semibold text-slate-200 transition hover:bg-slate-700 text-xs sm:text-sm"
          />
        </div>
      </PortalModal>

      {/* ── REGULARIZATION MODAL ── */}
      <PortalModal
        open={showRegularizationModal}
        onClose={() => setShowRegularizationModal(false)}
      >
        <div className="dash-modal-card w-full rounded-4xl border border-white/10 bg-[#111827] p-8 shadow-2xl">
          <h2 className="mb-2 text-center text-2xl font-bold text-white">
            Request Regularization
          </h2>
          <p className="mb-5 text-center text-sm text-slate-400">
            Ask admin to correct your attendance for a past date
          </p>
          <label className="mb-2 block text-sm text-slate-400">Date</label>
          <DashboardDatePicker
            value={regDate}
            max={getLocalDate()}
            onChange={setRegDate}
            className="mb-4 w-full"
          />
          <label className="mb-2 block text-sm text-slate-400">
            Requested status
          </label>
          <select
            value={regStatus}
            onChange={(e) => setRegStatus(e.target.value)}
            className="mb-4 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-white"
          >
            <option value="present">Present</option>
            <option value="late">Late</option>
            <option value="half_day">Half Day</option>
          </select>
          <label className="mb-2 block text-sm text-slate-400">Reason</label>
          <Input
            value={regReason}
            onChange={(e) => setRegReason(e.target.value)}
            placeholder="Explain why this needs to be corrected"
            className="mb-5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-white"
          />
          <div className="grid grid-cols-2 gap-3">
            <Button
              text="Cancel"
              onClick={() => setShowRegularizationModal(false)}
              className="rounded-2xl bg-slate-700 py-3 font-semibold text-white cursor-pointer"
            />
            <Button
              text="Submit"
              onClick={requestRegularization}
              className="rounded-2xl bg-blue-600 py-3 font-semibold text-white cursor-pointer"
            />
          </div>
        </div>
      </PortalModal>

      {/* ── REASON MODAL ── */}
      <PortalModal
        open={showReasonModal && Boolean(viewReason)}
        onClose={() => {
          setShowReasonModal(false);
          setViewReason(null);
        }}
      >
        <div className="dash-modal-card w-full rounded-4xl border border-white/10 bg-[#111827] p-8 shadow-2xl">
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
      </PortalModal>
    </div>
  );
}
