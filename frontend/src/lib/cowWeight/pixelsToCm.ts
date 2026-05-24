import { isStandoffInOptimalBand, standoffHeightMultiplier } from "./cowWeightResearch";
import type { BBox, CowLines } from "./types";
import { lineLengthPx } from "./imageUtils";
import { dimensionsFromPlanDScale } from "./measureSegments";

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

/** Adjust assumed standing height when camera standoff is outside optimal band (±8% max). */
export function assumedHeightCmForStandoff(
  baseCm = ASSUMED_COW_HEIGHT_CM,
  standoffM?: number | null
): { heightCm: number; adjusted: boolean } {
  if (standoffM == null || standoffM <= 0 || isStandoffInOptimalBand(standoffM)) {
    return { heightCm: baseCm, adjusted: false };
  }
  const mult = standoffHeightMultiplier(standoffM);
  return { heightCm: Math.round(baseCm * mult * 100) / 100, adjusted: mult !== 1 };
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
  bbox: BBox,
  standoffM?: number | null
): {
  chest_width_cm: number;
  body_length_cm: number;
  chestCmPerPixel: number;
  lengthCmPerPixel: number;
  scaleAdjustedForDistance: boolean;
} {
  const { heightCm, adjusted } = assumedHeightCmForStandoff(ASSUMED_COW_HEIGHT_CM, standoffM);
  const chestCmPerPixel = cmPerPixelFromBBoxHeight(bbox.height, heightCm);
  const lengthCmPerPixel = cmPerPixelFromBBoxWidth(bbox.width);
  const chestPx = lineLengthPx(lines.chest);
  const lengthPx = lineLengthPx(lines.length);
  return {
    chest_width_cm: Math.round(chestPx * chestCmPerPixel * 100) / 100,
    body_length_cm: Math.round(lengthPx * lengthCmPerPixel * 100) / 100,
    chestCmPerPixel,
    lengthCmPerPixel,
    scaleAdjustedForDistance: adjusted,
  };
}

/** @deprecated Use cmPerPixelFromBBoxHeight — kept for callers expecting single bbox-height scale. */
export function estimateCmPerPixelFromBBox(bboxHeightPx: number, assumedHeightCm = ASSUMED_COW_HEIGHT_CM): number {
  return cmPerPixelFromBBoxHeight(bboxHeightPx, assumedHeightCm);
}

/** Plan D: axis-aware cm from dynamic r1 (vertical/chest) and r2 (horizontal/length). */
export function dimensionsFromLinesPlanD(
  lines: CowLines,
  r1: number,
  r2: number
): { chest_width_cm: number; body_length_cm: number } {
  return dimensionsFromPlanDScale(lines, r1, r2);
}
