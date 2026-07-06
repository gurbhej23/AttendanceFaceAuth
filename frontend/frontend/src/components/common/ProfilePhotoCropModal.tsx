import {
  useCallback,
  useEffect,
  useRef,
  useState, 
  type SyntheticEvent,
} from "react";
import { RotateCcw, Save, X } from "lucide-react";
import ReactCrop, {
  centerCrop,
  convertToPixelCrop,
  makeAspectCrop,
  type Crop,
  type PixelCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import Button from "./Button";
import { clampPixelCrop, cropImageToBase64 } from "../../utils/cropImage";

interface Props {
  imageSrc: string;
  onCancel: () => void;
  onSave: (croppedBase64: string) => void | Promise<void>;
  saving?: boolean;
}

export default function ProfilePhotoCropModal({
  imageSrc,
  onCancel,
  onSave,
  saving = false,
}: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [previewSrc, setPreviewSrc] = useState("");
  const [zoom, setZoom] = useState(1);
  const [hasChanged, setHasChanged] = useState(false);

  const createCenteredCrop = useCallback((width: number, height: number) => {
    return centerCrop(
      makeAspectCrop({ unit: "%", width: 72 }, 1, width, height),
      width,
      height,
    );
  }, []);

  const updatePixelCrop = useCallback((pixelCrop: PixelCrop) => {
    const image = imgRef.current;
    if (!image) return;

    const clampedCrop = clampPixelCrop(pixelCrop, image);
    if (clampedCrop) setCompletedCrop(clampedCrop);
  }, []);

  const onImageLoad = useCallback((event: SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    requestAnimationFrame(() => {
      const width = img.offsetWidth;
      const height = img.offsetHeight;
      if (!width || !height) return;

      const centered = createCenteredCrop(width, height);
      setCrop(centered);
      setCompletedCrop(clampPixelCrop(convertToPixelCrop(centered, width, height), img) || undefined);
      setHasChanged(false);
    });
  }, [createCenteredCrop]);

  const resetCrop = useCallback(() => {
    const image = imgRef.current;
    if (!image) return;

    const width = image.offsetWidth;
    const height = image.offsetHeight;
    if (!width || !height) return;

    const centered = createCenteredCrop(width, height);
    setCrop(centered);
    setCompletedCrop(clampPixelCrop(convertToPixelCrop(centered, width, height), image) || undefined);
    setZoom(1);
    setHasChanged(false);
  }, [createCenteredCrop]);

  // const handleZoomChange = useCallback((nextZoom: number) => {
  //   const normalizedZoom = Math.min(Math.max(nextZoom, 1), 2.5);
  //   setZoom(normalizedZoom);
  //   setHasChanged(true);

  //   requestAnimationFrame(() => {
  //     const image = imgRef.current;
  //     if (!image || !crop?.width || !crop?.height) return;

  //     const { width, height } = image.getBoundingClientRect();
  //     if (!width || !height) return;

  //     updatePixelCrop(convertToPixelCrop(crop, width, height));
  //   });
  // }, [crop, updatePixelCrop]);

  useEffect(() => {
    const image = imgRef.current;
    if (!image || !completedCrop?.width || !completedCrop?.height) return;

    const nextPreview = cropImageToBase64(image, completedCrop, 0.9, 192);
    if (nextPreview) setPreviewSrc(nextPreview);
  }, [completedCrop]);

  const handleSave = async () => {
    const image = imgRef.current;
    if (!image) return;

    const width = image.offsetWidth;
    const height = image.offsetHeight;
    if (!width || !height) return;

    const pixelCrop =
      completedCrop ||
      (crop?.width && crop?.height
        ? convertToPixelCrop(crop, width, height)
        : undefined);
    if (!pixelCrop) return;

    const clampedCrop = clampPixelCrop(pixelCrop, image);
    if (!clampedCrop) return;

    const base64 = cropImageToBase64(image, clampedCrop, 0.92, 512);
    if (!base64) return;
    await onSave(base64);
  };

  return (
    <div
      className="crop-modal-overlay fixed inset-0 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm sm:p-5 w-full h-full"
      role="dialog"
      aria-modal="true"
      aria-labelledby="crop-modal-title"
    >
      <div className="crop-modal-card w-full rounded-3xl border border-slate-700/80 bg-slate-900 p-4 shadow-2xl sm:p-5">
        <div className="crop-modal-header mb-4 flex items-start justify-between gap-4">
          <div>
            <h2
              id="crop-modal-title"
              className="text-lg font-bold text-white sm:text-xl"
            >
              Adjust profile photo
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Position your face inside the guide for a clean avatar.
            </p>
          </div>
          <Button
            type="button"
            text={<X size={18} />}
            onClick={onCancel}
            disabled={saving}
            unstyled
            className="crop-modal-close grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
            aria-label="Cancel crop"
          />
        </div>

        <div className="crop-modal-workspace grid gap-4 lg:grid-cols-[minmax(0,1fr)_13rem]">
          <div className="crop-modal-canvas relative overflow-hidden rounded-2xl bg-slate-950">
            <ReactCrop
              crop={crop}
              aspect={1}
              circularCrop
              keepSelection
              minWidth={96}
              minHeight={96}
              className="crop-modal-react-crop"
              onChange={(pixelCrop, percentCrop) => {
                setCrop(percentCrop);
                updatePixelCrop(pixelCrop);
                setHasChanged(true);
              }}
              onComplete={updatePixelCrop}
            >
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Crop profile"
                onLoad={onImageLoad}
                className="crop-modal-image"
                style={{
                  width: `${zoom * 100}%`,
                  maxWidth: `${zoom * 100}%`,
                }}
              />
            </ReactCrop>
          </div>

          <aside className="crop-modal-preview-panel rounded-2xl border border-slate-700/70 bg-slate-950/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Preview
            </p>
            <div className="crop-modal-preview mx-auto mt-4 grid h-36 w-36 place-items-center overflow-hidden rounded-full border border-white/10 bg-slate-900 shadow-xl">
              {previewSrc ? (
                <img
                  src={previewSrc}
                  alt="Profile preview"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-xs font-medium text-slate-500">Loading</span>
              )}
            </div>
            <p className="mt-4 text-center text-xs leading-relaxed text-slate-400">
              This is the image that will be saved to your profile.
            </p>
          </aside>
        </div>

        {/* <div className="crop-modal-zoom mt-4 flex items-center gap-3 rounded-2xl border border-slate-700/70 bg-slate-950/50 px-4 py-3">
          <Minus size={16} className="shrink-0 text-slate-400" />
          <input
            type="range"
            min="1"
            max="2.5"
            step="0.01"
            value={zoom}
            onChange={(event) => handleZoomChange(Number(event.target.value))}
            className="crop-zoom-slider flex-1"
            aria-label="Zoom profile photo"
            style={{ "--zoom-pct": `${((zoom - 1) / 1.5) * 100}%` } as CSSProperties}
          />
          <Plus size={16} className="shrink-0 text-slate-400" />
        </div> */}

        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_1.2fr]">
          <Button
            text="Cancel"
            onClick={onCancel}
            disabled={saving}
            className="crop-modal-btn rounded-2xl border border-slate-600 bg-slate-800 py-3 font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50"
          />
          <Button
            text={
              <span className="inline-flex items-center justify-center gap-2">
                <RotateCcw size={16} />
                Reset
              </span>
            }
            onClick={resetCrop}
            disabled={saving}
            className="crop-modal-btn rounded-2xl border border-slate-600 bg-slate-800 py-3 font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50"
          />
          <Button
            text={
              <span className="inline-flex items-center justify-center gap-2">
                <Save size={16} />
                {saving ? "Saving..." : "Save Photo"}
              </span>
            }
            onClick={() => void handleSave()}
            disabled={saving || !hasChanged || !completedCrop?.width}
            className="crop-modal-btn rounded-2xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      </div>
    </div>
  );
}
