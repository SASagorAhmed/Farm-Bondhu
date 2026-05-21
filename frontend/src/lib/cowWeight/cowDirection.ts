import type { BBox, CowKeypoints, Point2D } from "./types";
import {
  headSideFromMaskHeadThirds,
  headSideFromMaskHeadTip,
  headSideFromMaskNarrowBand,
  headSideFromMaskWidthAtLengthRow,
  MASK_HEAD_BAND_Y0,
  MASK_HEAD_BAND_Y1,
  MASK_TAIL_BAND_Y0,
  MASK_TAIL_BAND_Y1,
  maskSpansFullBboxWidth,
  tailSideFromMaskHindCentroid,
  tailSideFromMaskHindExtremity,
  tailSideFromMaskHindThirds,
  tailSideFromMaskLengthRowThirds,
  tailSideFromMaskTorsoThirds,
  type CowBodyMask,
} from "./cowMask";

export type ImageSide = "left" | "right" | "unknown";
export type CowDirectionLabel = "normal" | "reverse" | "unknown";
export type CowFacing = "head_left" | "head_right";
export type DirectionSource =
  | "length"
  | "tail"
  | "head_band"
  | "legs"
  | "mask_legacy"
  | "vision"
  | "unknown";

export interface CowBodyDirection {
  headSide: ImageSide;
  tailSide: ImageSide;
  direction: CowDirectionLabel;
  isReversed: boolean;
  /** How head/tail side was resolved (UI hint). */
  source?: DirectionSource;
  /** i18n key when headSide is unknown — explains why auto-detect failed. */
  directionIssueKey?: string | null;
  /** Approximate head region in image coordinates (mask heuristic or vision API). */
  headBbox?: BBox | null;
}

const BAND_MARGIN_FRAC = 0.03;
const HORIZONTAL_Y_TOL_FRAC = 0.05;
const END_WINDOW_FRAC = 0.15;

const WEIGHT_HEAD_THIRDS = 12;
const WEIGHT_HEAD_CENTROID = 6;
const WEIGHT_LENGTH_HEAD_RATIO = 8;
const END_HEAD_ONLY_RATIO = 1.2;
/** When head-tip and length-end head disagree, trust length-end above this ratio. */
const END_HEAD_OVERRIDE_TIP_RATIO = 3;
const WEIGHT_HIND_CENTROID = 8;
const WEIGHT_TORSO_THIRDS = 7;
const WEIGHT_LENGTH_TAIL = 6;
const WEIGHT_LENGTH_ROW = 6;
const WEIGHT_TAIL_THIRDS = 7;
const WEIGHT_TAIL_EXTREMITY = 1;
const HEAD_RATIO_MIN = 1.35;
/** Minimum weighted score to accept head from vote tally (last resort). */
const HEAD_VOTE_MIN_SCORE = 8;
/** Hind/torso tail votes required before inferring head from tail. */
const TAIL_FALLBACK_MIN_SCORE = 14;
const HEAD_VOTE_CONFIDENT_SCORE = 18;
const THIRDS_MIN_PIXELS = 20;
const END_HEAD_MIN_MASS = 6;

function lum(data: Uint8ClampedArray, i: number): number {
  return data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
}

function luminanceAt(data: Uint8ClampedArray, w: number, x: number, y: number): number {
  if (x < 0 || y < 0 || y >= data.length / (w * 4)) return 255;
  return lum(data, (y * w + x) * 4);
}

export function bboxCenterX(bbox: BBox): number {
  return bbox.x + bbox.width / 2;
}

export function imageSideFromX(x: number, bbox: BBox, marginFrac = BAND_MARGIN_FRAC): ImageSide {
  const center = bboxCenterX(bbox);
  const margin = bbox.width * marginFrac;
  if (x < center - margin) return "left";
  if (x > center + margin) return "right";
  return "unknown";
}

export function oppositeSide(side: ImageSide): ImageSide {
  if (side === "left") return "right";
  if (side === "right") return "left";
  return "unknown";
}

export function cowBodyDirectionFromHeadSide(
  headSide: ImageSide,
  source?: DirectionSource
): CowBodyDirection {
  if (headSide === "left") {
    return {
      headSide: "left",
      tailSide: "right",
      direction: "normal",
      isReversed: false,
      source,
    };
  }
  if (headSide === "right") {
    return {
      headSide: "right",
      tailSide: "left",
      direction: "reverse",
      isReversed: true,
      source,
    };
  }
  return {
    headSide: "unknown",
    tailSide: "unknown",
    direction: "unknown",
    isReversed: false,
    source: source ?? "unknown",
  };
}

export function headSideFromFacing(facing: CowFacing): ImageSide {
  return facing === "head_left" ? "left" : "right";
}

export function facingFromHeadSide(headSide: ImageSide): CowFacing | null {
  if (headSide === "left") return "head_left";
  if (headSide === "right") return "head_right";
  return null;
}

export function cowBodyDirectionFromFacing(facing: CowFacing): CowBodyDirection {
  return cowBodyDirectionFromHeadSide(headSideFromFacing(facing), "unknown");
}

/** L1 = rear/tail, L2 = head (photo left/right). */
export function orderLengthKeypointsForFacing(
  l1: Point2D,
  l2: Point2D,
  facing: CowFacing
): { l1: Point2D; l2: Point2D } {
  const left = l1.x <= l2.x ? l1 : l2;
  const right = l1.x <= l2.x ? l2 : l1;
  if (facing === "head_left") {
    return { l1: right, l2: left };
  }
  return { l1: left, l2: right };
}

