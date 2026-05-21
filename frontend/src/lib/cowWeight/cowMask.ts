import type { BBox, Point2D } from "./types";

/** Binary cow mask in full image coordinates. */
export interface CowBodyMask {
  data: Uint8Array;
  width: number;
  height: number;
}

export function createEmptyMask(width: number, height: number): CowBodyMask {
  return { data: new Uint8Array(width * height), width, height };
}

function maskIdx(mask: CowBodyMask, x: number, y: number): number {
  return y * mask.width + x;
}

function maskGet(mask: CowBodyMask, x: number, y: number): 0 | 1 {
  if (x < 0 || y < 0 || x >= mask.width || y >= mask.height) return 0;
  return mask.data[maskIdx(mask, x, y)] ? 1 : 0;
}

function maskSet(mask: CowBodyMask, x: number, y: number, v: 0 | 1) {
  if (x < 0 || y < 0 || x >= mask.width || y >= mask.height) return;
  mask.data[maskIdx(mask, x, y)] = v;
}

export function maskAt(mask: CowBodyMask, x: number, y: number): boolean {
  return maskGet(mask, Math.round(x), Math.round(y)) === 1;
}

/** Horizontal extent of mask on row y (image coords). */
export function maskRowExtent(mask: CowBodyMask, y: number): { left: number; right: number } | null {
  const iy = Math.round(y);
  if (iy < 0 || iy >= mask.height) return null;
  let left = -1;
  let right = -1;
  const off = iy * mask.width;
  for (let x = 0; x < mask.width; x++) {
    if (mask.data[off + x]) {
      if (left < 0) left = x;
      right = x;
    }
  }
  if (left < 0) return null;
  return { left, right };
}

const BAND_CENTROID_MARGIN = 0.03;
const MIN_BAND_PIXELS = 12;

/** Mask pixel centroid X in a vertical band (fractions of bbox height). */
export function maskBandCentroidX(
  mask: CowBodyMask,
  bbox: BBox,
  yStartFrac: number,
  yEndFrac: number
): number | null {
  const { x0, y0, x1, y1 } = bboxBounds(bbox, mask);
  const yBand0 = Math.max(y0, Math.floor(bbox.y + bbox.height * yStartFrac));
  const yBand1 = Math.min(y1, Math.floor(bbox.y + bbox.height * yEndFrac));
  let sumX = 0;
  let n = 0;
  for (let y = yBand0; y <= yBand1; y++) {
    const off = y * mask.width;
    for (let x = x0; x <= x1; x++) {
      if (mask.data[off + x]) {
        sumX += x;
        n++;
      }
    }
  }
  if (n < MIN_BAND_PIXELS) return null;
  return sumX / n;
}

function imageSideFromCentroidX(cx: number, bbox: BBox): "left" | "right" | "unknown" {
  const center = bbox.x + bbox.width / 2;
  const margin = bbox.width * BAND_CENTROID_MARGIN;
  if (cx < center - margin) return "left";
  if (cx > center + margin) return "right";
  return "unknown";
}

/** Narrow head band (forehead/neck only — avoids shoulder bulk). */
export const MASK_HEAD_BAND_Y0 = 0.05;
export const MASK_HEAD_BAND_Y1 = 0.22;
/** Hindquarters / rump band. */
export const MASK_TAIL_BAND_Y0 = 0.68;
export const MASK_TAIL_BAND_Y1 = 0.92;
/** Shoulder–belly torso (excludes narrow head/tail). */
export const MASK_TORSO_BAND_Y0 = 0.28;
export const MASK_TORSO_BAND_Y1 = 0.58;

const THIRDS_MIN_PIXELS = 20;

