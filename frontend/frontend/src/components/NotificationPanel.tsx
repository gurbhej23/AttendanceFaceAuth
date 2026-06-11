import { Bell, X } from "lucide-react";
import type { DashboardNotification } from "../hooks/useDashboardNotifications";

interface Props {
  open: boolean;
  onClose: () => void;
  notifications: DashboardNotification[];
  onMarkAllRead: () => void;
  onMarkOneRead: (id: string) => void;
}

export default function NotificationPanel({
  open,
  onClose,
  notifications,
  onMarkAllRead,
  onMarkOneRead,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/60 p-4 pt-16 backdrop-blur-sm sm:justify-end sm:pt-20 sm:pr-6">
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
            {notifications.length > 0 && (
              <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white">
                {notifications.length > 99 ? "99+" : notifications.length}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[min(70vh,420px)] overflow-y-auto p-3">
          {notifications.length === 0 ? (
            <div className="py-12 text-center">
              <Bell size={32} className="mx-auto mb-3 text-slate-600" />
              <p className="text-sm font-medium text-slate-400">No new notifications</p>
              <p className="mt-1 text-xs text-slate-500">You are all caught up.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {notifications.map((item, index) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onMarkOneRead(item.id);
                    }}
                    className="flex w-full gap-3 rounded-2xl border border-white/5 bg-white/5 p-4 text-left transition hover:border-sky-500/30 hover:bg-sky-500/10"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-red-600 text-sm font-bold text-white">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white">{item.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-400">
                        {item.message}
                      </p>
                      {item.time && (
                        <p className="mt-1 text-[10px] text-slate-500">{item.time}</p>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {notifications.length > 0 && (
          <div className="border-t border-white/10 p-3">
            <button
              type="button"
              onClick={() => {
                onMarkAllRead();
                onClose();
              }}
              className="w-full rounded-2xl bg-sky-600/90 py-3 text-sm font-semibold text-white transition hover:bg-sky-600"
            >
              Mark all as read
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
