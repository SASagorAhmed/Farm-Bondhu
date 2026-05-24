import { describe, expect, it } from "vitest";
import { applyDirectionOnlyVision } from "./keypointMerge";
import type { BBox, CowKeypoints } from "./types";

const bbox: BBox = { x: 80, y: 60, width: 500, height: 350, confidence: 0.8 };

const localKp: CowKeypoints = {
  leg1: { x: 200, y: 300 },
  leg2: { x: 400, y: 300 },
  topChest: { x: 300, y: 120 },
  lowerChest: { x: 300, y: 220 },
  l1: { x: 150, y: 200 },
  l2: { x: 450, y: 200 },
  chestCenterX: 300,
  detected: { legs: true, facing: "head_right" },
};

describe("applyDirectionOnlyVision", () => {
  it("does not receive or return modified keypoints", () => {
    const result = applyDirectionOnlyVision(
      {
        headSide: "left",
        confidence: 0.85,
        headBbox: { x: 0.12, y: 0.2, width: 0.14, height: 0.16 },
        frontLeg: { x: 0.15, y: 0.85 },
        hindLeg: { x: 0.85, y: 0.85 },
        topChest: { x: 0.5, y: 0.2 },
        lowerChest: { x: 0.5, y: 0.55 },
        standoffDistanceM: 3.5,
        distanceConfidence: 0.6,
        reason: "ok",
      },
      bbox,
      800,
      600
    );

    expect(result.facing).toBe("head_left");
    expect(result.verifySource).toBe("vision");
    expect(localKp.leg1.x).toBe(200);
    expect(localKp.topChest.y).toBe(120);
  });
});