function tailSideFromMaskBandThirds(
  mask: CowBodyMask,
  bbox: BBox,
  yStartFrac: number,
  yEndFrac: number,
  outerWedgesOnly = false,
  wedgeLeftFrac = 0.28,
  wedgeRightFrac = 0.72
): "left" | "right" | "unknown" {
  const y0 = Math.floor(bbox.y + bbox.height * yStartFrac);
  const y1 = Math.floor(bbox.y + bbox.height * yEndFrac);
  const x0 = Math.max(0, Math.floor(bbox.x));
  const x1 = Math.min(mask.width - 1, Math.floor(bbox.x + bbox.width));
  const xLeft = outerWedgesOnly
    ? bbox.x + bbox.width * wedgeLeftFrac
    : bbox.x + bbox.width / 3;
  const xRight = outerWedgesOnly
    ? bbox.x + bbox.width * wedgeRightFrac
    : bbox.x + (2 * bbox.width) / 3;
  let leftCount = 0;
  let rightCount = 0;
  for (let y = y0; y <= y1; y++) {
    const off = y * mask.width;
    for (let x = x0; x <= x1; x++) {
      if (!mask.data[off + x]) continue;
      if (x < xLeft) leftCount++;
      else if (x > xRight) rightCount++;
    }
  }
  if (leftCount > rightCount + THIRDS_MIN_PIXELS && leftCount > THIRDS_MIN_PIXELS) {
    return "left";
  }
  if (rightCount > leftCount + THIRDS_MIN_PIXELS && rightCount > THIRDS_MIN_PIXELS) {
    return "right";
  }
  return "unknown";
}

/** True when the mask spans nearly the full bbox width (YOLO seg — edge reach is unreliable). */
export function maskSpansFullBboxWidth(mask: CowBodyMask, bbox: BBox): boolean {
  const yMid = Math.floor(bbox.y + bbox.height * 0.5);
  const ext = maskRowExtent(mask, yMid);
  if (!ext) return false;
  return ext.right - ext.left >= bbox.width * 0.82;
}

/** Tail side from mask hind band centroid (can bias toward body center). */
export function tailSideFromMaskCentroid(
  mask: CowBodyMask,
  bbox: BBox
): "left" | "right" | "unknown" {
  const tailCx = maskBandCentroidX(mask, bbox, MASK_TAIL_BAND_Y0, MASK_TAIL_BAND_Y1);
  if (tailCx === null) return "unknown";
  return imageSideFromCentroidX(tailCx, bbox);
}

/**
 * Tail/rear side from hind-band protrusion toward bbox edges (preferred over centroid).
 * Cow facing right → rump closer to left edge → tail left.
 */
export function tailSideFromMaskHindExtremity(
  mask: CowBodyMask,
  bbox: BBox
): "left" | "right" | "unknown" {
  const y0 = Math.floor(bbox.y + bbox.height * MASK_TAIL_BAND_Y0);
  const y1 = Math.floor(bbox.y + bbox.height * MASK_TAIL_BAND_Y1);
  let leftMost = Infinity;
  let rightMost = -Infinity;
  let found = false;
  for (let y = y0; y <= y1; y++) {
    const ext = maskRowExtent(mask, y);
    if (!ext) continue;
    found = true;
    leftMost = Math.min(leftMost, ext.left);
    rightMost = Math.max(rightMost, ext.right);
  }
  if (!found) return "unknown";
  const distLeft = leftMost - bbox.x;
  const distRight = bbox.x + bbox.width - rightMost;
  const tie = bbox.width * 0.02;
  if (Math.abs(distLeft - distRight) < tie) return "unknown";
  return distLeft < distRight ? "left" : "right";
}

/**
 * Tail side from hind-band mask mass in left vs right bbox thirds (stable when the
 * full hind row spans the bbox — edge protrusion alone is ambiguous).
 */
export function tailSideFromMaskHindThirds(
  mask: CowBodyMask,
  bbox: BBox
): "left" | "right" | "unknown" {
  return tailSideFromMaskBandThirds(mask, bbox, MASK_TAIL_BAND_Y0, MASK_TAIL_BAND_Y1, true);
}

/** Torso band mass in outer wedges (excludes central belly). */
export function tailSideFromMaskTorsoThirds(
  mask: CowBodyMask,
  bbox: BBox
): "left" | "right" | "unknown" {
  return tailSideFromMaskBandThirds(mask, bbox, MASK_TORSO_BAND_Y0, MASK_TORSO_BAND_Y1, true);
}

/** Hind-band centroid X — rump bulk side (works when mask is full-width). */
export function tailSideFromMaskHindCentroid(
  mask: CowBodyMask,
  bbox: BBox
): "left" | "right" | "unknown" {
  return tailSideFromMaskCentroid(mask, bbox);
}

