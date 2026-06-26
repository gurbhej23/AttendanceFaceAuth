import { CheckCircle2, XCircle } from "lucide-react";

interface Props {
  message: string;
  ok?: boolean;
}

export default function Toast({ message, ok = true }: Props) {
  return (
    <div
      role="status"
      className={`profile-toast fixed right-4 top-4 z-[80] flex max-w-sm items-start gap-3 rounded-2xl border px-4 py-3.5 text-sm font-medium shadow-2xl backdrop-blur-md sm:right-6 sm:top-6 ${
        ok
          ? "border-emerald-500/35 bg-emerald-950/90 text-emerald-200"
          : "border-red-500/35 bg-red-950/90 text-red-200"
      }`}
    >
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
      ) : (
        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
      )}
      <span className="leading-relaxed">{message}</span>
    </div>
  );
}
