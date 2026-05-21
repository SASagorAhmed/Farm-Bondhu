import { describe, expect, it } from "vitest";
import { assumedHeightCmForStandoff } from "./pixelsToCm";
import {
  isLiveWeightPlausible,
  isStandoffInOptimalBand,
  standoffHeightMultiplier,
} from "./cowWeightResearch";

describe("cowWeightResearch", () => {
  it("flags optimal standoff band", () => {
    expect(isStandoffInOptimalBand(3.5)).toBe(true);
    expect(isStandoffInOptimalBand(1.5)).toBe(false);
  });

  it("nudges assumed height when too close", () => {
    const { heightCm, adjusted } = assumedHeightCmForStandoff(150, 1.8);
    expect(adjusted).toBe(true);
    expect(heightCm).toBeLessThan(150);
  });

  it("does not nudge in optimal band", () => {
    const { adjusted } = assumedHeightCmForStandoff(150, 3.5);
    expect(adjusted).toBe(false);
  });

  it("checks plausible live weight", () => {
    expect(isLiveWeightPlausible(400)).toBe(true);
    expect(isLiveWeightPlausible(900)).toBe(false);
  });

  it("standoffHeightMultiplier stays within ±8%", () => {
    const mult = standoffHeightMultiplier(1.5);
    expect(mult).toBeGreaterThanOrEqual(0.92);
    expect(mult).toBeLessThanOrEqual(1.08);
  });
});
