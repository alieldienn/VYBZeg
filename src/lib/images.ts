import { LIMITS } from "./constants";

/** For file pickers: every image type, plus HEIC/HEIF files some devices don't label as images. */
export const IMAGE_ACCEPT = "image/*,.heic,.heif,.avif";

// Phones and Windows often leave HEIC files without a type, so the name is checked too.
const IMAGE_EXTENSION = /\.(jpe?g|jfif|png|gif|webp|avif|heic|heif|bmp|svg|ico|tiff?)$/i;
const HEIC_TYPE = /^image\/hei[cf](-sequence)?$/i;
const HEIC_EXTENSION = /\.hei[cf]$/i;

/** True when the file looks like a photo or picture of any kind. */
export function isImageFile(file: File) {
  return file.type.startsWith("image/") || (!file.type && IMAGE_EXTENSION.test(file.name));
}

function isHeic(file: File) {
  return HEIC_TYPE.test(file.type) || HEIC_EXTENSION.test(file.name);
}

/** Friendly check before using a picked file. Returns an error message, or null when it's fine. */
export function imageFileError(file: File) {
  if (!isImageFile(file)) return "That file isn't a photo. Pick an image file.";
  if (file.size > LIMITS.maxImageMB * 1024 * 1024) {
    return `That photo is too big. Please pick one under ${LIMITS.maxImageMB} MB.`;
  }
  return null;
}

/**
 * Makes a picked file something every browser can show: iPhone HEIC/HEIF
 * photos are turned into JPEGs (only Safari opens those natively). Other
 * files are returned as they are. The converter is only downloaded when needed.
 */
export async function toBrowserImage(file: File): Promise<File> {
  if (!isHeic(file)) return file;
  try {
    const { heicTo } = await import("heic-to/next");
    const jpeg = await heicTo({ blob: file, type: "image/jpeg", quality: 0.92 });
    return new File([jpeg], file.name.replace(HEIC_EXTENSION, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    throw new Error("We couldn't open this HEIC photo. Try exporting it as a JPG first.");
  }
}

/** Opens any image the browser understands. Some (like SVG) only open through an <img>. */
async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      // Pictures without their own size (some SVGs) get a sensible one.
      const width = img.naturalWidth || 1200;
      const height = img.naturalHeight || 1200;
      return { source: img, width, height, close: () => URL.revokeObjectURL(url) };
    } catch {
      URL.revokeObjectURL(url);
      throw new Error("Your browser can't open this photo format. Try a JPG or PNG.");
    }
  }
}

/**
 * Checks a picked file and redraws it as a JPEG in the browser before upload.
 * Redrawing shrinks big phone photos, fixes sideways photos, and strips hidden
 * metadata such as the GPS location where the photo was taken.
 * With `keepGif`, GIFs are kept as they are so their animation survives
 * (GIFs carry no camera or location data).
 * Throws an Error with a friendly message if the file can't be used.
 */
export async function prepareImage(
  file: File,
  {
    maxSide,
    square = false,
    quality = 0.85,
    keepGif = false,
  }: { maxSide: number; square?: boolean; quality?: number; keepGif?: boolean },
): Promise<Blob> {
  const problem = imageFileError(file);
  if (problem) throw new Error(problem);
  if (keepGif && file.type === "image/gif") return file;

  const image = await decode(await toBrowserImage(file));

  // Square photos are cropped from the centre (used for profile pictures).
  const side = Math.min(image.width, image.height);
  const sx = square ? (image.width - side) / 2 : 0;
  const sy = square ? (image.height - side) / 2 : 0;
  const sw = square ? side : image.width;
  const sh = square ? side : image.height;
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const width = Math.round(sw * scale);
  const height = Math.round(sh * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Couldn't process that photo. Please try another one.");
  // JPEGs have no see-through parts: give transparent PNGs, GIFs and SVGs a white background.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image.source, sx, sy, sw, sh, 0, 0, width, height);
  image.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("Couldn't process that photo. Please try another one.");
  return blob;
}
