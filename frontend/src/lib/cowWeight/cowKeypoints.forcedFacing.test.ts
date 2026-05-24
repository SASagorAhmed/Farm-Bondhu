import { describe, expect, it } from "vitest";
import { assignLegsFromSemanticPoints } from "./cowKeypoints";

describe("forcedFacing leg assignment", () => {
  const frontLeft = { x: 200, y: 400 };
  const hindRight = { x: 500, y: 400 };

  it("head_left puts Front (leg1) on the head-side column", () => {
    const assigned = assignLegsFromSemanticPoints("head_left", frontLeft, hindRight);
    expect(assigned.leg1.x).toBe(frontLeft.x);
    expect(assigned.leg2.x).toBe(hindRight.x);
  });

  it("head_right puts Front (leg1) on the head-side column", () => {
    const assigned = assignLegsFromSemanticPoints("head_right", hindRight, frontLeft);
    expect(assigned.leg1.x).toBe(hindRight.x);
    expect(assigned.leg2.x).toBe(frontLeft.x);
  });
});
