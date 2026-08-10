interface InputProps {
  type?: string;
  value?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  max?: string;
  className?: string;
  min?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  accept?: string;
}

export default function Input({
  type = "text",
  value,
  onChange,
  placeholder,
  max,
  min,
  className = "",
  onKeyDown,
  accept,
}: InputProps) {
  const baseStyle =
    "w-full rounded-2xl border border-slate-700/80 bg-slate-900/60 px-4 py-3 text-white placeholder:text-slate-500 outline-none transition-all focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 light:bg-slate-100 light:text-slate-900 light:border-slate-300";

  const finalClass = className ? `${baseStyle} ${className}` : baseStyle;

  return (
    <input
      type={type}
      value={value}
      max={max}
      min={min}
      className={finalClass}
      onChange={onChange}
      placeholder={placeholder}
      onKeyDown={onKeyDown}
      accept={accept}
    />
  );
}
