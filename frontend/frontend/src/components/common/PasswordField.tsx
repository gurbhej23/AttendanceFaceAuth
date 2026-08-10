import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import Input from "./Input";

interface Props {
  label?: string;
  value: string;
  onChange: (e: any) => void;
  placeholder?: string;
  className?: string;
}

const fieldClass =
  "w-full rounded-2xl border border-slate-700/80 bg-slate-900/60 py-3 pl-4 pr-12 text-white outline-none transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] placeholder:text-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 light:bg-slate-100 light:text-slate-900 light:border-slate-300";

export default function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  className = "",
}: Props) {
  const [visible, setVisible] = useState(false);

  const inputContent = (
    <div className={`relative ${!label && className ? className : ""}`}>
      <Input
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={fieldClass}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-2 flex items-center justify-center rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );

  if (label) {
    return (
      <label className={`block text-sm text-slate-400 ${className}`}>
        {label}
        <div className="mt-2">{inputContent}</div>
      </label>
    );
  }

  return inputContent;
}
