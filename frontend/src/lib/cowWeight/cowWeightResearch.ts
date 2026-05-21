/**
 * Documented constants for side-view dairy cow photogrammetry and Qurbani-style weight.
 * See docs/ai/cow_weight_detection.md — References.
 */

/** Adult dairy withers height used for pinhole distance (cm). */
export const ASSUMED_WITHERS_CM = 145;

/** Plan B assumed standing height (cm) — aligned with pixelsToCm default. */
export const ASSUMED_COW_HEIGHT_CM_RESEARCH = 150;

/** Recommended camera-to-cow distance for side-view phone photos (m). */
export const OPTIMAL_STANDOFF_MIN_M = 3;
export const OPTIMAL_STANDOFF_MAX_M = 4.5;

export const WARN_STANDOFF_TOO_CLOSE_M = 2;
export const WARN_STANDOFF_TOO_FAR_M = 6;

export const STANDOFF_CLAMP_MIN_M = 1.5;
export const STANDOFF_CLAMP_MAX_M = 8;

/** Qurbani / regional live-weight proxy divisor. */
export const FORMULA_DIVISOR_RESEARCH = 660;

/** Typical adult dairy live weight range for UI hints (kg). */
export const PLAUSIBLE_LIVE_KG_MIN = 250;
export const PLAUSIBLE_LIVE_KG_MAX = 750;

/** Blend pinhole with heuristic/vision when not vision-only. */
export const PINHOLE_BLEND_WEIGHT = 0.4;

export const RECOMMENDED_STANDOFF_BAND = {
  min: OPTIMAL_STANDOFF_MIN_M,
  max: OPTIMAL_STANDOFF_MAX_M,
} as const;

/**
 * Pinhole standoff: distance ≈ (withers_m) × image_height / bbox_height.
 */
export function pinholeStandoffMeters(
  bboxHeightPx: number,
  imageHeightPx: number,
  withersCm = ASSUMED_WITHERS_CM
): number | null {
  if (bboxHeightPx <= 0 || imageHeightPx <= 0) return null;
  const m = (withersCm / 100) * (imageHeightPx / bboxHeightPx);
  const clamped = Math.max(STANDOFF_CLAMP_MIN_M, Math.min(STANDOFF_CLAMP_MAX_M, m));
  return Math.round(clamped * 10) / 10;
}

export function isStandoffInOptimalBand(meters: number): boolean {
  return meters >= OPTIMAL_STANDOFF_MIN_M && meters <= OPTIMAL_STANDOFF_MAX_M;
}

/** Max ±8% adjustment to assumed cow height from standoff (Plan B). */
export const STANDOFF_HEIGHT_NUDGE_MAX_FRAC = 0.08;

/**
 * Closer than optimal → cow fills frame → reduce assumed height slightly.
 * Farther → increase slightly. Returns multiplier near 1.0.
 */
export function standoffHeightMultiplier(standoffM: number): number {
  const mid = (OPTIMAL_STANDOFF_MIN_M + OPTIMAL_STANDOFF_MAX_M) / 2;
  const span = OPTIMAL_STANDOFF_MAX_M - OPTIMAL_STANDOFF_MIN_M;
  if (span <= 0) return 1;
  /** Closer than mid → smaller assumed height; farther → larger. */
  const delta = (standoffM - mid) / span;
  const nudge = Math.max(-STANDOFF_HEIGHT_NUDGE_MAX_FRAC, Math.min(STANDOFF_HEIGHT_NUDGE_MAX_FRAC, delta * STANDOFF_HEIGHT_NUDGE_MAX_FRAC * 2));
  return 1 + nudge;
}

export function isLiveWeightPlausible(kg: number): boolean {
  return kg >= PLAUSIBLE_LIVE_KG_MIN && kg <= PLAUSIBLE_LIVE_KG_MAX;
}
