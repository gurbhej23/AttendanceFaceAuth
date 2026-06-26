const EMPTY_CELL_MARKERS = new Set(["", "--", "-", "—", "—-"]);

/** True when a table cell holds a placeholder / unpopulated attendance value. */
export function isEmptyCellValue(value?: string | null): boolean {
  if (value == null) return true;
  return EMPTY_CELL_MARKERS.has(value.trim());
}

/** Muted token for inactive or pending table placeholders. */
export const DASH_CELL_EMPTY =
  "font-normal text-slate-500/80 tabular-nums";
