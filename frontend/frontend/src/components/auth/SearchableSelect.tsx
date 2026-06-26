import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

interface Props {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
}

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
  const rootRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => opt.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <label className="block text-sm text-slate-300">
      {label}
      <div ref={rootRef} className="relative mt-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`flex w-full items-center gap-3 rounded-2xl border bg-slate-950/80 p-4 text-left text-white outline-none transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] ${
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

        {open && (
          <div className="search-select-menu absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
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
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pl-9 pr-3 text-sm text-white outline-none transition focus:border-blue-500"
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
                          setOpen(false);
                          setQuery("");
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
          </div>
        )}
      </div>
    </label>
  );
}
