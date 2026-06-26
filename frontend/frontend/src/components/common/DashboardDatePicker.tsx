import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  max?: string;
  placeholder?: string;
  className?: string;
  compact?: boolean;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const PANEL_MIN_WIDTH = 280;
const PANEL_EST_HEIGHT = 340;
const VIEWPORT_PAD = 12;

const parseYmd = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const formatYmd = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const formatDisplay = (ymd: string) => {
  if (!ymd) return "Select date";
  return parseYmd(ymd).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const monthLabel = (year: number, month: number) =>
  new Date(year, month, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

type PanelPos = { top: number; left: number; width: number };

export default function DashboardDatePicker({
  value,
  onChange,
  max,
  placeholder = "Select date",
  className = "",
  compact = false,
}: Props) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [pulseKey, setPulseKey] = useState<string | null>(null);
  const [panelPos, setPanelPos] = useState<PanelPos>({
    top: 0,
    left: 0,
    width: PANEL_MIN_WIDTH,
  });

  const selected = value ? parseYmd(value) : null;
  const maxDate = max ? parseYmd(max) : null;

  const [viewYear, setViewYear] = useState(
    () => selected?.getFullYear() ?? new Date().getFullYear(),
  );
  const [viewMonth, setViewMonth] = useState(
    () => selected?.getMonth() ?? new Date().getMonth(),
  );

  const updatePanelPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const width = Math.max(rect.width, PANEL_MIN_WIDTH);
    let left = rect.left;
    let top = rect.bottom + 8;

    if (left + width > window.innerWidth - VIEWPORT_PAD) {
      left = window.innerWidth - width - VIEWPORT_PAD;
    }
    left = Math.max(VIEWPORT_PAD, left);

    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow < PANEL_EST_HEIGHT && rect.top > PANEL_EST_HEIGHT) {
      top = rect.top - PANEL_EST_HEIGHT - 8;
    }

    setPanelPos({ top, left, width });
  }, []);

  const openPanel = useCallback(() => {
    if (selected) {
      setViewYear(selected.getFullYear());
      setViewMonth(selected.getMonth());
    }
    setOpen(true);
    requestAnimationFrame(() => {
      updatePanelPosition();
      setVisible(true);
    });
  }, [selected, updatePanelPosition]);

  const closePanel = useCallback(() => {
    setVisible(false);
    window.setTimeout(() => setOpen(false), 200);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePanelPosition();
  }, [open, updatePanelPosition]);

  useEffect(() => {
    if (!open) return;

    const onReposition = () => updatePanelPosition();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);

    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, updatePanelPosition]);

  useEffect(() => {
    if (!open) return;

    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      closePanel();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanel();
    };

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [closePanel, open]);

  const cells = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const items: Array<{ key: string; day: number | null; ymd: string | null }> =
      [];

    for (let i = 0; i < startPad; i++) {
      items.push({ key: `pad-${i}`, day: null, ymd: null });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const ymd = formatYmd(new Date(viewYear, viewMonth, day));
      items.push({ key: ymd, day, ymd });
    }
    return items;
  }, [viewMonth, viewYear]);

  const isDisabled = (ymd: string) => {
    if (!maxDate) return false;
    return parseYmd(ymd).getTime() > maxDate.getTime();
  };

  const goMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const selectDay = (ymd: string) => {
    if (isDisabled(ymd)) return;
    onChange(ymd);
    setPulseKey(ymd);
    window.setTimeout(() => setPulseKey(null), 280);
    closePanel();
  };

  const panel =
    open &&
    createPortal(
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Choose date"
        style={{
          top: panelPos.top,
          left: panelPos.left,
          width: panelPos.width,
        }}
        className={`date-picker-panel date-picker-panel-portal fixed z-[85] rounded-2xl border border-slate-700 bg-slate-950 p-4 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.85)] ${
          visible ? "date-picker-panel-visible" : ""
        }`}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => goMonth(-1)}
            className="date-picker-nav rounded-xl border border-slate-700 bg-slate-800 p-2 text-slate-300 hover:border-slate-600 hover:text-white"
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <p className="text-sm font-semibold text-white">
            {monthLabel(viewYear, viewMonth)}
          </p>
          <button
            type="button"
            onClick={() => goMonth(1)}
            className="date-picker-nav rounded-xl border border-slate-700 bg-slate-800 p-2 text-slate-300 hover:border-slate-600 hover:text-white"
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="mb-1 grid grid-cols-7 gap-1">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map(({ key, day, ymd }) => {
            if (day === null || !ymd) {
              return <div key={key} className="aspect-square" aria-hidden />;
            }

            const selectedDay = value === ymd;
            const disabled = isDisabled(ymd);
            const todayYmd = formatYmd(new Date());
            const isToday = ymd === todayYmd;

            return (
              <button
                key={key}
                type="button"
                disabled={disabled}
                onClick={() => selectDay(ymd)}
                className={`date-picker-day aspect-square rounded-xl text-sm font-medium transition-colors duration-150 ${
                  disabled
                    ? "cursor-not-allowed text-slate-600"
                    : "text-slate-200 hover:bg-slate-800"
                } ${
                  selectedDay
                    ? `bg-blue-600 text-white hover:bg-blue-500 ${pulseKey === ymd ? "date-picker-day-pulse" : ""}`
                    : isToday
                      ? "border border-blue-500/40 text-blue-200"
                      : ""
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>,
      document.body,
    );

  return (
    <div ref={triggerRef} className={className}>
      <button
        type="button"
        onClick={() => (open ? closePanel() : openPanel())}
        className={`dash-date-shell dash-squircle flex w-full items-center gap-2 border border-slate-700 bg-slate-900 text-left text-white outline-none transition-colors hover:border-slate-600 focus-visible:border-blue-500 focus-visible:shadow-[0_0_0_3px_rgba(59,130,246,0.15)] sm:gap-3 ${
          compact ? "py-2 pl-2.5 pr-3" : "gap-3 p-4"
        } ${open ? "border-blue-500/60 ring-1 ring-blue-500/25" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <CalendarDays
          size={compact ? 16 : 18}
          className="shrink-0 text-slate-400"
        />
        <span
          className={`min-w-0 flex-1 truncate ${compact ? "text-xs sm:text-sm" : "text-sm sm:text-base"}`}
        >
          {value ? formatDisplay(value) : placeholder}
        </span>
      </button>
      {panel}
    </div>
  );
}