/**
 * At the body length row, compare mask mass in left vs right bbox thirds.
 */
export function tailSideFromMaskLengthRowThirds(
  mask: CowBodyMask,
  bbox: BBox,
  lengthY: number
): "left" | "right" | "unknown" {
  const iy = Math.round(lengthY);
  if (iy < 0 || iy >= mask.height) return "unknown";
  const x0 = Math.max(0, Math.floor(bbox.x));
  const x1 = Math.min(mask.width - 1, Math.floor(bbox.x + bbox.width));
  const xLeft = bbox.x + bbox.width / 3;
  const xRight = bbox.x + (2 * bbox.width) / 3;
  let leftCount = 0;
  let rightCount = 0;
  const off = iy * mask.width;
  for (let x = x0; x <= x1; x++) {
    if (!mask.data[off + x]) continue;
    if (x < xLeft) leftCount++;
    else if (x > xRight) rightCount++;
  }
  if (leftCount > rightCount + THIRDS_MIN_PIXELS && leftCount > THIRDS_MIN_PIXELS) {
    return "left";
  }
  if (rightCount > leftCount + THIRDS_MIN_PIXELS && rightCount > THIRDS_MIN_PIXELS) {
    return "right";
  }
  return "unknown";
}

/** Head-band mask mass in outer left vs right wedges (stable on full-width YOLO masks). */
export function headSideFromMaskHeadThirds(
  mask: CowBodyMask,
  bbox: BBox
): "left" | "right" | "unknown" {
  return tailSideFromMaskBandThirds(
    mask,
    bbox,
    MASK_HEAD_BAND_Y0,
    MASK_HEAD_BAND_Y1,
    true,
    0.12,
    0.88
  );
}

/**
 * At the body length row, the head end is narrower than the rump (side view).
 * Color-independent — works on Holstein / black / white / brown coats.
 */
export function headSideFromMaskWidthAtLengthRow(
  mask: CowBodyMask,
  bbox: BBox,
  lengthY: number,
  lengthEnds?: { l1: { x: number }; l2: { x: number } }
): "left" | "right" | "unknown" {
  const leftCenter = lengthEnds
    ? Math.min(lengthEnds.l1.x, lengthEnds.l2.x)
    : bbox.x + bbox.width * 0.12;
  const rightCenter = lengthEnds
    ? Math.max(lengthEnds.l1.x, lengthEnds.l2.x)
    : bbox.x + bbox.width * 0.88;
  const halfWin = Math.max(10, bbox.width * 0.07);

  function crossSectionWidth(centerX: number): number {
    let left = Infinity;
    let right = -Infinity;
    let found = false;
    const ySpan = Math.max(8, Math.floor(bbox.height * 0.12));
    for (let dy = -ySpan; dy <= ySpan; dy++) {
      const iy = Math.round(lengthY + dy);
      if (iy < 0 || iy >= mask.height) continue;
      const x0 = Math.max(0, Math.floor(centerX - halfWin));
      const x1 = Math.min(mask.width - 1, Math.ceil(centerX + halfWin));
      const off = iy * mask.width;
      for (let x = x0; x <= x1; x++) {
        if (!mask.data[off + x]) continue;
        found = true;
        left = Math.min(left, x);
        right = Math.max(right, x);
      }
    }
    return found ? right - left : 0;
  }

  const leftW = crossSectionWidth(leftCenter);
  const rightW = crossSectionWidth(rightCenter);
  if (leftW <= 0 || rightW <= 0) return "unknown";
  if (leftW < rightW * 0.82) return "left";
  if (rightW < leftW * 0.82) return "right";
  return "unknown";
}

/** Head side from mask nose/forehead reach (binary mask only — color independent). */
export function headSideFromMaskHeadTip(
  mask: CowBodyMask,
  bbox: BBox
): "left" | "right" | "unknown" {
  return headSideFromMaskHeadExtremity(mask, bbox);
}

/** Narrow head band side from mask centroid (can bias left when back dominates). */
export function headSideFromMaskNarrowBand(
  mask: CowBodyMask,
  bbox: BBox
): "left" | "right" | "unknown" {
  const headCx = maskBandCentroidX(mask, bbox, MASK_HEAD_BAND_Y0, MASK_HEAD_BAND_Y1);
  if (headCx === null) return "unknown";
  return imageSideFromCentroidX(headCx, bbox);
}

