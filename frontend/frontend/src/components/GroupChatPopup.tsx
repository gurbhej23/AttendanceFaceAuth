import { Minus, Users, X } from "lucide-react";
import GroupChatSection from "./GroupChatSection";
import type { ChatGroup, Contact } from "../utils/chatHelpers";
import { getMediaUrl } from "../utils/chatHelpers";

interface Props {
  group: ChatGroup;
  employeeId: string;
  isStaffRole: boolean;
  allContacts: Contact[];
  onClose: () => void;
  onMinimize: () => void;
  minimized: boolean;
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
  refreshUnread,
  unreadByGroup,
}: Props) {
  if (minimized) {
    return (
      <div className="flex h-12 w-[220px] items-center gap-2 rounded-t-2xl border border-b-0 border-violet-700/40 bg-slate-900 px-3 shadow-lg">
        <button
          type="button"
          onClick={onMinimize}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
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
          <span className="truncate text-sm font-semibold text-white">
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
    <div className="flex h-[min(70vh,480px)] w-[min(calc(100vw-2rem),360px)] flex-col overflow-hidden rounded-t-2xl border border-b-0 border-violet-700/40 bg-slate-900 shadow-2xl shadow-black/50">
      <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-3">
        {group.group_img ? (
          <img
            src={getMediaUrl(group.group_img)}
            alt={group.group_name}
            className="h-9 w-9 rounded-full object-cover"
          />
        ) : (
          <div className="grid h-9 w-9 place-items-center rounded-full bg-violet-700 text-white">
            <Users className="h-4 w-4" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white">{group.group_name}</p>
          <p className="truncate text-xs text-slate-400">
            {group.member_count || group.members?.length || 0} members
          </p>
        </div>
        <button
          type="button"
          onClick={onMinimize}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
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
        />
      </div>
    </div>
  );
}
