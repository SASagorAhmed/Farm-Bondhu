import { describe, expect, it } from "vitest";
import { computePlanDScale } from "./distanceScale";
import { previewWeightKg } from "./scanMetrics";
import type { CowLines } from "./types";

describe("distanceScale Plan D", () => {
  const bbox = { x: 50, y: 40, width: 500, height: 350, confidence: 0.9 };
  const lines: CowLines = {
    chest: { a: { x: 300, y: 120 }, b: { x: 300, y: 280 } },
    length: { a: { x: 100, y: 200 }, b: { x: 450, y: 200 } },
  };

  it("computes scale on grid with positive r1 r2", () => {
    const s = computePlanDScale({
      bbox,
      lines,
      imageWidthPx: 640,
      imageHeightPx: 480,
    });
    expect(s.cameraDistanceCm).toBeGreaterThanOrEqual(150);
    expect(s.cameraDistanceCm).toBeLessThanOrEqual(250);
    expect(s.r1).toBeGreaterThan(0);
    expect(s.groundY).toBe(bbox.y + bbox.height);
  });

  it("prefers pinhole-snapped Z on grid for typical side photo", () => {
    const s = computePlanDScale({
      bbox,
      lines,
      imageWidthPx: 640,
      imageHeightPx: 480,
      standoffMeters: 3.5,
    });
    expect(s.cameraDistanceCm).toBeGreaterThanOrEqual(150);
    expect(s.bodyHeightCm).toBeGreaterThan(30);
    expect(s.bodyHeightCm).toBeLessThan(280);
  });
});
