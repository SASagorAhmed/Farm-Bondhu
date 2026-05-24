import { describe, expect, it } from "vitest";
import {
  estimateManualFromDimensions,
  MANUAL_MAX_DIMENSION_CM,
  validateManualDimensions,
} from "./manualEstimate";

describe("manualEstimate", () => {
  it("matches backend-style formula outputs", () => {
    const m = estimateManualFromDimensions(55, 65);
    expect(m.estimatedLiveWeightKg).toBe(297.92);
    expect(m.edibleMeatKg).toBe(163.85);
    expect(m.breakdown).toEqual({
      solid_meat_kg: 89.38,
      bone_kg: 44.69,
      fat_kg: 14.9,
      head_meat_kg: 8.94,
      liver_heart_kg: 5.96,
    });
    expect(m.formulaDivisor).toBe(660);
  });

  it("validates manual dimensions", () => {
    expect(validateManualDimensions(0, 10)).toEqual({
      ok: false,
      error: "Dimensions must be greater than zero",
    });
    expect(validateManualDimensions(10, Number.NaN)).toEqual({
      ok: false,
      error: "chest_width_cm and body_length_cm must be numbers",
    });
    expect(validateManualDimensions(MANUAL_MAX_DIMENSION_CM + 1, 10)).toEqual({
      ok: false,
      error: "Dimensions exceed allowed maximum",
    });
    expect(validateManualDimensions(55, 65)).toEqual({ ok: true });
  });
});
