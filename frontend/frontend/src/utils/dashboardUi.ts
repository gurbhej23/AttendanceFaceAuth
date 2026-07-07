const EMPTY_CELL_MARKERS = new Set(["", "--", "-", "—", "—-"]);

/** True when a table cell holds a placeholder / unpopulated attendance value. */
export function isEmptyCellValue(value?: string | null): boolean {
  if (value == null) return true;
  return EMPTY_CELL_MARKERS.has(value.trim());
}

/** Muted token for inactive or pending table placeholders. */
export const DASH_CELL_EMPTY =
  "font-normal text-slate-500/80 tabular-nums";

export function getAttendanceStatusLabel(status?: string | null): string {
  const normalized = (status || "").trim().toLowerCase();

  switch (normalized) {
    case "present":
      return "Present";
    case "late":
      return "Late";
    case "absent":
      return "Absent";
    case "half_day":
    case "half day":
      return "Half Day";
    case "leave":
    case "leave_approved":
      return "Leave";
    case "leave_pending":
      return "Leave Pending";
    case "leave_rejected":
      return "Leave Rejected";
    case "not_marked":
      return "Not Marked";
    default:
      return normalized
        ? normalized
            .split(/[_\s]+/)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(" ")
        : "Not Marked";
  }
}

export function getAttendanceStatusTextClass(status?: string | null): string {
  const normalized = (status || "").trim().toLowerCase();

  switch (normalized) {
    case "present":
      return "text-green-500";
    case "late":
      return "text-yellow-500";
    case "absent":
      return "text-red-500";
    case "half_day":
    case "half day":
      return "text-orange-500";
    case "leave":
    case "leave_approved":
      return "text-purple-500";
    case "leave_pending":
      return "text-slate-500";
    case "leave_rejected":
      return "text-red-500";
    case "not_marked":
      return "text-slate-400";
    default:
      return "text-slate-500";
  }
}
