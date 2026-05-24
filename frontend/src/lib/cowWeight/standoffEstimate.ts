import {
  ASSUMED_WITHERS_CM,
  OPTIMAL_STANDOFF_MAX_M,
  OPTIMAL_STANDOFF_MIN_M,
  PINHOLE_BLEND_WEIGHT,
  pinholeStandoffMeters,
  RECOMMENDED_STANDOFF_BAND,
  WARN_STANDOFF_TOO_CLOSE_M,
  WARN_STANDOFF_TOO_FAR_M,
} from "./cowWeightResearch";
import type { BBox } from "./types";

export type StandoffMethod = "vision" | "pinhole" | "heuristic" | "blended";

export interface StandoffEstimate {
  meters: number;
  /** @deprecated use method */
  source: "vision" | "heuristic";
  method: StandoffMethod;
  confidence: number;
  warningKey?: string | null;
  focalLengthMm?: number | null;
  recommendedBand: { min: number; max: number };
}

const MIN_BBOX_HEIGHT_FRAC = 0.35;

/** Rough standoff from bbox height fraction (side-view dairy cow, phone photo). */
function heuristicMetersFromBboxFrac(frac: number): number {
  const f = Math.max(0.15, Math.min(0.95, frac));
  return Math.round((4.8 - f * 5.2) * 10) / 10;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function blendMeters(a: number, b: number, weightA: number): number {
  return round1(a * weightA + b * (1 - weightA));
}

export interface StandoffVisionInput {
  standoffDistanceM: number | null;
  distanceConfidence: number;
}

export interface StandoffExifInput {
  focalLengthMm?: number | null;
}

export function estimateCameraStandoff(
  bbox: BBox,
  imageHeight: number,
  vision?: StandoffVisionInput,
  exif?: StandoffExifInput
): StandoffEstimate {
  const frac = imageHeight > 0 ? bbox.height / imageHeight : 0;
  const heuristic = heuristicMetersFromBboxFrac(frac);
  const pinhole = pinholeStandoffMeters(bbox.height, imageHeight, ASSUMED_WITHERS_CM) ?? heuristic;

  let meters: number;
  let method: StandoffMethod = "heuristic";
  let source: StandoffEstimate["source"] = "heuristic";
  let confidence = frac >= MIN_BBOX_HEIGHT_FRAC ? 0.5 : 0.35;

  const visionOk =
    vision?.standoffDistanceM != null &&
    vision.standoffDistanceM > 0 &&
    vision.distanceConfidence >= 0.5;

  if (visionOk) {
    const v = vision!.standoffDistanceM!;
    meters = blendMeters(pinhole, v, PINHOLE_BLEND_WEIGHT);
    method = meters === v ? "vision" : "blended";
    source = "vision";
    confidence = vision!.distanceConfidence;
  } else if (pinhole !== heuristic) {
    meters = blendMeters(pinhole, heuristic, PINHOLE_BLEND_WEIGHT);
    method = "blended";
    source = "heuristic";
    confidence = Math.min(0.55, confidence + 0.05);
  } else {
    meters = heuristic;
    method = "heuristic";
  }

  if (exif?.focalLengthMm != null && exif.focalLengthMm > 0 && !visionOk) {
    confidence = Math.min(0.6, confidence + 0.05);
  }

  let warningKey: string | null = null;
  if (frac < MIN_BBOX_HEIGHT_FRAC) {
    warningKey = "cowWeight.scan.standoffCowSmall";
  } else if (meters < WARN_STANDOFF_TOO_CLOSE_M) {
    warningKey = "cowWeight.scan.standoffTooClose";
  } else if (meters > WARN_STANDOFF_TOO_FAR_M) {
    warningKey = "cowWeight.scan.standoffTooFar";
  }

  return {
    meters,
    source,
    method,
    confidence,
    warningKey,
    focalLengthMm: exif?.focalLengthMm ?? null,
    recommendedBand: RECOMMENDED_STANDOFF_BAND,
  };
}

export { OPTIMAL_STANDOFF_MIN_M, OPTIMAL_STANDOFF_MAX_M, isStandoffInOptimalBand } from "./cowWeightResearch";
