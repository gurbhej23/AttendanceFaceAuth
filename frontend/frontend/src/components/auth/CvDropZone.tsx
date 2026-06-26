import { useCallback, useRef, useState } from "react";
import { FileText, Upload, X } from "lucide-react";

interface Props {
  fileName: string;
  onFileReady: (dataUrl: string, name: string) => void;
  onClear: () => void;
  onError: (message: string) => void;
  isPdfFile: (file: File) => boolean;
  fileToDataUrl: (file: File) => Promise<string>;
}

export default function CvDropZone({
  fileName,
  onFileReady,
  onClear,
  onError,
  isPdfFile,
  fileToDataUrl,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const processFile = useCallback(
    async (file: File) => {
      if (!isPdfFile(file)) {
        onError("CV / Resume must be a PDF file");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        onError("CV file must be 5MB or smaller");
        return;
      }

      setUploading(true);
      setProgress(8);
      const tick = window.setInterval(() => {
        setProgress((p) => (p >= 88 ? p : p + 12));
      }, 80);

      try {
        const dataUrl = await fileToDataUrl(file);
        setProgress(100);
        onFileReady(dataUrl, file.name);
      } catch {
        onError("Could not read selected CV");
      } finally {
        window.clearInterval(tick);
        window.setTimeout(() => {
          setUploading(false);
          setProgress(0);
        }, 350);
      }
    },
    [fileToDataUrl, isPdfFile, onError, onFileReady],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void processFile(file);
  };

  return (
    <div className="block text-sm text-slate-300">
      CV / Resume *
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`cv-drop-zone relative mt-2 cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] ${
          dragOver
            ? "border-cyan-400/70 bg-cyan-500/10 shadow-[0_0_24px_rgba(34,211,238,0.12)]"
            : fileName
              ? "border-blue-500/40 bg-blue-500/5"
              : "border-slate-600 bg-slate-950/50 hover:border-slate-500 hover:bg-slate-900/60"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void processFile(file);
            e.target.value = "";
          }}
        />

        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-slate-900/80 text-blue-300">
          {fileName ? <FileText size={22} /> : <Upload size={22} />}
        </div>

        {fileName ? (
          <div className="space-y-1">
            <p className="truncate text-sm font-semibold text-white">{fileName}</p>
            <p className="text-xs text-slate-400">PDF attached · click or drop to replace</p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-sm font-medium text-white">
              Drag & drop your resume here
            </p>
            <p className="text-xs text-slate-400">or click to browse · PDF only, max 5MB</p>
          </div>
        )}

        {uploading && (
          <div className="mt-4">
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-linear-to-r from-blue-500 to-cyan-400 transition-[width] duration-200 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-400">Uploading… {progress}%</p>
          </div>
        )}

        {fileName && !uploading && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            aria-label="Remove CV"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
