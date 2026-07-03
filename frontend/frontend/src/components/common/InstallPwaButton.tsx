import { useEffect, useState } from "react";
import { Download } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPwaButton({ className = "" }: { className?: string }) {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!promptEvent) return null;

  return (
    <button
      type="button"
      onClick={async () => {
        await promptEvent.prompt();
        setPromptEvent(null);
      }}
      className={`inline-flex items-center gap-2 rounded-xl border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-200 transition hover:bg-blue-500/20 cursor-pointer ${className}`}
    >
      <Download className="h-3.5 w-3.5" />
      Install app
    </button>
  );
}
