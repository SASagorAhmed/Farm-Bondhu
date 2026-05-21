import { describe, expect, it } from "vitest";
import {
  assignLegsFromSemanticPoints,
  completeLegPairFromFacing,
  reassignKeypointsForHeadSide,
} from "./cowKeypoints";
import type { CowKeypoints } from "./types";

function kpWithLegs(leg1x: number, leg2x: number): CowKeypoints {
  return {
    leg1: { x: leg1x, y: 300 },
    leg2: { x: leg2x, y: 300 },
    topChest: { x: 450, y: 100 },
    lowerChest: { x: 450, y: 250 },
    l1: { x: leg2x, y: 200 },
    l2: { x: leg1x, y: 200 },
    chestCenterX: 450,
    detected: {
      legs: true,
      lowerChest: true,
      topChest: true,
      length: true,
      facing: "head_right",
    },
  };
}

describe("completeLegPairFromFacing", () => {
  const bbox = { x: 100, y: 50, width: 800, height: 400, confidence: 0.8 };

  it("adds hind on tail side when only front column known (head_left)", () => {
    const r = completeLegPairFromFacing(
      "head_left",
      { x: 200, y: 300 },
      null,
      bbox,
      { x: 750, y: 200 },
      320
    );
    expect(r.inferred).toBe(true);
    expect(r.colA.x).toBeLessThan(r.colB.x);
  });
});

describe("assignLegsFromSemanticPoints", () => {
  it("swaps when front is on tail side for head_left", () => {
    const r = assignLegsFromSemanticPoints(
      "head_left",
      { x: 800, y: 300 },
      { x: 200, y: 300 }
    );
    expect(r.leg1.x).toBeLessThan(r.leg2.x);
  });
});

describe("reassignKeypointsForHeadSide", () => {
  it("puts front leg (leg1) on head-left side when facing head_left", () => {
    const out = reassignKeypointsForHeadSide(kpWithLegs(700, 200), "head_left");
    expect(out.leg1.x).toBeLessThan(out.leg2.x);
  });

  it("puts front leg (leg1) on head-right side when facing head_right", () => {
    const out = reassignKeypointsForHeadSide(kpWithLegs(200, 700), "head_right");
    expect(out.leg1.x).toBeGreaterThan(out.leg2.x);
  });
});

describe("chest ordering", () => {
  it("expects top chest above lower chest in sample keypoints", () => {
    const kp = kpWithLegs(200, 700);
    expect(kp.topChest.y).toBeLessThan(kp.lowerChest.y);
  });
});
