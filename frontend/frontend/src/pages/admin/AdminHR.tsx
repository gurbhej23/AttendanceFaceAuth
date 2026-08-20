import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import API from "../../services/api";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import AdminSidebar from "../../components/AdminSidebar";
import MobileMenuButton from "../../components/common/MobileMenuButton";
import LogOutModal from "../../components/modal/LogOutModal";
import EmptyState from "../../components/common/EmptyState";
import AnimatedBackground from "../../components/motion/AnimatedBackground";
import Toast from "../../components/common/Toast";
import { clearAuthSession } from "../../utils/auth";
import { getMediaUrl } from "../../utils/chatHelpers";
import {
  Calendar,
  CalendarDays,
  ChartNoAxesCombined,
  Clock,
  Download,
  IdCardLanyard,
  Info,
  Megaphone,
  ShieldAlert,
  User,
  Users,
  CheckCircle2,
  Plus,
  Building2,
  RefreshCw,
  LayoutDashboard,
} from "lucide-react";

type Tab = "shifts" | "holidays" | "roster" | "overtime" | "regularization" | "announcements";

const VALID_TABS: Tab[] = [
  "shifts",
  "holidays",
  "roster",
  "overtime",
  "regularization",
  "announcements",
];

function tabFromParam(value: string | null): Tab {
  if (value && VALID_TABS.includes(value as Tab)) return value as Tab;
  return "shifts";
}

interface Shift {
  code: string;
  name: string;
  start_hour: number;
  start_minute: number;
  end_hour: number;
  end_minute: number;
  grace_minutes: number;
}

