import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import Input from "./Input";

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const fieldClass =
  "w-full rounded-2xl border border-slate-700 bg-slate-950 py-3 pl-4 pr-12 text-white outline-none transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] placeholder:text-slate-500 focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)]";

export default function PasswordField({
  label,
  value,
  onChange,
  placeholder,
}: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="block text-sm text-slate-400">
      {label}
      <div className="relative mt-2">
        <Input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
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
    </label>
  );
}
