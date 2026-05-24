/**
 * Pinhole camera helpers for Plan D distance scaling (browser / Vercel).
 */

import { pinholeStandoffMeters } from "./cowWeightResearch";
import type { CameraDistanceSource } from "./types";

export const CAMERA_DISTANCE_CANDIDATES_CM = [
  150, 160, 170, 180, 190, 200, 210, 220, 230, 240, 250,
] as const;

export const DEFAULT_CAMERA_DISTANCE_CM = 180;
export const BODY_HEIGHT_MIN_CM = 150;
export const BODY_HEIGHT_MAX_CM = 250;
export const BODY_HEIGHT_PRIOR_CM = 180;
export const BODY_LENGTH_MIN_CM = 100;
export const BODY_LENGTH_MAX_CM = 220;

/** Typical phone sensor width (mm) when EXIF sensor size missing. */
export const DEFAULT_SENSOR_WIDTH_MM = 6.17;
export const DEFAULT_FOCAL_MM = 4.5;

export function readCalibrationFactor(): number {
  const raw = import.meta.env.VITE_COW_SCALE_CALIBRATION_FACTOR;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Focal length in pixels from EXIF or 35mm equivalent. */
export function focalLengthPx(
  imageWidthPx: number,
  focalLengthMm?: number | null,
  focalLength35mm?: number | null
): number {
  if (imageWidthPx <= 0) return 1;
  let fMm = focalLengthMm;
  if ((fMm == null || fMm <= 0) && focalLength35mm != null && focalLength35mm > 0) {
    fMm = (focalLength35mm / 36) * DEFAULT_SENSOR_WIDTH_MM;
  }
  if (fMm == null || fMm <= 0) fMm = DEFAULT_FOCAL_MM;
  return (imageWidthPx * fMm) / DEFAULT_SENSOR_WIDTH_MM;
}

/** cm per pixel at depth Z (cm) along optical axis. */
export function cmPerPxAtZ(zCm: number, fPx: number, calibrationFactor = readCalibrationFactor()): number {
  if (fPx <= 0 || zCm <= 0) return 0;
  return (zCm / fPx) * calibrationFactor;
}

export function snapToDistanceGrid(zCm: number): number {
  let best = DEFAULT_CAMERA_DISTANCE_CM;
  let bestD = Infinity;
  for (const c of CAMERA_DISTANCE_CANDIDATES_CM) {
    const d = Math.abs(zCm - c);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

export const GROUND_DISTANCE_CONFIDENCE_MIN = 0.52;

export interface JointZScoreInput {
  imageWidthPx: number;
  imageHeightPx: number;
  bboxHeightPx: number;
  bboxWidthPx: number;
  lengthSpanPx: number;
  focalLengthMm?: number | null;
  focalLength35mm?: number | null;
  standoffPriorCm?: number | null;
  /** Cloud direction assist provided standoff (OpenRouter). */
  visionUsed?: boolean;
}

export interface JointZResult {
  cameraDistanceCm: number;
  r1: number;
  r2: number;
  bodyHeightCm: number;
  focalLengthPx: number;
  geometryConfidence: number;
  pinholePriorCm: number;
  localPriorCm: number;
  cloudPriorCm: number | null;
  distanceSource: CameraDistanceSource;
  groundDistanceDetected: boolean;
}

/** Cloud standoff or strong local pinhole score → distance treated as detected. */
export function isGroundDistanceDetected(
  visionUsed: boolean,
  cloudPriorCm: number | null,
  geometryConfidence: number
): boolean {
  if (visionUsed && cloudPriorCm != null) return true;
  return geometryConfidence >= GROUND_DISTANCE_CONFIDENCE_MIN;
}

export function applyAverageFallback(
  joint: Omit<JointZResult, "groundDistanceDetected">,
  bboxHeightPx: number,
  fPx: number,
  cal: number
): JointZResult {
  const z = DEFAULT_CAMERA_DISTANCE_CM;
  const r1 = cmPerPxAtZ(z, fPx, cal);
  const r2 = r1;
  return {
    ...joint,
    groundDistanceDetected: false,
    cameraDistanceCm: z,
    r1,
    r2,
    bodyHeightCm: Math.round(bboxHeightPx * r1 * 100) / 100,
    distanceSource: "fallback_average",
  };
}

const GRID_MATCH_TOLERANCE_CM = 10;

function inferDistanceSource(
  bestZ: number,
  visionUsed: boolean,
  cloudPriorCm: number | null,
  localPriorCm: number
): CameraDistanceSource {
  const cloudMatch =
    visionUsed &&
    cloudPriorCm != null &&
    Math.abs(bestZ - cloudPriorCm) <= GRID_MATCH_TOLERANCE_CM;
  const localMatch = Math.abs(bestZ - localPriorCm) <= GRID_MATCH_TOLERANCE_CM;

  if (cloudMatch && !localMatch) return "cloud";
  if (localMatch && !cloudMatch) return "local";
  if (cloudMatch && localMatch) return "blended";
  return "blended";
}

function heightPenalty(hCm: number): number {
  if (hCm < BODY_HEIGHT_MIN_CM) return (BODY_HEIGHT_MIN_CM - hCm) * 2;
  if (hCm > BODY_HEIGHT_MAX_CM) return (hCm - BODY_HEIGHT_MAX_CM) * 2;
  return 0;
}

function lengthPenalty(lCm: number): number {
  if (lCm < BODY_LENGTH_MIN_CM) return (BODY_LENGTH_MIN_CM - lCm) * 0.5;
  if (lCm > BODY_LENGTH_MAX_CM) return (lCm - BODY_LENGTH_MAX_CM) * 0.5;
  return 0;
}

/**
 * Try each camera distance 150–250 cm; pick best joint 2D/3D score; else 180.
 */
export function jointSelectCameraDistance(input: JointZScoreInput): JointZResult {
  const fPx = focalLengthPx(input.imageWidthPx, input.focalLengthMm, input.focalLength35mm);
  const cal = readCalibrationFactor();

  const pinholeM =
    pinholeStandoffMeters(input.bboxHeightPx, input.imageHeightPx) ??
    DEFAULT_CAMERA_DISTANCE_CM / 100;
  const pinholeRawCm = pinholeM * 100;
  const pinholePriorCm = snapToDistanceGrid(
    Math.max(CAMERA_DISTANCE_CANDIDATES_CM[0], Math.min(250, pinholeRawCm))
  );

  const cloudPriorCm =
    input.visionUsed && input.standoffPriorCm != null && input.standoffPriorCm > 0
      ? snapToDistanceGrid(
          Math.max(CAMERA_DISTANCE_CANDIDATES_CM[0], Math.min(250, input.standoffPriorCm))
        )
      : null;

  const standoffPriorCm = cloudPriorCm ?? pinholePriorCm;

  const bboxFrac =
    input.imageHeightPx > 0 ? input.bboxHeightPx / input.imageHeightPx : 0.5;
  /** Larger cow in frame → closer camera prior (lower Z on grid). */
  const positionPriorCm = snapToDistanceGrid(
    250 - bboxFrac * 100 - (input.bboxHeightPx > 0 ? 0 : 0)
  );

  const localPriorCm = snapToDistanceGrid((pinholePriorCm + positionPriorCm) / 2);

  const standoffWeight = input.visionUsed ? 0.4 : 0.25;

  let bestZ = DEFAULT_CAMERA_DISTANCE_CM;
  let bestScore = Infinity;
  let secondBest = Infinity;

  for (const z of CAMERA_DISTANCE_CANDIDATES_CM) {
    const r = cmPerPxAtZ(z, fPx, cal);
    const hEst = input.bboxHeightPx * r;
    const lEst = input.lengthSpanPx * r;

    const score =
      Math.abs(z - pinholePriorCm) * 0.35 +
      Math.abs(z - standoffPriorCm) * standoffWeight +
      Math.abs(z - localPriorCm) * 0.12 +
      Math.abs(z - positionPriorCm) * 0.08 +
      heightPenalty(hEst) * 0.35 +
      Math.abs(hEst - BODY_HEIGHT_PRIOR_CM) * 0.06 +
      lengthPenalty(lEst) * 0.2 +
      Math.abs(z - DEFAULT_CAMERA_DISTANCE_CM) * 0.03;

    if (score < bestScore) {
      secondBest = bestScore;
      bestScore = score;
      bestZ = z;
    } else if (score < secondBest) {
      secondBest = score;
    }
  }

  const margin = secondBest === Infinity ? 0 : Math.max(0, secondBest - bestScore);
  const geometryConfidence = Math.min(0.95, 0.45 + margin * 0.08);

  const r1 = cmPerPxAtZ(bestZ, fPx, cal);
  const r2 = r1;
  const bodyHeightCm = Math.round(input.bboxHeightPx * r1 * 100) / 100;

  const distanceSource = inferDistanceSource(
    bestZ,
    !!input.visionUsed,
    cloudPriorCm,
    localPriorCm
  );

  const base = {
    cameraDistanceCm: bestZ,
    r1,
    r2,
    bodyHeightCm,
    focalLengthPx: fPx,
    geometryConfidence,
    pinholePriorCm,
    localPriorCm,
    cloudPriorCm,
    distanceSource,
  };

  if (
    isGroundDistanceDetected(!!input.visionUsed, cloudPriorCm, geometryConfidence)
  ) {
    return { ...base, groundDistanceDetected: true };
  }

  return applyAverageFallback(base, input.bboxHeightPx, fPx, cal);
}

export function cmPerPxFromReferenceDynamic(
  referencePx: number,
  referenceCm: number
): number {
  if (referencePx <= 0 || referenceCm <= 0) return 0;
  return referenceCm / referencePx;
}
