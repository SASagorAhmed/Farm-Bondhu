import type { BBox, CowAnalysisResult, CowLines, DetectionMode, ScanMetrics } from "./types";
import { lineLengthPx } from "./imageUtils";
import {
  ASSUMED_BODY_LENGTH_CM,
  ASSUMED_COW_HEIGHT_CM,
  dimensionsFromLines,
  dimensionsFromLinesPlanB,
  TYPICAL_LENGTH_SPAN_FRAC,
} from "./pixelsToCm";
import { cmPerPixelFromReference } from "./referenceScale";

export const WEIGHT_FORMULA_DIVISOR = 660;
const FORMULA_DIVISOR = WEIGHT_FORMULA_DIVISOR;
export { ASSUMED_COW_HEIGHT_CM, ASSUMED_BODY_LENGTH_CM, TYPICAL_LENGTH_SPAN_FRAC };
export const REFERENCE_STICK_CM = 100;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Values for UI formula strings (Plan B dual-axis vs Plan C). */
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
  };
}

export function previewWeightKg(chestWidthCm: number, bodyLengthCm: number): number {
  if (chestWidthCm <= 0 || bodyLengthCm <= 0) return 0;
  return round2((chestWidthCm * chestWidthCm * bodyLengthCm) / FORMULA_DIVISOR);
}

export function computeScanMetrics(
  mode: DetectionMode,
  lines: CowLines,
  analysis: CowAnalysisResult
): ScanMetrics {
  const chestPixels = round2(lineLengthPx(lines.chest));
  const lengthPixels = round2(lineLengthPx(lines.length));
  const referencePixels = lines.reference ? round2(lineLengthPx(lines.reference)) : null;

  let cmPerPixel = analysis.cmPerPixel ?? 0;
  let chestCmPerPixel: number | undefined;
  let lengthCmPerPixel: number | undefined;
  let scaleMethod: ScanMetrics["scaleMethod"] = "bbox_assumed_150cm";
  let chest_width_cm: number;
  let body_length_cm: number;

  if (mode === "plan_c" && lines.reference) {
    cmPerPixel = cmPerPixelFromReference(lines.reference);
    scaleMethod = "reference_100cm";
    const dims = dimensionsFromLines(lines, cmPerPixel);
    chest_width_cm = dims.chest_width_cm;
    body_length_cm = dims.body_length_cm;
  } else {
    const planB = dimensionsFromLinesPlanB(lines, analysis.bbox);
    chest_width_cm = planB.chest_width_cm;
    body_length_cm = planB.body_length_cm;
    chestCmPerPixel = planB.chestCmPerPixel;
    lengthCmPerPixel = planB.lengthCmPerPixel;
    cmPerPixel = chestCmPerPixel;
    scaleMethod = "bbox_assumed_150cm";

    if (import.meta.env.DEV) {
      console.debug("[cow-weight] Plan B scale", {
        bboxW: Math.round(analysis.bbox.width),
        bboxH: Math.round(analysis.bbox.height),
        chestPx: chestPixels,
        lengthPx: lengthPixels,
        chestCmPerPixel: round2(chestCmPerPixel),
        lengthCmPerPixel: round2(lengthCmPerPixel),
        chestCm: chest_width_cm,
        lengthCm: body_length_cm,
        weightKg: previewWeightKg(chest_width_cm, body_length_cm),
      });
    }
  }

  const estimatedLiveWeightKg = previewWeightKg(chest_width_cm, body_length_cm);
  const edibleMeatKg = round2(estimatedLiveWeightKg * 0.55);

  let confidence = analysis.confidence;
  if (mode === "plan_b" && scaleMethod === "bbox_assumed_150cm") {
    confidence = Math.min(confidence, 0.55);
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
  };
}

export function bboxSummary(bbox: BBox) {
  return {
    x: Math.round(bbox.x),
    y: Math.round(bbox.y),
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

export function stepShowsReference(step: number, mode: DetectionMode) {
  return mode === "plan_c" && (step === 4 || step >= 5);
}

export function stepAllowsDrag(step: number) {
  return step >= 2 && step <= 3 || step >= 5;
}
