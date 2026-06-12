import {
  Bell,
  CalendarDays,
  MessageSquare,
  PhoneMissed,
  PhoneOff,
  Users,
  X,
} from "lucide-react";
  import Button from "./Button";
import type { DashboardNotification, NotificationType } from "../../hooks/useDashboardNotifications";

interface Props {
  open: boolean;
  onClose: () => void;
  notifications: DashboardNotification[];
  unreadCount: number;
  onMarkAllRead: () => void;
  onSelect: (item: DashboardNotification) => void;
}

const typeMeta: Record<
  NotificationType,
  { icon: typeof Bell; label: string; accent: string }
> = {
  message: {
    icon: MessageSquare,
    label: "Message",
    accent: "bg-sky-500/20 text-sky-300",
  },
  group_message: {
    icon: Users,
    label: "Group",
    accent: "bg-violet-500/20 text-violet-300",
  },
  missed_call: {
    icon: PhoneMissed,
    label: "Missed call",
    accent: "bg-red-500/20 text-red-300",
  },
  call_declined: {
    icon: PhoneOff,
    label: "Call declined",
    accent: "bg-orange-500/20 text-orange-300",
  },
  call_ended: {
    icon: PhoneOff,
    label: "Call ended",
    accent: "bg-slate-500/20 text-slate-300",
  },
  leave_request: {
    icon: CalendarDays,
    label: "Leave request",
    accent: "bg-purple-500/20 text-purple-300",
  },
  leave_status: {
    icon: CalendarDays,
    label: "Leave update",
    accent: "bg-emerald-500/20 text-emerald-300",
  },
};

export default function NotificationPanel({
  open,
  onClose,
  notifications,
  unreadCount,
  onMarkAllRead,
  onSelect,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/60 p-4 pt-16 backdrop-blur-sm sm:justify-center sm:pt-20 sm:pr-6">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close notifications"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <Bell size={18} className="text-sky-400" />
            <h2 className="text-lg font-bold text-white">Notifications</h2>
            {unreadCount > 0 && (
              <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </div>
          <Button
            type="button"
            onClick={onClose}
            text={<X size={18} />}
            unstyled
            className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          />
        </div>

        <div className="max-h-[min(70vh,420px)] overflow-y-auto p-3">
          {notifications.length === 0 ? (
            <div className="py-12 text-center">
              <Bell size={32} className="mx-auto mb-3 text-slate-600" />
              <p className="text-sm font-medium text-slate-400">No notifications yet</p>
              <p className="mt-1 text-xs text-slate-500">
                Messages, calls, and leave updates will appear here.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {notifications.map((item) => {
                const meta = typeMeta[item.type] || typeMeta.message;
                const Icon = meta.icon;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(item)}
                      className={`flex w-full cursor-pointer gap-3 rounded-2xl border p-4 text-left transition hover:border-sky-500/30 hover:bg-sky-500/10 ${
                        item.isRead
                          ? "border-white/5 bg-white/[0.02] opacity-70"
                          : "border-sky-500/20 bg-white/5"
                      }`}
                    >
                      <span
                        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${meta.accent}`}
                      >
                        <Icon size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-white">{item.title}</p>
                          {!item.isRead && (
                            <span className="h-2 w-2 shrink-0 rounded-full bg-sky-400" />
                          )}
                        </div>
                        <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                          {meta.label}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-400">
                          {item.message}
                        </p> 
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {notifications.length > 0 && unreadCount > 0 && (
          <div className="border-t border-white/10 p-3">
            <Button
              type="button"
              onClick={onMarkAllRead}
              text="Mark all as read"
              className="w-full bg-sky-600/90 py-3 text-sm text-white hover:bg-sky-600"
            />
          </div>
        )}
      </div>
    </div>
  );
}
