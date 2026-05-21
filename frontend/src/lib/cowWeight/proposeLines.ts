import type { BBox, CowKeypoints, CowLines, LegCenters, LineSegment, Point2D } from "./types";
import { proposeLinesFromKeypoints } from "./cowKeypoints";
import { lineLengthPx } from "./imageUtils";

const PAD = 4;
/** Top chest fallback when keypoints missing. */
const CHEST_TOP_FRAC = 0.14;
/** Bottom chest fallback when keypoints missing. */
const CHEST_BOTTOM_FRAC = 0.58;
const LEG_FRONT_X_FRAC = 0.34;
const LEG_HIND_X_FRAC = 0.62;
const LENGTH_Y_FRAC = 0.32;
const LENGTH_START_FRAC = 0.14;
const LENGTH_END_FRAC = 0.86;
const MAX_LENGTH_SPAN_FRAC = 0.78;
const MIN_CHEST_SPAN_FRAC = 0.08;
const MIN_LENGTH_SPAN_FRAC = 0.2;

export const MIN_AUTO_CHEST_SPAN_FRAC = 0.3;

function pt(x: number, y: number): Point2D {
  return { x, y };
}

function clampPoint(p: Point2D, bbox: BBox, pad = PAD): Point2D {
  const x1 = bbox.x + pad;
  const y1 = bbox.y + pad;
  const x2 = bbox.x + bbox.width - pad;
  const y2 = bbox.y + bbox.height - pad;
  return {
    x: Math.max(x1, Math.min(x2, p.x)),
    y: Math.max(y1, Math.min(y2, p.y)),
  };
}

export function clampLinesToBBox(lines: CowLines, bbox: BBox): CowLines {
  const chest = {
    a: clampPoint(lines.chest.a, bbox),
    b: clampPoint(lines.chest.b, bbox),
  };
  const length = {
    a: clampPoint(lines.length.a, bbox),
    b: clampPoint(lines.length.b, bbox),
  };
  const next: CowLines = { chest, length };
  if (lines.reference) {
    next.reference = {
      a: clampPoint(lines.reference.a, bbox),
      b: clampPoint(lines.reference.b, bbox),
    };
  }
  return next;
}

export function chestXBetweenLegs(
  bbox: BBox,
  legCenters?: LegCenters | null,
  keypoints?: CowKeypoints | null
): number {
  if (keypoints) return keypoints.chestCenterX;
  if (legCenters) {
    return (Math.min(legCenters.x1, legCenters.x2) + Math.max(legCenters.x1, legCenters.x2)) / 2;
  }
  const xFront = bbox.x + bbox.width * LEG_FRONT_X_FRAC;
  const xHind = bbox.x + bbox.width * LEG_HIND_X_FRAC;
  return (xFront + xHind) / 2;
}

function buildChestLineRaw(
  bbox: BBox,
  legCenters?: LegCenters | null,
  keypoints?: CowKeypoints | null
): LineSegment {
  if (keypoints) {
    const cx = keypoints.chestCenterX;
    return {
      a: pt(cx, keypoints.topChest.y),
      b: pt(cx, keypoints.lowerChest.y),
    };
  }

  const { x, y, height } = bbox;
  const chestTop = y + height * CHEST_TOP_FRAC;
  let chestBottom = y + height * CHEST_BOTTOM_FRAC;
  const minChestSpan = height * MIN_CHEST_SPAN_FRAC;
  if (chestBottom - chestTop < minChestSpan) {
    chestBottom = Math.min(y + height - PAD, chestTop + minChestSpan);
  }
  const cx = chestXBetweenLegs(bbox, legCenters);
  return { a: pt(cx, chestTop), b: pt(cx, chestBottom) };
}

export function isChestOffLegCenter(
  chest: LineSegment,
  bbox: BBox,
  legCenters?: LegCenters | null,
  keypoints?: CowKeypoints | null
): boolean {
  const cx = chestXBetweenLegs(bbox, legCenters, keypoints);
  const tol = Math.max(4, bbox.width * 0.04);
  if (Math.abs(chest.a.x - cx) > tol || Math.abs(chest.b.x - cx) > tol) return true;

  if (keypoints) {
    const yTol = Math.max(6, bbox.height * 0.04);
    if (Math.abs(chest.a.y - keypoints.topChest.y) > yTol) return true;
    if (Math.abs(chest.b.y - keypoints.lowerChest.y) > yTol) return true;
  }
  return false;
}

export function shouldReproposeChest(
  chest: LineSegment,
  bbox: BBox,
  legCenters?: LegCenters | null,
  keypoints?: CowKeypoints | null
): boolean {
  return isChestSpanTooShort(chest, bbox) || isChestOffLegCenter(chest, bbox, legCenters, keypoints);
}

export function proposeChestFromBBox(
  bbox: BBox,
  legCentersOrKeypoints?: LegCenters | CowKeypoints | null
): LineSegment {
  const keypoints =
    legCentersOrKeypoints && "topChest" in legCentersOrKeypoints ? legCentersOrKeypoints : null;
  const legCenters =
    legCentersOrKeypoints && "x1" in legCentersOrKeypoints ? legCentersOrKeypoints : null;

  const chest = buildChestLineRaw(bbox, legCenters, keypoints);
  return {
    a: clampPoint(chest.a, bbox),
    b: clampPoint(chest.b, bbox),
  };
}

export function isChestSpanTooShort(chest: LineSegment, bbox: BBox): boolean {
  if (bbox.height <= 0) return true;
  return lineLengthPx(chest) / bbox.height < MIN_AUTO_CHEST_SPAN_FRAC;
}

export function proposeLinesFromBBox(
  bbox: BBox,
  legCentersOrKeypoints?: LegCenters | CowKeypoints | null
): CowLines {
  const keypoints =
    legCentersOrKeypoints && "topChest" in legCentersOrKeypoints ? legCentersOrKeypoints : null;

  if (keypoints) {
    return clampLinesToBBox(proposeLinesFromKeypoints(bbox, keypoints), bbox);
  }

  const legCenters =
    legCentersOrKeypoints && "x1" in legCentersOrKeypoints ? legCentersOrKeypoints : null;
  const { x, y, width, height } = bbox;
  const chest = proposeChestFromBBox(bbox, legCenters);

  const lengthY = y + height * LENGTH_Y_FRAC;
  let lengthStart = x + width * LENGTH_START_FRAC;
  let lengthEnd = x + width * LENGTH_END_FRAC;

  const maxLengthSpan = width * MAX_LENGTH_SPAN_FRAC;
  if (lengthEnd - lengthStart > maxLengthSpan) {
    const mid = (lengthStart + lengthEnd) / 2;
    lengthStart = mid - maxLengthSpan / 2;
    lengthEnd = mid + maxLengthSpan / 2;
  }
  const minLengthSpan = width * MIN_LENGTH_SPAN_FRAC;
  if (lengthEnd - lengthStart < minLengthSpan) {
    lengthEnd = Math.min(x + width - PAD, lengthStart + minLengthSpan);
  }

  return clampLinesToBBox(
    {
      chest,
      length: { a: pt(lengthStart, lengthY), b: pt(lengthEnd, lengthY) },
    },
    bbox
  );
}
