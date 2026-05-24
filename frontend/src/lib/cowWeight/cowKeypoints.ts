import type { BBox, CowKeypoints, CowLines, LegCenters, Point2D } from "./types";
import {
  attachBodyDirectionToKeypoints,
  cowBodyDirectionFromFacing,
  cowBodyDirectionFromHeadSide,
  detectCowBodyDirection,
  orderLengthKeypointsForFacing,
  resolveFacingFromBodyDirection,
  type CowBodyDirection,
  type CowFacing,
} from "./cowDirection";
import {
  headBboxFromHeadPoint,
  resolveHeadBboxFromVision,
} from "./headBbox";
import {
  legColumnsFromMask,
  lengthEndsFromMask,
  maskHindBandTailEndX,
  maskRearEnvelopeXAtY,
  maskStrictTailBoundaryX,
  maskRowExtent,
  withersFromMask,
  type CowBodyMask,
} from "./cowMask";

export type { CowFacing } from "./cowDirection";

const PAD = 4;
const LEG_ROI_Y_START = 0.42;
const LEG_ROI_Y_END = 0.95;
const LEG_X_MARGIN = 0.06;
const LEG_MERGE_FRAC = 0.06;
const LEG_MIN_SEP_FRAC = 0.1;
const LEG_MIN_SCORE_FRAC = 0.25;
const LEG_MIDPOINT_MIN_FRAC = 0.25;
const LEG_MIDPOINT_MAX_FRAC = 0.75;
const LOWER_CHEST_Y_START = 0.48;
const LOWER_CHEST_Y_END = 0.58;
const LOWER_CHEST_MAX_FRAC = 0.58;
const MIN_BODY_WIDTH_FRAC = 0.22;
const LOWER_CHEST_EDGE_PEAK_FRAC = 0.85;
const LEG_CHEST_CEILING_MARGIN = 0.03;
const LOWER_CHEST_FALLBACK_FRAC = 0.58;
const TOP_CHEST_Y_START = 0.06;
const TOP_CHEST_Y_END = 0.28;
const TOP_CHEST_FALLBACK_FRAC = 0.14;
const TOP_CHEST_EDGE_PEAK_FRAC = 0.9;
const MIN_CHEST_SPAN_FRAC = 0.08;
const LENGTH_Y_FRAC = 0.32;
const LENGTH_START_FRAC = 0.14;
const LENGTH_END_FRAC = 0.86;
const LEG_FRONT_X_FRAC = 0.34;
const LEG_HIND_X_FRAC = 0.62;
const SMOOTH_RADIUS = 2;
/** Lower body ROI for silhouette leg detect (bottom 55% of bbox). */
const SIL_ROI_Y_START = 0.45;
const SIL_SCAN_UP_FRAC = 0.45;
/** Side view: hind leg column (left side of bbox when cow faces right). */
const ZONE_LEFT_LEG_START = 0.06;
const ZONE_LEFT_LEG_END = 0.4;
/** Side view: front leg column (right side of bbox). */
const ZONE_RIGHT_LEG_START = 0.42;
const ZONE_RIGHT_LEG_END = 0.88;
const MIN_ZONE_SCORE_FRAC = 0.35;
const MIN_LEG_SEP_FRAC = 0.12;
const CENTER_BELLY_LO = 0.35;
const CENTER_BELLY_HI = 0.65;
const TAIL_FALLBACK_FROM_HIND_FRAC = 0.12;

function pt(x: number, y: number): Point2D {
  return { x, y };
}

function lum(data: Uint8ClampedArray, i: number): number {
  return data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
}

function smoothProfile(profile: number[], radius: number): number[] {
  const out = new Array(profile.length).fill(0);
  for (let i = 0; i < profile.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - radius); j <= Math.min(profile.length - 1, i + radius); j++) {
      sum += profile[j];
      count++;
    }
    out[i] = count > 0 ? sum / count : 0;
  }
  return out;
}

function findLocalMaxima(profile: number[], minSep: number): Array<{ index: number; score: number }> {
  const peaks: Array<{ index: number; score: number }> = [];
  for (let i = 1; i < profile.length - 1; i++) {
    if (profile[i] >= profile[i - 1] && profile[i] > profile[i + 1]) {
      peaks.push({ index: i, score: profile[i] });
    }
  }
  peaks.sort((a, b) => b.score - a.score);
  const kept: Array<{ index: number; score: number }> = [];
  for (const peak of peaks) {
    if (kept.every((k) => Math.abs(k.index - peak.index) >= minSep)) {
      kept.push(peak);
    }
  }
  return kept;
}

function mergePeaksToClusters(
  peaks: Array<{ index: number; score: number }>,
  mergeSep: number
): Array<{ index: number; score: number }> {
  const sorted = [...peaks].sort((a, b) => a.index - b.index);
  const clusters: Array<{ indices: number[]; score: number }> = [];
  for (const peak of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && peak.index - last.indices[last.indices.length - 1] < mergeSep) {
      last.indices.push(peak.index);
      last.score += peak.score;
    } else {
      clusters.push({ indices: [peak.index], score: peak.score });
    }
  }
  return clusters.map((c) => ({
    index: Math.round(c.indices.reduce((a, b) => a + b, 0) / c.indices.length),
    score: c.score,
  }));
}

function pickLegPair(
  clusters: Array<{ index: number; score: number }>,
  minSep: number,
  minScore: number,
  bbox: BBox,
  x0: number
): { x1: number; x2: number } | null {
  const valid = clusters.filter((c) => c.score >= minScore);
  if (valid.length < 2) return null;

  let best: { i: number; j: number; score: number } | null = null;
  for (let a = 0; a < valid.length; a++) {
    for (let b = a + 1; b < valid.length; b++) {
      const sep = Math.abs(valid[a].index - valid[b].index);
      if (sep < minSep) continue;
      const combined = valid[a].score + valid[b].score;
      if (!best || combined > best.score) {
        best = { i: valid[a].index, j: valid[b].index, score: combined };
      }
    }
  }
  if (!best) return null;

  const legX1 = x0 + best.i;
  const legX2 = x0 + best.j;
  const midFrac = (legX1 + legX2) / 2 - bbox.x;
  const midNorm = midFrac / bbox.width;
  if (midNorm < LEG_MIDPOINT_MIN_FRAC || midNorm > LEG_MIDPOINT_MAX_FRAC) return null;

  return { x1: Math.min(legX1, legX2), x2: Math.max(legX1, legX2) };
}

function luminanceAt(data: Uint8ClampedArray, w: number, x: number, y: number): number {
  if (x < 0 || y < 0 || y >= data.length / (w * 4)) return 255;
  return lum(data, (y * w + x) * 4);
}

function percentileLum(samples: number[], p: number): number {
  if (!samples.length) return 128;
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx];
}

/** Ground-connected silhouette score for one column (higher = more leg mass at hoof). */
function columnSilhouetteScore(
  data: Uint8ClampedArray,
  w: number,
  x: number,
  yBottom: number,
  yTop: number,
  threshold: number
): number {
  let run = 0;
  let started = false;
  for (let y = yBottom; y >= yTop; y--) {
    const l = luminanceAt(data, w, x, y);
    if (l < threshold) {
      if (!started) started = true;
      run++;
    } else if (started) {
      break;
    }
  }

  let hEdge = 0;
  if (x > 0) {
    for (let y = yTop; y <= yBottom; y++) {
      const l = luminanceAt(data, w, x, y);
      const lLeft = luminanceAt(data, w, x - 1, y);
      hEdge += Math.abs(l - lLeft);
    }
  }

  return run + hEdge * 0.12;
}