export default function AdminHR() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => tabFromParam(searchParams.get("tab")));
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [holidays, setHolidays] = useState<
    { id: string; date: string; name: string; applies_to: string }[]
  >([]);
  const [roster, setRoster] = useState<
    {
      employee_id: string;
      name: string;
      department: string;
      shift_code: string;
      work_mode_default: string;
    }[]
  >([]);
  const [overtime, setOvertime] = useState<
    { id: string; employee_name: string; date: string; overtime_minutes: number; status: string }[]
  >([]);
  const [regularizations, setRegularizations] = useState<
    {
      id: string;
      employee_name: string;
      date: string;
      requested_status: string;
      reason: string;
      status: string;
    }[]
  >([]);
  const [holidayForm, setHolidayForm] = useState({ date: "", name: "", applies_to: "all" });
  const [announcementForm, setAnnouncementForm] = useState({ title: "", body: "", expires_at: "" });
  const [announcements, setAnnouncements] = useState<
    { id: string; title: string; body: string; created_by_name: string }[]
  >([]);

  const adminName = localStorage.getItem("employee_name") || "Admin";
  const adminRoleRaw = localStorage.getItem("role") || "admin";
  const adminRole = adminRoleRaw.toUpperCase();
  const adminProfileImg = getMediaUrl(localStorage.getItem("profile_img"));

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    if (!["admin", "hr"].includes(adminRoleRaw)) navigate("/", { replace: true });
  }, [adminRoleRaw, navigate]);

  useEffect(() => {
    setTab(tabFromParam(searchParams.get("tab")));
  }, [searchParams]);

  const selectTab = (next: Tab) => {
    setTab(next);
    setSearchParams({ tab: next }, { replace: true });
  };

  const loadShifts = useCallback(async () => {
    try {
      const res = await API.get("/attendance/hr/shifts/");
      if (res.data.success) setShifts(res.data.shifts);
    } catch {
      /* silent */
    }
  }, []);

  const loadHolidays = useCallback(async () => {
    try {
      const res = await API.get("/attendance/hr/holidays/");
      if (res.data.success) setHolidays(res.data.holidays);
    } catch {
      /* silent */
    }
  }, []);

  const loadRoster = useCallback(async () => {
    try {
      const res = await API.get("/attendance/hr/roster/");
      if (res.data.success) setRoster(res.data.roster);
    } catch {
      /* silent */
    }
  }, []);

  const loadOvertime = useCallback(async () => {
    try {
      const res = await API.get("/attendance/hr/overtime/admin/", { params: { status: "pending" } });
      if (res.data.success) setOvertime(res.data.records);
    } catch {
      /* silent */
    }
  }, []);

  const loadRegularizations = useCallback(async () => {
    try {
      const res = await API.get("/attendance/hr/regularization/admin/", {
        params: { status: "pending" },
      });
      if (res.data.success) setRegularizations(res.data.records);
    } catch {
      /* silent */
    }
  }, []);

  const loadAnnouncements = useCallback(async () => {
    try {
      const res = await API.get("/employees/announcements/", { params: { active: "0" } });
      if (res.data.success) setAnnouncements(res.data.announcements);
    } catch {
      /* silent */
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      loadShifts(),
      loadHolidays(),
      loadRoster(),
      loadOvertime(),
      loadRegularizations(),
      loadAnnouncements(),
    ]);
    setLoading(false);
  }, [loadShifts, loadHolidays, loadRoster, loadOvertime, loadRegularizations, loadAnnouncements]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const updateRoster = async (employeeId: string, shiftCode: string, workMode: string) => {
    try {
      await API.post("/attendance/hr/roster/", {
        employee_id: employeeId,
        shift_code: shiftCode,
        work_mode_default: workMode,
      });
      showToast("Roster updated successfully");
      void loadRoster();
    } catch {
      showToast("Failed to update roster", false);
    }
  };

  const addHoliday = async () => {
    if (!holidayForm.date || !holidayForm.name) {
      showToast("Date and holiday name are required", false);
      return;
    }
    try {
      await API.post("/attendance/hr/holidays/", holidayForm);
      setHolidayForm({ date: "", name: "", applies_to: "all" });
      showToast("Holiday added successfully");
      void loadHolidays();
    } catch {
      showToast("Failed to add holiday", false);
    }
  };

  const resolveOT = async (id: string, action: "approve" | "reject") => {
    try {
      await API.post("/attendance/hr/overtime/resolve/", { request_id: id, action });
      showToast(`Overtime ${action}d successfully`);
      void loadOvertime();
    } catch {
      showToast(`Failed to ${action} overtime`, false);
    }
  };

  const resolveReg = async (id: string, action: "approve" | "reject") => {
    try {
      await API.post("/attendance/hr/regularization/resolve/", { request_id: id, action });
      showToast(`Regularization ${action}d successfully`);
      void loadRegularizations();
    } catch {
      showToast(`Failed to ${action} regularization`, false);
    }
  };

  const handleLogout = () => {
    clearAuthSession();
    navigate("/", { replace: true });
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

  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "shifts", label: "Shifts & Policies", icon: <Clock size={16} /> },
    { id: "holidays", label: "Holiday Calendar", icon: <Calendar size={16} /> },
    { id: "roster", label: "Employee Roster", icon: <Users size={16} /> },
    {
      id: "overtime",
      label: "Overtime Requests",
      icon: <Clock size={16} />,
      badge: overtime.length,
    },
    {
      id: "regularization",
      label: "Regularization",
      icon: <CalendarDays size={16} />,
      badge: regularizations.length,
    },
    { id: "announcements", label: "Announcements & Reminders", icon: <Megaphone size={16} /> },
  ];

  const fmtShift = (h: number, m: number) =>
    `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

  return (
    <div className="admin-page-bg relative min-h-screen bg-slate-50 text-slate-900 dark:bg-[#080d1a] dark:text-white px-3 py-5 sm:px-6 transition-colors duration-300">
      <AnimatedBackground particleColor={0x6366f1} secondaryColor={0xec4899} />

      {toast && <Toast message={toast.msg} ok={toast.ok} />}

      <AdminSidebar
        items={sidebarItems}
        onLogout={() => setShowLogoutModal(true)}
        mobileOpen={showMenu}
        onMobileClose={() => setShowMenu(false)}
        adminName={adminName}
        adminRole={adminRole}
        profileImg={adminProfileImg}
      />
      <MobileMenuButton onClick={() => setShowMenu(true)} />

      {/* Main Content Area */}
      <div className="relative z-10 mx-auto max-w-7xl pt-12 sm:pt-4 lg:ml-22 lg:pt-0">
        {/* Hero Header */}
        <header className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200/80 dark:border-white/10 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/10 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400">
                <Building2 size={12} className="text-indigo-500" /> Human Resources Command Suite
              </span>
              {(regularizations.length > 0 || overtime.length > 0) && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400">
                  ⚡ {regularizations.length + overtime.length} Pending Actions
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
              HR Operations Center
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              Shift policies, company holidays, staff rosters, overtime approvals, and broadcast notices.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              onClick={loadAll}
              className="flex items-center gap-1.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-xs hover:bg-slate-50 cursor-pointer"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
            </Button>
            <Button
              onClick={() => navigate("/attendance-sheet")}
              className="flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-500/20 cursor-pointer"
            >
              <Download size={13} /> Attendance Sheet
            </Button>
          </div>
        </header>

        {/* Tab Switcher Pills */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-3 mb-6 overflow-x-auto">
          {tabs.map((t) => {
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => selectTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition cursor-pointer whitespace-nowrap ${isActive
                    ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20"
                    : "bg-white dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-transparent"
                  }`}
              >
                {t.icon}
                <span>{t.label}</span>
                {Boolean(t.badge && t.badge > 0) && (
                  <span className="rounded-full bg-rose-500 px-2 py-0.2 text-[10px] font-black text-white">
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ─── TAB 1: SHIFTS & POLICIES ─── */}
        {tab === "shifts" && (
          <div className="space-y-6">
            <div className="rounded-3xl border border-indigo-500/30 bg-indigo-500/5 dark:bg-slate-950/80 p-5 backdrop-blur-xl">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  <p className="font-bold text-slate-900 dark:text-white">How Shifts &amp; Punctuality Work</p>
                  <p className="mt-1">
                    Each employee is assigned a shift via the <strong>Roster</strong> tab. Shifts define expected check-in/out hours and grace periods before attendance is marked as &quot;Late&quot;. Morning, Evening, and Night shifts are pre-configured.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {shifts.map((s) => (
                <div
                  key={s.code}
                  className="relative overflow-hidden rounded-3xl border border-slate-200/90 dark:border-white/10 bg-white/90 dark:bg-slate-950/80 p-6 shadow-xl backdrop-blur-xl"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-3">
                    <span className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      Code: {s.code}
                    </span>
                    <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      Active Shift
                    </span>
                  </div>

                  <h3 className="text-lg font-black text-slate-900 dark:text-white capitalize">
                    {s.name}
                  </h3>

                  <div className="my-4 rounded-2xl bg-slate-50 dark:bg-slate-900/80 p-4 border border-slate-200 dark:border-slate-800 text-center">
                    <p className="font-mono text-xl font-extrabold text-slate-900 dark:text-white">
                      {fmtShift(s.start_hour, s.start_minute)} – {fmtShift(s.end_hour, s.end_minute)}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">Standard Operating Hours</p>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                    <span>Grace Period:</span>
                    <span className="font-bold font-mono text-amber-600 dark:text-amber-400">
                      {s.grace_minutes} Minutes
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── TAB 2: HOLIDAY CALENDAR ─── */}
        {tab === "holidays" && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.3fr] gap-6">
            {/* Add Holiday Card */}
            <div className="rounded-3xl border border-slate-200/90 dark:border-white/10 bg-white/90 dark:bg-slate-950/80 p-6 shadow-xl backdrop-blur-xl">
              <h2 className="text-base font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
                <Plus size={18} className="text-indigo-500" /> Schedule Company Holiday
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
                Designated holidays block attendance marking and auto-mark off-duty.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                    Holiday Date
                  </label>
                  <Input
                    type="date"
                    value={holidayForm.date}
                    onChange={(e) => setHolidayForm((f) => ({ ...f, date: e.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                    Holiday Title
                  </label>
                  <Input
                    placeholder="e.g. Independence Day / Diwali"
                    value={holidayForm.name}
                    onChange={(e) => setHolidayForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                    Applies To
                  </label>
                  <Input
                    placeholder="all or specific department"
                    value={holidayForm.applies_to}
                    onChange={(e) => setHolidayForm((f) => ({ ...f, applies_to: e.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3 text-sm"
                  />
                </div>

                <Button
                  text="Save Holiday"
                  onClick={addHoliday}
                  className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 py-3 font-bold text-white shadow-md shadow-emerald-500/20 cursor-pointer text-xs sm:text-sm"
                />
              </div>
            </div>

            {/* Holiday Roster List */}
            <div className="rounded-3xl border border-slate-200/90 dark:border-white/10 bg-white/90 dark:bg-slate-950/80 p-6 shadow-xl backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3 mb-4">
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar size={18} className="text-emerald-500" /> Holiday Master Calendar ({holidays.length})
                </h2>
                <span className="text-xs text-slate-400 font-mono">Company Wide</span>
              </div>

              {holidays.length === 0 ? (
                <div className="py-12 text-center">
                  <EmptyState
                    icon={<Calendar className="h-8 w-8 text-slate-400" />}
                    title="No holidays scheduled yet"
                  />
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {holidays.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center justify-between rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/60 p-4 shadow-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500 font-bold">
                          🌴
                        </div>
                        <div>
                          <p className="font-bold text-sm text-slate-900 dark:text-white">{h.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">📅 {h.date}</p>
                        </div>
                      </div>

                      <span className="rounded-full bg-slate-200 dark:bg-slate-800 px-3 py-1 text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">
                        {h.applies_to}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 3: EMPLOYEE ROSTER ─── */}
        {tab === "roster" && (
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200/90 dark:border-white/10 bg-white/90 dark:bg-slate-950/80 p-5 sm:p-6 shadow-xl backdrop-blur-xl">
              <div className="flex items-center justify-between mb-4 border-b border-slate-200 dark:border-white/10 pb-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Employee Shift &amp; Work Mode Assignments ({roster.length})
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Assign shifts and WFH status (WFH bypasses office geofence checks)
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-white/10 text-xs font-bold uppercase text-slate-400">
                      <th className="py-3 px-4">Employee</th>
                      <th className="py-3 px-4">Department</th>
                      <th className="py-3 px-4">Assigned Shift</th>
                      <th className="py-3 px-4">Default Mode</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {roster.map((r) => (
                      <tr key={r.employee_id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition">
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                          {r.name} <span className="text-xs font-mono font-normal text-slate-400">({r.employee_id})</span>
                        </td>
                        <td className="py-3 px-4 text-xs font-semibold text-slate-600 dark:text-slate-400">
                          {r.department}
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={r.shift_code}
                            onChange={(e) =>
                              updateRoster(r.employee_id, e.target.value, r.work_mode_default)
                            }
                            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                          >
                            {shifts.map((s) => (
                              <option key={s.code} value={s.code}>
                                {s.name} ({s.code})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={r.work_mode_default}
                            onChange={(e) =>
                              updateRoster(r.employee_id, r.shift_code, e.target.value)
                            }
                            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                          >
                            <option value="office">🏢 Office</option>
                            <option value="wfh">🏠 WFH</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 4: OVERTIME REQUESTS ─── */}
        {tab === "overtime" && (
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200/90 dark:border-white/10 bg-white/90 dark:bg-slate-950/80 p-5 sm:p-6 shadow-xl backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3 mb-4">
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Clock size={18} className="text-amber-500" /> Pending Overtime Claims ({overtime.length})
                </h2>
                <span className="text-xs text-slate-400">Approval Workflow</span>
              </div>

              {overtime.length === 0 ? (
                <div className="py-12 text-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">All Overtime Requests Cleared</p>
                  <p className="text-xs text-slate-400 mt-0.5">No pending overtime submissions awaiting review.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {overtime.map((o) => (
                    <div
                      key={o.id}
                      className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 dark:bg-slate-900/70 p-4 shadow-xs"
                    >
                      <div>
                        <p className="font-extrabold text-sm text-slate-900 dark:text-white">{o.employee_name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                          📅 {o.date} • <span className="text-amber-600 dark:text-amber-400 font-bold">{o.overtime_minutes} Mins Requested</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          text="Approve"
                          onClick={() => resolveOT(o.id, "approve")}
                          className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-xs cursor-pointer"
                        />
                        <Button
                          text="Reject"
                          onClick={() => resolveOT(o.id, "reject")}
                          className="rounded-xl bg-rose-600 hover:bg-rose-500 px-4 py-2 text-xs font-bold text-white shadow-xs cursor-pointer"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 5: REGULARIZATION ─── */}
        {tab === "regularization" && (
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200/90 dark:border-white/10 bg-white/90 dark:bg-slate-950/80 p-5 sm:p-6 shadow-xl backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3 mb-4">
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <CalendarDays size={18} className="text-indigo-500" /> Pending Attendance Regularizations ({regularizations.length})
                </h2>
                <span className="text-xs text-slate-400">Employee Corrections</span>
              </div>

              {regularizations.length === 0 ? (
                <div className="py-12 text-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">All Regularizations Processed</p>
                  <p className="text-xs text-slate-400 mt-0.5">No pending attendance correction requests.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {regularizations.map((r) => (
                    <div
                      key={r.id}
                      className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 dark:bg-slate-900/70 p-4 shadow-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-extrabold text-sm text-slate-900 dark:text-white">{r.employee_name}</p>
                          <span className="rounded-full bg-indigo-500/20 border border-indigo-500/30 px-2 py-0.2 text-[10px] font-bold text-indigo-500 uppercase">
                            To: {r.requested_status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">📅 Date: {r.date}</p>
                        {r.reason && (
                          <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-950/70 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 mt-1">
                            &quot;{r.reason}&quot;
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          text="Approve"
                          onClick={() => resolveReg(r.id, "approve")}
                          className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-xs cursor-pointer"
                        />
                        <Button
                          text="Reject"
                          onClick={() => resolveReg(r.id, "reject")}
                          className="rounded-xl bg-rose-600 hover:bg-rose-500 px-4 py-2 text-xs font-bold text-white shadow-xs cursor-pointer"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 6: ANNOUNCEMENTS & REMINDERS ─── */}
        {tab === "announcements" && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.3fr] gap-6">
            {/* Post Announcement */}
            <div className="rounded-3xl border border-slate-200/90 dark:border-white/10 bg-white/90 dark:bg-slate-950/80 p-6 shadow-xl backdrop-blur-xl">
              <h2 className="text-base font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
                <Megaphone size={18} className="text-violet-500" /> Broadcast Company Announcement
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
                Publish notices and push instant morning attendance email reminders.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                    Announcement Headline
                  </label>
                  <Input
                    placeholder="e.g. Quarterly Town Hall / Policy Update"
                    value={announcementForm.title}
                    onChange={(e) => setAnnouncementForm((f) => ({ ...f, title: e.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                    Message Body
                  </label>
                  <textarea
                    placeholder="Write your announcement details..."
                    value={announcementForm.body}
                    onChange={(e) => setAnnouncementForm((f) => ({ ...f, body: e.target.value }))}
                    rows={4}
                    className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3 text-sm text-slate-900 dark:text-white resize-none outline-none focus:border-violet-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                    Expiry Date (Optional)
                  </label>
                  <Input
                    type="date"
                    value={announcementForm.expires_at}
                    onChange={(e) =>
                      setAnnouncementForm((f) => ({ ...f, expires_at: e.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3 text-sm"
                  />
                </div>

                <div className="pt-2 space-y-2.5">
                  <Button
                    text="Publish Notice"
                    onClick={async () => {
                      if (!announcementForm.title || !announcementForm.body) {
                        showToast("Title and message are required", false);
                        return;
                      }
                      await API.post("/employees/announcements/", {
                        employee_id: localStorage.getItem("employee_id"),
                        ...announcementForm,
                      });
                      setAnnouncementForm({ title: "", body: "", expires_at: "" });
                      showToast("Announcement published successfully");
                      void loadAnnouncements();
                    }}
                    className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 py-3 font-bold text-white shadow-md shadow-violet-500/20 cursor-pointer text-xs sm:text-sm"
                  />
                  <Button
                    text="Send Morning Attendance Reminders"
                    onClick={async () => {
                      const res = await API.post("/employees/send-attendance-reminders/", {
                        employee_id: localStorage.getItem("employee_id"),
                        force: true,
                      });
                      showToast(`Automated reminders dispatched: ${res.data.sent || 0}`);
                    }}
                    className="w-full rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 py-3 text-xs font-bold text-slate-200 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Active Announcements List */}
            <div className="rounded-3xl border border-slate-200/90 dark:border-white/10 bg-white/90 dark:bg-slate-950/80 p-6 shadow-xl backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3 mb-4">
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Megaphone size={18} className="text-indigo-500" /> Active Company Bulletins ({announcements.length})
                </h2>
                <span className="text-xs text-slate-400 font-mono">Company Wide</span>
              </div>

              {announcements.length === 0 ? (
                <div className="py-12 text-center">
                  <EmptyState
                    icon={<Megaphone className="h-8 w-8 text-slate-400" />}
                    title="No announcements posted yet"
                  />
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {announcements.map((a) => (
                    <div
                      key={a.id}
                      className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/60 p-4 shadow-xs"
                    >
                      <p className="font-bold text-sm text-slate-900 dark:text-white mb-1">{a.title}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{a.body}</p>
                      <p className="text-[10px] text-slate-400 mt-2 font-mono">
                        Posted by {a.created_by_name || "HR Operations"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <LogOutModal
        open={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onLogout={handleLogout}
      />
    </div>
  );
}
