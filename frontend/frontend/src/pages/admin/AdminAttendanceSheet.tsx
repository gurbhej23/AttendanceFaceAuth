import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, type Variants } from "framer-motion";
import {
  Calendar,
  ChartNoAxesCombined,
  Download,
  IdCardLanyard,
  User,
  Search,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
  Users,
  AlertCircle,
  Filter,
} from "lucide-react";
import API from "../../services/api";
import AdminSidebar from "../../components/AdminSidebar";
import AttendanceTable from "../../components/dashboard/AttendanceTable";
import ReasonModal from "../../components/modal/ReasonModal";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import MobileMenuButton from "../../components/common/MobileMenuButton";
import AnimatedBackground from "../../components/motion/AnimatedBackground";
import ThreeDCardContainer from "../../components/motion/ThreeDCardContainer";
import type { AttendanceRecord } from "../../types/attendance";
import { getMediaUrl } from "../../utils/chatHelpers";
import { isAdminOrHR } from "../../utils/auth";
import { getAttendanceStatusLabel } from "../../utils/dashboardUi";

const getStatusBadgeClass = (status: string): string => {
  const normalized = (status || "").toLowerCase().trim().replace(/[- ]/g, "_");
  switch (normalized) {
    case "present":
    case "on_time":
    case "ontime":
      return "bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40 shadow-xs font-semibold";
    case "late":
      return "bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40 shadow-xs font-semibold";
    case "absent":
      return "bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/40 shadow-xs font-semibold";
    case "half_day":
      return "bg-indigo-100 text-indigo-800 border border-indigo-300 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/40 shadow-xs font-semibold";
    case "leave":
    case "leave_approved":
      return "bg-purple-100 text-purple-800 border border-purple-300 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/40 shadow-xs font-semibold";
    case "not_marked":
      return "bg-slate-200 text-slate-700 border border-slate-300 dark:bg-slate-800/80 dark:text-slate-400 dark:border-slate-700/60 font-semibold";
    default:
      return "bg-slate-200 text-slate-700 border border-slate-300 dark:bg-slate-700/50 dark:text-slate-300 dark:border-slate-600/30";
  }
};

const card3dVariants: Variants = {
  hidden: { opacity: 0, y: 30, rotateX: -10, scale: 0.95 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    rotateX: 0,
    scale: 1,
    transition: {
      delay: i * 0.07,
      duration: 0.55,
      ease: [0.25, 1, 0.5, 1] as const,
    },
  }),
};