/** Y at leg column center (mid-leg), not on the ground. */
function legBodyYForColumn(
  data: Uint8ClampedArray,
  w: number,
  x: number,
  yBottom: number,
  yTop: number,
  threshold: number
): number {
  let sumY = 0;
  let count = 0;
  for (let y = yTop; y <= yBottom; y++) {
    if (luminanceAt(data, w, x, y) < threshold) {
      sumY += y;
      count++;
    }
  }
  if (count > 0) return Math.round(sumY / count);
  return yBottom - Math.floor((yBottom - yTop) * 0.15);
}

/** Y at hoof (bottommost ground-connected pixel in column). Leg2 only. */
function legHoofYForColumn(
  data: Uint8ClampedArray,
  w: number,
  x: number,
  yBottom: number,
  yTop: number,
  threshold: number
): number {
  for (let y = yBottom; y >= yTop; y--) {
    if (luminanceAt(data, w, x, y) < threshold) {
      return y;
    }
  }
  return legBodyYForColumn(data, w, x, yBottom, yTop, threshold);
}

function biasedLegScore(score: number, relFrac: number, preferLeft: boolean): number {
  const edgeBias = preferLeft ? 1 - relFrac : relFrac;
  return score * (0.55 + 0.45 * edgeBias);
}

/** Hind-on-right bias: peak near center-right, not far-right empty space. */
function centerRightLegScore(score: number, relFrac: number, center: number, spread: number): number {
  const dist = Math.abs(relFrac - center);
  const bias = Math.max(0, 1 - dist / spread);
  return score * (0.55 + 0.45 * bias);
}

/** i18n key for on-photo head label (head toward image left/right). */
export function photoOrientationI18nKey(
  facing: CowFacing | undefined
): "cowWeight.scan.headLeft" | "cowWeight.scan.headRight" | null {
  if (facing === "head_left") return "cowWeight.scan.headLeft";
  if (facing === "head_right") return "cowWeight.scan.headRight";
  return null;
}

/** Leg1 = front (head side), Leg2 = hind (tail side) in image coordinates. */
function assignLegsByFacing(
  facing: CowFacing,
  colA: Point2D,
  colB: Point2D
): { leg1: Point2D; leg2: Point2D } {
  const left = colA.x <= colB.x ? colA : colB;
  const right = colA.x <= colB.x ? colB : colA;
  if (facing === "head_left") return { leg1: left, leg2: right };
  return { leg1: right, leg2: left };
}

/**
 * Map vision/local semantic front+hind hooves to leg1/leg2 using facing.
 * Swaps when model places "front" on the tail side of the photo.
 */
export function assignLegsFromSemanticPoints(
  facing: CowFacing,
  frontPt: Point2D,
  hindPt: Point2D
): { leg1: Point2D; leg2: Point2D } {
  let front = frontPt;
  let hind = hindPt;
  if (facing === "head_left" && front.x > hind.x) {
    const tmp = front;
    front = hind;
    hind = tmp;
  } else if (facing === "head_right" && front.x < hind.x) {
    const tmp = front;
    front = hind;
    hind = tmp;
  }
  return assignLegsByFacing(facing, front, hind);
}

/** Infer missing hoof column on tail side when only one leg column was found. */
export function completeLegPairFromFacing(
  facing: CowFacing,
  colA: Point2D,
  colB: Point2D | null,
  bbox: BBox,
  tailL1: Point2D,
  legY: number
): { colA: Point2D; colB: Point2D; inferred: boolean } {
  if (colB) return { colA, colB, inferred: false };

  const known = colA;
  const midX = bbox.x + bbox.width * 0.5;
  const onHeadSide =
    facing === "head_left"
      ? known.x < midX + bbox.width * 0.08
      : known.x > midX - bbox.width * 0.08;

  let otherX: number;
  if (facing === "head_left") {
    otherX = onHeadSide
      ? Math.max(tailL1.x, bbox.x + bbox.width * LENGTH_END_FRAC * 0.98)
      : Math.min(tailL1.x, bbox.x + bbox.width * LENGTH_START_FRAC * 1.02);
  } else {
    otherX = onHeadSide
      ? Math.min(tailL1.x, bbox.x + bbox.width * LENGTH_START_FRAC * 1.02)
      : Math.max(tailL1.x, bbox.x + bbox.width * LENGTH_END_FRAC * 0.98);
  }

  return { colA: known, colB: pt(otherX, legY), inferred: true };
}

/** Vision/local: hind hoof when API returns front only. */
export function synthesizeHindLegPoint(
  facing: CowFacing,
  frontPt: Point2D,
  bbox: BBox,
  tailL1: Point2D,
  legY: number
): Point2D {
  return completeLegPairFromFacing(facing, frontPt, null, bbox, tailL1, legY).colB;
}

function legPairSeparation(x1: number, x2: number): number {
  return Math.abs(x1 - x2);
}

function photoLegsBetter(
  photo: { x1: number; x2: number },
  maskSep: number,
  bboxWidth: number
): boolean {
  const photoSep = legPairSeparation(photo.x1, photo.x2);
  const minSep = bboxWidth * MIN_LEG_SEP_FRAC;
  if (photoSep < minSep) return false;
  if (maskSep < minSep) return true;
  return photoSep > maskSep * 1.15;
}

/** Body-based head direction from mask + tail (no face/nose luminance). */
function resolveBodyHeadDirection(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  bbox: BBox,
  lengthEnds: { l1: Point2D; l2: Point2D; detected: boolean },
  bodyMask?: CowBodyMask,
  lengthY?: number
): { facing: CowFacing | null; bodyDirection: CowBodyDirection } {
  const dir = detectCowBodyDirection(
    data,
    w,
    h,
    bbox,
    lengthEnds,
    bodyMask,
    null,
    { lengthY }
  );
  const facing = resolveFacingFromBodyDirection(dir);
  let headBbox = dir.headBbox ?? null;
  if (!headBbox && facing && bodyMask && maskIsUsable(bodyMask, bbox)) {
    const ordered = orderLengthKeypointsForFacing(
      lengthEnds.l1,
      lengthEnds.l2,
      facing
    );
    headBbox = headBboxFromHeadPoint(bodyMask, bbox, ordered.l2);
  }
  return {
    facing,
    bodyDirection: { ...dir, headBbox },
  };
}