type SideVote = { side: ImageSide; weight: number; source: DirectionSource };

function addVote(votes: SideVote[], side: ImageSide, weight: number, source: DirectionSource) {
  if (side === "unknown" || weight <= 0) return;
  votes.push({ side, weight, source });
}

function tallySide(votes: SideVote[]): { side: ImageSide; source: DirectionSource } {
  const scores = { left: 0, right: 0 };
  const sourceWeight: Record<string, { w: number; source: DirectionSource }> = {
    left: { w: 0, source: "unknown" },
    right: { w: 0, source: "unknown" },
  };

  for (const v of votes) {
    if (v.side === "left" || v.side === "right") {
      scores[v.side] += v.weight;
      if (v.weight > sourceWeight[v.side].w) {
        sourceWeight[v.side] = { w: v.weight, source: v.source };
      }
    }
  }

  if (scores.left === scores.right) return { side: "unknown", source: "unknown" };
  if (scores.left > scores.right) {
    return { side: "left", source: sourceWeight.left.source };
  }
  return { side: "right", source: sourceWeight.right.source };
}

/** X range sampling outward from a length end toward the nearer bbox edge. */
function xRangeOutwardFromEnd(
  end: Point2D,
  bbox: BBox,
  maxX: number
): { x0: number; x1: number } {
  const halfW = bbox.width * END_WINDOW_FRAC;
  const center = bboxCenterX(bbox);
  if (end.x <= center) {
    return {
      x0: Math.max(0, Math.floor(bbox.x)),
      x1: Math.min(maxX, Math.ceil(end.x + halfW * 0.4)),
    };
  }
  return {
    x0: Math.max(0, Math.floor(end.x - halfW * 0.4)),
    x1: Math.min(maxX, Math.ceil(bbox.x + bbox.width)),
  };
}

/** Mass in a vertical band, windowed outward from one length end (mask). */
function maskMassNearEndOutward(
  mask: CowBodyMask,
  bbox: BBox,
  end: Point2D,
  yStartFrac: number,
  yEndFrac: number
): number {
  const { x0, x1 } = xRangeOutwardFromEnd(end, bbox, mask.width - 1);
  const y0 = Math.max(0, Math.floor(bbox.y + bbox.height * yStartFrac));
  const y1 = Math.min(mask.height - 1, Math.floor(bbox.y + bbox.height * yEndFrac));
  let n = 0;
  for (let y = y0; y <= y1; y++) {
    const off = y * mask.width;
    for (let x = x0; x <= x1; x++) {
      if (mask.data[off + x]) n++;
    }
  }
  return n;
}

/**
 * Head side from length ends — no "higher point = head" for horizontal side views.
 */
function luminanceMassNearEndOutward(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  bbox: BBox,
  end: Point2D,
  yStartFrac: number,
  yEndFrac: number
): number {
  const { x0, x1 } = xRangeOutwardFromEnd(end, bbox, w - 1);
  const y0 = Math.max(0, Math.floor(bbox.y + bbox.height * yStartFrac));
  const y1 = Math.min(h - 1, Math.floor(bbox.y + bbox.height * yEndFrac));
  const samples: number[] = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      samples.push(luminanceAt(data, w, x, y));
    }
  }
  if (!samples.length) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const threshold = sorted[Math.floor(sorted.length * 0.42)];
  let n = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (luminanceAt(data, w, x, y) < threshold) n++;
    }
  }
  return n;
}

function tailMassAtEnd(
  leftEnd: Point2D,
  rightEnd: Point2D,
  bbox: BBox,
  bodyMask?: CowBodyMask,
  data?: Uint8ClampedArray | null,
  w?: number,
  h?: number
): { leftTail: number; rightTail: number } | null {
  if (bodyMask) {
    return {
      leftTail: maskMassNearEndOutward(bodyMask, bbox, leftEnd, MASK_TAIL_BAND_Y0, MASK_TAIL_BAND_Y1),
      rightTail: maskMassNearEndOutward(bodyMask, bbox, rightEnd, MASK_TAIL_BAND_Y0, MASK_TAIL_BAND_Y1),
    };
  }
  if (data && w && h) {
    return {
      leftTail: luminanceMassNearEndOutward(data, w, h, bbox, leftEnd, MASK_TAIL_BAND_Y0, MASK_TAIL_BAND_Y1),
      rightTail: luminanceMassNearEndOutward(data, w, h, bbox, rightEnd, MASK_TAIL_BAND_Y0, MASK_TAIL_BAND_Y1),
    };
  }
  return null;
}

function headBandMassAtEnds(
  leftEnd: Point2D,
  rightEnd: Point2D,
  bbox: BBox,
  bodyMask?: CowBodyMask,
  data?: Uint8ClampedArray | null,
  w?: number,
  h?: number
): { leftHead: number; rightHead: number } | null {
  if (bodyMask) {
    return {
      leftHead: maskMassNearEndOutward(bodyMask, bbox, leftEnd, MASK_HEAD_BAND_Y0, MASK_HEAD_BAND_Y1),
      rightHead: maskMassNearEndOutward(bodyMask, bbox, rightEnd, MASK_HEAD_BAND_Y0, MASK_HEAD_BAND_Y1),
    };
  }
  if (data && w && h) {
    return {
      leftHead: luminanceMassNearEndOutward(data, w, h, bbox, leftEnd, MASK_HEAD_BAND_Y0, MASK_HEAD_BAND_Y1),
      rightHead: luminanceMassNearEndOutward(data, w, h, bbox, rightEnd, MASK_HEAD_BAND_Y0, MASK_HEAD_BAND_Y1),
    };
  }
  return null;
}

