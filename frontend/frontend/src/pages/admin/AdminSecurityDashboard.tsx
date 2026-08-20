import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import API from "../../services/api";
import AdminSidebar from "../../components/AdminSidebar";
import MobileMenuButton from "../../components/common/MobileMenuButton";
import EmptyState from "../../components/common/EmptyState";
import AnimatedBackground from "../../components/motion/AnimatedBackground";
import ProfileAvatarImg from "../../components/common/ProfileAvatarImg";
import PortalModal from "../../components/common/PortalModal";
import Input from "../../components/common/Input";
import Button from "../../components/common/Button";
import Toast from "../../components/common/Toast";
import { getMediaUrl } from "../../utils/chatHelpers";
import { clearAuthSession } from "../../utils/auth";
import {
  ShieldAlert,
  Users,
  Building2,
  Clock,
  Flame,
  Printer,
  Radio,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  RefreshCw,
  LogOut,
  Calendar,
  ChartNoAxesCombined,
  IdCardLanyard,
  LayoutDashboard,
  User,
  ShieldCheck,
  Phone,
  Zap,
} from "lucide-react";

interface Occupant {
  employee_id: string;
  name: string;
  department: string;
  designation: string;
  phone: string;
  profile_img: string;
  check_in?: string;
  time_in_building?: string;
  minutes_in_building?: number;
  status?: string;
  work_mode?: string;
}

interface SecurityAlert {
  id: string;
  employee_id: string;
  employee_name: string;
  alert_type: string;
  title: string;
  description: string;
  severity: "info" | "warning" | "critical";
  confidence_score: number;
  captured_image?: string;
  created_at: string;
  is_resolved: boolean;
  resolved_by?: string;
  resolution_notes?: string;
}

interface LiveOccupancySummary {
  total_staff: number;
  currently_inside: number;
  checked_out: number;
  on_leave: number;
  absent: number;
  not_marked: number;
  occupancy_rate_percent: number;
}

interface DepartmentCount {
  department: string;
  inside_count: number;
}

interface LiveEvent {
  employee_id: string;
  employee_name: string;
  action: string;
  time: string;
  status: string;
  work_mode: string;
}