/** Apply OpenRouter vision assist when local direction was uncertain. */
export function mergeDirectionAssistIntoKeypoints(
  kp: CowKeypoints,
  headSide: "left" | "right",
  headBboxNorm: { x: number; y: number; width: number; height: number } | null,
  imageWidth: number,
  imageHeight: number,
  confidence: number,
  cowBbox?: BBox,
  bodyMask?: CowBodyMask
): { keypoints: CowKeypoints; headBbox: BBox | null } {
  const facing: CowFacing = headSide === "left" ? "head_left" : "head_right";
  const reassigned = reassignKeypointsForHeadSide(kp, facing);
  const headPoint = reassigned.l2;
  const headBbox =
    cowBbox != null
      ? resolveHeadBboxFromVision(
          headBboxNorm,
          imageWidth,
          imageHeight,
          cowBbox,
          headPoint,
          headSide,
          bodyMask,
          confidence
        )
      : headBboxNorm
        ? resolveHeadBboxFromVision(
            headBboxNorm,
            imageWidth,
            imageHeight,
            {
              x: 0,
              y: 0,
              width: imageWidth,
              height: imageHeight,
              confidence: 1,
            },
            headPoint,
            headSide,
            bodyMask,
            confidence
          )
        : null;
  const bodyDirection: CowBodyDirection = {
    ...cowBodyDirectionFromHeadSide(headSide, "vision"),
    headBbox,
    directionIssueKey: null,
  };
  const keypoints = attachBodyDirectionToKeypoints(reassigned, facing, bodyDirection);
  return { keypoints, headBbox };
}

function maskPixelCountInBBox(mask: CowBodyMask, bbox: BBox): number {
  const x0 = Math.max(0, Math.floor(bbox.x));
  const y0 = Math.max(0, Math.floor(bbox.y));
  const x1 = Math.min(mask.width - 1, Math.ceil(bbox.x + bbox.width));
  const y1 = Math.min(mask.height - 1, Math.ceil(bbox.y + bbox.height));
  let n = 0;
  for (let y = y0; y <= y1; y++) {
    const off = y * mask.width;
    for (let x = x0; x <= x1; x++) {
      if (mask.data[off + x]) n++;
    }
  }
  return n;
}

function maskIsUsable(mask: CowBodyMask, bbox: BBox): boolean {
  return maskPixelCountInBBox(mask, bbox) > bbox.width * bbox.height * 0.04;
}

/**
 * After cloud head direction: keep mask/photo leg column pixels, swap Front/Hind + L1/L2 order only.
 */
export function applyCloudFacingToKeypoints(
  local: CowKeypoints,
  facing: CowFacing,
  headBbox: BBox | null
): CowKeypoints {
  const reassigned = reassignKeypointsForHeadSide(local, facing);
  const dir = reassigned.detected?.bodyDirection ?? cowBodyDirectionFromFacing(facing);
  return attachBodyDirectionToKeypoints(reassigned, facing, {
    ...dir,
    headBbox: headBbox ?? dir.headBbox ?? null,
    directionIssueKey: null,
  });
}

export interface LengthShoulderRearResult {
  shoulder: Point2D;
  rear: Point2D;
  detected: boolean;
}

function maskRowAtY(
  bodyMask: CowBodyMask | undefined,
  bbox: BBox,
  y: number
): { left: number; right: number } | null {
  if (!bodyMask) return null;
  const ext = maskRowExtent(bodyMask, y);
  if (!ext || ext.right - ext.left < bbox.width * 0.2) return null;
  return ext;
}

function clampLengthPointsToFacingBody(
  facing: CowFacing | null | undefined,
  shoulderX: number,
  rearX: number,
  bbox: BBox,
  bodyMask: CowBodyMask | undefined,
  y: number
): { shoulderX: number; rearX: number } {
  if (!bodyMask || (facing !== "head_left" && facing !== "head_right")) {
    return { shoulderX, rearX };
  }
  const ext = maskRowAtY(bodyMask, bbox, y);
  if (!ext) return { shoulderX, rearX };

  const minSep = Math.max(12, bbox.width * 0.12);
  let nextShoulder = shoulderX;
  let nextRear = rearX;

  if (facing === "head_left") {
    nextShoulder = Math.max(ext.left, nextShoulder);
    nextRear = Math.max(ext.right, nextRear);
    if (nextRear - nextShoulder < minSep) {
      nextRear = Math.max(nextRear, nextShoulder + minSep);
    }
  } else {
    nextShoulder = Math.min(ext.right, nextShoulder);
    nextRear = Math.min(ext.left, nextRear);
    if (nextShoulder - nextRear < minSep) {
      nextRear = nextShoulder - minSep;
    }
  }

  const xMin = bbox.x + PAD;
  const xMax = bbox.x + bbox.width - PAD;
  nextShoulder = Math.max(xMin, Math.min(xMax, nextShoulder));
  if (facing === "head_left") {
    nextRear = Math.max(xMin, nextRear);
  } else {
    nextRear = Math.max(xMin, Math.min(xMax, nextRear));
  }
  return { shoulderX: nextShoulder, rearX: nextRear };
}

function headLeftRearBodyEndX(
  bodyMask: CowBodyMask,
  bbox: BBox,
  y: number
): number | null {
  const bboxRightX = bbox.x + bbox.width - PAD;
  const row = maskRowAtY(bodyMask, bbox, y);
  const candidates = [
    bboxRightX,
    row?.right ?? null,
    maskRearEnvelopeXAtY(bodyMask, bbox, y, "right"),
    maskHindBandTailEndX(bodyMask, bbox, "right"),
    maskStrictTailBoundaryX(bodyMask, bbox, "right"),
  ].filter((v): v is number => v !== null);
  if (candidates.length === 0) return null;
  return Math.max(...candidates);
}

function enforceRearTailBoundary(
  rearX: number,
  facing: CowFacing | null | undefined,
  bbox: BBox,
  bodyMask: CowBodyMask | undefined,
  y: number
): number {
  if (facing !== "head_left") return rearX;
  if (!bodyMask) return rearX;
  const headLeftRear = headLeftRearBodyEndX(bodyMask, bbox, y);
  if (headLeftRear === null) return rearX;
  return Math.max(rearX, headLeftRear);
}

function tailFallbackFromLeg2(
  facing: CowFacing,
  bbox: BBox,
  leg2FallbackX: number
): number {
  const xMin = bbox.x + PAD;
  const xMax = bbox.x + bbox.width - PAD;
  const shift = bbox.width * TAIL_FALLBACK_FROM_HIND_FRAC;
  const raw =
    facing === "head_left" ? leg2FallbackX + shift : leg2FallbackX - shift;
  return Math.max(xMin, Math.min(xMax, raw));
}

/** Tail-side body edge X for C2 (hind-band extremity, row edge, then leg2-guided tail fallback). */
export function tailEndX(
  facing: CowFacing | null | undefined,
  bbox: BBox,
  y: number,
  bodyMask: CowBodyMask | undefined,
  leg2FallbackX: number
): number {
  if (facing === "head_left") {
    if (bodyMask) {
      const headLeftRear = headLeftRearBodyEndX(bodyMask, bbox, y);
      if (headLeftRear !== null) return headLeftRear;
    }
    return tailFallbackFromLeg2(facing, bbox, leg2FallbackX);
  }
  if (facing === "head_right") {
    if (bodyMask) {
      const hindEnd = maskHindBandTailEndX(bodyMask, bbox, "left");
      if (hindEnd !== null) return hindEnd;
      const ext = maskRowAtY(bodyMask, bbox, y);
      if (ext) return ext.left;
    }
    return tailFallbackFromLeg2(facing, bbox, leg2FallbackX);
  }
  return leg2FallbackX;
}

