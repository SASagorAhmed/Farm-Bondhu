import exifr from "exifr";

export interface PhotoExifMeta {
  focalLengthMm?: number | null;
  focalLength35mm?: number | null;
  imageWidth?: number;
  imageHeight?: number;
}

/** Read focal length and dimensions from a camera/gallery JPEG when available. */
export async function parseExifFromFile(file: File): Promise<PhotoExifMeta | null> {
  try {
    const parsed = await exifr.parse(file, {
      pick: ["FocalLength", "FocalLengthIn35mmFormat", "ImageWidth", "ImageHeight", "ExifImageWidth", "ExifImageHeight"],
    });
    if (!parsed || typeof parsed !== "object") return null;

    const focalLengthMm = toPositiveNumber(parsed.FocalLength);
    const focalLength35mm = toPositiveNumber(parsed.FocalLengthIn35mmFormat);
    const imageWidth =
      toPositiveNumber(parsed.ExifImageWidth) ?? toPositiveNumber(parsed.ImageWidth) ?? undefined;
    const imageHeight =
      toPositiveNumber(parsed.ExifImageHeight) ?? toPositiveNumber(parsed.ImageHeight) ?? undefined;

    if (focalLengthMm == null && focalLength35mm == null && imageWidth == null) return null;

    return { focalLengthMm, focalLength35mm, imageWidth, imageHeight };
  } catch {
    return null;
  }
}

function toPositiveNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}
