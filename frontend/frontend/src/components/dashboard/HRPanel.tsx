import { useCallback, useEffect, useState } from "react";
import API from "../../services/api";
import Button from "../../components/common/Button";
import {
  MotionStaggerItem,
  StaggerGroup,
} from "../motion/MotionPrimitives";
import {
  Briefcase,
  Coffee,
  Home,
  MapPin,
  RefreshCw,
  Wallet,
} from "lucide-react";

interface LeaveBalance {
  year?: number;
  casual: { total: number; used: number; remaining: number };
  sick: { total: number; used: number; remaining: number };
  annual: { total: number; used: number; remaining: number };
}

interface ShiftInfo {
  code: string;
  name: string;
  start_hour: number;
  start_minute: number;
  end_hour: number;
  end_minute: number;
}

interface Props {
  employeeId: string;
  workMode: "office" | "wfh";
  onWorkModeChange: (mode: "office" | "wfh") => void;
  onRegularization: () => void;
}

const fmtTime = (h: number, m: number) => {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
};

export default function HRPanel({
  employeeId,
  workMode,
  onWorkModeChange,
  onRegularization,
}: Props) {
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [shift, setShift] = useState<ShiftInfo | null>(null);
  const [rosterWorkMode, setRosterWorkMode] = useState<"office" | "wfh" | null>(null);
  const [breakActive, setBreakActive] = useState(false);
  const [breakMinutes, setBreakMinutes] = useState(0);
  const [loadingBreak, setLoadingBreak] = useState(false);

  const load = useCallback(async () => {
    if (!employeeId) return;
    try {
      const [balRes, shiftRes, breakRes] = await Promise.all([
        API.get("/attendance/hr/leave-balance/", { params: { employee_id: employeeId } }),
        API.get("/attendance/hr/employee-shift/", { params: { employee_id: employeeId } }),
        API.get("/attendance/hr/break/status/", { params: { employee_id: employeeId } }),
      ]);
      if (balRes.data.success) setBalance(balRes.data.balance);
      if (shiftRes.data.success) {
        setShift(shiftRes.data.shift);
        const assigned = shiftRes.data.work_mode_default === "wfh" ? "wfh" : "office";
        setRosterWorkMode(assigned);
        onWorkModeChange(assigned);
      }
      if (breakRes.data.success) {
        setBreakActive(breakRes.data.break_active);
        setBreakMinutes(breakRes.data.break_minutes || 0);
      }
    } catch {
      /* silent */
    }
  }, [employeeId, onWorkModeChange]);

  useEffect(() => {
    void load();
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const toggleBreak = async () => {
    setLoadingBreak(true);
    try {
      const res = await API.post("/attendance/hr/break/", {
        employee_id: employeeId,
        action: breakActive ? "end" : "start",
      });
      if (res.data.success) {
        setBreakActive(res.data.break_active ?? !breakActive);
        if (res.data.break_minutes_today != null) {
          setBreakMinutes(res.data.break_minutes_today);
        }
      }
    } catch {
      /* silent */
    } finally {
      setLoadingBreak(false);
    }
  };

  return (
    <StaggerGroup className="mb-3 grid gap-3 sm:mb-4 lg:grid-cols-3">
      {/* Shift & work mode */}
      <MotionStaggerItem className="dash-shell-panel rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg backdrop-blur-xl">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-300">
          <Briefcase className="h-4 w-4 text-blue-400" />
          Shift &amp; Location
        </div>
        {shift ? (
          <p className="text-sm text-slate-400">
            <span className="font-medium text-white">{shift.name}</span>
            <br />
            {fmtTime(shift.start_hour, shift.start_minute)} –{" "}
            {fmtTime(shift.end_hour, shift.end_minute)}
          </p>
        ) : (
          <p className="text-sm text-slate-500">Loading shift…</p>
        )}
        {rosterWorkMode && (
          <p className="mt-2 text-[11px] text-slate-500">
            Work mode set by HR roster:{" "}
            <span className="font-semibold text-slate-300">
              {rosterWorkMode === "wfh" ? "Work from home" : "Office"}
            </span>
          </p>
        )}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => onWorkModeChange("office")}
            disabled={rosterWorkMode === "wfh"}
            className={`motion-tap-btn flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-semibold transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
              workMode === "office"
                ? "border-blue-500/50 bg-blue-500/20 text-blue-300"
                : "border-slate-700 text-slate-400 hover:border-slate-500"
            }`}
          >
            <MapPin className="h-3.5 w-3.5" />
            Office
          </button>
          <button
            type="button"
            onClick={() => onWorkModeChange("wfh")}
            className={`motion-tap-btn flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-semibold transition cursor-pointer ${
              workMode === "wfh"
                ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-300"
                : "border-slate-700 text-slate-400 hover:border-slate-500"
            }`}
          >
            <Home className="h-3.5 w-3.5" />
            WFH
          </button>
        </div>
      </MotionStaggerItem>

      {/* Leave balance */}
      <MotionStaggerItem className="dash-shell-panel rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg backdrop-blur-xl">
        <div className="mb-1 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
            <Wallet className="h-4 w-4 text-purple-400" />
            Leave Balance
          </div>
          {balance?.year != null && (
            <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-300">
              {balance.year} · yearly
            </span>
          )}
        </div>
        <p className="mb-3 text-[11px] text-slate-500">
          Days reset each calendar year (not monthly).
        </p>
        {balance ? (
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            {(
              [
                ["Casual", balance.casual],
                ["Sick", balance.sick],
                ["Annual", balance.annual],
              ] as const
            ).map(([label, b]) => (
              <div
                key={label}
                className="rounded-xl border border-slate-700/80 bg-slate-900/50 px-2 py-2"
              >
                <p className="text-slate-500">{label}</p>
                <p className="text-lg font-bold text-white">{b.remaining}</p>
                <p className="text-[10px] text-slate-500">of {b.total}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Loading balance…</p>
        )}
      </MotionStaggerItem>

      {/* Break & regularization */}
      <MotionStaggerItem className="dash-shell-panel rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg backdrop-blur-xl">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-300">
          <Coffee className="h-4 w-4 text-amber-400" />
          Break &amp; Fixes
        </div>
        <p className="mb-2 text-xs text-slate-500">
          Break today: <span className="font-semibold text-slate-300">{breakMinutes} min</span>
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            text={breakActive ? "End Break" : "Start Break"}
            onClick={toggleBreak}
            disabled={loadingBreak}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold cursor-pointer ${
              breakActive
                ? "bg-amber-600 hover:bg-amber-700 text-white"
                : "bg-slate-700 hover:bg-slate-600 text-white"
            }`}
          />
          <Button
            text={
              <>
                <RefreshCw className="mr-1 inline h-3.5 w-3.5" />
                Regularize
              </>
            }
            onClick={onRegularization}
            className="flex-1 rounded-xl border border-slate-600 bg-slate-800/80 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer"
          />
        </div>
      </MotionStaggerItem>
    </StaggerGroup>
  );
}
