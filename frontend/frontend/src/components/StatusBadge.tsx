interface BadgeProps {
  status: string;
}

export default function StatusBadge({ status }: BadgeProps) {
  const statusColor = (status: string) => {
    switch (status) {
      case "present":
        return "bg-green-500/20 text-green-300";
      case "late":
        return "bg-yellow-500/20 text-yellow-300";
      case "half_day":
        return "bg-orange-500/20 text-orange-300";
      case "absent":
        return "bg-red-500/20 text-red-300";
      case "resign":
        return "bg-gray-500/20 text-gray-300";
      default:
        return "bg-slate-500/20 text-slate-300";
    }
  };

  return (
    <span 
      className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColor(status)}`}
    >
      {status.replace("_", " ").toUpperCase()}
    </span>
  )
}
