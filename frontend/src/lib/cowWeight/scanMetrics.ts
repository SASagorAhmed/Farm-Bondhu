import type { BBox, CowAnalysisResult, CowLines, DetectionMode, ScanMetrics } from "./types";
import { lineLengthPx } from "./imageUtils";
import {
  ASSUMED_BODY_LENGTH_CM,
  ASSUMED_COW_HEIGHT_CM,
  dimensionsFromLines,
  dimensionsFromLinesPlanB,
  dimensionsFromLinesPlanD,
  TYPICAL_LENGTH_SPAN_FRAC,
} from "./pixelsToCm";
import { cmPerPixelFromReference } from "./referenceScale";
import {
  computePlanDScale,
  cmPerPixelFromReferencePlanD,
  type PlanDScale,
} from "./distanceScale";

export const WEIGHT_FORMULA_DIVISOR = 660;
const FORMULA_DIVISOR = WEIGHT_FORMULA_DIVISOR;
export { ASSUMED_COW_HEIGHT_CM, ASSUMED_BODY_LENGTH_CM, TYPICAL_LENGTH_SPAN_FRAC };
export const REFERENCE_STICK_CM = 100;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Values for UI formula strings (Plan B / Plan D / Plan C). */
export function scaleFormulaVars(
  metrics: ScanMetrics,
  bboxHeightPx: number,
  bboxWidthPx: number
): {
  cmPerPixel: number;
  chestCmPerPixel: number;
  lengthCmPerPixel: number;
  chestPx: number;
  lengthPx: number;
  bboxHeight: number;
  bboxWidth: number;
  lengthSpanPx: number;
  refPx: number | null;
  cameraDistanceCm: number | null;
  r1: number | null;
  r2: number | null;
  bodyHeightCm: number | null;
} {
  const chestScale = metrics.chestCmPerPixel ?? metrics.cmPerPixel;
  const lengthScale = metrics.lengthCmPerPixel ?? metrics.cmPerPixel;
  return {
    cmPerPixel: metrics.cmPerPixel,
    chestCmPerPixel: chestScale,
    lengthCmPerPixel: lengthScale,
    chestPx: metrics.chestPixels,
    lengthPx: metrics.lengthPixels,
    bboxHeight: Math.round(bboxHeightPx),
    bboxWidth: Math.round(bboxWidthPx),
    lengthSpanPx: Math.round(bboxWidthPx * TYPICAL_LENGTH_SPAN_FRAC),
    refPx: metrics.referencePixels,
    cameraDistanceCm: metrics.cameraDistanceCm ?? null,
    r1: metrics.r1 ?? null,
    r2: metrics.r2 ?? null,
    bodyHeightCm: metrics.bodyHeightCm ?? null,
  };
}

export function previewWeightKg(chestWidthCm: number, bodyLengthCm: number): number {
  if (chestWidthCm <= 0 || bodyLengthCm <= 0) return 0;
  return round2((chestWidthCm * chestWidthCm * bodyLengthCm) / FORMULA_DIVISOR);
}

function planDFromSnapshot(s: NonNullable<CowAnalysisResult["planD"]>): PlanDScale {
  return s as PlanDScale;
}

function resolvePlanD(
  lines: CowLines,
  analysis: CowAnalysisResult,
  standoffM?: number | null
): PlanDScale {
  if (analysis.planD) return planDFromSnapshot(analysis.planD);
  return computePlanDScale({
    bbox: analysis.bbox,
    lines,
    imageWidthPx: analysis.imageWidth,
    imageHeightPx: analysis.imageHeight,
    focalLengthMm: analysis.focalLengthMm,
    standoffMeters: standoffM ?? analysis.standoffMeters,
    visionUsed: analysis.standoffSource === "vision",
  });
}

