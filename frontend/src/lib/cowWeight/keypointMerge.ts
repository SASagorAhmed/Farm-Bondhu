import type { CowDirectionAssistResult } from "./api";
import { mergeVisionWithLocal } from "./directionMerge";
import {
  assignLegsFromSemanticPoints,
  completeLegPairFromFacing,
  mergeDirectionAssistIntoKeypoints,
  reassignKeypointsForHeadSide,
  synthesizeHindLegPoint,
} from "./cowKeypoints";
import type { CowFacing } from "./cowDirection";
import { resolveHeadBboxFromVision } from "./headBbox";
import type { CowBodyMask } from "./cowMask";
import type { BBox, CowKeypoints, Point2D } from "./types";

const VISION_POINT_MIN = 0.5;
const KEYPOINT_CONFIDENCE = 0.55;
const MIN_LEG_SEP_FRAC = 0.12;
const VISION_LEG_SEP_FRAC = 0.1;

function normToPixel(
  p: { x: number; y: number },
  imageWidth: number,
  imageHeight: number
): Point2D {
  return {
    x: Math.max(0, Math.min(imageWidth, p.x * imageWidth)),
    y: Math.max(0, Math.min(imageHeight, p.y * imageHeight)),
  };
}

function legYFromBbox(bbox: BBox, frac = 0.78): number {
  return bbox.y + bbox.height * frac;
}

function legSeparation(a: Point2D, b: Point2D): number {
  return Math.abs(a.x - b.x);
}

function mergeVisionChest(
  local: CowKeypoints,
  vision: CowDirectionAssistResult,
  bbox: BBox,
  imageWidth: number,
  imageHeight: number,
  useKeypoints: boolean
): { topChest: Point2D; lowerChest: Point2D; chestCenterX: number } {
  let topChest = local.topChest;
  let lowerChest = local.lowerChest;

  if (vision.topChest && (!local.detected?.topChest || useKeypoints)) {
    const p = normToPixel(vision.topChest, imageWidth, imageHeight);
    const localDy = Math.abs(p.y - local.topChest.y);
    if (localDy <= bbox.height * 0.15 || !local.detected?.topChest) {
      topChest = { x: p.x, y: p.y };
    } else {
      topChest = { x: p.x, y: local.topChest.y };
    }
  }
  if (vision.lowerChest && (!local.detected?.lowerChest || useKeypoints)) {
    const p = normToPixel(vision.lowerChest, imageWidth, imageHeight);
    const localDy = Math.abs(p.y - local.lowerChest.y);
    if (localDy <= bbox.height * 0.15 || !local.detected?.lowerChest) {
      lowerChest = { x: p.x, y: p.y };
    } else {
      lowerChest = { x: p.x, y: local.lowerChest.y };
    }
  }
  if (topChest.y >= lowerChest.y) {
    const mid = (topChest.y + lowerChest.y) / 2;
    topChest = { ...topChest, y: mid - bbox.height * 0.06 };
    lowerChest = { ...lowerChest, y: mid + bbox.height * 0.06 };
  }

  const chestCenterX = (topChest.x + lowerChest.x) / 2;
  return { topChest, lowerChest, chestCenterX };
}

export interface DirectionOnlyVisionResult {
  facing: CowFacing | null;
  headBbox: BBox | null;
  verifySource: DirectionVerifySource;
  assistApplied: boolean;
  headSide: "left" | "right" | "unknown";
}

function headPointFromBboxAndSide(bbox: BBox, headSide: "left" | "right"): Point2D {
  const { x, y, width, height } = bbox;
  const cx = headSide === "left" ? x + width * 0.18 : x + width * 0.82;
  const cy = y + height * 0.22;
  return { x: cx, y: cy };
}

/** Cloud head direction + head box only — does not move chest, legs, or L1/L2. */
export function applyDirectionOnlyVision(
  vision: CowDirectionAssistResult,
  bbox: BBox,
  imageWidth: number,
  imageHeight: number,
  bodyMask?: CowBodyMask
): DirectionOnlyVisionResult {
  const policy = mergeVisionWithLocal(undefined, vision);
  const facing = policy.facing;
  const verifySource = policy.source;
  const assistApplied = verifySource === "vision";
  let headBbox: BBox | null = policy.headBbox;

  if (
    vision.headSide === "left" ||
    vision.headSide === "right"
  ) {
    const headPoint = headPointFromBboxAndSide(bbox, vision.headSide);
    headBbox = resolveHeadBboxFromVision(
      vision.headBbox,
      imageWidth,
      imageHeight,
      bbox,
      headPoint,
      vision.headSide,
      bodyMask,
      vision.confidence
    );
  }

  return {
    facing,
    headBbox,
    verifySource,
    assistApplied,
    headSide:
      vision.headSide === "left" || vision.headSide === "right"
        ? vision.headSide
        : "unknown",
  };
}

