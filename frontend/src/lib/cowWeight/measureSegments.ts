import type { CowLines, LineSegment, Point2D } from "./types";
import { lineLengthPx } from "./imageUtils";
import { isMostlyHorizontal, isMostlyVertical, segmentLengthPx } from "./geometry2d";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function measureVerticalCm(px: number, r1: number): number {
  return round2(px * r1);
}

export function measureHorizontalCm(px: number, r2: number): number {
  return round2(px * r2);
}

export function measureSegmentCm(
  line: LineSegment,
  r1: number,
  r2: number
): number {
  const px = lineLengthPx(line);
  if (isMostlyVertical(line.a, line.b)) return measureVerticalCm(px, r1);
  if (isMostlyHorizontal(line.a, line.b)) return measureHorizontalCm(px, r2);
  const dx = Math.abs(line.b.x - line.a.x);
  const dy = Math.abs(line.b.y - line.a.y);
  return round2(Math.hypot(dx * r2, dy * r1));
}

export function dimensionsFromPlanDScale(
  lines: CowLines,
  r1: number,
  r2: number
): { chest_width_cm: number; body_length_cm: number } {
  return {
    chest_width_cm: measureSegmentCm(lines.chest, r1, r2),
    body_length_cm: measureSegmentCm(lines.length, r1, r2),
  };
}

export function measureHeightLineCm(
  a: Point2D,
  b: Point2D,
  r1: number
): number {
  return measureVerticalCm(segmentLengthPx(a, b), r1);
}