/** Shoulder / withers on head side at length row. */
export function headSideShoulderX(
  facing: CowFacing | null | undefined,
  bbox: BBox,
  y: number,
  leg1X: number,
  bodyMask: CowBodyMask | undefined
): number {
  if (bodyMask) {
    const withers = withersFromMask(bodyMask, bbox);
    if (withers) return withers.centerX;
  }
  const ext = maskRowAtY(bodyMask, bbox, y);
  const midX = bbox.x + bbox.width * 0.5;
  const headMargin = bbox.width * 0.06;
  if (facing === "head_left" && ext) {
    return Math.max(ext.left, Math.min(leg1X, midX - headMargin));
  }
  if (facing === "head_right" && ext) {
    return Math.min(ext.right, Math.max(leg1X, midX + headMargin));
  }
  return leg1X;
}

/** Nudge C1 shoulder toward the head along the length span (default 20%). */
export const SHOULDER_HEAD_NUDGE_FRAC = 0.2;

export function nudgeShoulderTowardHead(
  shoulderX: number,
  rearX: number,
  facing: CowFacing | null | undefined,
  bbox: BBox,
  xMin: number,
  xMax: number
): number {
  if (facing !== "head_left" && facing !== "head_right") {
    return shoulderX;
  }
  const span = Math.abs(rearX - shoulderX);
  const nudge = span * SHOULDER_HEAD_NUDGE_FRAC;
  let x = facing === "head_left" ? shoulderX - nudge : shoulderX + nudge;
  const minSep = Math.max(12, bbox.width * 0.12);
  if (facing === "head_left") {
    x = Math.max(xMin, Math.min(x, rearX - minSep));
  } else {
    x = Math.min(xMax, Math.max(x, rearX + minSep));
  }
  return x;
}

/** Body length: C1 shoulder (nudged toward head) → C2 rear (tail-side body end). lines.length.a = shoulder, b = rear. */
export function lengthShoulderRearPoints(
  bbox: BBox,
  keypoints: Pick<CowKeypoints, "leg1" | "leg2" | "detected">,
  bodyMask?: CowBodyMask,
  lengthYOverride?: number
): LengthShoulderRearResult {
  const lengthY = lengthYOverride ?? bbox.y + bbox.height * LENGTH_Y_FRAC;
  const xMin = bbox.x + PAD;
  const xMax = bbox.x + bbox.width - PAD;
  const y = Math.max(bbox.y + PAD, Math.min(bbox.y + bbox.height - PAD, lengthY));

  const facing = keypoints.detected?.facing ?? null;
  let shoulderX = headSideShoulderX(facing, bbox, y, keypoints.leg1.x, bodyMask);
  let rearX = tailEndX(facing, bbox, y, bodyMask, keypoints.leg2.x);
  rearX = enforceRearTailBoundary(rearX, facing, bbox, bodyMask, y);

  if (facing === "head_left") {
    rearX = Math.max(rearX, xMin);
  } else {
    rearX = Math.max(xMin, Math.min(xMax, rearX));
  }
  shoulderX = nudgeShoulderTowardHead(shoulderX, rearX, facing, bbox, xMin, xMax);
  ({ shoulderX, rearX } = clampLengthPointsToFacingBody(
    facing,
    shoulderX,
    rearX,
    bbox,
    bodyMask,
    y
  ));
  if (facing === "head_left") {
    rearX = Math.max(rearX, xMax);
  }

  let shoulder = pt(shoulderX, y);
  let rear = pt(rearX, y);

  if (facing === "head_left") {
    if (shoulder.x > rear.x) {
      const tmp = shoulder;
      shoulder = rear;
      rear = tmp;
    }
  } else if (facing === "head_right") {
    if (shoulder.x < rear.x) {
      const tmp = shoulder;
      shoulder = rear;
      rear = tmp;
    }
  } else if (shoulder.x === rear.x) {
    shoulder = pt(bbox.x + bbox.width * LENGTH_START_FRAC, y);
    rear = pt(bbox.x + bbox.width * LENGTH_END_FRAC, y);
  }

  const minSep = Math.max(12, bbox.width * 0.12);
  const detected =
    (keypoints.detected?.legs ?? false) && Math.abs(rear.x - shoulder.x) >= minSep;

  return { shoulder, rear, detected };
}

/** Keep keypoint length fields aligned with weight line C1/C2 (l2=shoulder, l1=rear). */
export function syncLengthKeypointsFromLines(
  kp: CowKeypoints,
  length: { a: Point2D; b: Point2D }
): CowKeypoints {
  return {
    ...kp,
    l1: { ...length.b },
    l2: { ...length.a },
    detected: {
      ...kp.detected,
      legs: kp.detected?.legs ?? false,
      lowerChest: kp.detected?.lowerChest ?? false,
      topChest: kp.detected?.topChest ?? false,
      length: true,
      facing: kp.detected?.facing,
      bodyDirection: kp.detected?.bodyDirection,
    },
  };
}

/** Keep keypoint chest fields aligned with weight line Ch1/Ch2. */
export function syncChestKeypointsFromLines(
  kp: CowKeypoints,
  chest: { a: Point2D; b: Point2D }
): CowKeypoints {
  const chestCenterX = (chest.a.x + chest.b.x) / 2;
  return {
    ...kp,
    topChest: { ...chest.a },
    lowerChest: { ...chest.b },
    chestCenterX,
    detected: {
      ...kp.detected,
      legs: kp.detected?.legs ?? false,
      lowerChest: kp.detected?.lowerChest ?? true,
      topChest: kp.detected?.topChest ?? true,
      length: kp.detected?.length ?? false,
      facing: kp.detected?.facing,
      bodyDirection: kp.detected?.bodyDirection,
    },
  };
}

/** Re-assign Leg1/Leg2 and L1/L2 (tail/head) after user corrects head side on Step 1. */
export function reassignKeypointsForHeadSide(kp: CowKeypoints, facing: CowFacing): CowKeypoints {
  const colA = kp.leg1.x <= kp.leg2.x ? kp.leg1 : kp.leg2;
  const colB = kp.leg1.x <= kp.leg2.x ? kp.leg2 : kp.leg1;
  const assigned = assignLegsByFacing(facing, colA, colB);
  return attachBodyDirectionToKeypoints(
    {
      ...kp,
      leg1: assigned.leg1,
      leg2: assigned.leg2,
    },
    facing,
    cowBodyDirectionFromFacing(facing)
  );
}

const LEG2_BAND_HEAD_RIGHT_START = 0.48;
const LEG2_BAND_HEAD_RIGHT_END = 0.82;
const LEG2_BAND_HEAD_LEFT_START = 0.42;
const LEG2_BAND_HEAD_LEFT_END = 0.68;
const LEG2_HIND_CENTER_FRAC = 0.55;
const LEG2_HIND_SPREAD_FRAC = 0.13;

/** Which bbox half to search for front vs hind leg column (depends on cow facing). */
function legZoneRanges(facing: CowFacing): {
  leftStart: number;
  leftEnd: number;
  rightStart: number;
  rightEnd: number;
  leftPreferEdge: boolean;
  rightPreferEdge: boolean;
} {
  if (facing === "head_right") {
    return {
      leftStart: ZONE_LEFT_LEG_START,
      leftEnd: ZONE_LEFT_LEG_END,
      rightStart: ZONE_RIGHT_LEG_START,
      rightEnd: ZONE_RIGHT_LEG_END,
      leftPreferEdge: true,
      rightPreferEdge: false,
    };
  }
  return {
    leftStart: ZONE_LEFT_LEG_START,
    leftEnd: ZONE_LEFT_LEG_END,
    rightStart: ZONE_RIGHT_LEG_START,
    rightEnd: ZONE_RIGHT_LEG_END,
    leftPreferEdge: false,
    rightPreferEdge: false,
  };
}