/** Head on photo left/right from head-band mass at length ends (not inverted to tail). */
export function headSideFromLengthEndHeadRatio(
  l1: Point2D,
  l2: Point2D,
  bbox: BBox,
  bodyMask?: CowBodyMask,
  data?: Uint8ClampedArray | null,
  w?: number,
  h?: number
): ImageSide {
  const leftEnd = l1.x <= l2.x ? l1 : l2;
  const rightEnd = l1.x <= l2.x ? l2 : l1;
  const headMass = headBandMassAtEnds(leftEnd, rightEnd, bbox, bodyMask, data, w, h);
  if (!headMass) return "unknown";
  const { leftHead, rightHead } = headMass;
  if (rightHead > leftHead * HEAD_RATIO_MIN && rightHead > END_HEAD_MIN_MASS) {
    return "right";
  }
  if (leftHead > rightHead * HEAD_RATIO_MIN && leftHead > END_HEAD_MIN_MASS) {
    return "left";
  }
  return "unknown";
}

/**
 * Legacy: head band at ends → inferred tail side (used only in tests / debug).
 */
export function tailSideFromLengthEndHeadContrast(
  l1: Point2D,
  l2: Point2D,
  bbox: BBox,
  bodyMask?: CowBodyMask,
  data?: Uint8ClampedArray | null,
  w?: number,
  h?: number
): ImageSide {
  const leftEnd = l1.x <= l2.x ? l1 : l2;
  const rightEnd = l1.x <= l2.x ? l2 : l1;
  const headMass = headBandMassAtEnds(leftEnd, rightEnd, bbox, bodyMask, data, w, h);
  const tailMass = tailMassAtEnd(leftEnd, rightEnd, bbox, bodyMask, data, w, h);
  if (!headMass) return "unknown";

  const { leftHead, rightHead } = headMass;
  const leftTail = tailMass?.leftTail ?? 0;
  const rightTail = tailMass?.rightTail ?? 0;

  if (
    rightHead > leftHead + END_HEAD_MIN_MASS &&
    rightHead > END_HEAD_MIN_MASS &&
    rightTail <= leftTail + 4
  ) {
    return "left";
  }
  if (
    leftHead > rightHead + END_HEAD_MIN_MASS &&
    leftHead > END_HEAD_MIN_MASS &&
    leftTail <= rightTail + 4
  ) {
    return "right";
  }
  return "unknown";
}

/** Head side from head-band mass at length ends only (ignores tail-band noise). */
function headSideFromEndHeadMass(endMass: {
  leftHead: number;
  rightHead: number;
}): ImageSide {
  const { leftHead, rightHead } = endMass;
  if (rightHead > leftHead * END_HEAD_ONLY_RATIO && rightHead > END_HEAD_MIN_MASS) {
    return "right";
  }
  if (leftHead > rightHead * END_HEAD_ONLY_RATIO && leftHead > END_HEAD_MIN_MASS) {
    return "left";
  }
  return "unknown";
}

/** Which length end has more hind/tail band mass (photo left vs right). */
export function tailSideFromLengthEnds(
  l1: Point2D,
  l2: Point2D,
  bbox: BBox,
  bodyMask?: CowBodyMask,
  data?: Uint8ClampedArray | null,
  w?: number,
  h?: number
): ImageSide {
  const leftEnd = l1.x <= l2.x ? l1 : l2;
  const rightEnd = l1.x <= l2.x ? l2 : l1;
  const masses = tailMassAtEnd(leftEnd, rightEnd, bbox, bodyMask, data, w, h);
  if (masses) {
    const minMass = 8;
    const { leftTail, rightTail } = masses;
    if (leftTail > rightTail + minMass && leftTail > minMass) return "left";
    if (rightTail > leftTail + minMass && rightTail > minMass) return "right";
  }
  return "unknown";
}

/** Hind-band silhouette mass in left vs right bbox thirds (luminance). */
function tailSideFromLuminanceBandThirds(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  bbox: BBox,
  yStartFrac: number,
  yEndFrac: number
): ImageSide {
  const x0 = Math.max(0, Math.floor(bbox.x));
  const x1 = Math.min(w - 1, Math.floor(bbox.x + bbox.width));
  const y0 = Math.max(0, Math.floor(bbox.y + bbox.height * yStartFrac));
  const y1 = Math.min(h - 1, Math.floor(bbox.y + bbox.height * yEndFrac));
  const xLeft = bbox.x + bbox.width / 3;
  const xRight = bbox.x + (2 * bbox.width) / 3;

  const samples: number[] = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      samples.push(luminanceAt(data, w, x, y));
    }
  }
  if (!samples.length) return "unknown";
  const sorted = [...samples].sort((a, b) => a - b);
  const threshold = sorted[Math.floor(sorted.length * 0.42)];

  let leftCount = 0;
  let rightCount = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (luminanceAt(data, w, x, y) >= threshold) continue;
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

