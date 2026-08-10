import { useState } from "react";
import LiveClock from "./LiveClock";
import FaceCheckInModal from "./FaceCheckInModal";
import { Card3D } from "../../motion/motion3d";
import {
  CheckCircle2,
  XCircle,
  Clock3,
  CalendarDays,
  Briefcase,
  Sparkles,
  Zap,
  Check,
} from "lucide-react";
import type { AttendanceRecord } from "../../types/attendance";

interface TodayAttendanceProps {
  employeeName: string | null;
  employeeId: string | null;
  employeeDesignation?: string;
  employeeDepartment?: string;
  todayRecord?: AttendanceRecord;
  todayStatus: string;
  workMode: "office" | "wfh";
  onCheckInSuccess: (msg: string) => void;
  onOpenAbsentModal: () => void;
  onOpenHalfDayModal: () => void;
  onOpenLeaveModal: () => void;
  shiftInfo?: {
    code?: string;
    name?: string;
    start_hour?: number;
    start_minute?: number;
    end_hour?: number;
    end_minute?: number;
  };
}

export default function TodayAttendance({
  employeeName,
  employeeId,
  employeeDesignation,
  employeeDepartment,
  todayRecord,
  todayStatus,
  workMode,
  onCheckInSuccess,
  onOpenAbsentModal,
  onOpenHalfDayModal,
  onOpenLeaveModal,
  shiftInfo,
}: TodayAttendanceProps) {
  const [showFaceModal, setShowFaceModal] = useState(false);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const hasCheckedIn = Boolean(todayRecord?.check_in);
  const rawDuration = todayRecord?.duration?.trim();
  const hasDuration = Boolean(rawDuration) && rawDuration !== "--" && rawDuration !== "-";
  const workingHoursValue = !hasCheckedIn ? "Not Started" : hasDuration ? rawDuration! : "0h 00m";

  const shiftTimeStr = shiftInfo
    ? `${String(shiftInfo.start_hour || 10).padStart(2, "0")}:${String(shiftInfo.start_minute || 0).padStart(2, "0")} - ${String(shiftInfo.end_hour || 18).padStart(2, "0")}:${String(shiftInfo.end_minute || 0).padStart(2, "0")}`
    : "10:00 AM - 06:00 PM";

  const getStatusBadge = () => {
    switch (todayStatus) {
      case "present":
        return {
          label: "Present",
          bg: "bg-emerald-500/15 border-emerald-500/30 text-emerald-400",
          icon: <CheckCircle2 className="h-4 w-4" />,
        };
      case "late":
        return {
          label: "Late",
          bg: "bg-amber-500/15 border-amber-500/30 text-amber-400",
          icon: <Clock3 className="h-4 w-4" />,
        };
      case "absent":
        return {
          label: "Absent",
          bg: "bg-rose-500/15 border-rose-500/30 text-rose-400",
          icon: <XCircle className="h-4 w-4" />,
        };
      case "half_day":
      case "half day":
        return {
          label: "Half Day",
          bg: "bg-orange-500/15 border-orange-500/30 text-orange-400",
          icon: <Clock3 className="h-4 w-4" />,
        };
      case "leave":
      case "leave_approved":
        return {
          label: "On Leave",
          bg: "bg-purple-500/15 border-purple-500/30 text-purple-400",
          icon: <CalendarDays className="h-4 w-4" />,
        };
      default:
        return {
          label: "Not Marked",
          bg: "bg-slate-500/15 border-slate-500/30 text-slate-300",
          icon: <Zap className="h-4 w-4 text-cyan-400 animate-pulse" />,
        };
    }
  };

  const statusBadge = getStatusBadge();

  return (
    <Card3D className="mb-6 w-full" maxDegrees={4}>
      <div className="glass-card relative overflow-hidden rounded-[32px] p-5 sm:p-7 shadow-2xl">
        {/* Decorative Background Mesh */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-blue-600/20 via-cyan-500/15 to-transparent blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-gradient-to-br from-indigo-600/20 via-purple-500/15 to-transparent blur-3xl" />

        {/* Top Bar: Greeting & Live Clock */}
        <div className="relative z-10 flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                <Sparkles className="h-3 w-3" /> Today's Attendance Overview
              </span>
              <span className="text-xs font-semibold text-slate-400">
                {workMode === "wfh" ? "🏡 Work From Home" : "🏢 Office Shift"}
              </span>
            </div>

            <h1 className="mt-2 text-2xl font-extrabold text-white sm:text-3xl tracking-tight">
              {getGreeting()}, {employeeName || "Employee"} 👋
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-300 font-medium">
              {[employeeDepartment, employeeDesignation, employeeId ? `ID: ${employeeId}` : ""]
                .filter(Boolean)
                .join(" • ")}
            </p>
          </div>

          <LiveClock />
        </div>

        {/* Middle Details Grid */}
        <div className="relative z-10 my-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Status Tile */}
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/50 p-4 backdrop-blur-md">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Attendance Status
              </p>
              <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold shadow-sm">
                <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 ${statusBadge.bg}`}>
                  {statusBadge.icon}
                  {statusBadge.label}
                </div>
              </div>
            </div>
            {todayRecord?.check_in && (
              <div className="text-right">
                <p className="text-[11px] text-slate-400">Checked In</p>
                <p className="text-sm font-bold text-white font-mono">{todayRecord.check_in}</p>
              </div>
            )}
          </div>

          {/* Shift Information Tile */}
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/50 p-4 backdrop-blur-md">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Shift Schedule
              </p>
              <p className="mt-1 text-sm font-bold text-white">
                {shiftInfo?.name || "General Shift"}
              </p>
              <p className="text-xs text-slate-300 font-mono mt-0.5">{shiftTimeStr}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <Briefcase className="h-5 w-5" />
            </div>
          </div>

          {/* Working Hours Tile */}
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/50 p-4 backdrop-blur-md">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Logged Working Hours
              </p>
              <p className="mt-1 text-lg font-bold text-cyan-300 font-mono">
                {workingHoursValue}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              <Clock3 className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Quick Actions Header */}
        <div className="relative z-10 mt-6 border-t border-white/10 pt-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
              Attendance Actions
            </h2>
            <span className="text-xs text-slate-400">
              {hasCheckedIn ? "✅ Marked for today" : "Select an action below"}
            </span>
          </div>

          {/* 4 Interactive Action Cards */}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            {/* Primary Action: Check In (Face Recognition) */}
            <button
              type="button"
              onClick={() => setShowFaceModal(true)}
              className={`group relative flex flex-col justify-between rounded-2xl border p-4 text-left transition-all duration-300 cursor-pointer ${
                hasCheckedIn
                  ? "border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20"
                  : "border-emerald-500/50 bg-gradient-to-br from-emerald-500/20 via-emerald-950/30 to-slate-950 hover:border-emerald-400 hover:shadow-xl hover:shadow-emerald-500/20 hover:-translate-y-1"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 group-hover:scale-110 transition-transform">
                  {hasCheckedIn ? <Check className="h-6 w-6" /> : <CheckCircle2 className="h-6 w-6" />}
                </div>
                <span className="rounded-md border border-emerald-500/40 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300">
                  {hasCheckedIn ? "Checked In" : "Face Auth"}
                </span>
              </div>
              <div className="mt-4">
                <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition-colors">
                  {hasCheckedIn ? "Re-verify Check In" : "Check In"}
                </h3>
                <p className="mt-0.5 text-xs text-slate-300">
                  Open Face Recognition camera scan
                </p>
              </div>
            </button>

            {/* Action: Mark Absent */}
            <button
              type="button"
              onClick={onOpenAbsentModal}
              className="group relative flex flex-col justify-between rounded-2xl border border-rose-500/30 bg-gradient-to-br from-rose-500/10 via-rose-950/20 to-slate-950 p-4 text-left transition-all duration-300 hover:border-rose-400 hover:shadow-xl hover:shadow-rose-500/10 hover:-translate-y-1 cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-400 group-hover:scale-110 transition-transform">
                  <XCircle className="h-6 w-6" />
                </div>
                <span className="rounded-md border border-rose-500/30 bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-300">
                  No Face Req.
                </span>
              </div>
              <div className="mt-4">
                <h3 className="text-base font-bold text-white group-hover:text-rose-300 transition-colors">
                  Mark Absent
                </h3>
                <p className="mt-0.5 text-xs text-slate-300">
                  Enter reason & submit absence
                </p>
              </div>
            </button>

            {/* Action: Half Day */}
            <button
              type="button"
              onClick={onOpenHalfDayModal}
              className="group relative flex flex-col justify-between rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-amber-950/20 to-slate-950 p-4 text-left transition-all duration-300 hover:border-amber-400 hover:shadow-xl hover:shadow-amber-500/10 hover:-translate-y-1 cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 group-hover:scale-110 transition-transform">
                  <Clock3 className="h-6 w-6" />
                </div>
                <span className="rounded-md border border-amber-500/30 bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">
                  Partial
                </span>
              </div>
              <div className="mt-4">
                <h3 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors">
                  Half Day
                </h3>
                <p className="mt-0.5 text-xs text-slate-300">
                  Select until time & submit reason
                </p>
              </div>
            </button>

            {/* Action: Leave Request */}
            <button
              type="button"
              onClick={onOpenLeaveModal}
              className="group relative flex flex-col justify-between rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-500/10 via-purple-950/20 to-slate-950 p-4 text-left transition-all duration-300 hover:border-purple-400 hover:shadow-xl hover:shadow-purple-500/10 hover:-translate-y-1 cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400 group-hover:scale-110 transition-transform">
                  <CalendarDays className="h-6 w-6" />
                </div>
                <span className="rounded-md border border-purple-500/30 bg-purple-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-purple-300">
                  Apply Leave
                </span>
              </div>
              <div className="mt-4">
                <h3 className="text-base font-bold text-white group-hover:text-purple-300 transition-colors">
                  Leave Request
                </h3>
                <p className="mt-0.5 text-xs text-slate-300">
                  Select dates, type & reason
                </p>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Face Recognition Check-In Modal */}
      <FaceCheckInModal
        open={showFaceModal}
        onClose={() => setShowFaceModal(false)}
        onSuccess={(msg) => onCheckInSuccess(msg)}
        workMode={workMode}
      />
    </Card3D>
  );
}
