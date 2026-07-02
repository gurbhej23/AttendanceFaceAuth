import { useNavigate } from "react-router-dom";
import ProfileAvatarImg from "../common/ProfileAvatarImg";

interface WelcomeCardProps {
  employeeName: string | null;
  employeeId: string | null;
  employeeDepartment: string;
  employeeDesignation: string;
  profileImg: string;
}

function WelcomeCard({
  employeeName,
  employeeId,
  employeeDepartment,
  employeeDesignation,
  profileImg,
}: WelcomeCardProps) {
  const navigate = useNavigate();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const metaLine = [employeeDepartment, employeeDesignation, employeeId]
    .filter(Boolean)
    .join(" • ");

  return (
    <div className="dash-shell-panel relative mb-3 overflow-hidden border border-white/10 bg-white/5 shadow-xl backdrop-blur-xl dash-fade-up sm:mb-4 sm:shadow-2xl">
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-blue-500/10 blur-3xl sm:h-40 sm:w-40" />
      <div className="pointer-events-none absolute -bottom-10 left-1/3 h-24 w-24 rounded-full bg-cyan-500/10 blur-3xl sm:h-32 sm:w-32" />

      <div className="relative px-4 py-3.5 sm:px-6 sm:py-5">
        <div className="flex items-center gap-3 sm:items-start sm:gap-4">
          <button
            type="button"
            onClick={() => navigate("/profile")}
            className="dash-squircle relative h-12 w-12 shrink-0 overflow-hidden border border-white/15 bg-slate-800 shadow-md transition hover:border-blue-400/40 active:scale-[0.98] sm:h-20 sm:w-20 sm:shadow-lg md:h-24 md:w-24"
            title="View profile"
          >
            {profileImg ? (
              <ProfileAvatarImg
                src={profileImg}
                alt={employeeName || "Employee"}
                className="h-full w-full"
              />
            ) : (
              <div className="grid h-full w-full place-items-center bg-linear-to-br from-blue-600 to-cyan-500 text-lg font-bold text-white sm:text-2xl">
                {(employeeName || "E").charAt(0)}
              </div>
            )}
          </button>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium dash-welcome-muted text-slate-300 sm:text-sm">
              {getGreeting()},
            </p>
            <h1 className="mt-0.5 break-words text-lg font-bold leading-snug text-white sm:text-2xl md:text-3xl">
              {employeeName || "Employee"}
            </h1>
            {metaLine && (
              <p className="mt-1 line-clamp-2 text-xs leading-snug dash-welcome-muted text-slate-400 sm:mt-1.5 sm:text-sm">
                {metaLine}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default WelcomeCard;