function tailSideFromLuminanceHindThirds(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  bbox: BBox
): ImageSide {
  return tailSideFromLuminanceBandThirds(data, w, h, bbox, MASK_TAIL_BAND_Y0, MASK_TAIL_BAND_Y1);
}

function tailSideFromLuminanceTorsoThirds(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  bbox: BBox
): ImageSide {
  return tailSideFromLuminanceBandThirds(data, w, h, bbox, MASK_TORSO_BAND_Y0, MASK_TORSO_BAND_Y1);
}

function tailSideFromLuminanceLengthRowThirds(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  bbox: BBox,
  lengthY: number
): ImageSide {
  const iy = Math.round(lengthY);
  if (iy < 0 || iy >= h) return "unknown";
  const x0 = Math.max(0, Math.floor(bbox.x));
  const x1 = Math.min(w - 1, Math.floor(bbox.x + bbox.width));
  const xLeft = bbox.x + bbox.width / 3;
  const xRight = bbox.x + (2 * bbox.width) / 3;

  const samples: number[] = [];
  for (let x = x0; x <= x1; x++) {
    samples.push(luminanceAt(data, w, x, iy));
  }
  if (!samples.length) return "unknown";
  const sorted = [...samples].sort((a, b) => a - b);
  const threshold = sorted[Math.floor(sorted.length * 0.42)];

  let leftCount = 0;
  let rightCount = 0;
  for (let x = x0; x <= x1; x++) {
    if (luminanceAt(data, w, x, iy) >= threshold) continue;
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

/** Hind-band protrusion from luminance (not centroid). */
function tailSideFromLuminanceHindExtremity(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  bbox: BBox
): ImageSide {
  const x0 = Math.max(0, Math.floor(bbox.x));
  const x1 = Math.min(w - 1, Math.floor(bbox.x + bbox.width));
  const y0 = Math.max(0, Math.floor(bbox.y + bbox.height * MASK_TAIL_BAND_Y0));
  const y1 = Math.min(h - 1, Math.floor(bbox.y + bbox.height * MASK_TAIL_BAND_Y1));

  const samples: number[] = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      samples.push(luminanceAt(data, w, x, y));
    }
  }
  if (!samples.length) return "unknown";
  const sorted = [...samples].sort((a, b) => a - b);
  const threshold = sorted[Math.floor(sorted.length * 0.42)];

  let leftMost = Infinity;
  let rightMost = -Infinity;
  let found = false;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (luminanceAt(data, w, x, y) < threshold) {
        found = true;
        leftMost = Math.min(leftMost, x);
        rightMost = Math.max(rightMost, x);
      }
    }
  }
  if (!found) return "unknown";

  const distLeft = leftMost - bbox.x;
  const distRight = bbox.x + bbox.width - rightMost;
  const tie = bbox.width * 0.02;
  if (Math.abs(distLeft - distRight) < tie) return "unknown";
  return distLeft < distRight ? "left" : "right";
}

function voteScores(votes: SideVote[]): { left: number; right: number } {
  const scores = { left: 0, right: 0 };
  for (const v of votes) {
    if (v.side === "left" || v.side === "right") scores[v.side] += v.weight;
  }
  return scores;
}

function asImageSide(v: string | undefined): ImageSide {
  return v === "left" || v === "right" ? v : "unknown";
}

function headEndDominanceRatio(endMass: {
  leftHead: number;
  rightHead: number;
}): number {
  const max = Math.max(endMass.leftHead, endMass.rightHead);
  const min = Math.min(endMass.leftHead, endMass.rightHead);
  if (min < END_HEAD_MIN_MASS) return max >= END_HEAD_MIN_MASS ? 99 : 0;
  return max / min;
}

/** Mask/outline cues only (length-line ratio can mirror wrong L1/L2). */
const MASK_HEAD_SIGNAL_KEYS = [
  "headWidthRow",
  "headTip",
  "headThirds",
  "headCentroid",
  "endHeadMass",
] as const;

function hasStrongHeadGeometry(
  signals: Record<string, string>,
  endMass: { leftHead: number; rightHead: number } | null
): boolean {
  if (asImageSide(signals.headWidthRow) !== "unknown") return true;
  const endHead = asImageSide(signals.endHeadMass);
  return (
    endMass != null &&
    endHead !== "unknown" &&
    headEndDominanceRatio(endMass) >= END_HEAD_ONLY_RATIO
  );
}

function countMaskHeadSignalsForSide(side: ImageSide, signals: Record<string, string>): number {
  let n = 0;
  const thirds = asImageSide(signals.headThirds);
  const centroid = asImageSide(signals.headCentroid);
  for (const key of MASK_HEAD_SIGNAL_KEYS) {
    if (key === "headCentroid" && thirds === centroid && thirds !== "unknown") continue;
    if (asImageSide(signals[key]) === side) n++;
  }
  return n;
}

