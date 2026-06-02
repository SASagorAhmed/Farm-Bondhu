import type { Canvas } from "fabric";
import { withExportViewport } from "./fabricViewport";

export function exportFabricPng(canvas: Canvas): string | null {
  try {
    return withExportViewport(canvas, () =>
      canvas.toDataURL({ format: "png", multiplier: 1, enableRetinaScaling: false }),
    );
  } catch {
    return null;
  }
}

export function exportFabricThumbnail(canvas: Canvas, maxSide = 320): string | null {
  try {
    return withExportViewport(canvas, () => {
      const w = canvas.width;
      const h = canvas.height;
      const longest = Math.max(w, h, 1);
      const multiplier = Math.min(maxSide / longest, 1);
      return canvas.toDataURL({ format: "png", multiplier, enableRetinaScaling: false });
    });
  } catch {
    return null;
  }
}
