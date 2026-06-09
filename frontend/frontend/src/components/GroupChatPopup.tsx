import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Minus,
  MoreVertical,
  Settings,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import GroupChatSection, {
  type GroupChatHeaderActions,
} from "./GroupChatSection";
import type { ChatGroup, Contact } from "../utils/chatHelpers";
import { getMediaUrl } from "../utils/chatHelpers";
import Button from "./Button";

interface Props {
  group: ChatGroup;
  employeeId: string;
  isStaffRole: boolean;
  allContacts: Contact[];
  onClose: () => void;
  onMinimize: () => void;
  minimized: boolean;
  fullScreen?: boolean;
  refreshUnread: () => void;
  unreadByGroup: Record<string, number>;
}

export default function GroupChatPopup({
  group,
  employeeId,
  isStaffRole,
  allContacts,
  onClose,
  onMinimize,
  minimized,
  fullScreen = false,
  refreshUnread,
  unreadByGroup,
}: Props) {
  const [headerActions, setHeaderActions] =
    useState<GroupChatHeaderActions | null>(null);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);

  useEffect(() => {
    const close = () => setShowHeaderMenu(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  if (minimized) {
    return (
      <div className="flex h-12 w-[220px] items-center gap-2 rounded-t-2xl border border-b-0 border-violet-700/40 bg-slate-900 px-3 shadow-lg">
        <button
          type="button"
          onClick={onMinimize}
          className="flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer"
        >
          {group.group_img ? (
            <img
              src={getMediaUrl(group.group_img)}
              alt={group.group_name}
              className="h-7 w-7 rounded-full object-cover"
            />
          ) : (
            <div className="grid h-7 w-7 place-items-center rounded-full bg-violet-700 text-white">
              <Users className="h-3.5 w-3.5" />
            </div>
          )}
          <span className="truncate text-sm font-semibold text-slate-300">
            {group.group_name}
          </span>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col overflow-hidden bg-slate-900 ${
        fullScreen
          ? "h-[100dvh] w-full"
          : "h-[min(70vh,480px)] w-[min(calc(100vw-1.5rem),360px)] rounded-2xl border border-b-0 border-violet-700/40 shadow-2xl shadow-black/50 sm:rounded-t-2xl"
      }`}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-800 px-3 py-3">
        {fullScreen && (
          <button
            type="button"
            onClick={onClose}
            className="-ml-1 shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
            title="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        {group.group_img ? (
          <img
            src={getMediaUrl(group.group_img)}
            alt={group.group_name}
            className="h-9 w-9 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-violet-700 text-white">
            <Users className="h-4 w-4" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white">{group.group_name}</p>
          <p className="truncate text-xs text-slate-400">
            {group.member_count || group.members?.length || 0} members
          </p>
        </div>
        {headerActions && (
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowHeaderMenu((v) => !v);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-white"
              aria-label="Group options"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {showHeaderMenu && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-9 z-50 w-44 overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowHeaderMenu(false);
                    headerActions.openMembers();
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-slate-300 text-left text-sm hover:bg-slate-800"
                >
                  <Users size={15} /> View members
                </button>
                {isStaffRole && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setShowHeaderMenu(false);
                        headerActions.openAddMembers();
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-green-500/10"
                    >
                      <UserPlus size={15} /> Add members
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowHeaderMenu(false);
                        headerActions.openManage();
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-slate-300 text-left text-sm hover:bg-slate-800"
                    >
                      <Settings size={15} /> Manage group
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
        {!fullScreen && (
          <>
            <Button
              text={<Minus className="h-4 w-4" />}
              type="button"
              onClick={onMinimize}
              className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
            />  
            <Button
              text={<X className="h-4 w-4" />}
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
            />
          </>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <GroupChatSection
          employeeId={employeeId}
          isStaffRole={isStaffRole}
          allContacts={allContacts}
          active
          embedded
          initialGroupId={group.id}
          unreadByGroup={unreadByGroup}
          onUnreadChange={refreshUnread}
          onRegisterHeaderActions={setHeaderActions}
        />
      </div>
    </div>
  );
}
