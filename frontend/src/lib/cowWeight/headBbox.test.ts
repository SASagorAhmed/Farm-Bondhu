import { describe, expect, it } from "vitest";
import {
  clampHeadBbox,
  headBboxFromHeadPoint,
  headBboxFromNormalized,
  resolveHeadBboxFromVision,
  HEAD_MAX_WIDTH_FRAC,
} from "./headBbox";
import { createEmptyMask } from "./cowMask";
import type { BBox } from "./types";

describe("headBboxFromHeadPoint", () => {
  const bbox: BBox = { x: 100, y: 50, width: 800, height: 400, confidence: 0.8 };

  it("places box near head point X (right end)", () => {
    const mask = createEmptyMask(1200, 800);
    for (let y = 80; y < 200; y++) {
      for (let x = 820; x < 920; x++) {
        mask.data[y * mask.width + x] = 1;
      }
    }
    const head = { x: 880, y: 180 };
    const box = headBboxFromHeadPoint(mask, bbox, head);
    expect(box).not.toBeNull();
    expect(box!.x + box!.width / 2).toBeGreaterThan(750);
    expect(box!.width).toBeLessThanOrEqual(bbox.width * HEAD_MAX_WIDTH_FRAC + 2);
  });

  it("places box near head point X (left end)", () => {
    const mask = createEmptyMask(1200, 800);
    for (let y = 80; y < 200; y++) {
      for (let x = 120; x < 220; x++) {
        mask.data[y * mask.width + x] = 1;
      }
    }
    const head = { x: 150, y: 180 };
    const box = headBboxFromHeadPoint(mask, bbox, head);
    expect(box).not.toBeNull();
    expect(box!.x + box!.width / 2).toBeLessThan(350);
    expect(box!.width).toBeLessThanOrEqual(bbox.width * HEAD_MAX_WIDTH_FRAC + 2);
  });
});

describe("clampHeadBbox", () => {
  const cowBbox: BBox = { x: 100, y: 50, width: 800, height: 400, confidence: 0.8 };
  const head = { x: 180, y: 120 };

  it("shrinks wide vision box to at most 22% cow width", () => {
    const wide = headBboxFromNormalized(
      { x: 0.05, y: 0.05, width: 0.55, height: 0.35 },
      1000,
      800,
      0.8
    );
    const clamped = clampHeadBbox(wide, cowBbox, head, "left");
    expect(clamped.width).toBeLessThanOrEqual(cowBbox.width * HEAD_MAX_WIDTH_FRAC + 1);
    expect(clamped.x + clamped.width / 2).toBeLessThan(400);
  });
});

describe("resolveHeadBboxFromVision", () => {
  const cowBbox: BBox = { x: 100, y: 50, width: 800, height: 400, confidence: 0.8 };
  const head = { x: 850, y: 130 };

  it("rejects oversized normalized width and uses heuristic", () => {
    const box = resolveHeadBboxFromVision(
      { x: 0.1, y: 0.05, width: 0.5, height: 0.3 },
      1000,
      800,
      cowBbox,
      head,
      "right",
      undefined,
      0.8
    );
    expect(box).not.toBeNull();
    expect(box!.width).toBeLessThanOrEqual(cowBbox.width * HEAD_MAX_WIDTH_FRAC + 2);
  });
});
