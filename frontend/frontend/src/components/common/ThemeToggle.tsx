import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

interface Props {
  className?: string;
  showLabel?: boolean;
  mobile?: boolean;
  variant?: "sidebar" | "fab";
}

export default function ThemeToggle({
  className = "",
  showLabel = false,
  mobile = false,
  variant = "sidebar",
}: Props) {
  const { isDark, toggleTheme } = useTheme();

  if (variant === "fab") {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`theme-floating-toggle fixed top-4 right-4 z-[60] flex h-11 w-11 items-center justify-center rounded-xl transition active:scale-95 sm:left-4 sm:right-auto ${className}`}
        aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
        title={isDark ? "Light theme" : "Dark theme"}
      >
        {isDark ? <Sun size={20} /> : <Moon size={20} />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`theme-toggle-btn flex shrink-0 items-center rounded-2xl transition ${
        mobile
          ? "h-12 w-full gap-3 px-1.5 text-sm font-semibold"
          : "mx-auto h-12 w-12 justify-center p-0 lg:group-hover/sidebar:h-12 lg:group-hover/sidebar:w-full lg:group-hover/sidebar:justify-start lg:group-hover/sidebar:gap-3 lg:group-hover/sidebar:px-1.5"
      } ${className}`}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Light theme" : "Dark theme"}
    >
      <span className="theme-toggle-icon flex h-12 w-12 min-h-12 min-w-12 shrink-0 items-center justify-center rounded-2xl">
        {isDark ? <Sun size={18} /> : <Moon size={18} />}
      </span>
      {showLabel && (
        <span
          className={`truncate ${
            mobile
              ? "block"
              : "hidden w-0 overflow-hidden lg:group-hover/sidebar:block lg:group-hover/sidebar:w-auto"
          }`}
        >
          {isDark ? "Light theme" : "Dark theme"}
        </span>
      )}
    </button>
  );
}
