/**
 * 2D bbox / ground helpers for Plan D.
 */

import type { BBox, LineSegment, Point2D } from "./types";

export interface BBoxCorners {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export function bboxCorners(bbox: BBox): BBoxCorners {
  return {
    x1: bbox.x,
    y1: bbox.y,
    x2: bbox.x + bbox.width,
    y2: bbox.y + bbox.height,
  };
}

/** Bottom green bbox line = ground (hoof plane MVP). */
export function groundLineY(bbox: BBox): number {
  return bbox.y + bbox.height;
}

export function bboxMidX(bbox: BBox): number {
  return bbox.x + bbox.width / 2;
}

/** Full body height line: ground → top of bbox (L1/L2 display). */
export function heightLineFromBBox(bbox: BBox): LineSegment {
  const x = bboxMidX(bbox);
  const y2 = groundLineY(bbox);
  return {
    a: { x, y: y2 },
    b: { x, y: bbox.y },
  };
}

export function segmentLengthPx(a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.hypot(dx, dy);
}

export function isMostlyVertical(a: Point2D, b: Point2D): boolean {
  return Math.abs(b.y - a.y) >= Math.abs(b.x - a.x);
}

export function isMostlyHorizontal(a: Point2D, b: Point2D): boolean {
  return Math.abs(b.x - a.x) > Math.abs(b.y - a.y);
}
