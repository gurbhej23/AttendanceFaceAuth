import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import API from "../../services/api";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import AdminSidebar from "../../components/AdminSidebar";
import MobileMenuButton from "../../components/common/MobileMenuButton";
import LogOutModal from "../../components/modal/LogOutModal";
import { clearAuthSession } from "../../utils/auth";
import { getMediaUrl } from "../../utils/chatHelpers";
import {
  ArrowLeft,
  Bell,
  Calendar,
  CalendarDays,
  ChartNoAxesCombined,
  Clock,
  Download,
  IdCardLanyard,
  Info,
  Megaphone,
  User,
  Users,
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

function InfoBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="hr-info-banner mb-5 flex gap-3">
      <Info className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
      <div>{children}</div>
    </div>
  );
}

export default function AdminHR() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => tabFromParam(searchParams.get("tab")));
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

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
    const res = await API.get("/attendance/hr/shifts/");
    if (res.data.success) setShifts(res.data.shifts);
  }, []);

  const loadHolidays = useCallback(async () => {
    const res = await API.get("/attendance/hr/holidays/");
    if (res.data.success) setHolidays(res.data.holidays);
  }, []);

  const loadRoster = useCallback(async () => {
    const res = await API.get("/attendance/hr/roster/");
    if (res.data.success) setRoster(res.data.roster);
  }, []);

  const loadOvertime = useCallback(async () => {
    const res = await API.get("/attendance/hr/overtime/admin/", { params: { status: "pending" } });
    if (res.data.success) setOvertime(res.data.records);
  }, []);

  const loadRegularizations = useCallback(async () => {
    const res = await API.get("/attendance/hr/regularization/admin/", {
      params: { status: "pending" },
    });
    if (res.data.success) setRegularizations(res.data.records);
  }, []);

  const loadAnnouncements = useCallback(async () => {
    const res = await API.get("/employees/announcements/", { params: { active: "0" } });
    if (res.data.success) setAnnouncements(res.data.announcements);
  }, []);

  useEffect(() => {
    void loadShifts();
    void loadHolidays();
    void loadRoster();
    void loadOvertime();
    void loadRegularizations();
    void loadAnnouncements();
  }, [loadShifts, loadHolidays, loadRoster, loadOvertime, loadRegularizations, loadAnnouncements]);

  const updateRoster = async (employeeId: string, shiftCode: string, workMode: string) => {
    try {
      await API.post("/attendance/hr/roster/", {
        employee_id: employeeId,
        shift_code: shiftCode,
        work_mode_default: workMode,
      });
      showToast("Roster updated");
      void loadRoster();
    } catch {
      showToast("Failed to update roster", false);
    }
  };

  const addHoliday = async () => {
    if (!holidayForm.date || !holidayForm.name) {
      showToast("Date and name required", false);
      return;
    }
    try {
      await API.post("/attendance/hr/holidays/", holidayForm);
      setHolidayForm({ date: "", name: "", applies_to: "all" });
      showToast("Holiday added");
      void loadHolidays();
    } catch {
      showToast("Failed to add holiday", false);
    }
  };

  const resolveOT = async (id: string, action: "approve" | "reject") => {
    await API.post("/attendance/hr/overtime/resolve/", { request_id: id, action });
    showToast(`Overtime ${action}d`);
    void loadOvertime();
  };

  const resolveReg = async (id: string, action: "approve" | "reject") => {
    await API.post("/attendance/hr/regularization/resolve/", { request_id: id, action });
    showToast(`Regularization ${action}d`);
    void loadRegularizations();
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
        icon: <Bell size={18} />,
        label: "Notifications",
        onClick: () => navigate("/attendance-sheet"),
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
        active:
          location.pathname === "/admin-employees" ||
          location.pathname === "/admin-create-employee",
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

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "shifts", label: "Shifts", icon: <Clock className="h-4 w-4" /> },
    { id: "holidays", label: "Holidays", icon: <Calendar className="h-4 w-4" /> },
    { id: "roster", label: "Roster", icon: <Users className="h-4 w-4" /> },
    { id: "overtime", label: "Overtime", icon: <Clock className="h-4 w-4" /> },
    { id: "regularization", label: "Regularization", icon: <CalendarDays className="h-4 w-4" /> },
    { id: "announcements", label: "Announcements", icon: <Megaphone className="h-4 w-4" /> },
  ];

  const fmtShift = (h: number, m: number) =>
    `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

  return (
    <>
      <div className="min-h-screen px-3 py-5 pb-24 sm:px-5 lg:pb-8">
        {toast && (
          <div
            className={`fixed top-5 left-1/2 z-50 -translate-x-1/2 rounded-2xl border px-6 py-3 text-sm font-semibold shadow-xl ${
              toast.ok
                ? "border-green-500/30 bg-green-500/15 text-green-300"
                : "border-red-500/30 bg-red-500/15 text-red-300"
            }`}
          >
            {toast.msg}
          </div>
        )}

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

        <div className="mx-auto max-w-6xl pb-10 pt-12 transition-all duration-500 ease-out sm:pb-12 sm:pt-5 lg:ml-22 lg:pt-0">
            <div className="hr-panel dash-shell-panel mb-6 border border-white/10 bg-white/5 p-5 shadow-xl backdrop-blur-xl sm:p-6">
              <button
                type="button"
                onClick={() => navigate("/attendance-sheet")}
                className="mb-2 flex items-center gap-2 text-sm hr-text-muted hover:opacity-80 cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to dashboard
              </button>
              <h1 className="hr-page-title text-2xl font-bold sm:text-3xl">HR Management</h1>
              <p className="hr-page-subtitle mt-1 text-sm">
                Shifts, holidays, roster, overtime &amp; regularization
              </p>
            </div>

          <div className="mb-6 flex flex-wrap gap-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => selectTab(t.id)}
                className={tab === t.id ? "hr-tab hr-tab-active" : "hr-tab hr-tab-inactive"}
              >
                {t.icon}
                {t.label}
                {t.id === "overtime" && overtime.length > 0 && (
                  <span className="rounded-full bg-red-500 px-1.5 text-[10px] text-white">
                    {overtime.length}
                  </span>
                )}
                {t.id === "regularization" && regularizations.length > 0 && (
                  <span className="rounded-full bg-red-500 px-1.5 text-[10px] text-white">
                    {regularizations.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {tab === "shifts" && (
            <div className="hr-panel">
              <h2 className="hr-text-primary mb-2 text-lg font-bold">Shift definitions</h2>
              <InfoBanner>
                <p className="font-semibold hr-text-primary">How shifts work</p>
                <p className="mt-1">
                  Each employee is assigned a shift on the <strong>Roster</strong> tab. The shift
                  sets expected start/end times and a grace period (minutes after start before
                  marking &quot;late&quot;). Morning (9–6), Evening (2–11), and Night (10–7) are
                  pre-configured. Late status and shift-start warnings on the employee dashboard
                  use this schedule.
                </p>
              </InfoBanner>
              <div className="grid gap-3 sm:grid-cols-3">
                {shifts.map((s) => (
                  <div key={s.code} className="hr-card">
                    <p className="hr-text-primary font-semibold capitalize">{s.name}</p>
                    <p className="hr-text-muted mt-1 text-xs">Code: {s.code}</p>
                    <p className="hr-text-secondary mt-2 text-sm">
                      {fmtShift(s.start_hour, s.start_minute)} –{" "}
                      {fmtShift(s.end_hour, s.end_minute)}
                    </p>
                    <p className="hr-text-muted text-xs">Grace: {s.grace_minutes} min</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "holidays" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="hr-panel">
                <h2 className="hr-text-primary mb-4 text-lg font-bold">Add holiday</h2>
                <InfoBanner>
                  Holidays block check-in and leave requests for affected employees.
                  Use <code className="text-xs">all</code> or a department name for &quot;Applies
                  to&quot;.
                </InfoBanner>
                <div className="space-y-3">
                  <Input
                    type="date"
                    value={holidayForm.date}
                    onChange={(e) => setHolidayForm((f) => ({ ...f, date: e.target.value }))}
                    className="hr-input"
                  />
                  <Input
                    placeholder="Holiday name"
                    value={holidayForm.name}
                    onChange={(e) => setHolidayForm((f) => ({ ...f, name: e.target.value }))}
                    className="hr-input"
                  />
                  <Input
                    placeholder="Applies to (all or department)"
                    value={holidayForm.applies_to}
                    onChange={(e) =>
                      setHolidayForm((f) => ({ ...f, applies_to: e.target.value }))
                    }
                    className="hr-input"
                  />
                  <Button
                    text="Add Holiday"
                    onClick={addHoliday}
                    className="w-full rounded-xl bg-emerald-600 py-2.5 font-semibold text-white hover:bg-emerald-700 cursor-pointer"
                  />
                </div>
              </div>
              <div className="hr-panel">
                <h2 className="hr-text-primary mb-4 text-lg font-bold">Holiday calendar</h2>
                <div className="max-h-80 space-y-2 overflow-y-auto">
                  {holidays.length === 0 ? (
                    <p className="hr-text-muted text-sm">No holidays configured</p>
                  ) : (
                    holidays.map((h) => (
                      <div
                        key={h.id}
                        className="hr-card flex items-center justify-between px-3 py-2"
                      >
                        <div>
                          <p className="hr-text-primary font-medium">{h.name}</p>
                          <p className="hr-text-muted text-xs">{h.date}</p>
                        </div>
                        <span className="hr-text-muted text-xs">{h.applies_to}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === "roster" && (
            <div className="hr-panel">
              <h2 className="hr-text-primary mb-2 text-lg font-bold">Employee roster</h2>
              <InfoBanner>
                Assign each employee&apos;s shift and default work mode (Office or WFH). WFH skips
                location/geofence checks when marking present.
              </InfoBanner>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="hr-table-head">
                      <th className="pb-2 pr-4">Employee</th>
                      <th className="pb-2 pr-4">Department</th>
                      <th className="pb-2 pr-4">Shift</th>
                      <th className="pb-2">Default mode</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.map((r) => (
                      <tr key={r.employee_id} className="hr-table-row">
                        <td className="hr-text-primary py-3 pr-4">{r.name}</td>
                        <td className="hr-text-muted py-3 pr-4">{r.department}</td>
                        <td className="py-3 pr-4">
                          <select
                            value={r.shift_code}
                            onChange={(e) =>
                              updateRoster(r.employee_id, e.target.value, r.work_mode_default)
                            }
                            className="hr-input max-w-[140px] py-1.5 text-sm"
                          >
                            {shifts.map((s) => (
                              <option key={s.code} value={s.code}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3">
                          <select
                            value={r.work_mode_default}
                            onChange={(e) =>
                              updateRoster(r.employee_id, r.shift_code, e.target.value)
                            }
                            className="hr-input max-w-[120px] py-1.5 text-sm"
                          >
                            <option value="office">Office</option>
                            <option value="wfh">WFH</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "overtime" && (
            <div className="hr-panel">
              <h2 className="hr-text-primary mb-4 text-lg font-bold">Pending overtime</h2>
              {overtime.length === 0 ? (
                <p className="hr-text-muted">No pending overtime requests</p>
              ) : (
                <div className="space-y-3">
                  {overtime.map((o) => (
                    <div
                      key={o.id}
                      className="hr-card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="hr-text-primary font-semibold">{o.employee_name}</p>
                        <p className="hr-text-muted text-sm">
                          {o.date} · {o.overtime_minutes} min OT
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          text="Approve"
                          onClick={() => resolveOT(o.id, "approve")}
                          className="rounded-lg bg-green-600 px-3 py-1.5 text-sm text-white cursor-pointer"
                        />
                        <Button
                          text="Reject"
                          onClick={() => resolveOT(o.id, "reject")}
                          className="rounded-lg bg-red-600/80 px-3 py-1.5 text-sm text-white cursor-pointer"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "regularization" && (
            <div className="hr-panel">
              <h2 className="hr-text-primary mb-4 text-lg font-bold">Attendance regularization</h2>
              <InfoBanner>
                Employees request corrections from their dashboard (Regularize button). Approve to
                update their attendance record for that date.
              </InfoBanner>
              {regularizations.length === 0 ? (
                <p className="hr-text-muted">No pending requests</p>
              ) : (
                <div className="space-y-3">
                  {regularizations.map((r) => (
                    <div key={r.id} className="hr-card">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="hr-text-primary font-semibold">{r.employee_name}</p>
                          <p className="hr-text-muted text-sm">
                            {r.date} → {r.requested_status}
                          </p>
                          <p className="hr-text-secondary mt-1 text-sm">{r.reason}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            text="Approve"
                            onClick={() => resolveReg(r.id, "approve")}
                            className="rounded-lg bg-green-600 px-3 py-1.5 text-sm text-white cursor-pointer"
                          />
                          <Button
                            text="Reject"
                            onClick={() => resolveReg(r.id, "reject")}
                            className="rounded-lg bg-red-600/80 px-3 py-1.5 text-sm text-white cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "announcements" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="hr-panel">
                <h2 className="hr-text-primary mb-4 text-lg font-bold">Post announcement</h2>
                <div className="space-y-3">
                  <Input
                    placeholder="Title"
                    value={announcementForm.title}
                    onChange={(e) => setAnnouncementForm((f) => ({ ...f, title: e.target.value }))}
                    className="hr-input"
                  />
                  <textarea
                    placeholder="Message for all employees"
                    value={announcementForm.body}
                    onChange={(e) => setAnnouncementForm((f) => ({ ...f, body: e.target.value }))}
                    rows={4}
                    className="hr-input resize-none"
                  />
                  <Input
                    type="date"
                    value={announcementForm.expires_at}
                    onChange={(e) =>
                      setAnnouncementForm((f) => ({ ...f, expires_at: e.target.value }))
                    }
                    className="hr-input"
                  />
                  <Button
                    text="Publish"
                    onClick={async () => {
                      await API.post("/employees/announcements/", {
                        employee_id: localStorage.getItem("employee_id"),
                        ...announcementForm,
                      });
                      setAnnouncementForm({ title: "", body: "", expires_at: "" });
                      showToast("Announcement published");
                      void loadAnnouncements();
                    }}
                    className="w-full rounded-xl bg-blue-600 py-2.5 font-semibold text-white cursor-pointer"
                  />
                  <Button
                    text="Send attendance email reminders"
                    onClick={async () => {
                      const res = await API.post("/employees/send-attendance-reminders/", {
                        employee_id: localStorage.getItem("employee_id"),
                        force: true,
                      });
                      showToast(`Reminders sent: ${res.data.sent || 0}`);
                    }}
                    className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white cursor-pointer"
                  />
                </div>
              </div>
              <div className="hr-panel">
                <h2 className="hr-text-primary mb-4 text-lg font-bold">Recent announcements</h2>
                {announcements.map((a) => (
                  <div key={a.id} className="hr-card mb-2">
                    <p className="hr-text-primary font-semibold">{a.title}</p>
                    <p className="hr-text-secondary text-sm">{a.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <LogOutModal
        open={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onLogout={handleLogout}
      />
    </>
  );
}