export default function AdminAttendanceSheet() {
  const navigate = useNavigate();
  const location = useLocation();

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [departmentsList, setDepartmentsList] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [viewReason, setViewReason] = useState<string | null>(null);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const adminName = localStorage.getItem("employee_name") || "Admin";
  const adminRole = localStorage.getItem("role") || "Administrator";
  const adminProfileImg = localStorage.getItem("profile_img") || undefined;

  useEffect(() => {
    if (!isAdminOrHR()) {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      let data: AttendanceRecord[] = [];
      let depts: string[] = [];

      try {
        const response = await API.get("/attendance/admin-sheet/", {
          params: { date: selectedDate },
        });
        if (response.data) {
          data = response.data.records || response.data || [];
          if (Array.isArray(response.data.departments)) {
            depts = response.data.departments;
          }
        }
      } catch {
        const response = await API.get("/attendance/mark-report/", {
          params: { date: selectedDate },
        });
        data = response.data.records || response.data || [];
      }

      setRecords(Array.isArray(data) ? data : []);

      if (depts.length > 0) {
        setDepartmentsList(depts);
      } else {
        const extractedDepts = Array.from(
          new Set(data.map((r) => r.department).filter(Boolean)),
        ) as string[];
        extractedDepts.sort();
        setDepartmentsList(extractedDepts);
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setErrorMsg(e.response?.data?.error || "Failed to load employee attendance records");
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchesSearch =
        !searchQuery ||
        (r.employee_name && r.employee_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.employee_id && r.employee_id.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.department && r.department.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.designation && r.designation.toLowerCase().includes(searchQuery.toLowerCase()));

      const normalizedStatus = (r.status || "").toLowerCase().trim().replace(/[- ]/g, "_");
      const matchesStatus =
        statusFilter === "all" ||
        normalizedStatus === statusFilter.toLowerCase().replace(/[- ]/g, "_");

      const matchesDept =
        deptFilter === "all" ||
        (r.department && r.department.toLowerCase() === deptFilter.toLowerCase());

      return matchesSearch && matchesStatus && matchesDept;
    });
  }, [records, searchQuery, statusFilter, deptFilter]);

  const stats = useMemo(() => {
    const total = records.length;
    let present = 0;
    let late = 0;
    let absent = 0;
    let halfDay = 0;
    let leave = 0;
    let notMarked = 0;

    records.forEach((r) => {
      const s = (r.status || "").toLowerCase().trim().replace(/[- ]/g, "_");
      if (s === "present" || s === "on_time" || s === "ontime") present++;
      else if (s === "late") late++;
      else if (s === "absent") absent++;
      else if (s === "half_day") halfDay++;
      else if (s === "leave" || s === "leave_approved") leave++;
      else notMarked++;
    });

    return { total, present, late, absent, halfDay, leave, notMarked };
  }, [records]);

  const handleExportCSV = () => {
    if (filteredRecords.length === 0) return;
    const headers = [
      "Employee ID",
      "Name",
      "Department",
      "Designation",
      "Check In",
      "Check Out",
      "Status",
      "Duration",
      "Date",
    ];
    const rows = filteredRecords.map((r) => [
      `"${r.employee_id || ""}"`,
      `"${r.employee_name || ""}"`,
      `"${r.department || ""}"`,
      `"${r.designation || ""}"`,
      `"${r.check_in || ""}"`,
      `"${r.check_out || ""}"`,
      `"${getAttendanceStatusLabel(r.status)}"`,
      `"${r.duration || ""}"`,
      `"${r.date || selectedDate}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Employee_Attendance_Sheet_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  const handleLogout = () => {
    localStorage.clear();
    navigate("/", { replace: true });
  };

  const statCardsData = [
    {
      label: "Total Logged",
      count: stats.total,
      icon: <Users size={18} className="text-blue-600 dark:text-blue-400" />,
      color: "text-blue-600 dark:text-blue-400",
      bgClass: "bg-white border-blue-200 dark:bg-slate-900 dark:border-blue-500/30",
    },
    {
      label: "Present",
      count: stats.present,
      icon: <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400" />,
      color: "text-emerald-600 dark:text-emerald-400",
      bgClass: "bg-white border-emerald-200 dark:bg-slate-900 dark:border-emerald-500/30",
    },
    {
      label: "Late",
      count: stats.late,
      icon: <Clock size={18} className="text-amber-600 dark:text-amber-400" />,
      color: "text-amber-600 dark:text-amber-400",
      bgClass: "bg-white border-amber-200 dark:bg-slate-900 dark:border-amber-500/30",
    },
    {
      label: "Absent",
      count: stats.absent,
      icon: <XCircle size={18} className="text-rose-600 dark:text-rose-400" />,
      color: "text-rose-600 dark:text-rose-400",
      bgClass: "bg-white border-rose-200 dark:bg-slate-900 dark:border-rose-500/30",
    },
    {
      label: "Half Day",
      count: stats.halfDay,
      icon: <Clock size={18} className="text-indigo-600 dark:text-indigo-400" />,
      color: "text-indigo-600 dark:text-indigo-400",
      bgClass: "bg-white border-indigo-200 dark:bg-slate-900 dark:border-indigo-500/30",
    },
    {
      label: "Leave / Pending",
      count: stats.leave,
      icon: <Calendar size={18} className="text-purple-600 dark:text-purple-400" />,
      color: "text-purple-600 dark:text-purple-400",
      bgClass: "bg-white border-purple-200 dark:bg-slate-900 dark:border-purple-500/30",
    },
  ];

  return (
    <div className="relative flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 overflow-x-hidden transition-colors duration-300">
      <AnimatedBackground />

      <AdminSidebar
        items={sidebarItems}
        onLogout={handleLogout}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        adminName={adminName}
        adminRole={adminRole}
        profileImg={adminProfileImg}
      />

      <MobileMenuButton onClick={() => setMobileSidebarOpen(true)} />

      <main className="relative z-10 flex-1 p-4 md:p-8 lg:p-10 overflow-y-auto w-full lg:ml-22">
        {/* CENTERED HEADER SECTION */}
        <motion.div
          className="mx-auto max-w-4xl text-center mb-10 flex flex-col items-center justify-center pt-8 sm:pt-4"
          initial={{ opacity: 0, y: -20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5 }}
        >

          <div className="flex flex-wrap items-center justify-center gap-3">
            <motion.div whileHover={{ scale: 1.05, rotateY: 5 }} whileTap={{ scale: 0.95 }}>
              <Button
                onClick={fetchAttendance}
                className="flex items-center gap-2 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-md cursor-pointer"
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                Refresh Sheet
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05, rotateY: -5 }} whileTap={{ scale: 0.95 }}>
              <Button
                onClick={handleExportCSV}
                disabled={filteredRecords.length === 0}
                className="flex items-center gap-2 rounded-2xl bg-linear-to-r from-blue-600 to-cyan-600 px-5 py-3 text-sm font-bold text-white hover:from-blue-500 hover:to-cyan-500 disabled:opacity-50 transition-all shadow-lg shadow-blue-500/25 cursor-pointer"
              >
                <Download size={16} />
                Export CSV
              </Button>
            </motion.div>
          </div>
        </motion.div>

        {/* 3D STATS CARDS GRID - CENTERED */}
        <div className="mx-auto max-w-6xl mb-8">
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6 justify-center">
            {statCardsData.map((stat, idx) => (
              <ThreeDCardContainer key={stat.label} maxDegrees={10}>
                <motion.div
                  custom={idx}
                  variants={card3dVariants}
                  initial="hidden"
                  animate="visible"
                  className={`relative overflow-hidden rounded-3xl border ${stat.bgClass} p-4 backdrop-blur-xl transition-all duration-300 shadow-lg flex flex-col justify-between h-full`}
                >
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      {stat.label}
                    </span>
                    {stat.icon}
                  </div>
                  <p className={`mt-3 text-3xl font-black ${stat.color} tracking-tight`}>
                    {stat.count}
                  </p>
                </motion.div>
              </ThreeDCardContainer>
            ))}
          </div>
        </div>

        {/* CENTERED FILTER & SEARCH CONTROLS */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mx-auto max-w-5xl mb-8 rounded-3xl border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-900/80 p-5 backdrop-blur-2xl shadow-xl flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
        >
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <Input
                type="text"
                placeholder="Search name, ID, department, or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-950/70 pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 dark:focus:border-cyan-500 transition-all"
              />
            </div>

            {/* Department Filter */}
            {departmentsList.length > 0 && (
              <div className="flex items-center gap-2">
                <Filter size={15} className="text-slate-400 hidden sm:block" />
                <label className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider whitespace-nowrap">
                  Dept:
                </label>
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="rounded-2xl border border-slate-300 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-950/70 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-blue-500 dark:focus:border-cyan-500 focus:outline-none transition-all cursor-pointer"
                >
                  <option value="all">All Departments</option>
                  {departmentsList.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider whitespace-nowrap">
                Status:
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-2xl border border-slate-300 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-950/70 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-blue-500 dark:focus:border-cyan-500 focus:outline-none transition-all cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="present">Present</option>
                <option value="late">Late</option>
                <option value="absent">Absent</option>
                <option value="half_day">Half Day</option>
                <option value="leave">Leave</option>
                <option value="not_marked">Not Marked</option>
              </select>
            </div>
          </div>

          {/* Date Picker */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider whitespace-nowrap">
              Date:
            </label>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-2xl border border-slate-300 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-950/70 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-blue-500 dark:focus:border-cyan-500 focus:outline-none transition-all cursor-pointer"
            />
          </div>
        </motion.div>

        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto max-w-4xl mb-6 flex items-center gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm font-semibold text-rose-800 dark:text-rose-300 backdrop-blur-xl shadow-lg"
          >
            <AlertCircle size={20} className="shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{errorMsg}</span>
          </motion.div>
        )}

        {/* CENTERED ATTENDANCE SHEET TABLE CONTAINER */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="mx-auto max-w-7xl w-full flex justify-center"
        >
          <div className="w-full">
            <AttendanceTable
              records={filteredRecords}
              loading={loading}
              setViewReason={setViewReason}
              setShowReasonModal={setShowReasonModal}
              getStatusBadgeClass={getStatusBadgeClass}
              getMediaUrl={getMediaUrl}
            />
          </div>
        </motion.div>

        {showReasonModal && (
          <ReasonModal
            reason={viewReason}
            onClose={() => {
              setShowReasonModal(false);
              setViewReason(null);
            }}
          />
        )}
      </main>
    </div>
  );
}