/**
 * Head side from nose/forehead protrusion in narrow head band (not full-band centroid).
 * Compares how far the head band extends toward the left vs right bbox edge.
 */
export function headSideFromMaskHeadExtremity(
  mask: CowBodyMask,
  bbox: BBox
): "left" | "right" | "unknown" {
  const y0 = Math.floor(bbox.y + bbox.height * MASK_HEAD_BAND_Y0);
  const y1 = Math.floor(bbox.y + bbox.height * MASK_HEAD_BAND_Y1);
  let leftMost = Infinity;
  let rightMost = -Infinity;
  let found = false;
  for (let y = y0; y <= y1; y++) {
    const ext = maskRowExtent(mask, y);
    if (!ext) continue;
    found = true;
    leftMost = Math.min(leftMost, ext.left);
    rightMost = Math.max(rightMost, ext.right);
  }
  if (!found) return "unknown";
  const distLeft = leftMost - bbox.x;
  const distRight = bbox.x + bbox.width - rightMost;
  const tie = bbox.width * 0.02;
  if (Math.abs(distLeft - distRight) < tie) return "unknown";
  return distLeft < distRight ? "left" : "right";
}

/** Head + tail sides from mask mass centroids (body-based, not face edge). */
export function bodySidesFromMaskCentroids(
  mask: CowBodyMask,
  bbox: BBox
): { headSide: "left" | "right" | "unknown"; tailSide: "left" | "right" | "unknown" } | null {
  const headSide = headSideFromMaskHeadExtremity(mask, bbox);
  const tailSide = tailSideFromMaskHindExtremity(mask, bbox);
  if (headSide === "unknown" && tailSide === "unknown") return null;

  let head = headSide;
  let tail = tailSide;

  if (head === "unknown" && tail !== "unknown") {
    head = tail === "left" ? "right" : "left";
  } else if (tail === "unknown" && head !== "unknown") {
    tail = head === "left" ? "right" : "left";
  }

  return { headSide: head, tailSide: tail };
}

/** Head side from mask horizontal position in head band (legacy edge protrusion). */
export function headSideFromMask(mask: CowBodyMask, bbox: BBox): "head_left" | "head_right" | null {
  const y0 = Math.floor(bbox.y + bbox.height * 0.12);
  const y1 = Math.floor(bbox.y + bbox.height * 0.38);
  let leftMost = Infinity;
  let rightMost = -Infinity;
  let found = false;
  for (let y = y0; y <= y1; y++) {
    const ext = maskRowExtent(mask, y);
    if (!ext) continue;
    found = true;
    leftMost = Math.min(leftMost, ext.left);
    rightMost = Math.max(rightMost, ext.right);
  }
  if (!found) return null;
  const distLeft = leftMost - bbox.x;
  const distRight = bbox.x + bbox.width - rightMost;
  const tie = bbox.width * 0.02;
  if (Math.abs(distLeft - distRight) < tie) return null;
  return distLeft < distRight ? "head_left" : "head_right";
}

/** Leg columns from mask at lower body (hoof band). */
export function legColumnsFromMask(
  mask: CowBodyMask,
  bbox: BBox
): { x1: number; x2: number; y: number } | null {
  const yStart = Math.floor(bbox.y + bbox.height * 0.55);
  const yEnd = Math.floor(bbox.y + bbox.height * 0.95);
  const scores = new Map<number, number>();

  for (let y = yStart; y <= yEnd; y++) {
    const ext = maskRowExtent(mask, y);
    if (!ext) continue;
    const w = ext.right - ext.left;
    if (w < bbox.width * 0.08) continue;
    const bump = (scores.get(ext.left) ?? 0) + w;
    scores.set(ext.left, bump);
    const bumpR = (scores.get(ext.right) ?? 0) + w;
    scores.set(ext.right, bumpR);
  }

  const peaks = [...scores.entries()]
    .filter(([x]) => x >= bbox.x + bbox.width * 0.05 && x <= bbox.x + bbox.width * 0.95)
    .sort((a, b) => b[1] - a[1]);

  if (peaks.length < 2) return null;
  const x1 = Math.min(peaks[0][0], peaks[1][0]);
  const x2 = Math.max(peaks[0][0], peaks[1][0]);
  if (x2 - x1 < bbox.width * 0.1) return null;
  const y = yStart + (yEnd - yStart) * 0.65;
  return { x1, x2, y };
}

