import type React from "react";

interface ButtonProps {
  text?: React.ReactNode;
  children?: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  title?: string;
  badgeCount?: number;
  "aria-label"?: string;
  loading?: boolean;
  /** Skip default rounded-2xl / font-semibold for icon-only or link-style buttons */
  unstyled?: boolean;
}

export default function Button({
  text,
  children,
  onClick,
  className = "",
  type = "button",
  disabled = false,
  title,
  badgeCount,
  "aria-label": ariaLabel,
  loading = false,
  unstyled = false,
}: ButtonProps) {
  const content = children ?? text;
  const isDisabled = disabled || loading;

  const baseClass = unstyled
    ? "cursor-pointer transition duration-200 disabled:cursor-not-allowed disabled:opacity-50"
    : "cursor-pointer rounded-2xl font-semibold transition duration-200 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      title={title}
      aria-label={ariaLabel}
      aria-busy={loading || undefined}
      className={`${baseClass} ${badgeCount != null && badgeCount > 0 ? "relative" : ""} ${className}`.trim()}
    >
      {loading ? (
        <span className="inline-flex items-center justify-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          {content}
        </span>
      ) : (
        content
      )}

      {badgeCount != null && badgeCount > 0 && (
        <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
          {badgeCount > 9 ? "9+" : badgeCount}
        </span>
      )}
    </button>
  );
}
