import { LogOut, X } from "lucide-react";
import Button from "./common/Button";
import ProfileAvatarImg from "./common/ProfileAvatarImg";

export interface AdminNavItem {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  badgeCount?: number;
  /** @deprecated Ignored — unified sidebar styling */
  tone?: string;
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

/** Uniform squircle — 48×48px, never shrinks */
const SQUIRCLE = "h-12 w-12 min-h-12 min-w-12 shrink-0 rounded-full";

function ProfileAvatar({
  adminName,
  profileImg,
}: {
  adminName: string;
  profileImg?: string;
}) {
  return (
    <div
      className={`${SQUIRCLE} overflow-hidden rounded-2xl border border-white/10 bg-slate-800`}
    >
      {profileImg ? (
        <ProfileAvatarImg src={profileImg} alt={adminName} />
      ) : (
        <div className="grid h-full w-full place-items-center bg-blue-600 text-sm font-bold text-white">
          {adminName.charAt(0)}
        </div>
      )}
    </div>
  );
}

function NavIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="pointer-events-none flex h-[18px] w-[18px] items-center justify-center [&>svg]:h-[18px] [&>svg]:w-[18px] [&>svg]:shrink-0">
      {children}
    </span>
  );
}

function NavBadge({ count }: { count: number }) {
  return (
    <span className="sidebar-nav-badge absolute -right-1.5 -top-1.5 z-10 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-slate-950">
      {count > 99 ? "99+" : count}
    </span>
  );
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
  const iconWellTone = (isActive: boolean) =>
    isActive
      ? "bg-blue-600/30 text-blue-100"
      : "bg-white/[0.04] text-slate-400 group-hover/item:bg-white/[0.08] group-hover/item:text-white";

  const navButton = (item: AdminNavItem, mobile: boolean) => {
    const isActive = Boolean(item.active);
    const hasBadge = item.badgeCount != null && item.badgeCount > 0;

    return (
      <button
        key={item.label}
        type="button"
        onClick={() => {
          item.onClick();
          onMobileClose();
        }}
        className={`sidebar-nav-item group/item flex shrink-0 items-center rounded-2xl ${
          mobile
            ? "h-12 w-full gap-3 px-1.5"
            : `mx-auto ${SQUIRCLE} justify-center p-0 lg:group-hover/sidebar:h-12 lg:group-hover/sidebar:w-full lg:group-hover/sidebar:justify-start lg:group-hover/sidebar:gap-3 lg:group-hover/sidebar:px-1.5`
        } ${
          isActive
            ? "sidebar-nav-item-active bg-blue-600/15 text-blue-100"
            : "text-slate-300 hover:bg-white/[0.07] hover:text-white"
        }`}
        title={item.label}
        aria-label={item.label}
        aria-current={isActive ? "page" : undefined}
      >
        <span
          className={`sidebar-nav-icon-box relative flex ${SQUIRCLE} items-center justify-center overflow-visible rounded-2xl ${iconWellTone(isActive)}`}
        >
          <NavIcon>{item.icon}</NavIcon>
          {hasBadge && <NavBadge count={item.badgeCount!} />}
        </span>
        <span
          className={`truncate text-xs font-semibold ${
            mobile
              ? "block min-w-0 flex-1 text-left"
              : "hidden w-0 overflow-hidden lg:group-hover/sidebar:block lg:group-hover/sidebar:w-auto lg:group-hover/sidebar:flex-1"
          }`}
        >
          {item.label}
        </span>
      </button>
    );
  };

  const logoutButton = (mobile: boolean) => (
    <button
      type="button"
      onClick={() => {
        onLogout();
        onMobileClose();
      }}
      title="Logout"
      aria-label="Logout"
      className={`sidebar-nav-logout flex shrink-0 items-center rounded-2xl text-red-200 hover:bg-red-500/10 ${
        mobile
          ? "h-12 w-full gap-3 px-1.5 text-sm font-semibold"
          : `mx-auto ${SQUIRCLE} justify-center p-0 lg:group-hover/sidebar:h-12 lg:group-hover/sidebar:w-full lg:group-hover/sidebar:justify-start lg:group-hover/sidebar:gap-3 lg:group-hover/sidebar:px-1.5`
      }`}
    >
      <span
        className={`sidebar-nav-icon-box flex items-center justify-center rounded-2xl bg-red-500/15 text-red-300 ${SQUIRCLE}`}
      >
        <LogOut size={18} className="shrink-0" />
      </span>
      <span
        className={`truncate text-sm font-semibold ${
          mobile
            ? "block"
            : "hidden w-0 overflow-hidden lg:group-hover/sidebar:block lg:group-hover/sidebar:w-auto"
        }`}
      >
        Logout
      </span>
    </button>
  );

  const railShell =
    "sidebar-rail flex h-screen flex-col items-center justify-between overflow-hidden py-4";

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm sidebar-transition lg:hidden ${
          mobileOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
        onClick={onMobileClose}
        aria-hidden={!mobileOpen}
      />

      <aside
        className={`${railShell} fixed left-0 top-0 z-50 w-[min(88vw,320px)] items-stretch border-r border-white/10 bg-slate-950 shadow-2xl backdrop-blur-xl sidebar-transition lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="sidebar-rail-top w-full shrink-0 px-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <ProfileAvatar adminName={adminName} profileImg={profileImg} />
              <div className="min-w-0">
                <p className="truncate font-bold text-white">{adminName}</p>
                <p className="truncate text-xs text-slate-400">{adminRole}</p>
              </div>
            </div>
            <Button
              type="button"
              onClick={onMobileClose}
              text={<X size={20} />}
              unstyled
              className={`flex ${SQUIRCLE} items-center justify-center rounded-xl p-0 text-slate-400 hover:bg-white/10 hover:text-white`}
              aria-label="Close menu"
            />
          </div>
        </div>

        <nav className="sidebar-rail-nav flex min-h-0 w-full flex-1 flex-col items-stretch justify-center gap-1.5 overflow-hidden px-3">
          {items.map((item) => navButton(item, true))}
        </nav>

        <div className="sidebar-rail-bottom w-full shrink-0 px-3">
          {logoutButton(true)}
        </div>
      </aside>

      <aside
        className={`${railShell} group/sidebar fixed left-3 top-0 z-30 hidden w-[72px] rounded-[28px] border border-white/10 bg-slate-950 shadow-2xl backdrop-blur-xl transition-[width] duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] hover:w-64 lg:flex`}
      >
        <div className="sidebar-rail-top flex w-full shrink-0 flex items-start gap-2 p-3 mb-4">
          <ProfileAvatar adminName={adminName} profileImg={profileImg} />
          <div className="hidden w-full min-w-0 px-1 text-center group-hover/sidebar:block">
            <p className="truncate text-sm font-bold text-white">{adminName}</p>
            <p className="truncate text-[11px] text-slate-400">{adminRole}</p>
          </div>
        </div>

        <nav className="sidebar-rail-nav flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-hidden px-2">
          {items.map((item) => navButton(item, false))}
        </nav>

        <div className="sidebar-rail-bottom w-full shrink-0 px-2">
          {logoutButton(false)}
        </div>
      </aside>
    </>
  );
}
