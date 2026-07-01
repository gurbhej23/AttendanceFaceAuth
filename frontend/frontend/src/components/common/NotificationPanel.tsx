import { useEffect, useRef, useState } from "react";
import {
  Bell,
  CalendarDays,
  Check,
  MessageSquare,
  MoreVertical,
  Trash2,
  Users,
  X,
} from "lucide-react";
import Button from "./Button";
import type {
  DashboardNotification,
  NotificationType,
} from "../../hooks/useDashboardNotifications";

interface Props {
  open: boolean;
  onClose: () => void;
  notifications: DashboardNotification[];
  unreadCount: number;
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
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
  onMarkRead,
  onDelete,
  onSelect,
}: Props) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) setOpenMenuId(null);
  }, [open]);

  useEffect(() => {
    if (!openMenuId) return;

    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      setOpenMenuId(null);
    };

    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [openMenuId]);

  if (!open) return null;

  return (
    <div className="notification-panel-overlay fixed inset-0 z-[70] flex items-start justify-center bg-black/60 p-4 pt-16 backdrop-blur-sm sm:justify-center sm:pt-20 sm:pr-6">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close notifications"
        onClick={onClose}
      />
      <div
        ref={menuRef}
        className="notification-panel relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl"
      >
        <div className="notification-panel-header flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="notification-panel-icon grid h-9 w-9 place-items-center rounded-xl bg-sky-500/15 text-sky-400">
              <Bell size={18} />
            </span>
            <div>
              <h2 className="text-lg font-bold text-white">Notifications</h2>
              {notifications.length > 0 && (
                <p className="text-[11px] font-medium text-slate-500">
                  {notifications.length} total
                  {unreadCount > 0 ? ` · ${unreadCount} unread` : ""}
                </p>
              )}
            </div>
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
            className="notification-panel-close rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          />
        </div>

        <div className="notification-panel-body max-h-[min(70vh,420px)] overflow-y-auto p-3">
          {notifications.length === 0 ? (
            <div className="py-12 text-center">
              <span className="notification-panel-empty-icon mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.03]">
                <Bell size={28} className="text-slate-600" />
              </span>
              <p className="text-sm font-medium text-slate-400">
                No notifications yet
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Messages and leave updates will appear here.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {notifications.map((item) => {
                const meta = typeMeta[item.type] || typeMeta.message;
                const Icon = meta.icon;
                const menuOpen = openMenuId === item.id;

                return (
                  <li key={item.id}>
                    <div
                      className={`notification-item group relative flex items-start gap-1 rounded-2xl border transition ${
                        item.isRead
                          ? "notification-item-read border-white/5 bg-white/[0.02]"
                          : "notification-item-unread border-sky-500/20 bg-white/5"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelect(item)}
                        className="flex min-w-0 flex-1 cursor-pointer gap-3 p-4 pr-2 text-left transition hover:opacity-90"
                      >
                        <span
                          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${meta.accent}`}
                        >
                          <Icon size={18} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold text-white">
                              {item.title}
                            </p>
                            {!item.isRead && (
                              <span className="h-2 w-2 shrink-0 rounded-full bg-sky-400" />
                            )}
                          </div>
                          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            {meta.label}
                          </p>
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-400">
                            {item.message}
                          </p>
                        </div>
                      </button>

                      <div className="relative shrink-0 pr-2 pt-3">
                        <Button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(menuOpen ? null : item.id);
                          }}
                          text={<MoreVertical size={16} />}
                          unstyled
                          className={`notification-item-menu-btn rounded-lg p-1.5 transition ${
                            menuOpen
                              ? "notification-item-menu-btn-open bg-white/10 text-white"
                              : "text-slate-500 opacity-70 hover:bg-white/10 hover:text-white group-hover:opacity-100"
                          }`}
                          aria-label="Notification options"
                          aria-expanded={menuOpen}
                        />

                        {menuOpen && (
                          <div
                            className="notification-item-menu absolute right-0 top-9 z-30 w-44 overflow-hidden rounded-xl border border-slate-700/80 bg-slate-900 py-1 shadow-xl"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {!item.isRead && (
                              <button
                                type="button"
                                onClick={() => {
                                  onMarkRead(item.id);
                                  setOpenMenuId(null);
                                }}
                                className="notification-menu-action flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-slate-300 transition hover:bg-slate-800"
                              >
                                <Check size={15} className="shrink-0 text-sky-400" />
                                Mark as read
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                onDelete(item.id);
                                setOpenMenuId(null);
                              }}
                              className="notification-menu-action notification-menu-delete flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-red-300 transition hover:bg-red-500/10"
                            >
                              <Trash2 size={15} className="shrink-0" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {notifications.length > 0 && unreadCount > 0 && (
          <div className="notification-panel-footer border-t border-white/10 p-3">
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
