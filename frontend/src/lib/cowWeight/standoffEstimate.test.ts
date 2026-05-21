import { describe, expect, it } from "vitest";
import { pinholeStandoffMeters } from "./cowWeightResearch";
import { estimateCameraStandoff } from "./standoffEstimate";

describe("pinholeStandoffMeters", () => {
  it("estimates distance from bbox height fraction", () => {
    const m = pinholeStandoffMeters(400, 800);
    expect(m).not.toBeNull();
    expect(m!).toBeGreaterThan(2);
    expect(m!).toBeLessThan(5);
  });
});

describe("estimateCameraStandoff", () => {
  const bbox = { x: 100, y: 50, width: 600, height: 400, confidence: 0.8 };

  it("blends vision with pinhole when confident", () => {
    const r = estimateCameraStandoff(bbox, 800, {
      standoffDistanceM: 4.2,
      distanceConfidence: 0.8,
    });
    expect(r.meters).toBeGreaterThan(3);
    expect(r.meters).toBeLessThan(5);
    expect(r.method).toBe("blended");
    expect(r.source).toBe("vision");
    expect(r.recommendedBand.min).toBe(3);
    expect(r.recommendedBand.max).toBe(4.5);
  });

  it("uses blended pinhole+heuristic without vision", () => {
    const r = estimateCameraStandoff(bbox, 800);
    expect(r.method === "blended" || r.method === "heuristic").toBe(true);
    expect(r.meters).toBeGreaterThan(1.5);
  });

  it("warns when cow too small in frame", () => {
    const small = { ...bbox, height: 200 };
    const r = estimateCameraStandoff(small, 800);
    expect(r.warningKey).toBe("cowWeight.scan.standoffCowSmall");
  });

  it("includes EXIF focal length when provided", () => {
    const r = estimateCameraStandoff(bbox, 800, undefined, { focalLengthMm: 26 });
    expect(r.focalLengthMm).toBe(26);
  });
});
