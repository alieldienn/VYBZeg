import { LIMITS } from "./constants";

/**
 * Checks a picked file and redraws it as a JPEG in the browser before upload.
 * Redrawing shrinks big phone photos, fixes sideways photos, and strips hidden
 * metadata such as the GPS location where the photo was taken.
 * Throws an Error with a friendly message if the file can't be used.
 */
export async function prepareImage(
  file: File,
  { maxSide, square = false, quality = 0.85 }: { maxSide: number; square?: boolean; quality?: number },
): Promise<Blob> {
  if (!file.type.startsWith("image/")) {
    throw new Error("That file isn't a photo. Try a JPG, PNG or WebP image.");
  }
  if (file.size > LIMITS.maxImageMB * 1024 * 1024) {
    throw new Error(`That photo is too big. Please pick one under ${LIMITS.maxImageMB} MB.`);
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Your browser can't open this photo format. Try a JPG or PNG.");
  }

  // Square photos are cropped from the centre (used for profile pictures).
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = square ? (bitmap.width - side) / 2 : 0;
  const sy = square ? (bitmap.height - side) / 2 : 0;
  const sw = square ? side : bitmap.width;
  const sh = square ? side : bitmap.height;
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const width = Math.round(sw * scale);
  const height = Math.round(sh * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Couldn't process that photo. Please try another one.");
  context.drawImage(bitmap, sx, sy, sw, sh, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("Couldn't process that photo. Please try another one.");
  return blob;
}
