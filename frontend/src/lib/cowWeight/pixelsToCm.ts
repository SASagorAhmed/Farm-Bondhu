import type { BBox, CowLines } from "./types";
import { lineLengthPx } from "./imageUtils";

/** Vertical chest line ↔ standing height (Plan B). */
export const ASSUMED_COW_HEIGHT_CM = 150;

/** Horizontal body length ↔ poll-to-rump span (Plan B). */
export const ASSUMED_BODY_LENGTH_CM = 150;

/** Typical L1–L2 span as fraction of bbox width (see proposeLines.ts). */
export const TYPICAL_LENGTH_SPAN_FRAC = 0.72;

export function computeCmPerPixel(
  referenceLine: { a: { x: number; y: number }; b: { x: number; y: number } },
  referenceCm: number
): number {
  const px = lineLengthPx(referenceLine);
  if (px <= 0) return 0;
  return referenceCm / px;
}

export function dimensionsFromLines(
  lines: CowLines,
  cmPerPixel: number
): { chest_width_cm: number; body_length_cm: number } {
  const chestPx = lineLengthPx(lines.chest);
  const lengthPx = lineLengthPx(lines.length);
  return {
    chest_width_cm: Math.round(chestPx * cmPerPixel * 100) / 100,
    body_length_cm: Math.round(lengthPx * cmPerPixel * 100) / 100,
  };
}

/** Plan B: vertical chest depth scaled by bbox height. */
export function cmPerPixelFromBBoxHeight(
  bboxHeightPx: number,
  assumedHeightCm = ASSUMED_COW_HEIGHT_CM
): number {
  if (bboxHeightPx <= 0) return 0;
  return assumedHeightCm / bboxHeightPx;
}

/** Plan B: horizontal length scaled by bbox width (expected line ~72% of width). */
export function cmPerPixelFromBBoxWidth(
  bboxWidthPx: number,
  assumedLengthCm = ASSUMED_BODY_LENGTH_CM,
  lengthSpanFrac = TYPICAL_LENGTH_SPAN_FRAC
): number {
  const spanPx = bboxWidthPx * lengthSpanFrac;
  if (spanPx <= 0) return 0;
  return assumedLengthCm / spanPx;
}

/** Plan B axis-aware: chest uses height scale, length uses width scale. */
export function dimensionsFromLinesPlanB(
  lines: CowLines,
  bbox: BBox
): {
  chest_width_cm: number;
  body_length_cm: number;
  chestCmPerPixel: number;
  lengthCmPerPixel: number;
} {
  const chestCmPerPixel = cmPerPixelFromBBoxHeight(bbox.height);
  const lengthCmPerPixel = cmPerPixelFromBBoxWidth(bbox.width);
  const chestPx = lineLengthPx(lines.chest);
  const lengthPx = lineLengthPx(lines.length);
  return {
    chest_width_cm: Math.round(chestPx * chestCmPerPixel * 100) / 100,
    body_length_cm: Math.round(lengthPx * lengthCmPerPixel * 100) / 100,
    chestCmPerPixel,
    lengthCmPerPixel,
  };
}

/** @deprecated Use cmPerPixelFromBBoxHeight — kept for callers expecting single bbox-height scale. */
export function estimateCmPerPixelFromBBox(bboxHeightPx: number, assumedHeightCm = ASSUMED_COW_HEIGHT_CM): number {
  return cmPerPixelFromBBoxHeight(bboxHeightPx, assumedHeightCm);
}
