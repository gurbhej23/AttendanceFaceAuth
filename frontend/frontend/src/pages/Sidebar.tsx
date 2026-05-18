// src/components/Sidebar.tsx

import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarCheck,
  Clock3,
  Users,
  Settings,
  LogOut,
  BarChart3,
} from "lucide-react";

interface SidebarProps {
  employeeName?: string;
  employeeId?: string;
  profileImg?: string;
  onLogout: () => void;
}

export default function Sidebar({
  employeeName,
  employeeId,
  profileImg,
  onLogout,
}: SidebarProps) {
  const navItems = [
    {
      name: "Dashboard",
      icon: <LayoutDashboard size={20} />,
      path: "/dashboard",
    },
    {
      name: "Attendance",
      icon: <CalendarCheck size={20} />,
      path: "/attendance",
    },
    {
      name: "Check Out",
      icon: <Clock3 size={20} />,
      path: "/check-out",
    },
    {
      name: "Analytics",
      icon: <BarChart3 size={20} />,
      path: "/analytics",
    },
    {
      name: "Employees",
      icon: <Users size={20} />,
      path: "/employees",
    },
    {
      name: "Settings",
      icon: <Settings size={20} />,
      path: "/settings",
    },
  ];

  return (
    <aside className="fixed left-0 top-0 h-screen w-[280px] bg-[#0B1120] border-r border-white/10 p-5 flex flex-col justify-between shadow-2xl">
      {/* TOP */}
      <div>
        {/* LOGO */}
        <div className="mb-10">
          <h1 className="text-2xl font-bold text-white">
            Face<span className="text-blue-400">Track</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">Attendance System</p>
        </div>

        {/* PROFILE */}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-4 flex items-center gap-4 mb-8">
          <div className="h-14 w-14 rounded-full overflow-hidden border border-white/10 bg-slate-800">
            {profileImg ? (
              <img
                src={profileImg}
                alt="profile"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-blue-500 text-white font-bold text-xl">
                {employeeName?.charAt(0)}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-white font-semibold text-sm">{employeeName}</h2>
            <p className="text-slate-400 text-xs">{employeeId}</p>
          </div>
        </div>

        {/* NAVIGATION */}
        <nav className="space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-300 font-medium ${
                  isActive
                    ? "bg-blue-600 text-white shadow-lg"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`
              }
            >
              {item.icon}
              <span>{item.name}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* LOGOUT */}
      <button
        onClick={onLogout}
        className="flex items-center gap-4 px-4 py-3 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all duration-300"
      >
        <LogOut size={20} />
        <span>Logout</span>
      </button>
    </aside>
  );
}
