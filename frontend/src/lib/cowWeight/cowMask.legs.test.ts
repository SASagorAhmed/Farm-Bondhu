import { describe, expect, it } from "vitest";
import { createEmptyMask, legColumnsFromMask } from "./cowMask";
import type { BBox } from "./types";

describe("legColumnsFromMask", () => {
  const bbox: BBox = { x: 100, y: 50, width: 400, height: 300, confidence: 0.8 };

  it("finds two peaks from vertical projection", () => {
    const mask = createEmptyMask(800, 600);
    for (let y = 220; y < 320; y++) {
      for (let x = 140; x < 200; x++) mask.data[y * mask.width + x] = 1;
      for (let x = 420; x < 480; x++) mask.data[y * mask.width + x] = 1;
    }
    const legs = legColumnsFromMask(mask, bbox);
    expect(legs).not.toBeNull();
    expect(legs!.x2 - legs!.x1).toBeGreaterThanOrEqual(bbox.width * 0.1);
  });
});