/** Length ends from mask at body length row. */
export function lengthEndsFromMask(mask: CowBodyMask, bbox: BBox, lengthY: number): { l1: Point2D; l2: Point2D } | null {
  const ext = maskRowExtent(mask, lengthY);
  if (!ext) return null;
  if (ext.right - ext.left < bbox.width * 0.2) return null;
  return {
    l1: { x: ext.left, y: lengthY },
    l2: { x: ext.right, y: lengthY },
  };
}

function bboxBounds(bbox: BBox, mask: CowBodyMask) {
  return {
    x0: Math.max(0, Math.floor(bbox.x)),
    y0: Math.max(0, Math.floor(bbox.y)),
    x1: Math.min(mask.width - 1, Math.ceil(bbox.x + bbox.width)),
    y1: Math.min(mask.height - 1, Math.ceil(bbox.y + bbox.height)),
  };
}

/** Keep largest 4-connected foreground component inside bbox. */
export function largestComponentMask(mask: CowBodyMask, bbox: BBox): CowBodyMask {
  const { x0, y0, x1, y1 } = bboxBounds(bbox, mask);
  const out = createEmptyMask(mask.width, mask.height);
  const visited = new Uint8Array(mask.width * mask.height);
  let bestArea = 0;
  let bestPixels: number[] = [];

  const stack: number[] = [];
  for (let sy = y0; sy <= y1; sy++) {
    for (let sx = x0; sx <= x1; sx++) {
      const start = maskIdx(mask, sx, sy);
      if (!mask.data[start] || visited[start]) continue;
      stack.length = 0;
      stack.push(start);
      visited[start] = 1;
      const comp: number[] = [];

      while (stack.length) {
        const cur = stack.pop()!;
        comp.push(cur);
        const cx = cur % mask.width;
        const cy = (cur / mask.width) | 0;
        if (cx > 0) {
          const n = cur - 1;
          if (mask.data[n] && !visited[n]) {
            visited[n] = 1;
            stack.push(n);
          }
        }
        if (cx < mask.width - 1) {
          const n = cur + 1;
          if (mask.data[n] && !visited[n]) {
            visited[n] = 1;
            stack.push(n);
          }
        }
        if (cy > 0) {
          const n = cur - mask.width;
          if (mask.data[n] && !visited[n]) {
            visited[n] = 1;
            stack.push(n);
          }
        }
        if (cy < mask.height - 1) {
          const n = cur + mask.width;
          if (mask.data[n] && !visited[n]) {
            visited[n] = 1;
            stack.push(n);
          }
        }
      }

      if (comp.length > bestArea) {
        bestArea = comp.length;
        bestPixels = comp;
      }
    }
  }

  for (const i of bestPixels) out.data[i] = 1;
  return out;
}

function morphologicalClose(mask: CowBodyMask, bbox: BBox): CowBodyMask {
  const { x0, y0, x1, y1 } = bboxBounds(bbox, mask);
  const dilated = createEmptyMask(mask.width, mask.height);

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      let on = false;
      for (let dy = -1; dy <= 1 && !on; dy++) {
        for (let dx = -1; dx <= 1 && !on; dx++) {
          if (maskGet(mask, x + dx, y + dy)) on = true;
        }
      }
      if (on) maskSet(dilated, x, y, 1);
    }
  }

  const closed = createEmptyMask(mask.width, mask.height);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      let all = true;
      for (let dy = -1; dy <= 1 && all; dy++) {
        for (let dx = -1; dx <= 1 && all; dx++) {
          if (!maskGet(dilated, x + dx, y + dy)) all = false;
        }
      }
      if (all) maskSet(closed, x, y, 1);
    }
  }
  return closed;
}

