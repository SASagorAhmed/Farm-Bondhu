import { describe, expect, it } from "vitest";
import { clampLinesToBBox } from "./proposeLines";
import type { BBox, CowLines } from "./types";

describe("clampLinesToBBox facing-aware length clamp", () => {
  const bbox: BBox = { x: 100, y: 80, width: 800, height: 500, confidence: 0.8 };
  const xMin = bbox.x + 4;
  const xMax = bbox.x + bbox.width - 4;

  const lines: CowLines = {
    chest: { a: { x: 260, y: 180 }, b: { x: 260, y: 420 } },
    length: {
      a: { x: 220, y: 240 },
      b: { x: xMax + 24, y: 240 },
    },
  };

  it("keeps left-facing C2 at/outside right body end", () => {
    const clamped = clampLinesToBBox(lines, bbox, "head_left");
    expect(clamped.length.b.x).toBe(xMax + 24);
    expect(clamped.length.b.x).toBeGreaterThan(xMax);
    expect(clamped.length.b.x).toBeGreaterThanOrEqual(xMin);
  });

  it("keeps right-facing clamp behavior unchanged", () => {
    const clamped = clampLinesToBBox(lines, bbox, "head_right");
    expect(clamped.length.b.x).toBe(xMax);
    expect(clamped.length.b.x).toBeLessThanOrEqual(xMax);
  });
});
