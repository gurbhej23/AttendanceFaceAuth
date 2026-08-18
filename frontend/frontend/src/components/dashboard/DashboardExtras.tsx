import { Cake, Flame, Megaphone, PartyPopper } from "lucide-react";
import {
  MotionStaggerItem,
  StaggerGroup,
} from "../motion/MotionPrimitives";
import ThreeDCardContainer from "../motion/ThreeDCardContainer";
import type { DashboardExtrasData } from "../../services/dashboardExtras";

interface Props {
  data: DashboardExtrasData | null;
}

export default function DashboardExtras({ data }: Props) {
  if (!data) return null;

  const { announcements, celebrations, streak } = data;
  const hasContent =
    announcements.length > 0 || celebrations.length > 0 || Boolean(streak.badge);

  if (!hasContent) return null;

  return (
    <StaggerGroup className="mb-4 grid gap-3 lg:grid-cols-3">
      {announcements.length > 0 && (
        <MotionStaggerItem className="lg:col-span-3">
          <ThreeDCardContainer maxDegrees={6} className="rounded-3xl border border-amber-500/40 bg-linear-to-r from-amber-500/20 via-orange-950/30 to-slate-950 p-4 backdrop-blur-xl shadow-xl">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-amber-300">
              <Megaphone className="h-4 w-4 animate-bounce" />
              Company Announcements
            </div>
            {announcements.map((a) => (
              <div key={a.id} className="mb-2 last:mb-0">
                <p className="font-bold text-white text-base">{a.title}</p>
                <p className="text-sm text-slate-300">{a.body}</p>
              </div>
            ))}
          </ThreeDCardContainer>
        </MotionStaggerItem>
      )}

      {celebrations.slice(0, 3).map((c) => (
        <MotionStaggerItem key={`${c.type}-${c.employee_id}`}>
          <ThreeDCardContainer maxDegrees={8} className="rounded-3xl border border-pink-500/30 bg-white dark:bg-transparent p-4 backdrop-blur-xl shadow-xl">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-pink-500/20 text-pink-300 border border-pink-500/30 shadow-md">
                {c.type === "birthday" ? (
                  <Cake className="h-5 w-5" />
                ) : (
                  <PartyPopper className="h-5 w-5" />
                )}
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-pink-400">
                  {c.type === "birthday"
                    ? "Birthday 🎉"
                    : c.type === "welcome"
                    ? "New Teammate 👋"
                    : "Work Anniversary 🎈"}
                </p>
                <p className="font-bold text-slate-900 dark:text-white text-sm">{c.name}</p>
              </div>
            </div>
          </ThreeDCardContainer>
        </MotionStaggerItem>
      ))}

      {streak.badge && (
        <MotionStaggerItem>
          <ThreeDCardContainer maxDegrees={10} className="rounded-3xl border border-orange-500/40 bg-linear-to-br from-orange-500/20 via-amber-950/30 to-slate-950 p-4 backdrop-blur-xl shadow-xl">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-orange-500/20 text-orange-400 border border-orange-500/30 shadow-md">
                <Flame className="h-6 w-6 animate-pulse" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-orange-300">
                  Attendance Streak
                </p>
                <p className="text-base font-extrabold text-white">{streak.badge}</p>
              </div>
            </div>
          </ThreeDCardContainer>
        </MotionStaggerItem>
      )}
    </StaggerGroup>
  );
}