function isBoundaryPixel(mask: CowBodyMask, x: number, y: number): boolean {
  if (!maskGet(mask, x, y)) return false;
  return (
    !maskGet(mask, x - 1, y) ||
    !maskGet(mask, x + 1, y) ||
    !maskGet(mask, x, y - 1) ||
    !maskGet(mask, x, y + 1)
  );
}

/** Moore-neighbor clockwise trace of outer boundary. */
export function traceOuterContour(mask: CowBodyMask, bbox: BBox): Point2D[] {
  const { x0, y0, x1, y1 } = bboxBounds(bbox, mask);

  let startX = -1;
  let startY = -1;
  for (let y = y0; y <= y1 && startX < 0; y++) {
    for (let x = x0; x <= x1; x++) {
      if (isBoundaryPixel(mask, x, y)) {
        startX = x;
        startY = y;
        break;
      }
    }
  }
  if (startX < 0) return [];

  const dirs = [
    { dx: 1, dy: 0 },
    { dx: 1, dy: 1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: -1, dy: -1 },
    { dx: 0, dy: -1 },
    { dx: 1, dy: -1 },
  ];

  const contour: Point2D[] = [{ x: startX, y: startY }];
  let px = startX;
  let py = startY;
  let dir = 0;

  for (let step = 0; step < (x1 - x0 + 1) * (y1 - y0 + 1) * 4; step++) {
    let found = false;
    for (let k = 0; k < 8; k++) {
      const ni = (dir + k) % 8;
      const nx = px + dirs[ni].dx;
      const ny = py + dirs[ni].dy;
      if (isBoundaryPixel(mask, nx, ny)) {
        px = nx;
        py = ny;
        dir = (ni + 6) % 8;
        if (px === startX && py === startY && contour.length > 2) {
          return contour;
        }
        const last = contour[contour.length - 1];
        if (last.x !== px || last.y !== py) contour.push({ x: px, y: py });
        found = true;
        break;
      }
    }
    if (!found) break;
  }

  return contour;
}

function simplifyPolygon(points: Point2D[], epsilon = 2.5): Point2D[] {
  if (points.length <= 8) return points;

  const rdp = (pts: Point2D[], start: number, end: number, out: Point2D[]) => {
    if (end <= start + 1) return;
    let maxD = 0;
    let idx = start;
    const a = pts[start];
    const b = pts[end];
    const abLen = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    for (let i = start + 1; i < end; i++) {
      const p = pts[i];
      const d = Math.abs((b.y - a.y) * p.x - (b.x - a.x) * p.y + b.x * a.y - b.y * a.x) / abLen;
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > epsilon) {
      rdp(pts, start, idx, out);
      rdp(pts, idx, end, out);
    } else {
      out.push(a);
    }
  };

  const closed = [...points];
  if (closed[0].x !== closed[closed.length - 1].x || closed[0].y !== closed[closed.length - 1].y) {
    closed.push({ ...closed[0] });
  }

  const simplified: Point2D[] = [];
  rdp(closed, 0, closed.length - 1, simplified);
  return simplified;
}

function segmentsIntersect(a: Point2D, b: Point2D, c: Point2D, d: Point2D): boolean {
  const cross = (p: Point2D, q: Point2D, r: Point2D) =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);

  const d1 = cross(a, b, c);
  const d2 = cross(a, b, d);
  const d3 = cross(c, d, a);
  const d4 = cross(c, d, b);

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  return false;
}

export function polygonSelfIntersects(points: Point2D[]): boolean {
  const n = points.length;
  if (n < 4) return false;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    for (let j = i + 2; j < n; j++) {
      if (j === i || (j + 1) % n === i) continue;
      const c = points[j];
      const d = points[(j + 1) % n];
      if (segmentsIntersect(a, b, c, d)) return true;
    }
  }
  return false;
}

/** True when outline matches the generic bbox hourglass (not real seg/heuristic). */
export function isBboxRibbonOutline(outline: Point2D[], bbox: BBox): boolean {
  if (outline.length < 6) return false;
  const ref = outlineRibbonFromBBox(bbox);
  if (Math.abs(outline.length - ref.length) > 4) return false;
  const n = Math.min(outline.length, ref.length);
  let close = 0;
  for (let i = 0; i < n; i++) {
    if (Math.hypot(outline[i].x - ref[i].x, outline[i].y - ref[i].y) < 6) close++;
  }
  return close / n >= 0.82;
}

