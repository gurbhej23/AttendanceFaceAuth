import React, { useRef, useEffect } from "react";

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
}

export default function OtpInput({
  value,
  onChange,
  onComplete,
  disabled = false,
}: OtpInputProps) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const digits = Array.from({ length: 6 }, (_, i) => value[i] || "");

  useEffect(() => {
    // Focus first empty input or initial focus
    if (!disabled && inputsRef.current[0]) {
      const firstEmptyIndex = digits.findIndex((d) => !d);
      const targetIndex = firstEmptyIndex !== -1 ? firstEmptyIndex : 0;
      inputsRef.current[targetIndex]?.focus();
    }
  }, []);

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "");
    if (!val) return;

    const char = val[val.length - 1]; // take last entered digit
    const newDigits = [...digits];
    newDigits[index] = char;
    const nextValue = newDigits.join("").slice(0, 6);
    onChange(nextValue);

    if (nextValue.length === 6 && onComplete) {
      onComplete(nextValue);
    } else if (index < 5 && inputsRef.current[index + 1]) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const newDigits = [...digits];

      if (newDigits[index]) {
        newDigits[index] = "";
        onChange(newDigits.join(""));
      } else if (index > 0) {
        newDigits[index - 1] = "";
        onChange(newDigits.join(""));
        inputsRef.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasteData) {
      onChange(pasteData);
      if (pasteData.length === 6 && onComplete) {
        onComplete(pasteData);
      }
      const focusIndex = Math.min(pasteData.length, 5);
      inputsRef.current[focusIndex]?.focus();
    }
  };

  return (
    <div className="flex items-center justify-between gap-2 sm:gap-3">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            inputsRef.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          className={`h-14 w-12 sm:h-16 sm:w-14 rounded-2xl border text-center text-2xl font-bold tracking-tight outline-none transition-all duration-200 ${
            digit
              ? "border-violet-500 bg-violet-500/15 text-white shadow-lg shadow-violet-500/20"
              : "border-white/10 bg-slate-900/80 text-slate-200 focus:border-violet-400 focus:bg-slate-900 focus:shadow-lg focus:shadow-violet-500/10"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        />
      ))}
    </div>
  );
}
