import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import API from "../services/api";
import Input from "../components/common/Input";
import AdminSidebar from "../components/AdminSidebar";
import MobileMenuButton from "../components/common/MobileMenuButton";
import EmptyState from "../components/common/EmptyState";
import AnimatedBackground from "../components/motion/AnimatedBackground";
import { getMediaUrl } from "../utils/chatHelpers";
import { dispatchNotificationAction } from "../utils/notificationActions";
import { clearAuthSession } from "../utils/auth";
import TeamMemberFlipCard from "../motion/TeamMemberFlipCard";
import {
  Calendar,
  ChartNoAxesCombined,
  IdCardLanyard,
  LayoutDashboard,
  Search,
  User,
  Users,
  Sparkles,
  Building2,
  ShieldAlert,
} from "lucide-react";

interface Member {
  employee_id: string;
  name: string;
  department: string;
  designation: string;
  role: string;
  is_online: boolean;
  profile_img?: string;
}

export default function TeamDirectory() {
  const navigate = useNavigate();
  const location = useLocation();
  const employeeId = localStorage.getItem("employee_id") || "";
  const role = localStorage.getItem("role") || "employee";
  const isEmployee = role === "employee";
  const [members, setMembers] = useState<Member[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("all");
  const [showMenu, setShowMenu] = useState(false);

  const load = useCallback(async () => {
    const res = await API.get("/employees/team-directory/", {
      params: { employee_id: employeeId, search, department: dept },
    });
    if (res.data.success) {
      setMembers(res.data.directory);
      setDepartments(res.data.departments || []);
    }
  }, [employeeId, search, dept]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<string, Member[]>();
    for (const m of members) {
      const key = m.department || "General";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [members]);

  const openChat = (member: Member) => {
    if (member.employee_id === employeeId) return;
    dispatchNotificationAction({
      type: "open_chat",
      chat: { type: "direct", id: member.employee_id },
      contact: {
        employee_id: member.employee_id,
        name: member.name,
        role: member.role,
        department: member.department,
        designation: member.designation,
        profile_img: member.profile_img || "",
        is_online: member.is_online,
      },
    });
    navigate(isEmployee ? "/dashboard" : "/attendance-sheet");
  };

  const sidebarItems = useMemo(() => {
    if (isEmployee) {
      return [
        {
          icon: <LayoutDashboard size={18} />,
          label: "Dashboard",
          onClick: () => navigate("/dashboard"),
          active: location.pathname === "/dashboard",
        },
        {
          icon: <Users size={18} />,
          label: "Team Directory",
          onClick: () => navigate("/team"),
          active: location.pathname === "/team",
        },
        {
          icon: <User size={18} />,
          label: "Profile",
          onClick: () => navigate("/profile"),
          active: location.pathname === "/profile",
        },
      ];
    }
    return [
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
        icon: <IdCardLanyard size={18} />,
        label: "Employees",
        onClick: () => navigate("/admin-employees"),
        active:
          location.pathname === "/admin-employees" ||
          location.pathname === "/admin-create-employee",
      },
      {
        icon: <ShieldAlert size={18} />,
        label: "Security & Occupancy",
        onClick: () => navigate("/admin-security"),
        active: location.pathname === "/admin-security",
      },
    ];
  }, [isEmployee, location.pathname, navigate]);

  return (
    <div className="sheet-bg-page relative min-h-screen bg-slate-50 text-slate-900 dark:bg-[#080d1a] dark:text-white px-3 py-5 sm:px-6 transition-colors duration-300">
      <AnimatedBackground />

      <AdminSidebar
        items={sidebarItems}
        onLogout={() => {
          clearAuthSession();
          navigate("/");
        }}
        mobileOpen={showMenu}
        onMobileClose={() => setShowMenu(false)}
        adminName={localStorage.getItem("employee_name") || "User"}
        adminRole={role.toUpperCase()}
        profileImg={getMediaUrl(localStorage.getItem("profile_img") || "")}
      />
      <MobileMenuButton onClick={() => setShowMenu(true)} />

      <div className="relative z-10 mx-auto max-w-6xl pt-12 sm:pt-4 lg:ml-22 lg:pt-0">
        {/* Page Header */}
        <header className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-white/10 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400">
                <Sparkles size={12} className="text-cyan-500" /> Organization Hub
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Team Directory
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              Connect and collaborate directly with colleagues across departments.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3.5 py-1.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 shadow-xs">
              {members.length} {members.length === 1 ? "Member" : "Total Members"}
            </span>
          </div>
        </header>

        {/* Search & Filter Toolbar */}
        <div className="mb-8 flex flex-col gap-3 sm:flex-row items-center justify-between">
          <div className="relative w-full sm:flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search team member by name or ID..."
              className="w-full rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white shadow-xs backdrop-blur-md outline-none focus:border-cyan-500"
            />
          </div>

          <div className="w-full sm:w-auto">
            <select
              value={dept}
              onChange={(e) => setDept(e.target.value)}
              className="w-full sm:w-56 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 shadow-xs backdrop-blur-md outline-none cursor-pointer focus:border-cyan-500"
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Department Sections */}
        {grouped.map(([department, rows]) => (
          <div key={department} className="mb-8">
            <div className="mb-4 flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800/60 pb-2">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-cyan-500" />
                <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  {department}
                </h2>
              </div>
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                {rows.length} {rows.length === 1 ? "person" : "people"}
              </span>
            </div>

            {/* Grid of Executive Team Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {rows.map((m) => (
                <TeamMemberFlipCard
                  key={m.employee_id}
                  name={m.name}
                  designation={m.designation}
                  department={m.department}
                  employeeId={m.employee_id}
                  profileImg={m.profile_img ? getMediaUrl(m.profile_img) : undefined}
                  isOnline={m.is_online}
                  isSelf={m.employee_id === employeeId}
                  onMessage={() => openChat(m)}
                />
              ))}
            </div>
          </div>
        ))}

        {members.length === 0 && (
          <div className="my-12 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 p-8 text-center backdrop-blur-xl">
            <EmptyState
              icon={<Search className="h-8 w-8 text-slate-400" />}
              title="No team members found"
            />
          </div>
        )}
      </div>
    </div>
  );
}