/** Curved side-view envelope from bbox when mask/outline extraction fails. */
export function outlineRibbonFromBBox(bbox: BBox): Point2D[] {
  const y0 = bbox.y + bbox.height * 0.06;
  const y1 = bbox.y + bbox.height * 0.96;
  const n = Math.max(14, Math.round(bbox.height / 18));
  const top: Point2D[] = [];
  const bottom: Point2D[] = [];

  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const y = y0 + (y1 - y0) * t;
    const bulge = Math.sin(t * Math.PI);
    const insetX = bbox.width * (0.05 + 0.13 * bulge);
    top.push({ x: bbox.x + insetX, y });
    bottom.push({ x: bbox.x + bbox.width - insetX, y });
  }

  return [...top, ...bottom.reverse()];
}

/** Side-view ribbon: per-row left/right envelope (no star spokes). */
export function outlineRibbonFromMask(mask: CowBodyMask, bbox: BBox): Point2D[] {
  const y0 = Math.max(0, Math.floor(bbox.y + bbox.height * 0.08));
  const y1 = Math.min(mask.height - 1, Math.ceil(bbox.y + bbox.height * 0.98));
  const top: Point2D[] = [];
  const bottom: Point2D[] = [];

  for (let y = y0; y <= y1; y++) {
    const ext = maskRowExtent(mask, y);
    if (!ext) continue;
    if (ext.right - ext.left < 2) continue;
    top.push({ x: ext.left, y });
    bottom.push({ x: ext.right, y });
  }

  if (top.length < 2) return [];
  return [...top, ...bottom.reverse()];
}

function downsamplePoints(points: Point2D[], maxPoints: number): Point2D[] {
  if (points.length <= maxPoints) return points;
  const step = Math.ceil(points.length / maxPoints);
  return points.filter((_, i) => i % step === 0);
}

/** CapCut-style outline from ML/heuristic mask (no generic bbox hourglass). */
export function buildSegBodyOutline(mask: CowBodyMask, bbox: BBox, maxPoints = 160): Point2D[] {
  const tryRibbon = (m: CowBodyMask) => {
    const raw = outlineRibbonFromMask(m, bbox);
    if (raw.length < 3) return [] as Point2D[];
    const simplified = simplifyPolygon(raw, 1.2);
    return simplified.length >= 3 ? downsamplePoints(simplified, maxPoints) : [];
  };

  const ribbonRaw = tryRibbon(mask);
  if (ribbonRaw.length >= 3) return ribbonRaw;

  const comp = largestComponentMask(mask, bbox);
  const ribbonComp = tryRibbon(comp);
  if (ribbonComp.length >= 3) return ribbonComp;

  const closed = morphologicalClose(comp, bbox);
  const ribbonClosed = tryRibbon(closed);
  if (ribbonClosed.length >= 3) return ribbonClosed;

  const traced = simplifyPolygon(traceOuterContour(closed, bbox), 2);
  if (traced.length >= 3) return downsamplePoints(traced, maxPoints);

  return [];
}

/** Build closed body outline: traced contour, else ribbon; optional bbox fallback (heuristic only). */
export function buildBodyOutline(
  mask: CowBodyMask,
  bbox: BBox,
  maxPoints = 120,
  allowBboxFallback = false
): Point2D[] {
  const seg = buildSegBodyOutline(mask, bbox, maxPoints);
  if (seg.length >= 3) return seg;

  if (allowBboxFallback) {
    return downsamplePoints(outlineRibbonFromBBox(bbox), maxPoints);
  }
  return [];
}

/** True if mask has any foreground inside bbox. */
export function maskHasPixelsInBbox(mask: CowBodyMask, bbox: BBox): boolean {
  const x0 = Math.max(0, Math.floor(bbox.x));
  const y0 = Math.max(0, Math.floor(bbox.y));
  const x1 = Math.min(mask.width - 1, Math.ceil(bbox.x + bbox.width));
  const y1 = Math.min(mask.height - 1, Math.ceil(bbox.y + bbox.height));
  for (let y = y0; y <= y1; y++) {
    const off = y * mask.width;
    for (let x = x0; x <= x1; x++) {
      if (mask.data[off + x]) return true;
    }
  }
  return false;
}

