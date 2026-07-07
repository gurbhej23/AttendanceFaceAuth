import type { AttendanceRecord } from "../../types/attendance";
import {
  getAttendanceStatusLabel,
  getAttendanceStatusTextClass,
} from "../../utils/dashboardUi";
import DashboardDatePicker from "../common/DashboardDatePicker";
import { MotionStaggerItem, StaggerGroup } from "../motion/MotionPrimitives";

interface StatusProps {
  selectedDate: string;
  today: string;
  setSelectedDate: React.Dispatch<React.SetStateAction<string>>;
  todayStatus: string;
  todayRecord?: AttendanceRecord;

  cardStyle: {
    bg: string;
    border: string;
    text: string;
    icon: React.ReactNode;
  };
}

const metricCard =
  "dash-metric-card flex min-h-[6.75rem] flex-col justify-between border p-3 shadow-lg sm:min-h-0 sm:p-4 sm:shadow-xl";

export default function StatusCard({
  selectedDate,
  today,
  setSelectedDate,
  todayStatus,
  todayRecord,
  cardStyle,
}: StatusProps) {
  const hasCheckedIn = Boolean(todayRecord?.check_in);
  const rawDuration = todayRecord?.duration?.trim();
  const hasDuration =
    Boolean(rawDuration) && rawDuration !== "--" && rawDuration !== "-";

  const workingHoursValue = !hasCheckedIn
    ? "Not started"
    : hasDuration
      ? rawDuration!
      : "0h 00m";
  const workingHoursMuted = !hasDuration;
  const isNotMarked = !todayStatus;
  const statusTextClass = isNotMarked
    ? "text-slate-200 status-not-marked-pulse"
    : getAttendanceStatusTextClass(todayStatus);

  return (
    <StaggerGroup className="mb-3 grid grid-cols-2 gap-2 sm:mb-4 sm:gap-3 xl:grid-cols-3 xl:gap-5">
      <MotionStaggerItem className="dash-shell-panel col-span-2 flex items-center gap-2.5 border border-white/10 bg-white/5 px-3 py-2 shadow-lg backdrop-blur-xl sm:gap-3 sm:px-4 sm:py-3 xl:col-span-1 xl:flex-col xl:items-stretch xl:gap-2 xl:p-4">
        <p className="dash-metric-label shrink-0 text-xs font-semibold text-slate-300 sm:text-sm xl:mb-0.5">
          Selected Date
        </p>
        <DashboardDatePicker
          value={selectedDate}
          max={today}
          onChange={setSelectedDate}
          compact
          className="min-w-0 flex-1"
        />
      </MotionStaggerItem>

      <MotionStaggerItem
        className={`${metricCard} bg-linear-to-br ${cardStyle.bg} ${cardStyle.border}`}
      >
        <p
          className={`dash-metric-label font-semibold ${cardStyle.text} text-xs sm:text-sm`}
        >
          Today's Status
        </p>
        <div className="flex items-end justify-between gap-2">
          <h2
            className={`dash-metric-value text-base font-extrabold leading-tight sm:text-xl md:text-2xl ${statusTextClass}`}
          >
            {getAttendanceStatusLabel(todayStatus)}
          </h2>
          <div className="dash-metric-icon dash-squircle flex h-9 w-9 shrink-0 items-center justify-center border border-white/10 text-lg sm:h-11 sm:w-11 sm:text-xl">
            {cardStyle.icon}
          </div>
        </div>
      </MotionStaggerItem>

      <MotionStaggerItem
        className={`${metricCard} border-blue-500/20 bg-linear-to-br from-blue-500/20 to-cyan-500/10`}
      >
        <p className="dash-metric-label text-xs font-semibold text-blue-300 sm:text-sm">
          Working Hours
        </p>
        <div className="flex items-end justify-between gap-2">
          <h2
            className={`dash-metric-value text-base font-bold leading-tight sm:text-xl md:text-2xl ${
              workingHoursMuted ? "text-slate-400" : "text-white"
            }`}
          >
            {workingHoursValue}
          </h2>
          <div className="dash-metric-icon dash-squircle flex h-9 w-9 shrink-0 items-center justify-center border border-white/10 bg-blue-500/20 text-lg sm:h-11 sm:w-11 sm:text-xl">
            ⏰
          </div>
        </div>
      </MotionStaggerItem>
    </StaggerGroup>
  );
}
