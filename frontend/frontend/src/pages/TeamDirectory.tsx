import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import API from "../services/api";
import Input from "../components/common/Input";
import AdminSidebar from "../components/AdminSidebar";
import MobileMenuButton from "../components/common/MobileMenuButton";
import ProfileAvatarImg from "../components/common/ProfileAvatarImg";
import EmptyState from "../components/common/EmptyState";
import { getMediaUrl } from "../utils/chatHelpers";
import { dispatchNotificationAction } from "../utils/notificationActions";
import { clearAuthSession } from "../utils/auth";
import {
  Calendar,
  ChartNoAxesCombined,
  IdCardLanyard,
  LayoutDashboard,
  MessageCircle,
  Search,
  User,
  Users,
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
          label: "Team",
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
        active:
          location.pathname === "/admin-employees" ||
          location.pathname === "/admin-create-employee",
      },
    ];
  }, [isEmployee, location.pathname, navigate]);

  return (
    <div className="min-h-screen bg-[var(--th-bg)] px-3 py-5 text-[var(--th-text)] lg:px-5">
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

      <div className="mx-auto max-w-4xl lg:ml-22">
        <h1 className="mb-1 text-2xl font-bold">Team directory</h1>
        <p className="mb-4 text-sm text-[var(--th-text-muted)]">
          Tap an employee to open a direct message
        </p>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or ID..."
            className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-white"
          />
          <select
            value={dept}
            onChange={(e) => setDept(e.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-white"
          >
            <option value="all">All departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        {grouped.map(([department, rows]) => (
          <div key={department} className="mb-6">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--th-text-muted)]">
              {department}
            </h2>
            <div className="space-y-2">
              {rows.map((m) => (
                <button
                  key={m.employee_id}
                  type="button"
                  onClick={() => openChat(m)}
                  disabled={m.employee_id === employeeId}
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-left transition hover:border-slate-600 disabled:cursor-default disabled:opacity-60 cursor-pointer"
                >
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full">
                    {m.profile_img ? (
                      <ProfileAvatarImg src={getMediaUrl(m.profile_img)} alt={m.name} className="h-11 w-11" />
                    ) : (
                      <div className="grid h-full w-full place-items-center bg-blue-600 text-sm font-bold text-white">
                        {m.name.charAt(0)}
                      </div>
                    )}
                    <span
                      className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-slate-900 ${m.is_online ? "bg-emerald-500" : "bg-slate-500"}`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{m.name}</p>
                    <p className="truncate text-xs text-[var(--th-text-muted)]">
                      {m.designation} · {m.employee_id}
                    </p>
                  </div>
                  {m.employee_id !== employeeId ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-400">
                      <MessageCircle size={14} />
                      Message
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--th-text-muted)]">You</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
        {members.length === 0 && (
          <EmptyState
            icon={<Search className="h-7 w-7 text-slate-600" />}
            title="No team members found"
          />
        )}
      </div>
    </div>
  );
}