/** @deprecated Use buildBodyOutline */
export function maskToOutlinePolygon(mask: CowBodyMask, bbox: BBox, maxPoints = 120): Point2D[] {
  return buildBodyOutline(mask, bbox, maxPoints);
}

function lum(data: Uint8ClampedArray, w: number, x: number, y: number): number {
  const i = (y * w + x) * 4;
  return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
}

function maskPixelsInBbox(mask: CowBodyMask, bbox: BBox): number {
  const x0 = Math.max(0, Math.floor(bbox.x));
  const y0 = Math.max(0, Math.floor(bbox.y));
  const x1 = Math.min(mask.width - 1, Math.ceil(bbox.x + bbox.width));
  const y1 = Math.min(mask.height - 1, Math.ceil(bbox.y + bbox.height));
  let n = 0;
  for (let y = y0; y <= y1; y++) {
    const off = y * mask.width;
    for (let x = x0; x <= x1; x++) if (mask.data[off + x]) n++;
  }
  return n;
}

function thresholdMaskInBbox(
  data: Uint8ClampedArray,
  imageW: number,
  imageH: number,
  bbox: BBox,
  threshold: number
): CowBodyMask {
  const x0 = Math.max(0, Math.floor(bbox.x));
  const y0 = Math.max(0, Math.floor(bbox.y));
  const x1 = Math.min(imageW - 1, Math.floor(bbox.x + bbox.width));
  const y1 = Math.min(imageH - 1, Math.floor(bbox.y + bbox.height));
  const raw = createEmptyMask(imageW, imageH);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (lum(data, imageW, x, y) < threshold) {
        raw.data[y * imageW + x] = 1;
      }
    }
  }
  return raw;
}

/** Threshold silhouette inside bbox when seg model is unavailable. */
export function heuristicMaskFromCanvas(
  data: Uint8ClampedArray,
  imageW: number,
  imageH: number,
  bbox: BBox
): CowBodyMask {
  const x0 = Math.max(0, Math.floor(bbox.x));
  const y0 = Math.max(0, Math.floor(bbox.y));
  const x1 = Math.min(imageW - 1, Math.floor(bbox.x + bbox.width));
  const y1 = Math.min(imageH - 1, Math.floor(bbox.y + bbox.height));

  const samples: number[] = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      samples.push(lum(data, imageW, x, y));
    }
  }
  samples.sort((a, b) => a - b);
  const bboxArea = Math.max(1, (x1 - x0 + 1) * (y1 - y0 + 1));
  const percentiles = [0.32, 0.4, 0.48, 0.56];

  let bestMask: CowBodyMask | null = null;
  let bestScore = Infinity;

  for (const pct of percentiles) {
    const threshold = samples[Math.floor(samples.length * pct)] ?? 128;
    const raw = thresholdMaskInBbox(data, imageW, imageH, bbox, threshold);
    const comp = largestComponentMask(raw, bbox);
    const area = maskPixelsInBbox(comp, bbox);
    const ratio = area / bboxArea;
    if (ratio >= 0.12 && ratio <= 0.88) {
      const score = Math.abs(ratio - 0.42);
      if (score < bestScore) {
        bestScore = score;
        bestMask = morphologicalClose(comp, bbox);
      }
    }
  }

  if (bestMask) return bestMask;

  const fallbackTh = samples[Math.floor(samples.length * 0.4)] ?? 128;
  const raw = thresholdMaskInBbox(data, imageW, imageH, bbox, fallbackTh);
  return morphologicalClose(largestComponentMask(raw, bbox), bbox);
}

/** Outline from canvas pixels (heuristic mask; bbox curve only if allowBboxFallback). */
export function buildBodyOutlineFromCanvas(
  data: Uint8ClampedArray,
  imageW: number,
  imageH: number,
  bbox: BBox,
  allowBboxFallback = false
): Point2D[] {
  const mask = heuristicMaskFromCanvas(data, imageW, imageH, bbox);
  const seg = buildSegBodyOutline(mask, bbox);
  if (seg.length >= 3) return seg;
  return buildBodyOutline(mask, bbox, 120, allowBboxFallback);
}
