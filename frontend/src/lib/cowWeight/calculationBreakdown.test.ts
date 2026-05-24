import { describe, expect, it } from "vitest";
import { buildCalculationBreakdown, canBuildAudit } from "./calculationBreakdown";
import type { BBox, CowKeypoints, CowLines, ScanMetrics } from "./types";

describe("buildCalculationBreakdown", () => {
  const bbox: BBox = { x: 80, y: 60, width: 400, height: 300, confidence: 0.8 };
  const lines: CowLines = {
    chest: { a: { x: 200, y: 100 }, b: { x: 200, y: 220 } },
    length: { a: { x: 120, y: 180 }, b: { x: 420, y: 180 } },
  };
  const keypoints: CowKeypoints = {
    leg1: { x: 150, y: 350 },
    leg2: { x: 350, y: 350 },
    topChest: { x: 200, y: 120 },
    lowerChest: { x: 200, y: 200 },
    l1: { x: 120, y: 180 },
    l2: { x: 420, y: 180 },
    chestCenterX: 200,
    detected: { legs: true, lowerChest: true, length: true },
  };
  const metrics: ScanMetrics = {
    chestPixels: 120,
    lengthPixels: 350,
    referencePixels: null,
    cmPerPixel: 0.25,
    chestCmPerPixel: 0.25,
    lengthCmPerPixel: 0.25,
    chestWidthCm: 30,
    bodyLengthCm: 87.5,
    estimatedLiveWeightKg: 120,
    edibleMeatKg: 66,
    confidence: 0.7,
    scaleMethod: "plan_d_pinhole",
    cameraDistanceCm: 200,
    r1: 0.25,
    r2: 0.25,
    bodyHeightCm: 75,
    groundDistanceDetected: true,
    distanceSource: "local",
  };

  const planD = {
    cameraDistanceCm: 200,
    r1: 0.25,
    r2: 0.25,
    bodyHeightCm: 75,
    focalLengthPx: 900,
    geometryConfidence: 0.6,
    pinholePriorCm: 200,
    localPriorCm: 190,
    cloudPriorCm: null,
    distanceSource: "local",
    scaleMethod: "plan_d_pinhole",
    bodyLengthPriorCm: 87.5,
    groundY: 360,
  };

  it("canBuildAudit accepts planD r1 when cmPerPixel is zero", () => {
    const zeroCm: ScanMetrics = { ...metrics, cmPerPixel: 0, chestCmPerPixel: 0, lengthCmPerPixel: 0, r1: 0, r2: 0 };
    expect(canBuildAudit(zeroCm, planD)).toBe(true);
    expect(canBuildAudit(zeroCm, null)).toBe(false);
  });

  it("emits 40+ rows with sequential line numbers", () => {
    const b = buildCalculationBreakdown({
      metrics,
      imageWidthPx: 800,
      imageHeightPx: 600,
      bbox,
      lines,
      hasReference: false,
      keypoints,
      planD,
    });
    expect(b.rows.length).toBeGreaterThanOrEqual(40);
    const numbers = b.rows.map((r) => r.lineNumber);
    expect(numbers).toEqual(numbers.map((_, i) => i + 1));
  });

  it("includes bbox raw, dx/dy, r1 formula, and reference not set", () => {
    const b = buildCalculationBreakdown({
      metrics,
      imageWidthPx: 800,
      imageHeightPx: 600,
      bbox,
      lines,
      hasReference: false,
      keypoints,
      planD,
    });
    const ids = b.rows.map((r) => r.id);
    expect(ids).toContain("bbX");
    expect(ids).toContain("bbWraw");
    expect(ids).toContain("chdx");
    expect(ids).toContain("chdy");
    expect(ids).toContain("lndx");
    expect(ids).toContain("refNotSet");
    expect(ids).toContain("r1formula");
    expect(ids).toContain("kpLeg1");
    expect(ids).toContain("kpLeg2");
    expect(b.rows.find((r) => r.id === "bbX1")?.value).toBe("80 px");
    expect(b.rows.find((r) => r.id === "bbY2")?.value).toBe("360 px");
    const gapRow = b.rows.find((r) => r.id === "bbGap");
    expect(gapRow?.value).toBe("240 px");
    const floorCm = b.rows.find((r) => r.id === "convFloor");
    expect(floorCm?.value).toBe("60 cm");
  });

  it("shows keypoints missing row when keypoints omitted", () => {
    const b = buildCalculationBreakdown({
      metrics,
      imageWidthPx: 800,
      imageHeightPx: 600,
      bbox,
      lines,
      hasReference: false,
      planD,
    });
    expect(b.rows.some((r) => r.id === "kpMissing")).toBe(true);
  });

  it("includes frozen vs live chest when detectLines provided", () => {
    const detectLines: CowLines = {
      chest: { a: { x: 200, y: 100 }, b: { x: 200, y: 200 } },
      length: { a: { x: 120, y: 180 }, b: { x: 400, y: 180 } },
    };
    const b = buildCalculationBreakdown({
      metrics,
      imageWidthPx: 800,
      imageHeightPx: 600,
      bbox,
      lines,
      hasReference: false,
      detectLines,
      planD,
    });
    expect(b.rows.some((r) => r.id === "frozenChest")).toBe(true);
    expect(b.rows.some((r) => r.id === "frozenChestDelta")).toBe(true);
  });
});