/** Confident only with length-row width, strong end-mass, or tip + another mask cue. */
function isHeadDetectionConfident(
  side: ImageSide,
  signals: Record<string, string>,
  headVotes: SideVote[],
  endMass: { leftHead: number; rightHead: number } | null
): boolean {
  if (side === "unknown") return false;
  const endHead = asImageSide(signals.endHeadMass);
  if (
    endMass &&
    endHead !== "unknown" &&
    endHead !== side &&
    headEndDominanceRatio(endMass) >= END_HEAD_ONLY_RATIO
  ) {
    return false;
  }
  if (asImageSide(signals.headWidthRow) === side) return true;

  if (
    endMass &&
    endHead === side &&
    headEndDominanceRatio(endMass) >= END_HEAD_ONLY_RATIO
  ) {
    return true;
  }

  if (countMaskHeadSignalsForSide(side, signals) <= 1) return false;

  const scores = voteScores(headVotes);
  const tally = tallySide(headVotes);
  if (tally.side === side && scores[side] >= HEAD_VOTE_CONFIDENT_SCORE) {
    return true;
  }
  if (signals.maskFullWidth === "yes" && scores[side] >= HEAD_VOTE_CONFIDENT_SCORE) {
    return true;
  }
  return false;
}

function directionIssueKeyForFailedHead(
  signals: Record<string, string>,
  headVotes: SideVote[],
  endMass: { leftHead: number; rightHead: number } | null,
  hasMask: boolean
): string {
  if (!hasMask) return "cowWeight.scan.issueNoBodyOutline";
  const anyHead =
    countMaskHeadSignalsForSide("left", signals) +
      countMaskHeadSignalsForSide("right", signals) >
    0;
  if (!anyHead && !headVotes.length) {
    return "cowWeight.scan.issueSideViewUnclear";
  }
  if (endMass) {
    const ratio = headEndDominanceRatio(endMass);
    if (ratio > 1 && ratio < END_HEAD_ONLY_RATIO) {
      return "cowWeight.scan.issuePatchyCoat";
    }
  }
  return "cowWeight.scan.issueHeadNotClear";
}

/** Length-row / end-mass cue (more reliable than head-band on patchy coats). */
function headSideFromLengthCues(
  signals: Record<string, string>,
  endMass: { leftHead: number; rightHead: number } | null
): { side: ImageSide; strong: boolean } {
  const endHead = asImageSide(signals.endHeadMass);
  const lengthHead = asImageSide(signals.lengthHeadRatio);
  const endRatio = endMass ? headEndDominanceRatio(endMass) : 0;
  if (endHead !== "unknown" && endRatio >= END_HEAD_ONLY_RATIO) {
    return { side: endHead, strong: true };
  }
  if (lengthHead !== "unknown") return { side: lengthHead, strong: false };
  if (endHead !== "unknown") return { side: endHead, strong: false };
  return { side: "unknown", strong: false };
}

/**
 * Step 1: head on photo left/right (mask geometry only — black/white/brown cows).
 * Length ends and width row beat head-band wedges when they disagree (Holstein fix).
 */
function resolveHeadSidePrimary(
  signals: Record<string, string>,
  headVotes: SideVote[],
  endMass: { leftHead: number; rightHead: number } | null
): { side: ImageSide; source: DirectionSource } {
  const tip = asImageSide(signals.headTip);
  const endHead = asImageSide(signals.endHeadMass);
  const thirds = asImageSide(signals.headThirds);
  const centroid = asImageSide(signals.headCentroid);
  const endRatio = endMass ? headEndDominanceRatio(endMass) : 0;
  const widthRow = asImageSide(signals.headWidthRow);
  const lengthCue = headSideFromLengthCues(signals, endMass);

  if (widthRow !== "unknown") {
    return { side: widthRow, source: "head_band" };
  }

  if (lengthCue.side !== "unknown" && lengthCue.strong) {
    return { side: lengthCue.side, source: "length" };
  }

  const bandAgree =
    tip !== "unknown" && tip === thirds && tip === centroid
      ? tip
      : thirds !== "unknown" && centroid !== "unknown" && thirds === centroid
        ? thirds
        : "unknown";

  if (
    endHead !== "unknown" &&
    endRatio >= END_HEAD_ONLY_RATIO &&
    bandAgree !== "unknown" &&
    endHead !== bandAgree
  ) {
    return { side: endHead, source: "length" };
  }

  if (bandAgree !== "unknown") {
    if (lengthCue.side === "unknown" || lengthCue.side === bandAgree) {
      return { side: bandAgree, source: "head_band" };
    }
    return { side: lengthCue.side, source: "length" };
  }

  if (lengthCue.side !== "unknown") {
    return { side: lengthCue.side, source: "length" };
  }

  if (endHead !== "unknown" && endRatio >= END_HEAD_ONLY_RATIO) {
    if (tip === "unknown" || endHead === tip || endRatio >= END_HEAD_OVERRIDE_TIP_RATIO) {
      return { side: endHead, source: "length" };
    }
  }

  if (tip !== "unknown") {
    return { side: tip, source: "head_band" };
  }

  if (thirds !== "unknown" && centroid !== "unknown" && thirds === centroid) {
    if (lengthCue.side === "unknown" || lengthCue.side === thirds) {
      return { side: thirds, source: "head_band" };
    }
    return { side: lengthCue.side, source: "length" };
  }
  if (thirds !== "unknown") {
    if (lengthCue.side === "unknown" || lengthCue.side === thirds) {
      return { side: thirds, source: "head_band" };
    }
    return { side: lengthCue.side, source: "length" };
  }
  if (centroid !== "unknown") {
    if (lengthCue.side === "unknown" || lengthCue.side === centroid) {
      return { side: centroid, source: "head_band" };
    }
    return { side: lengthCue.side, source: "length" };
  }

  if (endHead !== "unknown") {
    return { side: endHead, source: "length" };
  }

  const tally = tallySide(headVotes);
  const scores = voteScores(headVotes);
  if (tally.side !== "unknown") {
    const margin =
      scores[tally.side] - scores[tally.side === "left" ? "right" : "left"];
    if (scores[tally.side] >= HEAD_VOTE_MIN_SCORE && margin >= 3) {
      return {
        side: tally.side,
        source: tally.source === "unknown" ? "head_band" : tally.source,
      };
    }
  }
  return { side: "unknown", source: "unknown" };
}

