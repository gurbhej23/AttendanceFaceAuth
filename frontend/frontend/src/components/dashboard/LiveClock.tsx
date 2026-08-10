import { useEffect, useState } from "react";
import { Clock, Calendar } from "lucide-react";

export default function LiveClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = time.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  const formattedDate = time.toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex flex-wrap items-center gap-3 sm:gap-4">
      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/60 px-3.5 py-2 backdrop-blur-md">
        <Clock className="h-4 w-4 text-cyan-400 animate-pulse" />
        <span className="text-sm font-bold tracking-wider text-white font-mono">
          {formattedTime}
        </span>
      </div>

      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/60 px-3.5 py-2 backdrop-blur-md">
        <Calendar className="h-4 w-4 text-indigo-400" />
        <span className="text-xs font-semibold text-slate-300">
          {formattedDate}
        </span>
      </div>
    </div>
  );
}