export default function AdminSecurityDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const employeeId = localStorage.getItem("employee_id") || "ADMIN";
  const employeeName = localStorage.getItem("employee_name") || "Security Admin";
  const profileImg = getMediaUrl(localStorage.getItem("profile_img") || "");

  const [activeTab, setActiveTab] = useState<"occupancy" | "alerts" | "rollcall">("occupancy");
  const [showMenu, setShowMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  // Live Occupancy Data
  const [summary, setSummary] = useState<LiveOccupancySummary>({
    total_staff: 0,
    currently_inside: 0,
    checked_out: 0,
    on_leave: 0,
    absent: 0,
    not_marked: 0,
    occupancy_rate_percent: 0,
  });
  const [insidePersonnel, setInsidePersonnel] = useState<Occupant[]>([]);
  const [checkedOutList, setCheckedOutList] = useState<Occupant[]>([]);
  const [departments, setDepartments] = useState<DepartmentCount[]>([]);
  const [recentEvents, setRecentEvents] = useState<LiveEvent[]>([]);
  const [searchOccupant, setSearchOccupant] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");

  // Security Alerts Data
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [unresolvedAlertsCount, setUnresolvedAlertsCount] = useState(0);
  const [criticalAlertsCount, setCriticalAlertsCount] = useState(0);
  const [alertSeverityFilter, setAlertSeverityFilter] = useState("all");
  const [alertStatusFilter, setAlertStatusFilter] = useState("open");

  // Modals & Active Selections
  const [selectedSnapshot, setSelectedSnapshot] = useState<{ url: string; title: string } | null>(null);
  const [resolvingAlert, setResolvingAlert] = useState<SecurityAlert | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [resolvingLoading, setResolvingLoading] = useState(false);

  // Emergency Roll-Call State
  const [accountedMap, setAccountedMap] = useState<Record<string, boolean>>({});
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastHeadline, setBroadcastHeadline] = useState("EMERGENCY EVACUATION NOTICE");
  const [broadcastInstructions, setBroadcastInstructions] = useState(
    "Please proceed immediately to the designated emergency assembly point. Check in with your safety warden."
  );
  const [broadcasting, setBroadcasting] = useState(false);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  // Fetch Live Occupancy
  const fetchLiveOccupancy = useCallback(async () => {
    try {
      const res = await API.get("/attendance/live-occupancy/");
      if (res.data.success) {
        setSummary(res.data.summary);
        setInsidePersonnel(res.data.inside_building || []);
        setCheckedOutList(res.data.checked_out || []);
        setDepartments(res.data.departments || []);
        setRecentEvents(res.data.recent_events || []);
      }
    } catch {
      /* silent */
    }
  }, []);

  // Fetch Security Alerts
  const fetchAlerts = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (alertSeverityFilter !== "all") params.severity = alertSeverityFilter;
      if (alertStatusFilter !== "all") params.status = alertStatusFilter;

      const res = await API.get("/attendance/security-alerts/", { params });
      if (res.data.success) {
        setAlerts(res.data.alerts || []);
        setUnresolvedAlertsCount(res.data.unresolved_count || 0);
        setCriticalAlertsCount(res.data.critical_count || 0);
      }
    } catch {
      /* silent */
    }
  }, [alertSeverityFilter, alertStatusFilter]);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchLiveOccupancy(), fetchAlerts()]);
    setLoading(false);
  }, [fetchLiveOccupancy, fetchAlerts]);

  useEffect(() => {
    loadAllData();
    // Auto-refresh live feed every 12 seconds
    const interval = setInterval(() => {
      fetchLiveOccupancy();
      fetchAlerts();
    }, 12000);
    return () => clearInterval(interval);
  }, [loadAllData, fetchLiveOccupancy, fetchAlerts]);

  // Resolve Alert Action
  const handleResolveAlert = async () => {
    if (!resolvingAlert) return;
    try {
      setResolvingLoading(true);
      const res = await API.post("/attendance/security-alerts/resolve/", {
        alert_id: resolvingAlert.id,
        admin_id: employeeId,
        notes: resolutionNotes,
      });
      if (res.data.success) {
        showToast("Alert resolved successfully!");
        setResolvingAlert(null);
        setResolutionNotes("");
        fetchAlerts();
      } else {
        showToast(res.data.error || "Failed to resolve alert", false);
      }
    } catch {
      showToast("Error resolving alert", false);
    } finally {
      setResolvingLoading(false);
    }
  };

  // Broadcast Emergency Action
  const handleEmergencyBroadcast = async () => {
    try {
      setBroadcasting(true);
      const res = await API.post("/attendance/emergency-broadcast/", {
        admin_id: employeeId,
        headline: broadcastHeadline,
        instructions: broadcastInstructions,
      });
      if (res.data.success) {
        showToast("🚨 Emergency Evacuation Notice Broadcasted!");
        setShowBroadcastModal(false);
        fetchAlerts();
      } else {
        showToast(res.data.error || "Failed to broadcast alert", false);
      }
    } catch {
      showToast("Broadcast failure", false);
    } finally {
      setBroadcasting(false);
    }
  };

  // Toggle Accounted in Roll-Call
  const toggleAccounted = (empId: string) => {
    setAccountedMap((prev) => ({
      ...prev,
      [empId]: !prev[empId],
    }));
  };

  // Print Evacuation Roster
  const handlePrintEvacuation = () => {
    window.print();
  };

  // Filtered Occupants
  const filteredOccupants = useMemo(() => {
    return insidePersonnel.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchOccupant.toLowerCase()) ||
        p.employee_id.toLowerCase().includes(searchOccupant.toLowerCase()) ||
        p.department.toLowerCase().includes(searchOccupant.toLowerCase());
      const matchesDept = deptFilter === "all" || p.department === deptFilter;
      return matchesSearch && matchesDept;
    });
  }, [insidePersonnel, searchOccupant, deptFilter]);

  // Roll-Call Stats
  const accountedCount = useMemo(() => {
    return insidePersonnel.filter((p) => accountedMap[p.employee_id]).length;
  }, [insidePersonnel, accountedMap]);

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
        badgeCount: unresolvedAlertsCount > 0 ? unresolvedAlertsCount : undefined,
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
    [location.pathname, navigate, unresolvedAlertsCount],
  );

  return (
    <div className="relative min-h-screen bg-slate-50 text-slate-900 dark:bg-[#080d1a] dark:text-white px-3 py-5 sm:px-6 transition-colors duration-300">
      <AnimatedBackground particleColor={0x06b6d4} secondaryColor={0xef4444} />

      {toast && <Toast message={toast.msg} ok={toast.ok} />}

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

      {/* Main Content */}
      <div className="relative z-10 mx-auto max-w-7xl pt-12 sm:pt-4 lg:ml-22 lg:pt-0">
        {/* Header Banner */}
        <header className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-white/10 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-500/10 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400">
                <Radio size={12} className="text-cyan-500 animate-pulse" /> Live Security Intelligence
              </span>
              {criticalAlertsCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 animate-bounce">
                  <AlertTriangle size={12} /> {criticalAlertsCount} Critical
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
              Security &amp; Live Occupancy
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              Live facility presence monitor, biometric anomaly detector, and emergency roll-call manager.
            </p>
          </div>

          {/* Action Hub */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              onClick={() => {
                fetchLiveOccupancy();
                fetchAlerts();
                showToast("Feed refreshed!");
              }}
              className="flex items-center gap-1.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-xs hover:bg-slate-50 cursor-pointer"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
            </Button>
            <Button
              onClick={() => setShowBroadcastModal(true)}
              className="flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-rose-500/20 cursor-pointer"
            >
              <Flame size={14} /> Evacuation Broadcast
            </Button>
          </div>
        </header>

        {/* Top Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-6">
          {/* Card 1: Currently Inside */}
          <div className="relative overflow-hidden rounded-3xl border border-cyan-500/30 bg-white/90 dark:bg-slate-950/80 p-4 sm:p-5 shadow-lg backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Inside Facility
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-500">
                <Building2 size={16} />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black text-cyan-600 dark:text-cyan-400">
                {summary.currently_inside}
              </span>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                / {summary.total_staff} Staff
              </span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              <span>{summary.occupancy_rate_percent}% Occupancy Rate</span>
            </div>
          </div>

          {/* Card 2: Checked Out */}
          <div className="relative overflow-hidden rounded-3xl border border-slate-200/90 dark:border-white/10 bg-white/90 dark:bg-slate-950/80 p-4 sm:p-5 shadow-lg backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Checked Out
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/15 text-blue-500">
                <LogOut size={16} />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white">
                {summary.checked_out}
              </span>
            </div>
            <div className="mt-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Completed shifts today
            </div>
          </div>

          {/* Card 3: On Leave / Absent */}
          <div className="relative overflow-hidden rounded-3xl border border-slate-200/90 dark:border-white/10 bg-white/90 dark:bg-slate-950/80 p-4 sm:p-5 shadow-lg backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Leave / Off-Duty
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/15 text-purple-500">
                <Calendar size={16} />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black text-purple-600 dark:text-purple-400">
                {summary.on_leave + summary.absent}
              </span>
              <span className="text-xs text-slate-500">({summary.on_leave} leave, {summary.absent} absent)</span>
            </div>
            <div className="mt-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Not in facility premises
            </div>
          </div>

          {/* Card 4: Security Alerts */}
          <div className="relative overflow-hidden rounded-3xl border border-rose-500/30 bg-white/90 dark:bg-slate-950/80 p-4 sm:p-5 shadow-lg backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Security Alerts
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/15 text-rose-500">
                <ShieldAlert size={16} />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black text-rose-600 dark:text-rose-400">
                {unresolvedAlertsCount}
              </span>
              <span className="text-xs font-bold text-slate-500">Pending Review</span>
            </div>
            <div className="mt-2 text-[11px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1">
              <AlertTriangle size={12} />
              <span>{criticalAlertsCount} Critical Flags</span>
            </div>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-3 mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab("occupancy")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition cursor-pointer whitespace-nowrap ${activeTab === "occupancy"
                ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md shadow-cyan-500/20"
                : "bg-white dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-transparent"
              }`}
          >
            <Building2 size={16} /> Live Occupancy Feed ({summary.currently_inside})
          </button>
          <button
            onClick={() => setActiveTab("alerts")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition cursor-pointer whitespace-nowrap ${activeTab === "alerts"
                ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md shadow-cyan-500/20"
                : "bg-white dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-transparent"
              }`}
          >
            <ShieldAlert size={16} /> Biometric Security Alerts
            {unresolvedAlertsCount > 0 && (
              <span className="ml-1 rounded-full bg-rose-500 px-2 py-0.2 text-[10px] font-black text-white">
                {unresolvedAlertsCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("rollcall")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition cursor-pointer whitespace-nowrap ${activeTab === "rollcall"
                ? "bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-md shadow-rose-500/20"
                : "bg-white dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-transparent"
              }`}
          >
            <Flame size={16} /> Emergency Roll-Call &amp; Evacuation
          </button>
        </div>

        {/* ─── TAB 1: LIVE OCCUPANCY FEED ─── */}
        {activeTab === "occupancy" && (
          <div className="space-y-6">
            {/* Search & Department Filters */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <Input
                  value={searchOccupant}
                  onChange={(e) => setSearchOccupant(e.target.value)}
                  placeholder="Search present personnel by name, ID, or department..."
                  className="w-full rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white shadow-xs backdrop-blur-md outline-none focus:border-cyan-500"
                />
              </div>

              <div className="w-full sm:w-auto">
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="w-full sm:w-56 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 shadow-xs backdrop-blur-md outline-none cursor-pointer focus:border-cyan-500"
                >
                  <option value="all">All Departments</option>
                  {departments.map((d) => (
                    <option key={d.department} value={d.department}>
                      {d.department} ({d.inside_count})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Department Occupancy Distribution Chips */}
            {departments.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                  Distribution:
                </span>
                {departments.map((d) => (
                  <button
                    key={d.department}
                    onClick={() => setDeptFilter(deptFilter === d.department ? "all" : d.department)}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition whitespace-nowrap cursor-pointer ${deptFilter === d.department
                        ? "bg-cyan-500 text-white shadow-xs"
                        : "bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-cyan-500/40"
                      }`}
                  >
                    <span>{d.department}</span>
                    <span className="rounded-full bg-cyan-500/20 dark:bg-white/10 px-1.5 py-0.2 text-[10px]">
                      {d.inside_count}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Live Presence Table / Grid */}
            <div className="rounded-3xl border border-slate-200/90 dark:border-white/10 bg-white/90 dark:bg-slate-950/80 p-5 sm:p-6 shadow-xl backdrop-blur-xl">
              <div className="flex items-center justify-between mb-4 border-b border-slate-200 dark:border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Personnel Currently Inside Facility ({filteredOccupants.length})
                  </h2>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Auto-synced via Real-Time Ticker
                </span>
              </div>

              {filteredOccupants.length === 0 ? (
                <div className="py-12 text-center">
                  <EmptyState
                    icon={<Building2 className="h-8 w-8 text-slate-400" />}
                    title="No personnel currently inside facility"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {filteredOccupants.map((occ) => (
                    <div
                      key={occ.employee_id}
                      className="group relative flex items-center justify-between gap-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/60 p-3.5 hover:border-cyan-500/40 transition shadow-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-emerald-500/50 bg-slate-800 shadow-sm">
                          <ProfileAvatarImg
                            src={occ.profile_img}
                            alt={occ.name}
                            className="h-full w-full object-cover"
                          />
                          <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-slate-900 bg-emerald-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-extrabold text-sm text-slate-900 dark:text-white">
                            {occ.name}
                          </p>
                          <p className="truncate text-xs font-semibold text-cyan-600 dark:text-cyan-400">
                            {occ.designation}
                          </p>
                          <p className="truncate text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {occ.department} • #{occ.employee_id}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          <Clock size={10} /> {occ.check_in || "--"}
                        </span>
                        <p className="text-[10px] font-mono text-slate-400 mt-1">
                          In: {occ.time_in_building || "Just now"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Live Activity Stream (Recent Events) */}
            <div className="rounded-3xl border border-slate-200/90 dark:border-white/10 bg-white/90 dark:bg-slate-950/80 p-5 sm:p-6 shadow-xl backdrop-blur-xl">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3.5 flex items-center gap-2">
                <Zap size={14} className="text-amber-500" /> Real-Time Access Event Log
              </h3>
              <div className="divide-y divide-slate-100 dark:divide-white/5 max-h-56 overflow-y-auto">
                {recentEvents.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">No access events recorded today.</p>
                ) : (
                  recentEvents.map((evt, idx) => (
                    <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${evt.action.includes("Out") ? "bg-blue-500" : "bg-emerald-500"
                            }`}
                        />
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {evt.employee_name}
                        </span>
                        <span className="text-slate-400">({evt.employee_id})</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${evt.action.includes("Out")
                              ? "bg-blue-500/10 text-blue-500"
                              : "bg-emerald-500/10 text-emerald-500"
                            }`}
                        >
                          {evt.action}
                        </span>
                        <span className="font-mono text-slate-500 dark:text-slate-400">{evt.time}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 2: BIOMETRIC SECURITY ALERTS ─── */}
        {activeTab === "alerts" && (
          <div className="space-y-6">
            {/* Filter Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Status:
                </span>
                {["open", "resolved", "all"].map((st) => (
                  <button
                    key={st}
                    onClick={() => setAlertStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition cursor-pointer ${alertStatusFilter === st
                        ? "bg-cyan-600 text-white"
                        : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                      }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Severity:
                </span>
                {["all", "critical", "warning", "info"].map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setAlertSeverityFilter(sev)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition cursor-pointer ${alertSeverityFilter === sev
                        ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                        : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                      }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>

            {/* Alert List */}
            {alerts.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 p-12 text-center">
                <ShieldCheck className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
                <h3 className="font-bold text-slate-800 dark:text-white">All Biometric Checks Clear</h3>
                <p className="text-xs text-slate-500 mt-1">No security anomalies or mismatch alerts recorded.</p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {alerts.map((al) => (
                  <div
                    key={al.id}
                    className={`relative overflow-hidden rounded-3xl border p-4 sm:p-5 backdrop-blur-xl transition shadow-md ${al.severity === "critical"
                        ? "border-rose-500/40 bg-rose-500/5 dark:bg-slate-950/90"
                        : al.severity === "warning"
                          ? "border-amber-500/40 bg-amber-500/5 dark:bg-slate-950/90"
                          : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/90"
                      }`}
                  >
                    {/* Left Severity Accent */}
                    <div
                      className={`absolute top-0 left-0 bottom-0 w-1.5 ${al.severity === "critical"
                          ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]"
                          : al.severity === "warning"
                            ? "bg-amber-500"
                            : "bg-blue-500"
                        }`}
                    />

                    <div className="pl-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${al.severity === "critical"
                                ? "bg-rose-500/20 text-rose-500 border border-rose-500/30"
                                : al.severity === "warning"
                                  ? "bg-amber-500/20 text-amber-500 border border-amber-500/30"
                                  : "bg-blue-500/20 text-blue-500 border border-blue-500/30"
                              }`}
                          >
                            {al.severity}
                          </span>
                          <span className="text-xs font-bold text-slate-800 dark:text-white">
                            {al.title}
                          </span>
                          {al.is_resolved ? (
                            <span className="rounded-md bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.2 text-[10px] font-bold text-emerald-500 flex items-center gap-1">
                              <CheckCircle2 size={10} /> Resolved
                            </span>
                          ) : (
                            <span className="rounded-md bg-rose-500/15 border border-rose-500/30 px-2 py-0.2 text-[10px] font-bold text-rose-500 flex items-center gap-1">
                              <XCircle size={10} /> Open Investigation
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          {al.description}
                        </p>

                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 pt-1 font-mono">
                          <span>👤 Account: {al.employee_name} ({al.employee_id})</span>
                          <span>🕒 {al.created_at}</span>
                          {al.confidence_score > 0 && <span>Distance Score: {al.confidence_score}</span>}
                        </div>

                        {al.is_resolved && al.resolution_notes && (
                          <div className="mt-2 rounded-xl bg-slate-100 dark:bg-slate-900/90 p-2.5 text-xs text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              Resolution ({al.resolved_by}):
                            </span>{" "}
                            {al.resolution_notes}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {al.captured_image && (
                          <Button
                            onClick={() =>
                              setSelectedSnapshot({
                                url: al.captured_image!,
                                title: `${al.title} - ${al.employee_name}`,
                              })
                            }
                            className="flex items-center gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
                          >
                            <Eye size={13} /> View Snapshot
                          </Button>
                        )}
                        {!al.is_resolved && (
                          <Button
                            onClick={() => {
                              setResolvingAlert(al);
                              setResolutionNotes("");
                            }}
                            className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs font-bold text-white shadow-xs cursor-pointer"
                          >
                            Investigate &amp; Resolve
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 3: EMERGENCY ROLL-CALL & EVACUATION ─── */}
        {activeTab === "rollcall" && (
          <div className="space-y-6">
            {/* Emergency Status Banner */}
            <div className="rounded-3xl border-2 border-rose-500 bg-gradient-to-r from-rose-950/90 via-red-900/80 to-slate-950/90 p-5 sm:p-6 text-white shadow-2xl backdrop-blur-xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/30 text-rose-300 animate-pulse border border-rose-400">
                    <Flame size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black tracking-tight">
                      Emergency Evacuation Manifest
                    </h2>
                    <p className="text-xs text-rose-200 mt-0.5">
                      Account for all personnel currently recorded inside the facility during drills or emergencies.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={handlePrintEvacuation}
                    className="flex items-center gap-1.5 rounded-2xl bg-white text-slate-900 px-4 py-2.5 text-xs font-bold shadow-lg hover:bg-slate-100 cursor-pointer"
                  >
                    <Printer size={14} /> Print Roster
                  </Button>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-5 pt-4 border-t border-rose-500/30">
                <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                  <span>
                    Evacuation Progress: {accountedCount} of {insidePersonnel.length} Accounted For
                  </span>
                  <span>
                    {insidePersonnel.length > 0
                      ? Math.round((accountedCount / insidePersonnel.length) * 100)
                      : 100}
                    % Safe
                  </span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-slate-900/80 border border-white/20">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-500"
                    style={{
                      width: `${insidePersonnel.length > 0
                          ? (accountedCount / insidePersonnel.length) * 100
                          : 100
                        }%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Checklist Table */}
            <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-950/80 p-5 sm:p-6 shadow-xl backdrop-blur-xl">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 dark:border-white/10">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Live Personnel Manifest ({insidePersonnel.length})
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const all: Record<string, boolean> = {};
                      insidePersonnel.forEach((p) => (all[p.employee_id] = true));
                      setAccountedMap(all);
                    }}
                    className="text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                  >
                    Mark All Safe
                  </button>
                  <span>•</span>
                  <button
                    onClick={() => setAccountedMap({})}
                    className="text-xs font-bold text-slate-400 hover:underline cursor-pointer"
                  >
                    Reset Checkmarks
                  </button>
                </div>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {insidePersonnel.map((p) => {
                  const isSafe = Boolean(accountedMap[p.employee_id]);
                  return (
                    <div
                      key={p.employee_id}
                      onClick={() => toggleAccounted(p.employee_id)}
                      className={`flex items-center justify-between p-3 rounded-2xl transition cursor-pointer select-none my-1 ${isSafe
                          ? "bg-emerald-500/10 border border-emerald-500/30"
                          : "hover:bg-slate-50 dark:hover:bg-slate-900/60"
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-6 w-6 items-center justify-center rounded-lg border transition ${isSafe
                              ? "bg-emerald-500 border-emerald-500 text-white"
                              : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                            }`}
                        >
                          {isSafe && <CheckCircle2 size={16} />}
                        </div>
                        <div>
                          <p
                            className={`font-bold text-sm ${isSafe
                                ? "text-emerald-700 dark:text-emerald-300 line-through opacity-80"
                                : "text-slate-900 dark:text-white"
                              }`}
                          >
                            {p.name}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {p.department} • #{p.employee_id}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs font-mono text-slate-500">
                        {p.phone && p.phone !== "--" && (
                          <a
                            href={`tel:${p.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-cyan-600 dark:text-cyan-400 hover:underline"
                          >
                            <Phone size={12} /> {p.phone}
                          </a>
                        )}
                        <span className="hidden sm:inline">In: {p.check_in || "--"}</span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${isSafe
                              ? "bg-emerald-500 text-white"
                              : "bg-rose-500/20 text-rose-500 border border-rose-500/30"
                            }`}
                        >
                          {isSafe ? "SAFE" : "UNACCOUNTED"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Snapshot Preview Modal */}
      {selectedSnapshot && (
        <PortalModal open={true} onClose={() => setSelectedSnapshot(null)} cardClassName="max-w-md">
          <div className="rounded-3xl border border-white/20 bg-slate-950 p-5 text-center text-white shadow-2xl">
            <h3 className="text-base font-bold mb-3">{selectedSnapshot.title}</h3>
            <div className="overflow-hidden rounded-2xl border-2 border-rose-500/40 bg-black aspect-video flex items-center justify-center">
              <img
                src={selectedSnapshot.url}
                alt="Security incident frame"
                className="w-full h-full object-cover"
              />
            </div>
            <Button
              onClick={() => setSelectedSnapshot(null)}
              className="mt-4 w-full rounded-xl bg-slate-800 py-2.5 text-xs font-bold text-white hover:bg-slate-700 cursor-pointer"
            >
              Close Snapshot
            </Button>
          </div>
        </PortalModal>
      )}

      {/* Resolve Alert Modal */}
      {resolvingAlert && (
        <PortalModal open={true} onClose={() => setResolvingAlert(null)} cardClassName="max-w-md">
          <div className="rounded-3xl border border-emerald-500/30 bg-slate-950 p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={20} className="text-emerald-400" />
              <h3 className="text-base font-bold">Resolve Security Incident</h3>
            </div>
            <p className="text-xs text-slate-300">
              Marking alert for <span className="font-bold">{resolvingAlert.employee_name}</span> as resolved.
            </p>
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                Investigation / Admin Notes
              </label>
              <textarea
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Enter details of verification/investigation..."
                className="w-full h-24 rounded-xl border border-slate-700 bg-slate-900 p-3 text-xs text-white outline-none focus:border-emerald-500 resize-none"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => setResolvingAlert(null)}
                className="flex-1 py-2.5 rounded-xl text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                onClick={handleResolveAlert}
                disabled={resolvingLoading}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white cursor-pointer"
              >
                {resolvingLoading ? "Resolving..." : "Confirm Resolution"}
              </Button>
            </div>
          </div>
        </PortalModal>
      )}

      {/* Broadcast Evacuation Modal */}
      {showBroadcastModal && (
        <PortalModal open={true} onClose={() => setShowBroadcastModal(false)} cardClassName="max-w-lg">
          <div className="rounded-3xl border-2 border-rose-500 bg-slate-950 p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-rose-500">
              <Flame size={22} className="animate-pulse" />
              <h3 className="text-lg font-black uppercase tracking-tight">
                Emergency Evacuation Broadcast
              </h3>
            </div>
            <p className="text-xs text-slate-300">
              This will broadcast an urgent push banner across all connected employee dashboards in real-time.
            </p>
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Alert Headline</label>
              <Input
                value={broadcastHeadline}
                onChange={(e) => setBroadcastHeadline(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:border-rose-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Instructions</label>
              <textarea
                value={broadcastInstructions}
                onChange={(e) => setBroadcastInstructions(e.target.value)}
                className="w-full h-20 p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:border-rose-500 resize-none outline-none"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => setShowBroadcastModal(false)}
                className="flex-1 py-2.5 rounded-xl text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                onClick={handleEmergencyBroadcast}
                disabled={broadcasting}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white cursor-pointer shadow-lg shadow-rose-600/30"
              >
                {broadcasting ? "Broadcasting..." : "SEND EMERGENCY ALERT"}
              </Button>
            </div>
          </div>
        </PortalModal>
      )}
    </div>
  );
}