function isTailDetectionConfident(tailVotes: SideVote[]): boolean {
  const bodyTailVotes = tailVotes.filter((v) => v.source === "tail");
  const votes = bodyTailVotes.length > 0 ? bodyTailVotes : tailVotes;
  const tally = tallySide(votes);
  const scores = voteScores(votes);
  return tally.side !== "unknown" && scores.left + scores.right >= TAIL_FALLBACK_MIN_SCORE;
}

/** Drop guessed direction when cues are too weak; keep clear tail-only reads. */
function applyDirectionConfidenceGate(
  dir: CowBodyDirection,
  resolvePath: "head" | "tail" | "unknown",
  signals: Record<string, string>,
  headVotes: SideVote[],
  tailVotes: SideVote[],
  endMass: { leftHead: number; rightHead: number } | null,
  hasMask: boolean
): CowBodyDirection {
  if (dir.headSide === "unknown") return dir;

  if (
    asImageSide(signals.headThirds) !== "unknown" &&
    asImageSide(signals.headWidthRow) === "unknown" &&
    asImageSide(signals.endHeadMass) === "unknown"
  ) {
    const hind = asImageSide(signals.hindThirds);
    const canTrustTail =
      resolvePath === "tail" &&
      isTailDetectionConfident(tailVotes) &&
      hind !== "unknown" &&
      hind !== asImageSide(signals.headThirds);
    if (!canTrustTail) {
      return {
        ...UNKNOWN_DIRECTION,
        directionIssueKey: "cowWeight.scan.issuePatchyCoat",
      };
    }
  }

  const dominantMaskHeadSignals = Math.max(
    countMaskHeadSignalsForSide("left", signals),
    countMaskHeadSignalsForSide("right", signals)
  );
  if (!hasStrongHeadGeometry(signals, endMass)) {
    const weakHeadCue =
      asImageSide(signals.headThirds) !== "unknown" &&
      asImageSide(signals.headWidthRow) === "unknown" &&
      asImageSide(signals.endHeadMass) === "unknown" &&
      dominantMaskHeadSignals <= 1 &&
      signals.maskFullWidth !== "yes";
    const patchyTorsoHead =
      asImageSide(signals.headThirds) !== "unknown" &&
      asImageSide(signals.torsoThirds) !== "unknown" &&
      asImageSide(signals.headThirds) === asImageSide(signals.torsoThirds);
    const rejectGuess =
      (weakHeadCue || patchyTorsoHead) &&
      !(
        resolvePath === "head" &&
        isHeadDetectionConfident(dir.headSide, signals, headVotes, endMass)
      );
    if (rejectGuess) {
      return {
        ...UNKNOWN_DIRECTION,
        directionIssueKey: directionIssueKeyForFailedHead(
          signals,
          headVotes,
          endMass,
          hasMask
        ),
      };
    }
    if (resolvePath === "tail" && isTailDetectionConfident(tailVotes)) return dir;
    if (
      resolvePath === "head" &&
      isHeadDetectionConfident(dir.headSide, signals, headVotes, endMass)
    ) {
      return dir;
    }
    return {
      ...UNKNOWN_DIRECTION,
      directionIssueKey: directionIssueKeyForFailedHead(
        signals,
        headVotes,
        endMass,
        hasMask
      ),
    };
  }

  if (resolvePath === "tail") {
    return isTailDetectionConfident(tailVotes)
      ? dir
      : {
          ...UNKNOWN_DIRECTION,
          directionIssueKey: directionIssueKeyForFailedHead(
            signals,
            headVotes,
            endMass,
            hasMask
          ),
        };
  }

  if (!isHeadDetectionConfident(dir.headSide, signals, headVotes, endMass)) {
    return {
      ...UNKNOWN_DIRECTION,
      directionIssueKey: directionIssueKeyForFailedHead(
        signals,
        headVotes,
        endMass,
        hasMask
      ),
    };
  }
  return dir;
}

/**
 * Step 2 (fallback): detect tail from rump/torso only, then head = opposite(tail).
 */
function resolveTailSideFallback(
  tailVotes: SideVote[]
): { side: ImageSide; source: DirectionSource } {
  const bodyTailVotes = tailVotes.filter((v) => v.source === "tail");
  const votes = bodyTailVotes.length > 0 ? bodyTailVotes : tailVotes;
  const tally = tallySide(votes);
  const scores = voteScores(votes);
  const total = scores.left + scores.right;
  if (tally.side !== "unknown" && total >= TAIL_FALLBACK_MIN_SCORE) {
    return {
      side: tally.side,
      source: tally.source === "unknown" ? "tail" : tally.source,
    };
  }
  return { side: "unknown", source: "unknown" };
}

