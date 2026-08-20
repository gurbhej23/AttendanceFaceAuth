import { motion } from "framer-motion";
import { MessageCircle, Building2, User } from "lucide-react";
import ProfileAvatarImg from "../components/common/ProfileAvatarImg";

interface TeamMemberFlipCardProps {
  name: string;
  designation: string;
  department: string;
  employeeId: string;
  profileImg?: string;
  isOnline: boolean;
  isSelf: boolean;
  onMessage: () => void;
}

export default function TeamMemberFlipCard({
  name,
  designation,
  department,
  employeeId,
  profileImg,
  isOnline,
  isSelf,
  onMessage,
}: TeamMemberFlipCardProps) {
  return (
    <motion.div
      whileHover={{ y: -5, scale: 1.02 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/90 dark:border-white/10 bg-white/95 dark:bg-slate-900/80 p-4 sm:p-5 shadow-md hover:shadow-xl dark:shadow-2xl backdrop-blur-xl transition-all"
    >
      {/* Subtle ambient light glow */}
      <div className="pointer-events-none absolute -top-16 -right-16 h-32 w-32 rounded-full bg-cyan-500/10 blur-2xl group-hover:bg-cyan-500/20 transition-all duration-500" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-32 w-32 rounded-full bg-blue-500/10 blur-2xl group-hover:bg-blue-500/15 transition-all duration-500" />

      {/* Card Header & Avatar */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-3.5">
          {/* Online status badge */}
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold border transition-colors ${isOnline
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400"
              }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${isOnline ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                }`}
            />
            {isOnline ? "Online" : "Offline"}
          </span>

          {/* Employee ID Tag */}
          <span className="rounded-lg bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700/60">
            #{employeeId}
          </span>
        </div>

        {/* Center Avatar & Info */}
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-3">
            <div className="h-16 w-16 sm:h-18 sm:w-18 rounded-full overflow-hidden border-2 border-cyan-500/40 bg-slate-100 dark:bg-slate-800 shadow-md group-hover:border-cyan-400 transition-colors">
              <ProfileAvatarImg
                src={profileImg}
                alt={name}
                className="h-full w-full object-cover"
              />
            </div>
            {isOnline && (
              <span className="absolute bottom-0 right-0.5 h-4 w-4 rounded-full border-2 border-white dark:border-slate-900 bg-emerald-500 shadow-xs" />
            )}
          </div>

          <div className="w-full">
            <h3 className="truncate font-extrabold text-sm sm:text-base text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition-colors">
              {name}
            </h3>
            <p className="mt-0.5 truncate text-xs font-semibold text-cyan-600 dark:text-cyan-400 uppercase tracking-wide">
              {designation || "Staff Member"}
            </p>
          </div>

          {/* Department badge */}
          <div className="mt-2.5 inline-flex items-center gap-1 rounded-xl bg-slate-100 dark:bg-slate-800/60 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/50">
            <Building2 className="h-3 w-3 text-slate-400" />
            <span className="truncate max-w-[120px]">{department || "General"}</span>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/10">
        {isSelf ? (
          <div className="flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-slate-400 dark:text-slate-500">
            <User size={13} />
            <span>Your Profile</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMessage();
            }}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 py-2 px-3 text-xs font-bold text-white shadow-sm hover:shadow-md shadow-cyan-500/20 transition-all cursor-pointer"
          >
            <MessageCircle size={14} />
            <span>Direct Message</span>
          </button>
        )}
      </div>
    </motion.div>
  );
}