function buildLegColumnScores(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  bbox: BBox
): {
  scores: number[];
  x0: number;
  xEnd: number;
  yBottom: number;
  yScanTop: number;
  threshold: number;
  minScore: number;
  minSep: number;
} | null {
  const x0 = Math.max(0, Math.floor(bbox.x + bbox.width * LEG_X_MARGIN));
  const xEnd = Math.min(w - 1, Math.floor(bbox.x + bbox.width * (1 - LEG_X_MARGIN)));
  const yBottom = Math.min(h - 1, Math.floor(bbox.y + bbox.height - 1));
  const yRoiTop = Math.max(0, Math.floor(bbox.y + bbox.height * SIL_ROI_Y_START));
  const yScanTop = Math.max(yRoiTop, yBottom - Math.floor(bbox.height * SIL_SCAN_UP_FRAC));

  if (xEnd <= x0 || yBottom <= yScanTop) return null;

  const lumSamples: number[] = [];
  for (let y = yRoiTop; y <= yBottom; y++) {
    for (let x = x0; x <= xEnd; x++) {
      lumSamples.push(luminanceAt(data, w, x, y));
    }
  }
  const threshold = percentileLum(lumSamples, 0.42);

  const profileLen = xEnd - x0 + 1;
  const scores = new Array(profileLen).fill(0);
  for (let xi = 0; xi < profileLen; xi++) {
    scores[xi] = columnSilhouetteScore(data, w, x0 + xi, yBottom, yScanTop, threshold);
  }

  const maxScore = Math.max(...scores, 0);
  if (maxScore <= 0) return null;

  return {
    scores,
    x0,
    xEnd,
    yBottom,
    yScanTop,
    threshold,
    minScore: maxScore * MIN_ZONE_SCORE_FRAC,
    minSep: Math.max(8, Math.floor(bbox.width * MIN_LEG_SEP_FRAC)),
  };
}

type LegColumnPick = { xi: number; score: number };

/** Leg1 column — same logic as before (left zone + facing bias). */
function pickLeftLegColumn(
  scores: number[],
  x0: number,
  bbox: BBox,
  facing: CowFacing,
  minScore: number,
  minSep: number
): LegColumnPick | null {
  const zones = legZoneRanges(facing);
  let bestLeft: LegColumnPick | null = null;

  for (let xi = 0; xi < scores.length; xi++) {
    const x = x0 + xi;
    const relFrac = (x - bbox.x) / bbox.width;
    const raw = scores[xi];
    if (raw < minScore) continue;
    if (relFrac >= zones.leftStart && relFrac <= zones.leftEnd) {
      const s = biasedLegScore(raw, relFrac, zones.leftPreferEdge);
      if (!bestLeft || s > bestLeft.score) bestLeft = { xi, score: s };
    }
  }

  if (!bestLeft) {
    const peaks = scores
      .map((score, xi) => ({ xi, score, x: x0 + xi }))
      .filter((p) => p.score >= minScore)
      .sort((a, b) => b.score - a.score);
    for (const p of peaks) {
      const rel = (p.x - bbox.x) / bbox.width;
      if (rel <= zones.leftEnd) {
        bestLeft = { xi: p.xi, score: p.score };
        break;
      }
    }
  }

  return bestLeft;
}

/** Leg2 column — facing-specific band, exclude near Leg1, hoof Y applied later. */
function pickRightLegColumn(
  scores: number[],
  x0: number,
  bbox: BBox,
  facing: CowFacing,
  leg1X: number,
  minScore: number,
  minSep: number
): LegColumnPick | null {
  const bandStart =
    facing === "head_right" ? LEG2_BAND_HEAD_RIGHT_START : LEG2_BAND_HEAD_LEFT_START;
  const bandEnd =
    facing === "head_right" ? LEG2_BAND_HEAD_RIGHT_END : LEG2_BAND_HEAD_LEFT_END;

  let bestRight: LegColumnPick | null = null;

  for (let xi = 0; xi < scores.length; xi++) {
    const x = x0 + xi;
    if (Math.abs(x - leg1X) < minSep) continue;
    const relFrac = (x - bbox.x) / bbox.width;
    const raw = scores[xi];
    if (raw < minScore) continue;
    if (relFrac < bandStart || relFrac > bandEnd) continue;

    const s =
      facing === "head_right"
        ? biasedLegScore(raw, relFrac, false)
        : centerRightLegScore(raw, relFrac, LEG2_HIND_CENTER_FRAC, LEG2_HIND_SPREAD_FRAC);

    if (!bestRight || s > bestRight.score) bestRight = { xi, score: s };
  }

  if (!bestRight) {
    const peaks = scores
      .map((score, xi) => ({ xi, score, x: x0 + xi }))
      .filter((p) => p.score >= minScore && Math.abs(p.x - leg1X) >= minSep)
      .sort((a, b) => b.score - a.score);
    for (const p of peaks) {
      const rel = (p.x - bbox.x) / bbox.width;
      if (rel >= bandStart && rel <= bandEnd) {
        bestRight = { xi: p.xi, score: p.score };
        break;
      }
    }
  }

  return bestRight;
}

/** Horizontal span of cow body at row Y (rejects narrow penis / tail protrusion). */
function bodyWidthAtRow(
  data: Uint8ClampedArray,
  w: number,
  bbox: BBox,
  y: number,
  chestX: number,
  threshold: number
): number {
  const yRow = Math.round(y);
  const xMin = Math.max(0, Math.floor(bbox.x));
  const xMax = Math.min(w - 1, Math.floor(bbox.x + bbox.width));
  const halfBand = Math.max(4, Math.floor(bbox.width * 0.15));

  let spanMin = Infinity;
  let spanMax = -Infinity;
  for (let x = xMin; x <= xMax; x++) {
    if (Math.abs(x - chestX) > halfBand) continue;
    if (luminanceAt(data, w, x, yRow) < threshold) {
      spanMin = Math.min(spanMin, x);
      spanMax = Math.max(spanMax, x);
    }
  }
  if (!Number.isFinite(spanMin)) return 0;
  return spanMax - spanMin;
}

/**
 * Detect front/hind leg columns from photo silhouette (ground-connected mass per X).
 * Leg1 = left X, Leg2 = right X; Y at hoof level.
 */
export function detectLegColumnsFromPhoto(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  bbox: BBox,
  facing: CowFacing = "head_right"
): { x1: number; x2: number; y1: number; y2: number } | null {
  const legCtx = buildLegColumnScores(data, w, h, bbox);
  if (!legCtx) return null;

  const { scores, x0, yBottom, yScanTop, threshold, minScore, minSep } = legCtx;

  const bestLeft = pickLeftLegColumn(scores, x0, bbox, facing, minScore, minSep);
  if (!bestLeft) return null;

  const legX1 = x0 + bestLeft.xi;
  const bestRight = pickRightLegColumn(scores, x0, bbox, facing, legX1, minScore, minSep);
  if (!bestRight) return null;

  if (Math.abs(bestLeft.xi - bestRight.xi) < minSep) return null;

  const legX2 = x0 + bestRight.xi;

  const fFrac = (legX1 - bbox.x) / bbox.width;
  const hFrac = (legX2 - bbox.x) / bbox.width;
  if (
    fFrac > CENTER_BELLY_LO &&
    fFrac < CENTER_BELLY_HI &&
    hFrac > CENTER_BELLY_LO &&
    hFrac < CENTER_BELLY_HI
  ) {
    return null;
  }

  const y1 = legBodyYForColumn(data, w, legX1, yBottom, yScanTop, threshold);
  const y2 = legHoofYForColumn(data, w, legX2, yBottom, yScanTop, threshold);

  return { x1: legX1, x2: legX2, y1, y2 };
}

