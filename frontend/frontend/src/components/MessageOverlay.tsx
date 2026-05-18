interface MessageOverlayProps {
  title: string;
  message?: string;
  tone?: "info" | "success" | "error";
  loading?: boolean;
  onClose?: () => void;
}

export default function MessageOverlay({
  title,
  message,
  tone = "info",
  loading = false,
  onClose,
}: MessageOverlayProps) {
  const toneClass =
    tone === "success"
      ? "border-green-500/30 text-green-300"
      : tone === "error"
        ? "border-red-500/30 text-red-300"
        : "border-blue-500/30 text-blue-300";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-5">
      <div className={`w-full max-w-sm rounded-3xl border ${toneClass} bg-slate-950/95 p-7 text-center shadow-2xl`}>
        {loading && (
          <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-2 border-slate-700 border-t-blue-400" />
        )}
        <h2 className="text-2xl font-bold text-white">{title}</h2>
        {message && <p className="mt-3 text-sm leading-6 text-slate-300">{message}</p>}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="mt-6 w-full rounded-2xl bg-slate-800 px-5 py-3 font-semibold text-white transition hover:bg-slate-700"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}
