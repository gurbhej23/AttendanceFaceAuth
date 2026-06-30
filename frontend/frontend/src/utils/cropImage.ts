import type { PixelCrop } from "react-image-crop";

function getDisplayedSize(image: HTMLImageElement) {
  const width = image.offsetWidth || image.clientWidth;
  const height = image.offsetHeight || image.clientHeight;
  return { width, height };
}

/**
 * Export the crop region exactly as shown in react-image-crop.
 * Uses layout size (offsetWidth/offsetHeight) so scale matches the on-screen crop.
 */
export function cropImageToBase64(
  image: HTMLImageElement,
  crop: PixelCrop,
  quality = 0.92,
): string | null {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx || !crop.width || !crop.height) return null;

  const { width: displayWidth, height: displayHeight } = getDisplayedSize(image);
  if (!displayWidth || !displayHeight) return null;

  const scaleX = image.naturalWidth / displayWidth;
  const scaleY = image.naturalHeight / displayHeight;

  const cropX = Math.round(crop.x * scaleX);
  const cropY = Math.round(crop.y * scaleY);
  const cropW = Math.round(crop.width * scaleX);
  const cropH = Math.round(crop.height * scaleY);

  canvas.width = cropW;
  canvas.height = cropH;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.drawImage(image, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

  return canvas.toDataURL("image/jpeg", quality);
}
