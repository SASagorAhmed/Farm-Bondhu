import type { CowEstimationBreakdown } from "./types";
import { WEIGHT_FORMULA_DIVISOR } from "./scanMetrics";

export const MANUAL_MAX_DIMENSION_CM = 2000;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function validateManualDimensions(
  chestWidthCm: number,
  bodyLengthCm: number
): { ok: true } | { ok: false; error: string } {
  if (!Number.isFinite(chestWidthCm) || !Number.isFinite(bodyLengthCm)) {
    return { ok: false, error: "chest_width_cm and body_length_cm must be numbers" };
  }
  if (chestWidthCm <= 0 || bodyLengthCm <= 0) {
    return { ok: false, error: "Dimensions must be greater than zero" };
  }
  if (chestWidthCm > MANUAL_MAX_DIMENSION_CM || bodyLengthCm > MANUAL_MAX_DIMENSION_CM) {
    return { ok: false, error: "Dimensions exceed allowed maximum" };
  }
  return { ok: true };
}

export interface ManualEstimate {
  estimatedLiveWeightKg: number;
  edibleMeatKg: number;
  breakdown: CowEstimationBreakdown;
  formulaDivisor: number;
}

export function estimateManualFromDimensions(
  chestWidthCm: number,
  bodyLengthCm: number
): ManualEstimate {
  const validation = validateManualDimensions(chestWidthCm, bodyLengthCm);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const liveWeightRaw =
    (chestWidthCm * chestWidthCm * bodyLengthCm) / WEIGHT_FORMULA_DIVISOR;

  return {
    estimatedLiveWeightKg: round2(liveWeightRaw),
    edibleMeatKg: round2(liveWeightRaw * 0.55),
    breakdown: {
      solid_meat_kg: round2(liveWeightRaw * 0.3),
      bone_kg: round2(liveWeightRaw * 0.15),
      fat_kg: round2(liveWeightRaw * 0.05),
      head_meat_kg: round2(liveWeightRaw * 0.03),
      liver_heart_kg: round2(liveWeightRaw * 0.02),
    },
    formulaDivisor: WEIGHT_FORMULA_DIVISOR,
  };
}
