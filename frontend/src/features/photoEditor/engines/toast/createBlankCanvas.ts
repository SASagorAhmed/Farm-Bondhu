/** Build a solid-color PNG data URL at exact export dimensions (not 1×1). */
export function createBlankCanvasDataUrl(
  width: number,
  height: number,
  backgroundColor = "#ffffff",
): string {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  }
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, w, h);
  return canvas.toDataURL("image/png");
}