function detectLegPair(
  data: Uint8ClampedArray,
  w: number,
  bbox: BBox
): { x1: number; x2: number } | null {
  const x0 = Math.max(0, Math.floor(bbox.x + bbox.width * LEG_X_MARGIN));
  const x1 = Math.min(w - 1, Math.floor(bbox.x + bbox.width * (1 - LEG_X_MARGIN)));
  const y0 = Math.max(0, Math.floor(bbox.y + bbox.height * LEG_ROI_Y_START));
  const y1 = Math.min(
    data.length / (w * 4) - 1,
    Math.floor(bbox.y + bbox.height * LEG_ROI_Y_END)
  );

  if (x1 <= x0 || y1 <= y0) return null;

  const profileLen = x1 - x0 + 1;
  const profile = new Array(profileLen).fill(0);

  for (let xi = 0; xi < profileLen; xi++) {
    const x = x0 + xi;
    let edge = 0;
    for (let y = y0 + 1; y <= y1; y++) {
      const i = (y * w + x) * 4;
      const iPrev = ((y - 1) * w + x) * 4;
      edge += Math.abs(lum(data, i) - lum(data, iPrev));
    }
    profile[xi] = edge;
  }

  const maxScore = Math.max(...profile, 0);
  if (maxScore <= 0) return null;

  const smoothed = smoothProfile(profile, SMOOTH_RADIUS);
  const minSep = Math.max(8, Math.floor(bbox.width * LEG_MIN_SEP_FRAC));
  const mergeSep = Math.max(4, Math.floor(bbox.width * LEG_MERGE_FRAC));
  const minScore = maxScore * LEG_MIN_SCORE_FRAC;

  const peaks = findLocalMaxima(smoothed, 3);
  const clusters = mergePeaksToClusters(peaks, mergeSep);
  return pickLegPair(clusters, minSep, minScore * 0.5, bbox, x0);
}

function lowerChestFallbackY(bbox: BBox): number {
  return bbox.y + bbox.height * LOWER_CHEST_FALLBACK_FRAC;
}

function topChestFallbackY(bbox: BBox): number {
  return bbox.y + bbox.height * TOP_CHEST_FALLBACK_FRAC;
}

function detectTopChestY(
  data: Uint8ClampedArray,
  w: number,
  bbox: BBox,
  chestX: number,
  lowerChestY: number,
  cowThreshold?: number
): { y: number; detected: boolean } {
  const fallbackY = topChestFallbackY(bbox);
  const minY = Math.floor(bbox.y + bbox.height * TOP_CHEST_Y_START);
  const maxY = Math.floor(lowerChestY - bbox.height * MIN_CHEST_SPAN_FRAC);
  const x = Math.max(0, Math.min(w - 1, Math.round(chestX)));
  const yStart = minY;
  const yEnd = Math.floor(bbox.y + bbox.height * TOP_CHEST_Y_END);
  if (yEnd <= yStart || maxY <= minY) {
    return { y: Math.max(minY, Math.min(fallbackY, maxY)), detected: false };
  }

  let threshold = cowThreshold;
  if (threshold === undefined) {
    const samples: number[] = [];
    for (let y = yStart; y <= yEnd; y++) {
      for (let cx = Math.floor(bbox.x); cx <= Math.floor(bbox.x + bbox.width); cx++) {
        samples.push(luminanceAt(data, w, cx, y));
      }
    }
    threshold = percentileLum(samples, 0.42);
  }

  const minBodyWidth = bbox.width * MIN_BODY_WIDTH_FRAC;
  const candidates: Array<{ y: number; edge: number }> = [];

  for (let y = yStart + 1; y < yEnd; y++) {
    const bodyW = bodyWidthAtRow(data, w, bbox, y, x, threshold);
    if (bodyW < minBodyWidth) continue;

    let edge = 0;
    const halfBand = Math.max(3, Math.floor(bbox.width * 0.08));
    for (let dx = -halfBand; dx <= halfBand; dx++) {
      const col = x + dx;
      if (col < 0 || col >= w) continue;
      const i = (y * w + col) * 4;
      const iPrev = ((y - 1) * w + col) * 4;
      edge += Math.abs(lum(data, i) - lum(data, iPrev));
    }
    candidates.push({ y, edge });
  }

  const peakEdge = candidates.reduce((m, c) => Math.max(m, c.edge), 0);
  if (!candidates.length || peakEdge < 80) {
    return { y: Math.max(minY, Math.min(fallbackY, maxY)), detected: false };
  }

  const edgeFloor = peakEdge * TOP_CHEST_EDGE_PEAK_FRAC;
  const strong = candidates.filter((c) => c.edge >= edgeFloor);
  let resultY = strong.reduce((best, c) => (c.y < best ? c.y : best), strong[0].y);

  if (resultY > fallbackY) {
    resultY = fallbackY;
  }
  resultY = Math.max(minY, Math.min(resultY, maxY));
  return { y: resultY, detected: true };
}

function detectLowerChestY(
  data: Uint8ClampedArray,
  w: number,
  bbox: BBox,
  chestX: number,
  cowThreshold?: number,
  legMidY?: number
): { y: number; detected: boolean } {
  const fallbackY = lowerChestFallbackY(bbox);
  const maxY = Math.floor(bbox.y + bbox.height * LOWER_CHEST_MAX_FRAC);
  const legCeiling =
    legMidY !== undefined
      ? legMidY - bbox.height * LEG_CHEST_CEILING_MARGIN
      : Infinity;
  const x = Math.max(0, Math.min(w - 1, Math.round(chestX)));
  const yStart = Math.floor(bbox.y + bbox.height * LOWER_CHEST_Y_START);
  const yEnd = Math.floor(bbox.y + bbox.height * LOWER_CHEST_Y_END);
  if (yEnd <= yStart) {
    return { y: Math.min(fallbackY, maxY, legCeiling), detected: false };
  }

  let threshold = cowThreshold;
  if (threshold === undefined) {
    const samples: number[] = [];
    for (let y = yStart; y <= yEnd; y++) {
      for (let cx = Math.floor(bbox.x); cx <= Math.floor(bbox.x + bbox.width); cx++) {
        samples.push(luminanceAt(data, w, cx, y));
      }
    }
    threshold = percentileLum(samples, 0.42);
  }

  const minBodyWidth = bbox.width * MIN_BODY_WIDTH_FRAC;
  const candidates: Array<{ y: number; edge: number }> = [];

  for (let y = yStart + 1; y < yEnd; y++) {
    const bodyW = bodyWidthAtRow(data, w, bbox, y, x, threshold);
    if (bodyW < minBodyWidth) continue;

    let edge = 0;
    const halfBand = Math.max(3, Math.floor(bbox.width * 0.08));
    for (let dx = -halfBand; dx <= halfBand; dx++) {
      const col = x + dx;
      if (col < 0 || col >= w) continue;
      const i = (y * w + col) * 4;
      const iPrev = ((y - 1) * w + col) * 4;
      edge += Math.abs(lum(data, i) - lum(data, iPrev));
    }
    candidates.push({ y, edge });
  }

  const peakEdge = candidates.reduce((m, c) => Math.max(m, c.edge), 0);
  if (!candidates.length || peakEdge < 80) {
    return { y: Math.min(fallbackY, maxY, legCeiling), detected: false };
  }

  const edgeFloor = peakEdge * LOWER_CHEST_EDGE_PEAK_FRAC;
  const strong = candidates.filter((c) => c.edge >= edgeFloor);
  let resultY = strong.reduce((best, c) => (c.y < best ? c.y : best), strong[0].y);
  resultY = Math.min(resultY, maxY, legCeiling);

  if (resultY > fallbackY) {
    resultY = fallbackY;
  }
  resultY = Math.min(resultY, maxY, legCeiling);
  return { y: resultY, detected: true };
}

