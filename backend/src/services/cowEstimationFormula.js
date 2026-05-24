/**
 * Qurbani-style live weight and meat breakdown from chest width and body length (cm).
 */

const DEFAULT_DIVISOR = 660;
const MAX_DIMENSION_CM = 2000;

function round2(n) {
  return Math.round(n * 100) / 100;
}

export function getFormulaDivisor() {
  const raw = Number(process.env.COW_WEIGHT_FORMULA_DIVISOR);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_DIVISOR;
}

/**
 * @param {number} chestWidthCm
 * @param {number} bodyLengthCm
 */
export function validateDimensions(chestWidthCm, bodyLengthCm) {
  if (!Number.isFinite(chestWidthCm) || !Number.isFinite(bodyLengthCm)) {
    return { ok: false, error: "chest_width_cm and body_length_cm must be numbers" };
  }
  if (chestWidthCm <= 0 || bodyLengthCm <= 0) {
    return { ok: false, error: "Dimensions must be greater than zero" };
  }
  if (chestWidthCm > MAX_DIMENSION_CM || bodyLengthCm > MAX_DIMENSION_CM) {
    return { ok: false, error: "Dimensions exceed allowed maximum" };
  }
  return { ok: true };
}

/**
 * @param {number} chestWidthCm
 * @param {number} bodyLengthCm
 * @param {number} [motionDivisor]
 */
export function estimateFromDimensions(chestWidthCm, bodyLengthCm, divisor = getFormulaDivisor()) {
  const validation = validateDimensions(chestWidthCm, bodyLengthCm);
  if (!validation.ok) {
    const err = new Error(validation.error);
    err.status = 400;
    throw err;
  }

  const liveWeight = (chestWidthCm * chestWidthCm * bodyLengthCm) / divisor;
  const edibleMeat = liveWeight * 0.55;

  return {
    estimated_live_weight_kg: round2(liveWeight),
    edible_meat_kg: round2(edibleMeat),
    breakdown: {
      solid_meat_kg: round2(liveWeight * 0.3),
      bone_kg: round2(liveWeight * 0.15),
      fat_kg: round2(liveWeight * 0.05),
      head_meat_kg: round2(liveWeight * 0.03),
      liver_heart_kg: round2(liveWeight * 0.02),
    },
    formula_divisor: divisor,
  };
}
