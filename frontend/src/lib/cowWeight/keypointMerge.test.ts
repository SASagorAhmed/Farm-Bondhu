import { describe, expect, it } from "vitest";
import { applyFullVisionAssist } from "./keypointMerge";
import type { CowDirectionAssistResult } from "./api";
import type { CowKeypoints } from "./types";

function baseKp(): CowKeypoints {
  return {
    leg1: { x: 200, y: 300 },
    leg2: { x: 700, y: 300 },
    topChest: { x: 450, y: 120 },
    lowerChest: { x: 450, y: 220 },
    l1: { x: 700, y: 200 },
    l2: { x: 200, y: 200 },
    chestCenterX: 450,
    detected: {
      legs: true,
      lowerChest: true,
      topChest: true,
      length: true,
      facing: "head_left",
      bodyDirection: {
        headSide: "left",
        tailSide: "right",
        direction: "normal",
        isReversed: false,
      },
    },
  };
}

describe("applyFullVisionAssist", () => {
  const bbox = { x: 100, y: 50, width: 800, height: 400, confidence: 0.8 };

  it("maps vision front/hind to leg1/leg2 on head side", () => {
    const vision: CowDirectionAssistResult = {
      headSide: "left",
      confidence: 0.85,
      headBbox: { x: 0.1, y: 0.1, width: 0.15, height: 0.2 },
      frontLeg: { x: 0.2, y: 0.75 },
      hindLeg: { x: 0.8, y: 0.75 },
      topChest: { x: 0.45, y: 0.25 },
      lowerChest: { x: 0.45, y: 0.4 },
      standoffDistanceM: 3.5,
      distanceConfidence: 0.7,
      reason: "ok",
    };
    const { keypoints, facing } = applyFullVisionAssist(
      baseKp(),
      vision,
      bbox,
      1000,
      800
    );
    expect(facing).toBe("head_left");
    expect(keypoints.leg1.x).toBeLessThan(keypoints.leg2.x);
    expect(keypoints.topChest.y).toBeLessThan(keypoints.lowerChest.y);
  });

  it("swaps inverted vision front/hind for head_left", () => {
    const vision: CowDirectionAssistResult = {
      headSide: "left",
      confidence: 0.85,
      headBbox: { x: 0.05, y: 0.08, width: 0.12, height: 0.15 },
      frontLeg: { x: 0.82, y: 0.75 },
      hindLeg: { x: 0.18, y: 0.75 },
      topChest: { x: 0.5, y: 0.2 },
      lowerChest: { x: 0.5, y: 0.38 },
      standoffDistanceM: null,
      distanceConfidence: 0,
      reason: "swapped labels",
    };
    const { keypoints } = applyFullVisionAssist(baseKp(), vision, bbox, 1000, 800);
    expect(keypoints.leg1.x).toBeLessThan(keypoints.leg2.x);
  });

  it("synthesizes hind when vision returns only frontLeg", () => {
    const vision: CowDirectionAssistResult = {
      headSide: "left",
      confidence: 0.85,
      headBbox: { x: 0.05, y: 0.08, width: 0.12, height: 0.15 },
      frontLeg: { x: 0.22, y: 0.75 },
      hindLeg: null,
      topChest: { x: 0.5, y: 0.2 },
      lowerChest: { x: 0.5, y: 0.38 },
      standoffDistanceM: null,
      distanceConfidence: 0,
      reason: "one leg",
    };
    const { keypoints } = applyFullVisionAssist(baseKp(), vision, bbox, 1000, 800);
    expect(keypoints.leg1.x).toBeLessThan(keypoints.leg2.x);
    expect(keypoints.detected?.legs).toBe(true);
  });
});
