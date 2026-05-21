export function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = dataUrl;
  });
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/** Resize so longest side <= maxSide; returns canvas and scale factor vs original. */
export function resizeToCanvas(
  img: HTMLImageElement,
  maxSide: number
): { canvas: HTMLCanvasElement; scale: number; width: number; height: number } {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const tw = Math.round(w * scale);
  const th = Math.round(h * scale);
  const canvas = document.createElement("canvas");
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(img, 0, 0, tw, th);
  return { canvas, scale, width: tw, height: th };
}

export function lineLengthPx(line: { a: { x: number; y: number }; b: { x: number; y: number } }): number {
  const dx = line.b.x - line.a.x;
  const dy = line.b.y - line.a.y;
  return Math.hypot(dx, dy);
}

/** Compress data URL for API upload (max longest side, JPEG). */
export async function compressDataUrl(dataUrl: string, maxSide = 1280, quality = 0.85): Promise<string> {
  const img = await loadImageFromDataUrl(dataUrl);
  const { canvas } = resizeToCanvas(img, maxSide);
  return canvas.toDataURL("image/jpeg", quality);
}
