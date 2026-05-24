import { describe, expect, it } from "vitest";
import { proposeLinesFromKeypoints } from "./cowKeypoints";
import { clampLinesToBBox, proposeLinesFromBBox } from "./proposeLines";
import { computePlanDScale } from "./distanceScale";
import { computeScanMetrics } from "./scanMetrics";
import type { BBox, CowAnalysisResult, CowKeypoints, CowLines } from "./types";

function mockAnalysis(bbox: BBox, lines: CowLines): CowAnalysisResult {
  return {
    bbox,
    lines,
    imageWidth: 1200,
    imageHeight: 800,
    model: "yolov8n-seg-onnx",
    confidence: 0.71,
  };
}

describe("strict weight — Detect lines canonical", () => {
  const bbox: BBox = { x: 80, y: 60, width: 1123, height: 748, confidence: 0.71 };

  const shortChestLines: CowLines = {
    chest: { a: { x: 400, y: 200 }, b: { x: 400, y: 450 } },
    length: { a: { x: 200, y: 350 }, b: { x: 1000, y: 350 } },
  };

  const longChestKeypoints: CowKeypoints = {
    leg1: { x: 350, y: 700 },
    leg2: { x: 900, y: 700 },
    topChest: { x: 400, y: 180 },
    lowerChest: { x: 400, y: 620 },
    l1: { x: 200, y: 350 },
    l2: { x: 1000, y: 350 },
    chestCenterX: 400,
    detected: { legs: true, lowerChest: true, topChest: true, length: true, facing: "head_left" },
  };

  it("holding analyze lines keeps weight stable (simulates Step 1→2 without repropose)", () => {
    const analysis = mockAnalysis(bbox, shortChestLines);
    const before = computeScanMetrics("plan_b", shortChestLines, analysis);
    const after = computeScanMetrics("plan_b", shortChestLines, analysis);
    expect(after.estimatedLiveWeightKg).toBe(before.estimatedLiveWeightKg);
    expect(before.estimatedLiveWeightKg).toBeGreaterThan(0);
  });

  it("reproposing lines from keypoints would inflate weight (old Chest-step bug)", () => {
    const analysis = mockAnalysis(bbox, shortChestLines);
    const detectKg = computeScanMetrics("plan_b", shortChestLines, analysis).estimatedLiveWeightKg;
    const fromKp = clampLinesToBBox(proposeLinesFromBBox(bbox, longChestKeypoints), bbox);
    const chestKg = computeScanMetrics("plan_b", fromKp, analysis).estimatedLiveWeightKg;
    expect(chestKg).toBeGreaterThan(detectKg * 1.5);
  });

  it("proposeLinesFromKeypoints matches longer chest than short lines", () => {
    const fromKp = proposeLinesFromKeypoints(bbox, longChestKeypoints);
    const shortPx = shortChestLines.chest.b.y - shortChestLines.chest.a.y;
    const longPx = fromKp.chest.b.y - fromKp.chest.a.y;
    expect(longPx).toBeGreaterThan(shortPx);
  });
});

describe("Detect frozen preview — Plan D scale frozen on analysis", () => {
  const bbox: BBox = { x: 80, y: 60, width: 1123, height: 748, confidence: 0.71 };
  const lines: CowLines = {
    chest: { a: { x: 400, y: 200 }, b: { x: 400, y: 450 } },
    length: { a: { x: 200, y: 350 }, b: { x: 1000, y: 350 } },
  };
  const base = mockAnalysis(bbox, lines);
  const planD = computePlanDScale({
    bbox,
    lines,
    imageWidthPx: base.imageWidth,
    imageHeightPx: base.imageHeight,
    visionUsed: false,
  });
  const analysis = { ...base, planD };

  it("frozen planD ignores later standoff (Detect snapshot policy)", () => {
    const snap = computeScanMetrics("plan_b", lines, analysis, null);
    const withStandoff = computeScanMetrics("plan_b", lines, analysis, 7);
    expect(snap.estimatedLiveWeightKg).toBeGreaterThan(0);
    expect(withStandoff.estimatedLiveWeightKg).toBe(snap.estimatedLiveWeightKg);
    expect(withStandoff.cameraDistanceCm).toBe(snap.cameraDistanceCm);
    expect(snap.groundDistanceDetected).toBeDefined();
  });

  it("without frozen planD, standoff can change selected Z", () => {
    const unfrozen = mockAnalysis(bbox, lines);
    const a = computeScanMetrics("plan_b", lines, unfrozen, null);
    const b = computeScanMetrics("plan_b", lines, unfrozen, 3.5);
    expect(a.scaleMethod).toBe("plan_d_pinhole");
    expect(b.cameraDistanceCm).toBeDefined();
  });
});
