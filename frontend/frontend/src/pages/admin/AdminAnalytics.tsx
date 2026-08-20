import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import API from "../../services/api";
import AdminSidebar from "../../components/AdminSidebar";
import MobileMenuButton from "../../components/common/MobileMenuButton";
import EmptyState from "../../components/common/EmptyState";
import AnimatedBackground from "../../components/motion/AnimatedBackground";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import { getMediaUrl } from "../../utils/chatHelpers";
import { clearAuthSession, isAdminOrHR } from "../../utils/auth";
import {
  ChartNoAxesCombined,
  Calendar,
  Users,
  Clock,
  Building2,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Download,
  RefreshCw,
  LayoutDashboard,
  ShieldAlert,
  IdCardLanyard,
  User,
  Sparkles,
  Award,
  Zap,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  SunMedium,
  Coffee,
} from "lucide-react";

interface AnalyticsData {
  total_employees: number;
  total_records: number;
  total_working_hours: string;
  average_late_minutes: number;
  status_counts: Record<string, number>;
  location_counts: Record<string, number>;
  daily: Array<Record<string, string | number>>;
  departments: Array<{
    department: string;
    employees: number;
    present: number;
    late: number;
    absent: number;
  }>;
  top_late_employees: Array<{
    employee_id: string;
    employee_name: string;
    late_count: number;
    minutes_late: number;
  }>;
}

