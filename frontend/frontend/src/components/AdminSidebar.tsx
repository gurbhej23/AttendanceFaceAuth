import { LogOut, X } from "lucide-react";
import Button from "./common/Button";

export interface AdminNavItem {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone?: string;
  badgeCount?: number;
}

interface Props {
  items: AdminNavItem[];
  onLogout: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  adminName?: string;
  adminRole?: string;
  profileImg?: string;
}

export default function AdminSidebar({
  items,
  onLogout,
  mobileOpen,
  onMobileClose,
  adminName = "Admin",
  adminRole = "HR",
  profileImg,
}: Props) {
  const navButton = (item: AdminNavItem, showLabel: boolean) => (
    <button
      key={item.label}
      type="button"
      onClick={() => {
        item.onClick();
        onMobileClose();
      }}
      className={`group/item flex h-12 w-full items-center gap-3 rounded-2xl px-1 text-xs font-semibold text-white transition-all duration-300 ease-out hover:translate-x-0.5 hover:shadow-lg active:scale-[0.98] cursor-pointer ${item.tone || "bg-white/5 hover:bg-white/10"
        }`}
      title={item.label}
    >
      <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-transform duration-300 group-hover/item:scale-100 ">
        {item.icon}
        {item.badgeCount != null && item.badgeCount > 0 && (
          <span className="absolute -right-2 -top-2.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-slate-950 transition-all duration-500 group-hover:translate-y-5 group-hover:translate-x-42">

            {item.badgeCount > 99 ? "99+" : item.badgeCount}
          </span>
        )}
      </span>
      <span
        className={`whitespace-nowrap transition-all duration-300 ease-out ${showLabel
          ? "opacity-100 translate-x-0"
          : "opacity-0 -translate-x-2 w-0 overflow-hidden lg:group-hover:opacity-100 lg:group-hover:translate-x-0 lg:group-hover:w-auto"
          }`}
      >
        {item.label}
      </span>
    </button>
  );

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
        onClick={onMobileClose}
        aria-hidden={!mobileOpen}
      />

      {/* Mobile slide-in panel */}
      <aside
        className={`fixed left-0 top-0 z-50 flex h-full w-[min(88vw,320px)] flex-col border-r border-white/10 bg-slate-950/95 p-5 shadow-2xl backdrop-blur-xl transition-transform duration-300 ease-out lg:hidden ${mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 overflow-hidden rounded-2xl border border-white/10 bg-slate-800">
              {profileImg ? (
                <img src={profileImg} alt={adminName} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center bg-indigo-600 font-bold">
                  {adminName.charAt(0)}
                </div>
              )}
            </div>
            <div>
              <p className="font-bold text-white">{adminName}</p>
              <p className="text-xs text-slate-400">{adminRole}</p>
            </div>
          </div>
          <Button
            type="button"
            onClick={onMobileClose}
            text={<X size={20} />}
            unstyled
            className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Close menu"
          />
        </div>

        <nav className="flex flex-1 flex-col gap-5">{items.map((item) => navButton(item, true))}</nav>

        <Button
          type="button"
          onClick={() => {
            onLogout();
            onMobileClose();
          }}
          text={
            <>
              <span className="grid h-9 w-9 place-items-center rounded-xl">
                <LogOut size={18} />
              </span>
              Logout
            </>
          }
          className="mt-4 flex h-11 items-center gap-3 bg-red-600/90 px-3 text-sm text-white hover:bg-red-600 active:scale-[0.98]"
        />
      </aside>

      {/* Desktop hover-expand sidebar */}
      <aside className="group fixed bottom-5 left-3 top-5 z-30 hidden w-[72px] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/80 p-3 shadow-2xl backdrop-blur-xl transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:w-64 lg:flex">
        <div className="mb-5 flex items-center gap-3 border-b border-white/10 pb-4">
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-slate-800">
            {profileImg ? (
              <img src={profileImg} alt={adminName} className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center bg-indigo-600 font-bold text-white">
                {adminName.charAt(0)}
              </div>
            )}
          </div>
          <div className="min-w-0 opacity-0 transition-all duration-500 group-hover:opacity-100">
            <p className="truncate font-bold text-white">{adminName}</p>
            <p className="truncate text-xs text-slate-400">{adminRole}</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-5">
          {items.map((item) => navButton(item, false))}
        </nav>

        <Button
          type="button"
          onClick={onLogout}
          title="Logout"
          text={
            <>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl">
                <LogOut size={18} />
              </span>
              <span className="whitespace-nowrap opacity-0 transition-all duration-500 group-hover:opacity-100">
                Logout
              </span>
            </>
          }
          className="mt-auto flex h-11 items-center gap-3 bg-red-600/90 px-1.5 text-sm text-white transition-all duration-300 hover:bg-red-600 hover:shadow-lg active:scale-[0.98]"
        />
      </aside>
    </>
  );
}