const UNKNOWN_DIRECTION: CowBodyDirection = {
  headSide: "unknown",
  tailSide: "unknown",
  direction: "unknown",
  isReversed: false,
  source: "unknown",
  directionIssueKey: null,
};

/** Head-first; if head not confident, try tail; else unknown with issue key (no wrong guess). */
function resolveHeadAndTail(
  headVotes: SideVote[],
  tailVotes: SideVote[],
  signals: Record<string, string>,
  endMass: { leftHead: number; rightHead: number } | null,
  hasMask: boolean
): { dir: CowBodyDirection; resolvePath: "head" | "tail" | "unknown" } {
  const head = resolveHeadSidePrimary(signals, headVotes, endMass);
  if (head.side !== "unknown" && isHeadDetectionConfident(head.side, signals, headVotes, endMass)) {
    return {
      dir: cowBodyDirectionFromHeadSide(head.side, head.source),
      resolvePath: "head",
    };
  }

  const tail = resolveTailSideFallback(tailVotes);
  if (tail.side !== "unknown") {
    return {
      dir: cowBodyDirectionFromHeadSide(
        oppositeSide(tail.side),
        tail.source === "unknown" ? "tail" : tail.source
      ),
      resolvePath: "tail",
    };
  }

  return {
    dir: {
      ...UNKNOWN_DIRECTION,
      directionIssueKey: directionIssueKeyForFailedHead(
        signals,
        headVotes,
        endMass,
        hasMask
      ),
    },
    resolvePath: "unknown",
  };
}

/**
 * Body-based direction on upload: head left/right on photo, else tail → opposite head.
 */
export function detectCowBodyDirection(
  data: Uint8ClampedArray | null,
  w: number,
  h: number,
  bbox: BBox,
  lengthEnds: { l1: Point2D; l2: Point2D; detected: boolean } | null,
  bodyMask?: CowBodyMask,
  _legs?: { leg1: Point2D; leg2: Point2D } | null,
  options?: { includeLegVotes?: boolean; lengthY?: number }
): CowBodyDirection {
  void options?.includeLegVotes;
  const headVotes: SideVote[] = [];
  const tailVotes: SideVote[] = [];
  const lengthY =
    options?.lengthY ??
    (lengthEnds?.detected ? (lengthEnds.l1.y + lengthEnds.l2.y) / 2 : undefined);
  const signals: Record<string, string> = {};
  let endMass: Record<string, number> | null = null;

  if (lengthEnds?.detected) {
    const leftEnd =
      lengthEnds.l1.x <= lengthEnds.l2.x ? lengthEnds.l1 : lengthEnds.l2;
    const rightEnd =
      lengthEnds.l1.x <= lengthEnds.l2.x ? lengthEnds.l2 : lengthEnds.l1;
    const hm = headBandMassAtEnds(leftEnd, rightEnd, bbox, bodyMask, data, w, h);
    const tm = tailMassAtEnd(leftEnd, rightEnd, bbox, bodyMask, data, w, h);
    if (hm && tm) {
      endMass = {
        leftHead: hm.leftHead,
        rightHead: hm.rightHead,
        leftTail: tm.leftTail,
        rightTail: tm.rightTail,
      };
    }
    const sTail = tailSideFromLengthEnds(
      lengthEnds.l1,
      lengthEnds.l2,
      bbox,
      bodyMask,
      data,
      w,
      h
    );
    signals.lengthTailEnds = sTail;
    const fullWidthMask = bodyMask && maskSpansFullBboxWidth(bodyMask, bbox);
    if (!fullWidthMask) {
      addVote(tailVotes, sTail, WEIGHT_LENGTH_TAIL, "length");
    }
  }

  if (bodyMask) {
    const fullWidth = maskSpansFullBboxWidth(bodyMask, bbox);
    signals.headTip = headSideFromMaskHeadTip(bodyMask, bbox);
    signals.headThirds = headSideFromMaskHeadThirds(bodyMask, bbox);
    signals.headCentroid = headSideFromMaskNarrowBand(bodyMask, bbox);
    if (fullWidth && signals.headThirds !== "unknown") {
      signals.headCentroid = signals.headThirds;
    }
    if (lengthEnds?.detected) {
      const sHead = headSideFromLengthEndHeadRatio(
        lengthEnds.l1,
        lengthEnds.l2,
        bbox,
        bodyMask,
        data,
        w,
        h
      );
      signals.lengthHeadRatio = sHead;
    }
    signals.hindCentroid = tailSideFromMaskHindCentroid(bodyMask, bbox);
    signals.torsoThirds = tailSideFromMaskTorsoThirds(bodyMask, bbox);
    signals.hindThirds = tailSideFromMaskHindThirds(bodyMask, bbox);
    signals.maskFullWidth = fullWidth ? "yes" : "no";
    addVote(headVotes, signals.headThirds as ImageSide, WEIGHT_HEAD_THIRDS, "head_band");
    if (!fullWidth || signals.headThirds === "unknown") {
      addVote(headVotes, signals.headCentroid as ImageSide, WEIGHT_HEAD_CENTROID, "head_band");
    }
    if (endMass) {
      signals.endHeadMass = headSideFromEndHeadMass(endMass);
    }
    const hasHeadBandSignal =
      asImageSide(signals.headThirds) !== "unknown" ||
      asImageSide(signals.headCentroid) !== "unknown";
    if (hasHeadBandSignal) {
      addVote(headVotes, asImageSide(signals.lengthHeadRatio), WEIGHT_LENGTH_HEAD_RATIO, "length");
      addVote(headVotes, asImageSide(signals.endHeadMass), WEIGHT_LENGTH_HEAD_RATIO, "length");
    }
    addVote(tailVotes, signals.hindCentroid as ImageSide, WEIGHT_HIND_CENTROID, "tail");
    addVote(tailVotes, signals.torsoThirds as ImageSide, WEIGHT_TORSO_THIRDS, "tail");
    addVote(tailVotes, signals.hindThirds as ImageSide, WEIGHT_TAIL_THIRDS, "tail");
    if (lengthY !== undefined) {
      signals.headWidthRow = headSideFromMaskWidthAtLengthRow(
        bodyMask,
        bbox,
        lengthY,
        lengthEnds?.detected ? { l1: lengthEnds.l1, l2: lengthEnds.l2 } : undefined
      );
      signals.lengthRowThirds = tailSideFromMaskLengthRowThirds(bodyMask, bbox, lengthY);
      addVote(tailVotes, signals.lengthRowThirds as ImageSide, WEIGHT_LENGTH_ROW, "length");
    }
    if (!maskSpansFullBboxWidth(bodyMask, bbox)) {
      signals.hindExtremity = tailSideFromMaskHindExtremity(bodyMask, bbox);
      addVote(tailVotes, signals.hindExtremity as ImageSide, WEIGHT_TAIL_EXTREMITY, "tail");
    }
  } else if (data) {
    signals.lumTorso = tailSideFromLuminanceTorsoThirds(data, w, h, bbox);
    signals.lumHind = tailSideFromLuminanceHindThirds(data, w, h, bbox);
    addVote(tailVotes, signals.lumTorso as ImageSide, WEIGHT_TORSO_THIRDS, "tail");
    addVote(tailVotes, signals.lumHind as ImageSide, WEIGHT_TAIL_THIRDS, "tail");
    if (lengthY !== undefined) {
      signals.lumLengthRow = tailSideFromLuminanceLengthRowThirds(data, w, h, bbox, lengthY);
      addVote(tailVotes, signals.lumLengthRow as ImageSide, WEIGHT_LENGTH_ROW, "length");
    }
    addVote(tailVotes, tailSideFromLuminanceHindExtremity(data, w, h, bbox), WEIGHT_TAIL_EXTREMITY, "tail");
  }

  const { dir: rawDir, resolvePath } = resolveHeadAndTail(
    headVotes,
    tailVotes,
    signals,
    endMass,
    !!bodyMask
  );
  const dir = applyDirectionConfidenceGate(
    rawDir,
    resolvePath,
    signals,
    headVotes,
    tailVotes,
    endMass,
    !!bodyMask
  );
  return dir;
}

