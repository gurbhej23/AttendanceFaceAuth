import type { PixelCrop } from "react-image-crop";

function getDisplayedSize(image: HTMLImageElement) {
  const rect = image.getBoundingClientRect();
  const width = rect.width || image.offsetWidth || image.clientWidth;
  const height = rect.height || image.offsetHeight || image.clientHeight;
  return { width, height };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function clampPixelCrop(crop: PixelCrop, image: HTMLImageElement): PixelCrop | null {
  const { width: displayWidth, height: displayHeight } = getDisplayedSize(image);
  if (!displayWidth || !displayHeight || !crop.width || !crop.height) return null;

  const x = clamp(crop.x, 0, displayWidth);
  const y = clamp(crop.y, 0, displayHeight);
  const width = clamp(crop.width, 1, displayWidth - x);
  const height = clamp(crop.height, 1, displayHeight - y);

  if (width <= 0 || height <= 0) return null;

  return {
    unit: "px",
    x,
    y,
    width,
    height,
  };
}

/**
 * Export the crop region exactly as shown in react-image-crop.
 * Uses layout size (offsetWidth/offsetHeight) so scale matches the on-screen crop.
 */
export function cropImageToBase64(
  image: HTMLImageElement,
  crop: PixelCrop,
  quality = 0.92,
  outputSize = 512,
): string | null {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx || !crop.width || !crop.height) return null;

  const { width: displayWidth, height: displayHeight } = getDisplayedSize(image);
  if (!displayWidth || !displayHeight) return null;

  const scaleX = image.naturalWidth / displayWidth;
  const scaleY = image.naturalHeight / displayHeight;

  const sourceX = Math.round(clamp(crop.x * scaleX, 0, image.naturalWidth));
  const sourceY = Math.round(clamp(crop.y * scaleY, 0, image.naturalHeight));
  const sourceW = Math.round(
    clamp(crop.width * scaleX, 1, image.naturalWidth - sourceX),
  );
  const sourceH = Math.round(
    clamp(crop.height * scaleY, 1, image.naturalHeight - sourceY),
  );

  if (!sourceW || !sourceH) return null;

  const size = Math.max(128, outputSize);
  canvas.width = size;
  canvas.height = size;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.drawImage(image, sourceX, sourceY, sourceW, sourceH, 0, 0, size, size);

  return canvas.toDataURL("image/jpeg", quality);
}
