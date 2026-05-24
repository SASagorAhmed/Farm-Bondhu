import type { BBox, LineSegment, Point2D } from "./types";
import { lineLengthPx } from "./imageUtils";

const REFERENCE_CM = 100;

function pt(x: number, y: number): Point2D {
  return { x, y };
}

/**
 * Plan C: detect a vertical edge band left/right of cow bbox as 1m stick proxy.
 * Returns reference line (top-bottom) or null.
 */
export function detectReferenceLine(
  canvas: HTMLCanvasElement,
  bbox: BBox
): LineSegment | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const w = canvas.width;
  const h = canvas.height;
  const data = ctx.getImageData(0, 0, w, h).data;
  const cowLeft = bbox.x;
  const cowRight = bbox.x + bbox.width;
  const y0 = Math.max(0, Math.floor(bbox.y));
  const y1 = Math.min(h - 1, Math.floor(bbox.y + bbox.height));

  const searchZones: Array<{ xStart: number; xEnd: number }> = [
    { xStart: Math.max(0, Math.floor(cowLeft - bbox.width * 0.35)), xEnd: Math.max(0, Math.floor(cowLeft - 2)) },
    { xStart: Math.min(w - 1, Math.floor(cowRight + 2)), xEnd: Math.min(w - 1, Math.floor(cowRight + bbox.width * 0.35)) },
  ];

  let bestScore = 0;
  let bestX = -1;

  for (const zone of searchZones) {
    if (zone.xEnd <= zone.xStart) continue;
    for (let x = zone.xStart; x <= zone.xEnd; x++) {
      let edge = 0;
      for (let y = y0 + 1; y < y1; y++) {
        const i = (y * w + x) * 4;
        const iPrev = ((y - 1) * w + x) * 4;
        const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        const lumPrev = data[iPrev] * 0.299 + data[iPrev + 1] * 0.587 + data[iPrev + 2] * 0.114;
        edge += Math.abs(lum - lumPrev);
      }
      if (edge > bestScore) {
        bestScore = edge;
        bestX = x;
      }
    }
  }

  if (bestX < 0 || bestScore < 500) return null;

  return {
    a: pt(bestX, y0),
    b: pt(bestX, y1),
  };
}

export function referenceCmDefault(): number {
  return REFERENCE_CM;
}

export function cmPerPixelFromReference(line: LineSegment, referenceCm = REFERENCE_CM): number {
  const px = lineLengthPx(line);
  if (px <= 0) return 0;
  return referenceCm / px;
}
