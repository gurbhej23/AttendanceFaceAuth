interface LoadingSkeletonProps {
  className?: string;
  variant?: "card" | "text" | "avatar" | "button";
}

export default function LoadingSkeleton({
  className = "",
  variant = "card",
}: LoadingSkeletonProps) {
  if (variant === "avatar") {
    return (
      <div className={`skeleton-shimmer h-12 w-12 rounded-full border border-white/5 ${className}`} />
    );
  }

  if (variant === "text") {
    return (
      <div className={`skeleton-shimmer h-4 w-full rounded-lg border border-white/5 ${className}`} />
    );
  }

  if (variant === "button") {
    return (
      <div className={`skeleton-shimmer h-10 w-28 rounded-xl border border-white/5 ${className}`} />
    );
  }

  return (
    <div
      className={`skeleton-shimmer min-h-[8rem] w-full rounded-3xl border border-white/10 p-5 ${className}`}
    />
  );
}
