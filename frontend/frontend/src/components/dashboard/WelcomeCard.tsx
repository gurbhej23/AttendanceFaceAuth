import { useNavigate } from "react-router-dom";
import Button from "../common/Button";
import { Briefcase, Menu } from "lucide-react";

interface WelcomeCardProps {
  employeeName: string | null;
  employeeId: string | null;
  employeeDepartment: string;
  employeeDesignation: string;
  profileImg: string;
  onProfileClick: () => void;
  onMenuClick: () => void;
  setShowMenu: (value: boolean) => void;
}

function WelcomeCard({
  employeeName,
  employeeId,
  employeeDepartment,
  employeeDesignation,
  profileImg,
  setShowMenu,
}: WelcomeCardProps) {
  const navigate = useNavigate();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };
  return (
    <div className="relative mb-4 overflow-hidden rounded-3xl border border-white/10 bg-white/5">
      <h1>
        {" "}
        <div className="relative mb-4 overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-12 left-1/3 h-32 w-32 rounded-full bg-cyan-500/10 blur-3xl" />

          <div className="relative p-4 sm:p-6">
            <div className="flex gap-5 lg:flex-row lg:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <Button
                  type="button"
                  onClick={() => setShowMenu(true)}
                  text={<Menu size={22} />}
                  unstyled
                  className="rounded-xl border border-white/10 bg-white/10 p-2.5 text-white transition hover:bg-white/15 lg:hidden"
                  aria-label="Open menu"
                />
                <button
                  type="button"
                  onClick={() => navigate("/profile")}
                  className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-white/15 bg-slate-800 shadow-lg transition hover:border-blue-400/40"
                  title="View profile"
                >
                  {profileImg ? (
                    <img
                      src={profileImg}
                      alt={employeeName || "Employee"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center bg-linear-to-br from-blue-600 to-cyan-500 text-2xl font-bold text-white">
                      {(employeeName || "E").charAt(0)}
                    </div>
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-400">{getGreeting()},</p>
                  <h1 className="truncate text-2xl font-bold text-white sm:text-3xl">
                    {employeeName || "Employee"}
                  </h1>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-400">
                    {employeeDepartment && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                        <Briefcase className="h-3.5 w-3.5" />
                        {employeeDepartment}
                      </span>
                    )}
                    {employeeDesignation && (
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                        {employeeDesignation}
                      </span>
                    )}
                    {employeeId && (
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-xs text-slate-300">
                        {employeeId}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </h1>
    </div>
  );
}

export default WelcomeCard;