/**
 * Apply full vision assist: head direction + optional leg/chest overrides.
 */
export function applyFullVisionAssist(
  local: CowKeypoints,
  vision: CowDirectionAssistResult,
  bbox: BBox,
  imageWidth: number,
  imageHeight: number
): {
  keypoints: CowKeypoints;
  headBbox: BBox | null;
  facing: CowFacing | null;
  verifySource: "vision" | "local" | "none";
} {
  const localDir = local.detected?.bodyDirection;
  const policy = mergeVisionWithLocal(localDir, vision);

  let kp = local;
  let headBbox: BBox | null = null;
  let facing: CowFacing | null = policy.facing;
  let verifySource = policy.source;

  if (
    policy.source === "vision" &&
    facing &&
    (vision.headSide === "left" || vision.headSide === "right")
  ) {
    const applied = mergeDirectionAssistIntoKeypoints(
      local,
      vision.headSide,
      vision.headBbox,
      imageWidth,
      imageHeight,
      vision.confidence,
      bbox
    );
    kp = applied.keypoints;
    headBbox = applied.headBbox;
    facing = applied.keypoints.detected?.facing ?? facing;
  } else if (facing) {
    kp = reassignKeypointsForHeadSide(local, facing);
    headBbox = policy.headBbox ?? localDir?.headBbox ?? null;
  }

  const useKeypoints =
    vision.confidence >= KEYPOINT_CONFIDENCE ||
    vision.distanceConfidence >= VISION_POINT_MIN;

  if (useKeypoints && facing) {
    const legY = legYFromBbox(bbox);
    const minSep = bbox.width * (local.detected?.legs ? MIN_LEG_SEP_FRAC : VISION_LEG_SEP_FRAC);

    let frontPt: Point2D | null = vision.frontLeg
      ? normToPixel(vision.frontLeg, imageWidth, imageHeight)
      : null;
    let hindPt: Point2D | null = vision.hindLeg
      ? normToPixel(vision.hindLeg, imageWidth, imageHeight)
      : null;

    if (frontPt) frontPt = { x: frontPt.x, y: legY };
    if (hindPt) hindPt = { x: hindPt.x, y: legY };

    if (frontPt && !hindPt) {
      hindPt = synthesizeHindLegPoint(facing, frontPt, bbox, kp.l1, legY);
    } else if (hindPt && !frontPt) {
      const completed = completeLegPairFromFacing(facing, hindPt, null, bbox, kp.l1, legY);
      frontPt = completed.colB;
    }

    const { topChest, lowerChest, chestCenterX } = mergeVisionChest(
      kp,
      vision,
      bbox,
      imageWidth,
      imageHeight,
      useKeypoints
    );

    const localSep = legSeparation(kp.leg1, kp.leg2);
    const visionSep = frontPt && hindPt ? legSeparation(frontPt, hindPt) : 0;
    const visionLegsOk = visionSep >= minSep;
    const visionImproves = visionLegsOk && (!local.detected?.legs || visionSep > localSep * 1.05);

    if (visionImproves && frontPt && hindPt) {
      const assigned = assignLegsFromSemanticPoints(facing, frontPt, hindPt);
      kp = {
        ...kp,
        leg1: assigned.leg1,
        leg2: assigned.leg2,
        topChest,
        lowerChest,
        chestCenterX,
        detected: {
          ...kp.detected,
          legs: true,
          legsInferred: false,
          topChest: true,
          lowerChest: true,
          facing: facing ?? kp.detected?.facing,
          bodyDirection: kp.detected?.bodyDirection,
        },
      };
      kp = reassignKeypointsForHeadSide(kp, facing);
      kp = { ...kp, topChest, lowerChest, chestCenterX };
      if (verifySource !== "vision" && vision.confidence >= KEYPOINT_CONFIDENCE) {
        verifySource = "vision";
      }
    } else {
      kp = reassignKeypointsForHeadSide(kp, facing);
      kp = {
        ...kp,
        topChest,
        lowerChest,
        chestCenterX,
        detected: {
          ...kp.detected,
          legs: kp.detected?.legs ?? false,
          topChest: true,
          lowerChest: true,
          facing: facing ?? kp.detected?.facing,
          bodyDirection: kp.detected?.bodyDirection,
        },
      };
    }
  }

  return { keypoints: kp, headBbox, facing, verifySource };
}