function detectLengthEnds(
  data: Uint8ClampedArray,
  w: number,
  bbox: BBox,
  lengthY: number
): { l1: Point2D; l2: Point2D; detected: boolean } {
  const y = Math.max(0, Math.min(Math.floor(lengthY), Math.floor(bbox.y + bbox.height - 1)));
  const x0 = Math.floor(bbox.x + PAD);
  const x1 = Math.floor(bbox.x + bbox.width - PAD);
  if (x1 <= x0) {
    return {
      l1: pt(bbox.x + bbox.width * LENGTH_START_FRAC, lengthY),
      l2: pt(bbox.x + bbox.width * LENGTH_END_FRAC, lengthY),
      detected: false,
    };
  }

  const profileLen = x1 - x0 + 1;
  const profile = new Array(profileLen).fill(0);

  for (let xi = 0; xi < profileLen; xi++) {
    const x = x0 + xi;
    let edge = 0;
    for (let dy = -2; dy <= 2; dy++) {
      const row = y + dy;
      if (row < 1 || row >= data.length / (w * 4)) continue;
      const i = (row * w + x) * 4;
      const iLeft = (row * w + x - 1) * 4;
      edge += Math.abs(lum(data, i) - lum(data, iLeft));
    }
    profile[xi] = edge;
  }

  const maxScore = Math.max(...profile, 0);
  if (maxScore <= 0) {
    return {
      l1: pt(bbox.x + bbox.width * LENGTH_START_FRAC, lengthY),
      l2: pt(bbox.x + bbox.width * LENGTH_END_FRAC, lengthY),
      detected: false,
    };
  }

  const smoothed = smoothProfile(profile, SMOOTH_RADIUS);
  const minSep = Math.max(12, Math.floor(bbox.width * 0.25));
  const peaks = findLocalMaxima(smoothed, minSep);

  if (peaks.length >= 2) {
    const sorted = [...peaks].sort((a, b) => a.index - b.index);
    const left = sorted[0];
    const right = sorted[sorted.length - 1];
    if (right.index - left.index >= minSep) {
      return {
        l1: pt(x0 + left.index, lengthY),
        l2: pt(x0 + right.index, lengthY),
        detected: true,
      };
    }
  }

  return {
    l1: pt(bbox.x + bbox.width * LENGTH_START_FRAC, lengthY),
    l2: pt(bbox.x + bbox.width * LENGTH_END_FRAC, lengthY),
    detected: false,
  };
}

export interface DetectCowKeypointsOptions {
  /** Cloud-confirmed head direction — runs existing left/right leg paths from the start. */
  forcedFacing?: CowFacing | null;
  directionSource?: "vision" | "local";
  visionHeadBbox?: BBox | null;
}

