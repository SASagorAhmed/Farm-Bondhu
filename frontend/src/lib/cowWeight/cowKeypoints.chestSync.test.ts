import { describe, expect, it } from "vitest";
import { syncChestKeypointsFromLines } from "./cowKeypoints";
import type { CowKeypoints } from "./types";

const baseKp = (): CowKeypoints => ({
  leg1: { x: 100, y: 300 },
  leg2: { x: 500, y: 300 },
  topChest: { x: 300, y: 100 },
  lowerChest: { x: 300, y: 250 },
  l1: { x: 500, y: 200 },
  l2: { x: 100, y: 200 },
  chestCenterX: 300,
  detected: { legs: true, lowerChest: true, length: true, facing: "head_right" },
});

describe("syncChestKeypointsFromLines", () => {
  it("copies lines.chest into topChest and lowerChest", () => {
    const chest = { a: { x: 400, y: 110 }, b: { x: 402, y: 230 } };
    const out = syncChestKeypointsFromLines(baseKp(), chest);
    expect(out.topChest).toEqual(chest.a);
    expect(out.lowerChest).toEqual(chest.b);
    expect(out.chestCenterX).toBe(401);
    expect(out.leg1.x).toBe(100);
  });
});