export default function AdminAnalytics() {
  const navigate = useNavigate();
  const location = useLocation();
  const employeeName = localStorage.getItem("employee_name") || "Admin";
  const profileImg = getMediaUrl(localStorage.getItem("profile_img") || "");

  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [activeSegment, setActiveSegment] = useState<"overview" | "departments" | "punctuality">("overview");

  useEffect(() => {
    if (!isAdminOrHR()) {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  const loadAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await API.get("/attendance/admin-analytics/", {
        params: { year, month },
      });
      setData(res.data);
    } catch {
      setError("Failed to load analytics records.");
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  // Overall calculations
  const totalLogged = useMemo(() => {
    if (!data?.status_counts) return 0;
    return Object.values(data.status_counts).reduce((acc, curr) => acc + curr, 0);
  }, [data]);

  const presentCount = useMemo(() => {
    return (data?.status_counts?.present || 0) + (data?.status_counts?.late || 0);
  }, [data]);

  const complianceRate = useMemo(() => {
    if (!totalLogged) return 0;
    return Math.round((presentCount / totalLogged) * 100);
  }, [presentCount, totalLogged]);

  const maxDailySum = useMemo(() => {
    if (!data?.daily?.length) return 1;
    return Math.max(
      ...data.daily.map(
        (d) =>
          Number(d.present || 0) +
          Number(d.late || 0) +
          Number(d.half_day || 0) +
          Number(d.absent || 0) +
          Number(d.leave || 0),
      ),
      1,
    );
  }, [data]);

  const sidebarItems = useMemo(
    () => [
      {
        icon: <User size={18} />,
        label: "Profile",
        onClick: () => navigate("/admin-profile"),
        active: location.pathname === "/admin-profile",
      },
      {
        icon: <LayoutDashboard size={18} />,
        label: "Dashboard",
        onClick: () => navigate("/attendance-sheet"),
        active: location.pathname === "/attendance-sheet",
      },
      {
        icon: <Users size={18} />,
        label: "Team",
        onClick: () => navigate("/team"),
        active: location.pathname === "/team",
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
        icon: <ShieldAlert size={18} />,
        label: "Security & Occupancy",
        onClick: () => navigate("/admin-security"),
        active: location.pathname === "/admin-security",
      },
      {
        icon: <IdCardLanyard size={18} />,
        label: "Employees",
        onClick: () => navigate("/admin-employees"),
        active:
          location.pathname === "/admin-employees" ||
          location.pathname === "/admin-create-employee",
      },
    ],
    [location.pathname, navigate],
  );

  return (
    <div className="admin-page-bg relative min-h-screen bg-slate-50 text-slate-900 dark:bg-[#080d1a] dark:text-white px-3 py-5 sm:px-6 transition-colors duration-300">
      <AnimatedBackground particleColor={0x3b82f6} secondaryColor={0x8b5cf6} />

      <AdminSidebar
        items={sidebarItems}
        onLogout={() => {
          clearAuthSession();
          navigate("/");
        }}
        mobileOpen={showMenu}
        onMobileClose={() => setShowMenu(false)}
        adminName={employeeName}
        adminRole="ADMIN"
        profileImg={profileImg}
      />
      <MobileMenuButton onClick={() => setShowMenu(true)} />

      {/* Main Container */}
      <div className="relative z-10 mx-auto max-w-7xl pt-12 sm:pt-4 lg:ml-22 lg:pt-0">
        {/* Header Banner */}
        <header className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200/80 dark:border-white/10 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400">
                <TrendingUp size={12} className="text-blue-500" /> Executive Intelligence &amp; Performance
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
              Attendance Analytics
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              Workforce trends, compliance rates, hours delivered, and department benchmarks.
            </p>
          </div>

          {/* Period Selectors & Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 shadow-xs">
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="bg-transparent px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={String(i + 1)} className="dark:bg-slate-900">
                    {new Date(2026, i).toLocaleString("en-US", { month: "long" })}
                  </option>
                ))}
              </select>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="bg-transparent px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
              >
                {["2024", "2025", "2026", "2027"].map((yr) => (
                  <option key={yr} value={yr} className="dark:bg-slate-900">
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            <Button
              onClick={loadAnalytics}
              className="flex items-center gap-1.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-xs hover:bg-slate-50 cursor-pointer"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
            </Button>
            <Button
              onClick={() => navigate("/attendance-sheet")}
              className="flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 cursor-pointer"
            >
              <Download size={13} /> Detailed Records
            </Button>
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs font-bold text-rose-600 dark:text-rose-400">
            {error}
          </div>
        )}

        {/* ── Metric Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
          {/* Card 1: Total Workforce */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-3xl border border-blue-500/30 bg-white/90 dark:bg-slate-950/80 p-4 sm:p-5 shadow-lg backdrop-blur-xl"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Total Workforce
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/15 text-blue-500">
                <Users size={16} />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black text-blue-600 dark:text-blue-400">
                {data?.total_employees ?? 0}
              </span>
              <span className="text-xs font-semibold text-slate-500">Active Staff</span>
            </div>
            <div className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
              <ArrowUpRight size={13} />
              <span>{data?.departments?.length ?? 0} Departments Covered</span>
            </div>
          </motion.div>

          {/* Card 2: Compliance Rate */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-white/90 dark:bg-slate-950/80 p-4 sm:p-5 shadow-lg backdrop-blur-xl"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Compliance Rate
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500">
                <CheckCircle2 size={16} />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black text-emerald-600 dark:text-emerald-400">
                {complianceRate}%
              </span>
              <span className="text-xs font-semibold text-slate-500">Monthly Avg</span>
            </div>
            <div className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              <Sparkles size={12} />
              <span>{presentCount} Total Present Shifts</span>
            </div>
          </motion.div>

          {/* Card 3: Total Productive Hours */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="relative overflow-hidden rounded-3xl border border-cyan-500/30 bg-white/90 dark:bg-slate-950/80 p-4 sm:p-5 shadow-lg backdrop-blur-xl"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Delivered Work Hours
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-500">
                <Clock size={16} />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-cyan-600 dark:text-cyan-400">
                {data?.total_working_hours || "0h 0m"}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-cyan-600 dark:text-cyan-400">
              <Zap size={12} />
              <span>Cumulative Hours</span>
            </div>
          </motion.div>

          {/* Card 4: Average Punctuality Delay */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-white/90 dark:bg-slate-950/80 p-4 sm:p-5 shadow-lg backdrop-blur-xl"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Average Late Delay
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
                <AlertTriangle size={16} />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black text-amber-600 dark:text-amber-400">
                {data?.average_late_minutes ?? 0}m
              </span>
              <span className="text-xs font-semibold text-slate-500">per late check-in</span>
            </div>
            <div className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
              <span>{data?.top_late_employees?.length ?? 0} Repeat Late Occurrences</span>
            </div>
          </motion.div>
        </div>

        {/* ── Segment Controller ── */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-3 mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveSegment("overview")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition cursor-pointer whitespace-nowrap ${
              activeSegment === "overview"
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20"
                : "bg-white dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-transparent"
            }`}
          >
            <ChartNoAxesCombined size={16} /> Monthly Trends &amp; Status Breakdown
          </button>
          <button
            onClick={() => setActiveSegment("departments")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition cursor-pointer whitespace-nowrap ${
              activeSegment === "departments"
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20"
                : "bg-white dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-transparent"
            }`}
          >
            <Building2 size={16} /> Departmental Benchmarking ({data?.departments?.length ?? 0})
          </button>
          <button
            onClick={() => setActiveSegment("punctuality")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition cursor-pointer whitespace-nowrap ${
              activeSegment === "punctuality"
                ? "bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md shadow-amber-500/20"
                : "bg-white dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-transparent"
            }`}
          >
            <AlertTriangle size={16} /> Punctuality &amp; Late Risk Analysis
          </button>
        </div>

        {/* ─── SEGMENT 1: OVERVIEW & MONTHLY TREND ─── */}
        {activeSegment === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6">
              {/* Daily Attendance Trend */}
              <div className="rounded-3xl border border-slate-200/90 dark:border-white/10 bg-white/90 dark:bg-slate-950/80 p-5 sm:p-6 shadow-xl backdrop-blur-xl">
                <div className="flex items-center justify-between mb-5 border-b border-slate-200 dark:border-white/10 pb-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <TrendingUp size={16} className="text-blue-500" /> Daily Attendance Progression
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Day-by-day volume of employee attendance
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-bold text-slate-500">
                    <span className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Present
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Late
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Absent
                    </span>
                  </div>
                </div>

                {(!data?.daily || data.daily.length === 0) ? (
                  <div className="py-12 text-center">
                    <EmptyState
                      icon={<Calendar className="h-8 w-8 text-slate-400" />}
                      title="No attendance records found for this period"
                    />
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    {data.daily.map((day) => {
                      const present = Number(day.present || 0);
                      const late = Number(day.late || 0);
                      const absent = Number(day.absent || 0);
                      const halfDay = Number(day.half_day || 0);
                      const leave = Number(day.leave || 0);
                      const dayTotal = present + late + absent + halfDay + leave;

                      return (
                        <div
                          key={String(day.date)}
                          className="group grid grid-cols-[80px_1fr_40px] items-center gap-3 rounded-xl p-1.5 hover:bg-slate-50 dark:hover:bg-slate-900/60 transition"
                        >
                          <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-400">
                            {String(day.date).slice(5)}
                          </span>

                          <div className="h-3.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 flex shadow-inner">
                            {present > 0 && (
                              <div
                                style={{ width: `${(present / maxDailySum) * 100}%` }}
                                className="h-full bg-emerald-500"
                                title={`Present: ${present}`}
                              />
                            )}
                            {late > 0 && (
                              <div
                                style={{ width: `${(late / maxDailySum) * 100}%` }}
                                className="h-full bg-amber-400"
                                title={`Late: ${late}`}
                              />
                            )}
                            {halfDay > 0 && (
                              <div
                                style={{ width: `${(halfDay / maxDailySum) * 100}%` }}
                                className="h-full bg-orange-500"
                                title={`Half Day: ${halfDay}`}
                              />
                            )}
                            {absent > 0 && (
                              <div
                                style={{ width: `${(absent / maxDailySum) * 100}%` }}
                                className="h-full bg-rose-500"
                                title={`Absent: ${absent}`}
                              />
                            )}
                            {leave > 0 && (
                              <div
                                style={{ width: `${(leave / maxDailySum) * 100}%` }}
                                className="h-full bg-purple-500"
                                title={`Leave: ${leave}`}
                              />
                            )}
                          </div>

                          <span className="text-right font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                            {dayTotal}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Status Mix & Distribution */}
              <div className="rounded-3xl border border-slate-200/90 dark:border-white/10 bg-white/90 dark:bg-slate-950/80 p-5 sm:p-6 shadow-xl backdrop-blur-xl flex flex-col justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
                    <Sparkles size={16} className="text-indigo-500" /> Attendance Status Distribution
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
                    Breakdown across all shifts marked this month
                  </p>

                  <div className="space-y-3">
                    {[
                      { key: "present", label: "Present (On-Time)", count: data?.status_counts?.present || 0, color: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/30" },
                      { key: "late", label: "Late Arrivals", count: data?.status_counts?.late || 0, color: "bg-amber-400", text: "text-amber-600 dark:text-amber-400", border: "border-amber-500/30" },
                      { key: "half_day", label: "Half Day Sessions", count: data?.status_counts?.half_day || 0, color: "bg-orange-500", text: "text-orange-600 dark:text-orange-400", border: "border-orange-500/30" },
                      { key: "absent", label: "Absences", count: data?.status_counts?.absent || 0, color: "bg-rose-500", text: "text-rose-600 dark:text-rose-400", border: "border-rose-500/30" },
                      { key: "leave", label: "Approved Leaves", count: data?.status_counts?.leave || 0, color: "bg-purple-500", text: "text-purple-600 dark:text-purple-400", border: "border-purple-500/30" },
                    ].map((item) => {
                      const pct = totalLogged > 0 ? Math.round((item.count / totalLogged) * 100) : 0;
                      return (
                        <div
                          key={item.key}
                          className="flex items-center justify-between rounded-2xl bg-slate-50 dark:bg-slate-900/70 p-3.5 border border-slate-200 dark:border-slate-800"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className={`h-3 w-3 rounded-full ${item.color}`} />
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              {item.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`font-mono text-xs font-black ${item.text}`}>
                              {item.count}
                            </span>
                            <span className="rounded-md bg-slate-200 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-400">
                              {pct}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-6 rounded-2xl bg-blue-500/10 border border-blue-500/25 p-3.5 text-xs text-blue-600 dark:text-blue-300 font-medium">
                  💡 <span className="font-bold">Summary:</span> {complianceRate}% of scheduled workforce attended shifts without absence.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── SEGMENT 2: DEPARTMENT BENCHMARKING ─── */}
        {activeSegment === "departments" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(data?.departments || []).map((dept) => {
                const total = dept.present + dept.late + dept.absent;
                const rate = total > 0 ? Math.round(((dept.present + dept.late) / total) * 100) : 0;

                return (
                  <div
                    key={dept.department}
                    className="relative overflow-hidden rounded-3xl border border-slate-200/90 dark:border-white/10 bg-white/90 dark:bg-slate-950/80 p-5 shadow-lg backdrop-blur-xl flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-3">
                        <div>
                          <h3 className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-tight">
                            {dept.department}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {dept.employees} Employees Assigned
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-black text-blue-600 dark:text-blue-400">
                            {rate}%
                          </span>
                          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                            Compliance
                          </p>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 mb-4 flex">
                        <div
                          className="h-full bg-emerald-500"
                          style={{ width: `${total > 0 ? (dept.present / total) * 100 : 0}%` }}
                        />
                        <div
                          className="h-full bg-amber-400"
                          style={{ width: `${total > 0 ? (dept.late / total) * 100 : 0}%` }}
                        />
                        <div
                          className="h-full bg-rose-500"
                          style={{ width: `${total > 0 ? (dept.absent / total) * 100 : 0}%` }}
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-2">
                          <p className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {dept.present}
                          </p>
                          <p className="text-[10px] text-slate-500">Present</p>
                        </div>
                        <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-2">
                          <p className="font-mono font-bold text-amber-600 dark:text-amber-400">
                            {dept.late}
                          </p>
                          <p className="text-[10px] text-slate-500">Late</p>
                        </div>
                        <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-2">
                          <p className="font-mono font-bold text-rose-600 dark:text-rose-400">
                            {dept.absent}
                          </p>
                          <p className="text-[10px] text-slate-500">Absent</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── SEGMENT 3: PUNCTUALITY & LATE RISK ANALYSIS ─── */}
        {activeSegment === "punctuality" && (
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200/90 dark:border-white/10 bg-white/90 dark:bg-slate-950/80 p-5 sm:p-6 shadow-xl backdrop-blur-xl">
              <div className="flex items-center justify-between mb-5 border-b border-slate-200 dark:border-white/10 pb-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <AlertTriangle size={16} className="text-amber-500" /> Top Late Arrivals &amp; Tardiness Matrix
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Employees with multiple delayed check-ins during the current month
                  </p>
                </div>
                <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                  {data?.top_late_employees?.length ?? 0} Flagged
                </span>
              </div>

              {(!data?.top_late_employees || data.top_late_employees.length === 0) ? (
                <div className="py-12 text-center">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
                  <h3 className="font-bold text-slate-800 dark:text-white">Exceptional Punctuality</h3>
                  <p className="text-xs text-slate-500 mt-1">No repeat late arrival incidents recorded for this month.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {data.top_late_employees.map((emp, idx) => (
                    <div
                      key={emp.employee_id}
                      className="flex items-center justify-between rounded-2xl border border-amber-500/20 bg-amber-500/5 dark:bg-slate-900/70 p-4 transition shadow-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 font-black text-amber-600 dark:text-amber-400">
                          #{idx + 1}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-slate-900 dark:text-white">
                            {emp.employee_name}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                            ID: {emp.employee_id}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="rounded-full bg-amber-500/20 border border-amber-500/40 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                          {emp.late_count} times
                        </span>
                        <p className="text-[11px] font-mono font-bold text-rose-600 dark:text-rose-400 mt-1">
                          +{emp.minutes_late} mins delayed
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
