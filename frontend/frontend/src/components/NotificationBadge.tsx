interface Props {
  count: number;
  className?: string;
}

export default function NotificationBadge({ count, className = "" }: Props) {
  if (count <= 0) return null;
  return (
    <span
      className={`inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white ${className}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
