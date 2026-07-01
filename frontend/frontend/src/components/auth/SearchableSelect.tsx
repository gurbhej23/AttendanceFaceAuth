import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";

interface Props {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
}

const PANEL_EST_HEIGHT = 280;
const VIEWPORT_PAD = 12;

type PanelPos = { top: number; left: number; width: number };

export default function SearchableSelect({
  label,
  value,
  options,
  onChange,
  placeholder = "Search...",
  icon,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos] = useState<PanelPos>({
    top: 0,
    left: 0,
    width: 280,
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => opt.toLowerCase().includes(q));
  }, [options, query]);

  const updatePanelPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const width = rect.width;
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

  const closeMenu = useCallback(() => {
    setOpen(false);
    setQuery("");
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
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      closeMenu();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [closeMenu]);

  const panel =
    open &&
    createPortal(
      <div
        ref={panelRef}
        style={{
          top: panelPos.top,
          left: panelPos.left,
          width: panelPos.width,
        }}
        className="search-select-menu search-select-menu-portal fixed z-[110] overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
      >
        <div className="border-b border-slate-700/80 p-3">
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="search-select-input w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pl-9 pr-3 text-sm text-white outline-none transition focus:border-blue-500"
              autoFocus
            />
          </div>
        </div>
        <ul className="max-h-52 overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <li className="px-3 py-4 text-center text-sm text-slate-500">
              No matches found
            </li>
          ) : (
            filtered.map((opt) => {
              const selected = opt === value;
              return (
                <li key={opt}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(opt);
                      closeMenu();
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors duration-200 ${
                      selected
                        ? "bg-blue-500/15 text-blue-200"
                        : "text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <span className="truncate">{opt}</span>
                    {selected && <Check size={16} className="shrink-0" />}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>,
      document.body,
    );

  return (
    <label className="search-select-field block min-w-0 text-sm text-slate-300">
      {label}
      <div ref={triggerRef} className="relative mt-2 min-w-0">
        <button
          type="button"
          onClick={() => {
            if (open) {
              closeMenu();
              return;
            }
            setOpen(true);
            requestAnimationFrame(updatePanelPosition);
          }}
          className={`search-select-trigger flex w-full min-w-0 items-center gap-3 rounded-2xl border bg-slate-950/80 p-4 text-left text-white outline-none transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] ${
            open
              ? "border-blue-500 shadow-[0_0_0_3px_rgba(59,130,246,0.15)]"
              : "border-slate-700 hover:border-slate-600"
          }`}
        >
          {icon && <span className="shrink-0 text-slate-400">{icon}</span>}
          <span className="min-w-0 flex-1 truncate">{value}</span>
          <ChevronDown
            size={18}
            className={`shrink-0 text-slate-400 transition-transform duration-300 ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>
        {panel}
      </div>
    </label>
  );
}
