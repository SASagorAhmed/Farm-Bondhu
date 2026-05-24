import { describe, expect, it } from "vitest";
import {
  applyCloudFacingToKeypoints,
  reassignKeypointsForHeadSide,
} from "./cowKeypoints";
import type { CowKeypoints } from "./types";

function kpWithLegs(leg1x: number, leg2x: number): CowKeypoints {
  return {
    leg1: { x: leg1x, y: 300 },
    leg2: { x: leg2x, y: 300 },
    topChest: { x: 400, y: 120 },
    lowerChest: { x: 400, y: 220 },
    l1: { x: leg2x, y: 200 },
    l2: { x: leg1x, y: 200 },
    chestCenterX: 400,
    detected: {
      legs: true,
      lowerChest: true,
      length: true,
      facing: "head_right",
    },
  };
}

describe("stable facing after cloud", () => {
  it("reassignKeypointsForHeadSide keeps leg column X positions", () => {
    const local = kpWithLegs(200, 700);
    const flipped = reassignKeypointsForHeadSide(local, "head_left");
    const xs = [local.leg1.x, local.leg2.x].sort((a, b) => a - b);
    const xsAfter = [flipped.leg1.x, flipped.leg2.x].sort((a, b) => a - b);
    expect(xsAfter).toEqual(xs);
    expect(flipped.leg1.x).toBeLessThan(flipped.leg2.x);
  });

  it("applyCloudFacingToKeypoints swaps front/hind without moving columns", () => {
    const local = kpWithLegs(700, 200);
    const cloud = applyCloudFacingToKeypoints(local, "head_left", null);
    const xs = [local.leg1.x, local.leg2.x].sort((a, b) => a - b);
    const xsAfter = [cloud.leg1.x, cloud.leg2.x].sort((a, b) => a - b);
    expect(xsAfter).toEqual(xs);
    expect(cloud.detected?.facing).toBe("head_left");
  });
});
