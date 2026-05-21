import { describe, expect, it } from "vitest";
import { computeScanMetrics, previewWeightKg } from "./scanMetrics";
import type { CowAnalysisResult, CowLines } from "./types";

describe("computeScanMetrics standoff", () => {
  const analysis: CowAnalysisResult = {
    bbox: { x: 50, y: 40, width: 500, height: 350, confidence: 0.85 },
    lines: {
      chest: { a: { x: 200, y: 120 }, b: { x: 200, y: 280 } },
      length: { a: { x: 100, y: 200 }, b: { x: 450, y: 200 } },
    },
    imageWidth: 640,
    imageHeight: 480,
    model: "yolov8n-seg-onnx",
    confidence: 0.85,
  };

  const lines: CowLines = analysis.lines;

  it("returns positive preview weight from step-1 lines", () => {
    const m = computeScanMetrics("plan_b", lines, analysis);
    expect(m.estimatedLiveWeightKg).toBeGreaterThan(0);
    expect(previewWeightKg(m.chestWidthCm, m.bodyLengthCm)).toBe(m.estimatedLiveWeightKg);
  });

  it("adjusts scale when standoff is outside optimal band", () => {
    const base = computeScanMetrics("plan_b", lines, analysis, 3.5);
    const far = computeScanMetrics("plan_b", lines, analysis, 7);
    expect(far.scaleAdjustedForDistance).toBe(true);
    expect(far.chestWidthCm).not.toBe(base.chestWidthCm);
  });
});
