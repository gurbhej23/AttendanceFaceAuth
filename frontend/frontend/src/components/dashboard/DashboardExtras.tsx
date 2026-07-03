import API from "../../services/api";
import { Cake, Flame, Megaphone, PartyPopper } from "lucide-react";
import {
  MotionStaggerItem,
  StaggerGroup,
} from "../motion/MotionPrimitives";

export interface DashboardExtrasData {
  announcements: { id: string; title: string; body: string; created_by_name?: string }[];
  celebrations: {
    type: "birthday" | "anniversary" | "welcome";
    name: string;
    employee_id: string;
    department?: string;
    years?: number;
    profile_img?: string;
  }[];
  streak: { present_streak: number; on_time_streak: number; badge: string };
}

interface Props {
  data: DashboardExtrasData | null;
}

const extraCardBase =
  "dash-shell-panel flex items-center gap-3 rounded-2xl border p-4 shadow-lg backdrop-blur-xl sm:shadow-xl";

export default function DashboardExtras({ data }: Props) {
  if (!data) return null;

  const { announcements, celebrations, streak } = data;
  const hasContent =
    announcements.length > 0 || celebrations.length > 0 || Boolean(streak.badge);

  if (!hasContent) return null;

  return (
    <StaggerGroup className="mb-4 grid gap-3 lg:grid-cols-3">
      {announcements.length > 0 && (
        <MotionStaggerItem className="dash-shell-panel rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 shadow-lg backdrop-blur-xl sm:shadow-xl lg:col-span-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-200">
            <Megaphone className="h-4 w-4" />
            Announcements
          </div>
          {announcements.map((a) => (
            <div key={a.id} className="mb-2 last:mb-0">
              <p className="font-semibold text-white">{a.title}</p>
              <p className="text-sm text-slate-300">{a.body}</p>
            </div>
          ))}
        </MotionStaggerItem>
      )}

      {celebrations.slice(0, 3).map((c) => (
        <MotionStaggerItem
          key={`${c.type}-${c.employee_id}`}
          className={`${extraCardBase} border-white/10 bg-white/5`}
        >
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-pink-500/20 text-pink-300">
            {c.type === "birthday" ? (
              <Cake className="h-5 w-5" />
            ) : c.type === "welcome" ? (
              <PartyPopper className="h-5 w-5" />
            ) : (
              <PartyPopper className="h-5 w-5" />
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {c.type === "birthday"
                ? "Birthday"
                : c.type === "welcome"
                  ? "Welcome"
                  : "Work anniversary"}
            </p>
            <p className="font-semibold text-white">{c.name}</p>
          </div>
        </MotionStaggerItem>
      ))}

      {streak.badge && (
        <MotionStaggerItem
          className={`${extraCardBase} border-orange-500/30 bg-orange-500/10`}
        >
          <Flame className="h-8 w-8 shrink-0 text-orange-400" />
          <div>
            <p className="text-xs font-semibold uppercase text-orange-300">
              Attendance streak
            </p>
            <p className="text-lg font-bold text-white">{streak.badge}</p>
          </div>
        </MotionStaggerItem>
      )}
    </StaggerGroup>
  );
}

export async function fetchDashboardExtras(employeeId: string): Promise<DashboardExtrasData | null> {
  try {
    const res = await API.get("/employees/dashboard-extras/", {
      params: { employee_id: employeeId },
    });
    if (res.data.success) return res.data;
  } catch {
    /* silent */
  }
  return null;
}