export function computeScanMetrics(
  mode: DetectionMode,
  lines: CowLines,
  analysis: CowAnalysisResult,
  standoffM?: number | null
): ScanMetrics {
  const chestPixels = round2(lineLengthPx(lines.chest));
  const lengthPixels = round2(lineLengthPx(lines.length));
  const referencePixels = lines.reference ? round2(lineLengthPx(lines.reference)) : null;

  let cmPerPixel = analysis.cmPerPixel ?? 0;
  let chestCmPerPixel: number | undefined;
  let lengthCmPerPixel: number | undefined;
  let scaleMethod: ScanMetrics["scaleMethod"] = "plan_d_pinhole";
  let chest_width_cm: number;
  let body_length_cm: number;
  let scaleAdjustedForDistance = false;
  let cameraDistanceCm: number | undefined;
  let r1: number | undefined;
  let r2: number | undefined;
  let bodyHeightCm: number | undefined;
  let geometryConfidence: number | undefined;
  let distanceSource: ScanMetrics["distanceSource"];
  let groundDistanceDetected: boolean | undefined;

  if (lines.reference) {
    const planD = analysis.planD ?? resolvePlanD(lines, analysis, standoffM);
    const physicalStick = true;
    cmPerPixel = cmPerPixelFromReferencePlanD(
      referencePixels ?? lineLengthPx(lines.reference),
      planD,
      physicalStick
    );
    if (cmPerPixel <= 0) {
      cmPerPixel = cmPerPixelFromReference(lines.reference);
    }
    scaleMethod = physicalStick ? "reference_100cm" : "plan_d_pinhole_stick";
    const dims = dimensionsFromLines(lines, cmPerPixel);
    chest_width_cm = dims.chest_width_cm;
    body_length_cm = dims.body_length_cm;
    cameraDistanceCm = planD.cameraDistanceCm;
    r1 = round2(planD.r1);
    r2 = round2(planD.r2);
    bodyHeightCm = planD.bodyHeightCm;
    geometryConfidence = planD.geometryConfidence;
    distanceSource = planD.distanceSource;
    groundDistanceDetected = planD.groundDistanceDetected;
  } else {
    const planD = resolvePlanD(lines, analysis, standoffM);
    const dims = dimensionsFromLinesPlanD(lines, planD.r1, planD.r2);
    chest_width_cm = dims.chest_width_cm;
    body_length_cm = dims.body_length_cm;
    chestCmPerPixel = round2(planD.r1);
    lengthCmPerPixel = round2(planD.r2);
    cmPerPixel = chestCmPerPixel;
    scaleMethod = "plan_d_pinhole";
    cameraDistanceCm = planD.cameraDistanceCm;
    r1 = chestCmPerPixel;
    r2 = lengthCmPerPixel;
    bodyHeightCm = planD.bodyHeightCm;
    geometryConfidence = planD.geometryConfidence;
    distanceSource = planD.distanceSource;
    groundDistanceDetected = planD.groundDistanceDetected;

    if (import.meta.env.DEV) {
      console.debug("[cow-weight] Plan D scale", {
        cameraDistanceCm,
        r1,
        r2,
        bodyHeightCm,
        bboxH: Math.round(analysis.bbox.height),
        chestCm: chest_width_cm,
        lengthCm: body_length_cm,
        weightKg: previewWeightKg(chest_width_cm, body_length_cm),
      });
    }
  }

  const estimatedLiveWeightKg = previewWeightKg(chest_width_cm, body_length_cm);
  const edibleMeatKg = round2(estimatedLiveWeightKg * 0.55);

  let confidence = analysis.confidence;
  if (scaleMethod === "plan_d_pinhole" && geometryConfidence != null) {
    confidence = Math.min(confidence, 0.55 + geometryConfidence * 0.35);
  } else if (scaleMethod === "plan_d_pinhole") {
    confidence = Math.min(confidence, 0.6);
  }

  return {
    chestPixels,
    lengthPixels,
    referencePixels,
    cmPerPixel: round2(cmPerPixel),
    chestCmPerPixel: chestCmPerPixel !== undefined ? round2(chestCmPerPixel) : undefined,
    lengthCmPerPixel: lengthCmPerPixel !== undefined ? round2(lengthCmPerPixel) : undefined,
    chestWidthCm: chest_width_cm,
    bodyLengthCm: body_length_cm,
    estimatedLiveWeightKg,
    edibleMeatKg,
    confidence,
    scaleMethod,
    scaleAdjustedForDistance: scaleAdjustedForDistance || undefined,
    cameraDistanceCm,
    r1,
    r2,
    bodyHeightCm,
    geometryConfidence,
    distanceSource,
    groundDistanceDetected,
  };
}

export function bboxSummary(bbox: BBox) {
  const x1 = Math.round(bbox.x);
  const y1 = Math.round(bbox.y);
  const x2 = Math.round(bbox.x + bbox.width);
  const y2 = Math.round(bbox.y + bbox.height);
  return {
    x: x1,
    y: y1,
    x1,
    y1,
    x2,
    y2,
    width: Math.round(bbox.width),
    height: Math.round(bbox.height),
    confidencePct: Math.round(bbox.confidence * 100),
  };
}

export const SCAN_STEP_COUNT = 6;

export function stepShowsBbox(step: number) {
  return step >= 1;
}

export function stepShowsChest(step: number) {
  return step === 2 || step >= 5;
}

export function stepShowsLength(step: number) {
  return step === 3 || step >= 5;
}

export function stepShowsReference(step: number, hasReference: boolean) {
  return hasReference && (step === 4 || step >= 5);
}

export function stepAllowsDrag(step: number) {
  return step >= 2 && step <= 3 || step >= 5;
}
