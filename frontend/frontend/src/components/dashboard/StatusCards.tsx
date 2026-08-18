import type { AttendanceRecord } from "../../types/attendance";
import {
  getAttendanceStatusLabel,
  getAttendanceStatusTextClass,
} from "../../utils/dashboardUi";
import DashboardDatePicker from "../common/DashboardDatePicker";
import { MotionStaggerItem, StaggerGroup } from "../motion/MotionPrimitives";
import ThreeDCardContainer from "../motion/ThreeDCardContainer";

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
    <StaggerGroup className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:mb-4 sm:gap-4 xl:gap-5">
      <MotionStaggerItem>
        <ThreeDCardContainer maxDegrees={8} className="h-full rounded-3xl border border-white/15 bg-transparent p-4 backdrop-blur-xl shadow-xl">
          <div className="flex min-h-[5.5rem] flex-col justify-between">
            <p className="dash-metric-label text-xs font-semibold text-slate-300 sm:text-sm">
              Selected Date Filter
            </p>
            <DashboardDatePicker
              value={selectedDate}
              max={today}
              onChange={setSelectedDate}
              compact
              className="w-full"
            />
          </div>
        </ThreeDCardContainer>
      </MotionStaggerItem>

      <MotionStaggerItem>
        <ThreeDCardContainer maxDegrees={10} className={`h-full rounded-3xl border p-4 backdrop-blur-xl shadow-xl bg-transparent ${cardStyle.border}`}>
          <div className="flex min-h-[5.5rem] flex-col justify-between">
            <p className={`dash-metric-label font-semibold ${cardStyle.text} text-xs sm:text-sm`}>
              Today's Status
            </p>
            <div className="flex items-end justify-between gap-2">
              <h2 className={`dash-metric-value text-base font-extrabold leading-tight sm:text-xl md:text-2xl ${statusTextClass}`}>
                {getAttendanceStatusLabel(todayStatus)}
              </h2>
              <div className="dash-metric-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-lg shadow-md sm:h-11 sm:w-11 sm:text-xl">
                {cardStyle.icon}
              </div>
            </div>
          </div>
        </ThreeDCardContainer>
      </MotionStaggerItem>

      <MotionStaggerItem>
        <ThreeDCardContainer maxDegrees={10} className="h-full rounded-3xl border border-cyan-500/30 bg-transparent p-4 backdrop-blur-xl shadow-xl">
          <div className="flex min-h-[5.5rem] flex-col justify-between">
            <p className="dash-metric-label text-xs font-semibold text-cyan-300 sm:text-sm">
              Working Hours
            </p>
            <div className="flex items-end justify-between gap-2">
              <h2 className={`dash-metric-value text-base font-bold leading-tight sm:text-xl md:text-2xl ${workingHoursMuted ? "text-slate-400" : "text-white"}`}>
                {workingHoursValue}
              </h2>
              <div className="dash-metric-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/20 text-lg shadow-md sm:h-11 sm:w-11 sm:text-xl">
                ⏰
              </div>
            </div>
          </div>
        </ThreeDCardContainer>
      </MotionStaggerItem>
    </StaggerGroup>
  );
}
