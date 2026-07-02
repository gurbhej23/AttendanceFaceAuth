import { useCallback, useRef, useState, type SyntheticEvent } from "react";
import ReactCrop, {
  centerCrop,
  convertToPixelCrop,
  makeAspectCrop,
  type Crop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import Button from "./Button";
import { cropImageToBase64 } from "../../utils/cropImage";

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

  const onImageLoad = useCallback((event: SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    requestAnimationFrame(() => {
      const width = img.offsetWidth;
      const height = img.offsetHeight;
      if (!width || !height) return;

      const centered = centerCrop(
        makeAspectCrop({ unit: "%", width: 78 }, 1, width, height),
        width,
        height,
      );
      setCrop(centered);
    });
  }, []);

  const handleSave = async () => {
    const image = imgRef.current;
    if (!image || !crop?.width || !crop?.height) return;

    const width = image.offsetWidth;
    const height = image.offsetHeight;
    if (!width || !height) return;

    const pixelCrop = convertToPixelCrop(crop, width, height);
    const base64 = cropImageToBase64(image, pixelCrop);
    if (!base64) return;
    await onSave(base64);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="crop-modal-title"
    >
      <div className="crop-modal-card w-full max-w-lg rounded-3xl border border-slate-700/80 bg-slate-900 px-5 pt-5 pb-8 shadow-2xl sm:px-6 sm:pt-6">
        <div className="mb-4">
          <h2
            id="crop-modal-title"
            className="text-lg font-bold text-white sm:text-xl"
          >
            Adjust profile photo
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Drag the circle to frame your face, then save.
          </p>
        </div>

        <div className="crop-modal-canvas relative overflow-hidden rounded-2xl bg-slate-950">
          <ReactCrop
            crop={crop}
            aspect={1}
            circularCrop
            keepSelection
            className="crop-modal-react-crop"
            onChange={(_, percentCrop) => setCrop(percentCrop)}
          >
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Crop profile"
              onLoad={onImageLoad}
              className="crop-modal-image"
            />
          </ReactCrop>
        </div>

        <div className="mt-6 flex gap-3">
          <Button
            text="Cancel"
            onClick={onCancel}
            disabled={saving}
            className="crop-modal-btn flex-1 rounded-2xl border border-slate-600 bg-slate-800 py-3 font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50"
          />
          <Button
            text={saving ? "Saving..." : "Crop & Save"}
            onClick={() => void handleSave()}
            disabled={saving || !crop?.width}
            className="crop-modal-btn flex-1 rounded-2xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      </div>
    </div>
  );
}
