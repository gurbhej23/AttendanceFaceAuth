import Input from "../common/Input";
import type { AttendanceRecord } from "../../types/attendance";

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
  return (
    <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-5 mb-4">
      <div className="col-span-2 xl:col-span-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-4 sm:p-5 shadow-xl">
        <p className="text-slate-400 text-sm mb-3">Selected Date</p>
        <Input
          type="date"
          value={selectedDate}
          max={today}
          onChange={(e) =>
            setSelectedDate(e.target.value > today ? today : e.target.value)
          }
          className="w-full p-4 rounded-2xl bg-slate-900/70 text-white border border-slate-700 focus:border-blue-500 outline-none"
        />
      </div>

      <div
        className={`bg-linear-to-br ${cardStyle.bg} border ${cardStyle.border} rounded-3xl p-5 shadow-xl`}
      >
        <p className={`${cardStyle.text} text-sm`}>Today's Status</p>
        <div className="flex items-center justify-between mt-3">
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white capitalize">
            {todayStatus || "Not Marked"}
          </h2>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl">
            {cardStyle.icon}
          </div>
        </div>
      </div>

      <div className="bg-linear-to-br from-blue-500/20 to-cyan-500/10 border border-blue-500/20 rounded-3xl p-5 shadow-xl">
        <p className="text-blue-300 text-sm">Working Hours</p>
        <div className="flex items-center justify-between mt-3">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            {todayRecord?.duration || "--"}
          </h2>
          <div className="w-14 h-14 rounded-2xl bg-blue-500/20 flex items-center justify-center text-2xl">
            ⏰
          </div>
        </div>
      </div>
    </div>
  );
}
