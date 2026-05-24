import { describe, expect, it } from "vitest";
import { canonicalLinesFromAnalysis } from "./canonicalScanLines";
import { lineLengthPx } from "./imageUtils";
import { proposeLinesFromBBox, shouldReproposeChest } from "./proposeLines";
import type { BBox, CowAnalysisResult, CowKeypoints, CowLines } from "./types";

function chestSpanPx(chest: CowLines["chest"]): number {
  return Math.abs(chest.b.y - chest.a.y);
}

describe("canonicalLinesFromAnalysis", () => {
  const bbox: BBox = { x: 80, y: 60, width: 1123, height: 748, confidence: 0.71 };

  const legCenters = { x1: 350, x2: 900 };
  const shortLines: CowLines = {
    chest: { a: { x: 625, y: 200 }, b: { x: 625, y: 450 } },
    length: { a: { x: 200, y: 350 }, b: { x: 1000, y: 350 } },
  };

  const longChestKeypoints: CowKeypoints = {
    leg1: { x: 350, y: 700 },
    leg2: { x: 900, y: 700 },
    topChest: { x: 400, y: 180 },
    lowerChest: { x: 400, y: 620 },
    l1: { x: 150, y: 400 },
    l2: { x: 1050, y: 320 },
    chestCenterX: 400,
    detected: { legs: true, lowerChest: true, topChest: true, length: true, facing: "head_left" },
  };

  it("keeps analyze lines when chest does not need repropose (Re-analyze vs proposeLinesFromBBox)", () => {
    const analysis: CowAnalysisResult = {
      bbox,
      lines: shortLines,
      legCenters,
      imageWidth: 1200,
      imageHeight: 800,
      model: "yolov8n-seg-onnx",
      confidence: 0.71,
    };

    expect(shouldReproposeChest(shortLines.chest, bbox, legCenters, undefined)).toBe(false);

    const canonical = canonicalLinesFromAnalysis(analysis);
    const fromKeypoints = proposeLinesFromBBox(bbox, longChestKeypoints);

    expect(chestSpanPx(canonical.chest)).toBe(chestSpanPx(shortLines.chest));
    expect(chestSpanPx(fromKeypoints.chest)).toBeGreaterThan(chestSpanPx(canonical.chest));
    expect(lineLengthPx(canonical.length)).toBe(lineLengthPx(shortLines.length));
  });

  it("reproposes chest only (not full keypoint lines) when span is too short", () => {
    const analysis: CowAnalysisResult = {
      bbox,
      lines: shortLines,
      keypoints: longChestKeypoints,
      imageWidth: 1200,
      imageHeight: 800,
      model: "yolov8n-seg-onnx",
      confidence: 0.71,
    };

    expect(shouldReproposeChest(shortLines.chest, bbox, undefined, longChestKeypoints)).toBe(true);

    const canonical = canonicalLinesFromAnalysis(analysis);
    const fromKeypoints = proposeLinesFromBBox(bbox, longChestKeypoints);

    expect(chestSpanPx(canonical.chest)).toBeGreaterThan(chestSpanPx(shortLines.chest));
    expect(lineLengthPx(canonical.length)).toBe(lineLengthPx(shortLines.length));
    expect(lineLengthPx(fromKeypoints.length)).not.toBe(lineLengthPx(shortLines.length));
  });
});
