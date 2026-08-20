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
        className={`cv-drop-zone relative mt-1 cursor-pointer rounded-xl border-2 border-dashed py-2.5 px-4 text-center transition-all duration-200 ${dragOver
            ? "border-cyan-400/70 bg-cyan-500/10 shadow-[0_0_20px_rgba(34,211,238,0.12)]"
            : fileName
              ? "border-emerald-500/40 bg-emerald-500/5"
              : "border-slate-700 bg-slate-900/60 hover:border-cyan-500/50 hover:bg-slate-900/80"
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

        <div className="flex items-center justify-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-slate-800 text-cyan-300">
            {fileName ? <FileText size={16} /> : <Upload size={16} />}
          </div>

          {fileName ? (
            <div className="text-left min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-emerald-300">{fileName}</p>
              <p className="text-[10px] text-slate-400">PDF attached · click to replace</p>
            </div>
          ) : (
            <div className="text-left">
              <p className="text-xs font-semibold text-white">
                Upload Resume (PDF, max 5MB)
              </p>
              <p className="text-[10px] text-slate-400">Drag &amp; drop or click to browse</p>
            </div>
          )}
        </div>

        {uploading && (
          <div className="mt-2">
            <div className="h-1 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-[width] duration-200 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1 text-[10px] text-slate-400">Uploading… {progress}%</p>
          </div>
        )}

        {fileName && !uploading && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            aria-label="Remove CV"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