export function detectCowKeypoints(
  canvas: HTMLCanvasElement,
  bbox: BBox,
  bodyMask?: CowBodyMask,
  options?: DetectCowKeypointsOptions
): CowKeypoints {
  const forcedFacing = options?.forcedFacing ?? null;
  const { x, y, width, height } = bbox;
  const legMidY = y + height * ((LEG_ROI_Y_START + LEG_ROI_Y_END) / 2);
  const lengthY = y + height * LENGTH_Y_FRAC;

  let chestCenterX = x + width / 2;
  let leg1 = pt(x + width * LEG_FRONT_X_FRAC, legMidY);
  let leg2 = pt(x + width * LEG_HIND_X_FRAC, legMidY);
  let legsDetected = false;
  let lowerChestDetected = false;
  let topChestDetected = false;
  let lengthDetected = false;
  let facing: CowFacing = "head_right";

  const ctx = canvas.getContext("2d");
  if (ctx && width > 0 && height > 0) {
    const w = canvas.width;
    const h = canvas.height;
    const data = ctx.getImageData(0, 0, w, h).data;

    const useMask = bodyMask && maskIsUsable(bodyMask, bbox);

    let geomColA: Point2D | null = null;
    let geomColB: Point2D | null = null;
    let legsInferred = false;
    let maskLegSep = 0;

    const lowerRoiSamples: number[] = [];
    const yLo = Math.floor(y + height * LOWER_CHEST_Y_START);
    const yHi = Math.floor(y + height * LOWER_CHEST_Y_END);
    for (let yy = yLo; yy <= yHi; yy++) {
      for (let cx = Math.floor(x); cx <= Math.floor(x + width); cx++) {
        lowerRoiSamples.push(luminanceAt(data, w, cx, yy));
      }
    }
    const cowThreshold = percentileLum(lowerRoiSamples, 0.42);

    const detectedLegMidY = legsDetected ? (leg1.y + leg2.y) / 2 : undefined;
    const lower = detectLowerChestY(data, w, bbox, chestCenterX, cowThreshold, detectedLegMidY);
    lowerChestDetected = lower.detected;

    let topY = topChestFallbackY(bbox);
    if (useMask) {
      const withers = withersFromMask(bodyMask, bbox);
      if (withers) {
        topY = withers.y;
        chestCenterX = withers.centerX;
        topChestDetected = true;
      }
    }
    const top = detectTopChestY(data, w, bbox, chestCenterX, lower.y, cowThreshold);
    if (top.detected) {
      topY = top.y;
      topChestDetected = true;
    } else if (!topChestDetected) {
      topY = top.y;
    }

    let lengthEnds = detectLengthEnds(data, w, bbox, lengthY);
    if (useMask) {
      const maskLen = lengthEndsFromMask(bodyMask, bbox, lengthY);
      if (maskLen) {
        lengthEnds = { l1: maskLen.l1, l2: maskLen.l2, detected: true };
      }
    }
    lengthDetected = lengthEnds.detected;

    const resolved = resolveBodyHeadDirection(
      data,
      w,
      h,
      bbox,
      lengthEnds,
      useMask ? bodyMask : undefined,
      lengthY
    );

    if (forcedFacing) {
      const ordered = orderLengthKeypointsForFacing(lengthEnds.l1, lengthEnds.l2, forcedFacing);
      lengthEnds = { l1: ordered.l1, l2: ordered.l2, detected: lengthEnds.detected };
    }

    const legFacing: CowFacing = forcedFacing ?? resolved.facing ?? "head_right";
    facing = legFacing;

    if (useMask) {
      const maskLegs = legColumnsFromMask(bodyMask, bbox);
      if (maskLegs) {
        maskLegSep = legPairSeparation(maskLegs.x1, maskLegs.x2);
        if (maskLegSep >= width * MIN_LEG_SEP_FRAC) {
          legsDetected = true;
          geomColA = pt(maskLegs.x1, maskLegs.y);
          geomColB = pt(maskLegs.x2, maskLegs.y);
          chestCenterX = (maskLegs.x1 + maskLegs.x2) / 2;
        } else if (maskLegSep > 0) {
          geomColA = pt(maskLegs.x1, maskLegs.y);
        }
      }
    }

    if (!geomColB) {
      const photoSeed = detectLegColumnsFromPhoto(data, w, h, bbox, legFacing);
      if (photoSeed) {
        const photoSep = legPairSeparation(photoSeed.x1, photoSeed.x2);
        if (photoSep >= width * MIN_LEG_SEP_FRAC && photoLegsBetter(photoSeed, maskLegSep, width)) {
          legsDetected = true;
          geomColA = pt(photoSeed.x1, photoSeed.y1);
          geomColB = pt(photoSeed.x2, photoSeed.y2);
          chestCenterX = (photoSeed.x1 + photoSeed.x2) / 2;
        } else if (!geomColA && photoSep > width * 0.06) {
          geomColA = pt(photoSeed.x1, photoSeed.y1);
        }
      }
    }

    if (!geomColB) {
      const edgeLegs = detectLegPair(data, w, bbox);
      if (edgeLegs && legPairSeparation(edgeLegs.x1, edgeLegs.x2) >= width * MIN_LEG_SEP_FRAC) {
        legsDetected = true;
        geomColA = pt(edgeLegs.x1, legMidY);
        geomColB = pt(edgeLegs.x2, legMidY);
        chestCenterX = (edgeLegs.x1 + edgeLegs.x2) / 2;
      } else if (!geomColA && edgeLegs) {
        geomColA = pt(edgeLegs.x1, legMidY);
      }
    }

    if (geomColA && !geomColB && legFacing) {
      const completed = completeLegPairFromFacing(
        legFacing,
        geomColA,
        null,
        bbox,
        lengthEnds.l1,
        legMidY
      );
      geomColA = completed.colA;
      geomColB = completed.colB;
      legsDetected = true;
      legsInferred = completed.inferred;
      chestCenterX = (geomColA.x + geomColB.x) / 2;
    }

    if (geomColA && geomColB) {
      const assigned = assignLegsByFacing(legFacing, geomColA, geomColB);
      leg1 = assigned.leg1;
      leg2 = assigned.leg2;
    }

    const lenSR = lengthShoulderRearPoints(
      bbox,
      {
        leg1,
        leg2,
        detected: { facing: legFacing, legs: legsDetected },
      },
      useMask ? bodyMask : undefined,
      lengthY
    );
    lengthEnds = { l1: lenSR.rear, l2: lenSR.shoulder, detected: lenSR.detected };
    lengthDetected = lenSR.detected;

    let topChest = pt(chestCenterX, topY);
    let lowerChest = pt(chestCenterX, lower.y);
    if (useMask) {
      const topRow = maskRowExtent(bodyMask, topChest.y);
      const lowRow = maskRowExtent(bodyMask, lowerChest.y);
      if (topRow) topChest = pt((topRow.left + topRow.right) / 2, topChest.y);
      if (lowRow) lowerChest = pt((lowRow.left + lowRow.right) / 2, lowerChest.y);
      if (topRow || lowRow) {
        chestCenterX = (topChest.x + lowerChest.x) / 2;
      }
    }
    if (topChest.y >= lowerChest.y) {
      const gap = Math.max(height * MIN_CHEST_SPAN_FRAC, 8);
      topChest = pt(chestCenterX, lower.y - gap);
      lowerChestDetected = true;
      topChestDetected = true;
    }

    const attachFacing: CowFacing | null = forcedFacing ?? resolved.facing;

    if (!attachFacing) {
      legsDetected = false;
    }

    const bodyDirection: CowBodyDirection | undefined = forcedFacing
      ? {
          ...cowBodyDirectionFromHeadSide(
            forcedFacing === "head_left" ? "left" : "right",
            options?.directionSource === "vision" ? "vision" : "unknown"
          ),
          headBbox: options?.visionHeadBbox ?? resolved.bodyDirection?.headBbox ?? null,
          directionIssueKey: null,
        }
      : resolved.bodyDirection;

    return attachBodyDirectionToKeypoints(
      {
        leg1,
        leg2,
        topChest,
        lowerChest,
        l1: lengthEnds.l1,
        l2: lengthEnds.l2,
        chestCenterX,
        detected: {
          legs: legsDetected,
          legsInferred: legsInferred || undefined,
          lowerChest: lowerChestDetected,
          topChest: topChestDetected,
          length: lengthDetected,
        },
      },
      attachFacing,
      bodyDirection
    );
  }

  const topChest = pt(chestCenterX, y + height * TOP_CHEST_FALLBACK_FRAC);
  const lowerChest = pt(chestCenterX, y + height * LOWER_CHEST_FALLBACK_FRAC);
  return {
    leg1,
    leg2,
    topChest,
    lowerChest,
    l1: pt(x + width * LENGTH_START_FRAC, lengthY),
    l2: pt(x + width * LENGTH_END_FRAC, lengthY),
    chestCenterX,
    detected: {
      legs: false,
      lowerChest: false,
      topChest: false,
      length: false,
    },
  };
}

export function legCentersFromKeypoints(kp: CowKeypoints): LegCenters {
  return { x1: kp.leg1.x, x2: kp.leg2.x };
}

/** Always returns keypoints for Step 1 overlay (handles stale sessions without analysis.keypoints). */
export function resolveStep1Keypoints(
  keypoints: CowKeypoints | null | undefined,
  lines: CowLines,
  bbox: BBox
): CowKeypoints {
  if (keypoints) return keypoints;

  const { x, y, width, height } = bbox;
  const legMidY = y + height * ((LEG_ROI_Y_START + LEG_ROI_Y_END) / 2);
  const leg1 = pt(x + width * LEG_FRONT_X_FRAC, legMidY);
  const leg2 = pt(x + width * LEG_HIND_X_FRAC, legMidY);
  const chestCenterX = (lines.chest.a.x + lines.chest.b.x) / 2;

  return {
    leg1,
    leg2,
    topChest: { ...lines.chest.a },
    lowerChest: { ...lines.chest.b },
    l1: { ...lines.length.b },
    l2: { ...lines.length.a },
    chestCenterX,
    detected: { legs: false, lowerChest: false, topChest: false, length: false },
  };
}

/** Build chest + length lines from keypoints (length = shoulder → rear). */
export function proposeLinesFromKeypoints(
  bbox: BBox,
  keypoints: CowKeypoints,
  bodyMask?: CowBodyMask
): CowLines {
  const cx = keypoints.chestCenterX;
  const chest: CowLines["chest"] = {
    a: { x: cx, y: keypoints.topChest.y },
    b: { x: cx, y: keypoints.lowerChest.y },
  };
  const { shoulder, rear } = lengthShoulderRearPoints(bbox, keypoints, bodyMask);
  return {
    chest,
    length: { a: { ...shoulder }, b: { ...rear } },
  };
}