export function resolveFacingFromBodyDirection(dir: CowBodyDirection): CowFacing | null {
  if (dir.headSide === "unknown" || dir.directionIssueKey) return null;
  return facingFromHeadSide(dir.headSide);
}

/** i18n keys for scan UI summary. */
export function directionSummaryI18nKeys(dir: CowBodyDirection | undefined): {
  head: string | null;
  tail: string | null;
  direction: string | null;
  sourceHint: string | null;
  issue: string | null;
} {
  if (!dir || dir.headSide === "unknown") {
    return {
      head: null,
      tail: null,
      direction: null,
      sourceHint: null,
      issue: dir?.directionIssueKey ?? "cowWeight.scan.issueHeadNotClear",
    };
  }
  const head =
    dir.headSide === "left" ? "cowWeight.scan.headOnPhotoLeft" : "cowWeight.scan.headOnPhotoRight";
  const tail =
    dir.tailSide === "left"
      ? "cowWeight.scan.tailOnPhotoLeft"
      : dir.tailSide === "right"
        ? "cowWeight.scan.tailOnPhotoRight"
        : null;
  const direction =
    dir.direction === "normal"
      ? "cowWeight.scan.directionNormal"
      : dir.direction === "reverse"
        ? "cowWeight.scan.directionReverse"
        : null;
  const sourceHint =
    dir.source === "vision"
      ? "cowWeight.scan.directionFromVision"
      : dir.source === "tail"
        ? "cowWeight.scan.directionFromTail"
        : dir.direction === "unknown"
          ? "cowWeight.scan.directionUnknownHint"
          : null;
  return { head, tail, direction, sourceHint, issue: null };
}

export function attachBodyDirectionToKeypoints(
  kp: CowKeypoints,
  facing: CowFacing | null,
  bodyDirection?: CowBodyDirection
): CowKeypoints {
  const dir =
    bodyDirection ??
    (facing ? cowBodyDirectionFromHeadSide(headSideFromFacing(facing), "unknown") : UNKNOWN_DIRECTION);
  const ordered =
    facing != null ? orderLengthKeypointsForFacing(kp.l1, kp.l2, facing) : { l1: kp.l1, l2: kp.l2 };
  return {
    ...kp,
    l1: ordered.l1,
    l2: ordered.l2,
    detected: {
      legs: kp.detected?.legs ?? false,
      lowerChest: kp.detected?.lowerChest ?? false,
      topChest: kp.detected?.topChest ?? false,
      length: kp.detected?.length ?? false,
      ...(facing != null ? { facing } : {}),
      bodyDirection: dir,
    },
  };
}
