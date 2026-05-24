import { describe, expect, it } from "vitest";
import {
  createEmptyMask,
  MASK_STRICT_TAIL_Y0,
  MASK_TAIL_BAND_Y0,
  MASK_TAIL_BAND_Y1,
  type CowBodyMask,
} from "./cowMask";
import {
  headSideShoulderX,
  lengthShoulderRearPoints,
  nudgeShoulderTowardHead,
  proposeLinesFromKeypoints,
  SHOULDER_HEAD_NUDGE_FRAC,
  tailEndX,
} from "./cowKeypoints";
import type { BBox, CowKeypoints } from "./types";

const bbox: BBox = { x: 100, y: 80, width: 800, height: 500, confidence: 0.8 };
const PAD = 4;
const xMin = bbox.x + PAD;
const xMax = bbox.x + bbox.width - PAD;

function kpHeadRight(): CowKeypoints {
  return {
    leg1: { x: 720, y: 420 },
    leg2: { x: 280, y: 420 },
    topChest: { x: 500, y: 150 },
    lowerChest: { x: 500, y: 320 },
    l1: { x: 280, y: 240 },
    l2: { x: 720, y: 240 },
    chestCenterX: 500,
    detected: { legs: true, lowerChest: true, length: true, facing: "head_right" },
  };
}

function kpHeadLeft(): CowKeypoints {
  return {
    leg1: { x: 280, y: 420 },
    leg2: { x: 720, y: 420 },
    topChest: { x: 500, y: 150 },
    lowerChest: { x: 500, y: 320 },
    l1: { x: 720, y: 240 },
    l2: { x: 280, y: 240 },
    chestCenterX: 500,
    detected: { legs: true, lowerChest: true, length: true, facing: "head_left" },
  };
}

/** Full-width body band at one row. */
function maskWithLengthRow(
  left: number,
  right: number,
  lengthY: number
): CowBodyMask {
  const mask = createEmptyMask(1200, 800);
  const y = Math.round(lengthY);
  for (let x = left; x <= right; x++) {
    if (x >= 0 && x < mask.width && y >= 0 && y < mask.height) {
      mask.data[y * mask.width + x] = 1;
    }
  }
  return mask;
}

/** Belly row narrow; hind band extends further toward tail (photo-like). */
function maskNarrowLengthWideHind(
  box: BBox,
  lengthY: number,
  lengthLeft: number,
  lengthRight: number,
  hindTailX: number,
  tailOnRight: boolean
): CowBodyMask {
  const mask = createEmptyMask(1200, 800);
  const yLen = Math.round(lengthY);
  for (let x = lengthLeft; x <= lengthRight; x++) {
    mask.data[yLen * mask.width + x] = 1;
  }
  const y0 = Math.floor(box.y + box.height * MASK_TAIL_BAND_Y0);
  const y1 = Math.floor(box.y + box.height * MASK_TAIL_BAND_Y1);
  for (let y = y0; y <= y1; y++) {
    if (tailOnRight) {
      for (let x = lengthLeft; x <= hindTailX; x++) {
        mask.data[y * mask.width + x] = 1;
      }
    } else {
      for (let x = hindTailX; x <= lengthRight; x++) {
        mask.data[y * mask.width + x] = 1;
      }
    }
  }
  return mask;
}

/** Length row + lower rear band wide, but hind band itself stays narrow. */
function maskNarrowLengthWideLowerRear(
  box: BBox,
  lengthY: number,
  lengthLeft: number,
  lengthRight: number,
  rearRight: number
): CowBodyMask {
  const mask = createEmptyMask(1200, 800);
  const yLen = Math.round(lengthY);
  for (let x = lengthLeft; x <= lengthRight; x++) {
    mask.data[yLen * mask.width + x] = 1;
  }
  const y0 = Math.floor(box.y + box.height * MASK_STRICT_TAIL_Y0);
  const y1 = Math.floor(box.y + box.height * (MASK_TAIL_BAND_Y0 - 0.01));
  for (let y = y0; y <= y1; y++) {
    for (let x = lengthLeft; x <= rearRight; x++) {
      if (x >= 0 && x < mask.width) mask.data[y * mask.width + x] = 1;
    }
  }
  return mask;
}

/** Length row narrow; nearby rows around lengthY show wider rear boundary. */
function maskNarrowLengthWideNearRows(
  box: BBox,
  lengthY: number,
  lengthLeft: number,
  lengthRight: number,
  rearRight: number
): CowBodyMask {
  const mask = createEmptyMask(1200, 800);
  const yLen = Math.round(lengthY);
  for (let x = lengthLeft; x <= lengthRight; x++) {
    mask.data[yLen * mask.width + x] = 1;
  }
  const half = Math.max(8, Math.floor(box.height * 0.08));
  const y0 = Math.max(0, yLen - half);
  const y1 = Math.min(mask.height - 1, yLen + half);
  for (let y = y0; y <= y1; y++) {
    if (y === yLen) continue;
    for (let x = lengthLeft; x <= rearRight; x++) {
      if (x >= 0 && x < mask.width) mask.data[y * mask.width + x] = 1;
    }
  }
  return mask;
}

describe("nudgeShoulderTowardHead", () => {
  it("head_left: moves shoulder left by 20% of span", () => {
    const rearX = 880;
    const base = 280;
    const nudged = nudgeShoulderTowardHead(base, rearX, "head_left", bbox, xMin, xMax);
    expect(nudged).toBeCloseTo(base - (rearX - base) * SHOULDER_HEAD_NUDGE_FRAC, 5);
    expect(nudged).toBeLessThan(base);
  });

  it("head_right: moves shoulder right by 20% of span", () => {
    const rearX = 120;
    const base = 720;
    const nudged = nudgeShoulderTowardHead(base, rearX, "head_right", bbox, xMin, xMax);
    expect(nudged).toBeCloseTo(base + (base - rearX) * SHOULDER_HEAD_NUDGE_FRAC, 5);
    expect(nudged).toBeGreaterThan(base);
  });
});

describe("lengthShoulderRearPoints", () => {
  const lengthY = bbox.y + bbox.height * 0.32;
  const bodyLeft = 120;
  const bodyRight = 880;
  const fallbackShift = bbox.width * 0.12;
  const narrowLengthRight = 720;
  /** Hind-band tail inside bbox (xMax = bbox.x + width - PAD). */
  const hindTailRight = 890;
  const hindTailLeft = 110;

  it("head_right: weak/none mask fallback keeps rear tailward from leg2 (inside body)", () => {
    const kp = kpHeadRight();
    const shoulderBase = kp.leg1.x;
    const expectedRear = Math.max(xMin, Math.min(xMax, kp.leg2.x - fallbackShift));
    const { shoulder, rear } = lengthShoulderRearPoints(bbox, kp);
    expect(shoulder.x).toBeGreaterThan(rear.x);
    expect(rear.x).toBeCloseTo(expectedRear, 5);
    expect(rear.x).toBeLessThan(kp.leg2.x);
    expect(shoulder.x).toBeCloseTo(
      shoulderBase + (shoulderBase - expectedRear) * SHOULDER_HEAD_NUDGE_FRAC,
      5
    );
    expect(shoulder.y).toBe(rear.y);
  });

  it("head_left: weak/none mask fallback keeps rear tailward from leg2 (inside body)", () => {
    const kp = kpHeadLeft();
    const shoulderBase = kp.leg1.x;
    const fallbackRear = Math.max(xMin, Math.min(xMax, kp.leg2.x + fallbackShift));
    const expectedRear = Math.max(xMax, fallbackRear);
    const { shoulder, rear } = lengthShoulderRearPoints(bbox, kp);
    expect(shoulder.x).toBeLessThan(rear.x);
    expect(rear.x).toBeCloseTo(expectedRear, 5);
    expect(rear.x).toBeGreaterThan(kp.leg2.x);
    expect(shoulder.x).toBeCloseTo(
      shoulderBase - (fallbackRear - shoulderBase) * SHOULDER_HEAD_NUDGE_FRAC,
      5
    );
    expect(shoulder.y).toBe(rear.y);
  });

  it("head_right + empty mask: no outside jump to bbox edge", () => {
    const kp = kpHeadRight();
    const emptyMask = createEmptyMask(1200, 800);
    const { rear } = lengthShoulderRearPoints(bbox, kp, emptyMask);
    expect(rear.x).toBeGreaterThan(xMin + 20);
    expect(rear.x).toBeLessThan(kp.leg2.x);
  });

  it("head_left + mask: narrow length row but C2 at hind-band tail end", () => {
    const kp = kpHeadLeft();
    const mask = maskNarrowLengthWideHind(
      bbox,
      lengthY,
      bodyLeft,
      narrowLengthRight,
      hindTailRight,
      true
    );
    const lengthRowEnd = tailEndX("head_left", bbox, lengthY, maskWithLengthRow(bodyLeft, narrowLengthRight, lengthY), kp.leg2.x);
    const { shoulder, rear } = lengthShoulderRearPoints(bbox, kp, mask);
    expect(rear.x).toBe(xMax);
    expect(rear.x).toBeGreaterThanOrEqual(lengthRowEnd);
    expect(rear.x).toBeGreaterThan(kp.leg2.x);
    expect(shoulder.y).toBe(rear.y);
  });

  it("head_left + lower-rear-only mask: C2 snaps to strict far-right boundary", () => {
    const kp = kpHeadLeft();
    const strictRight = 892;
    const mask = maskNarrowLengthWideLowerRear(
      bbox,
      lengthY,
      bodyLeft,
      narrowLengthRight,
      strictRight
    );
    const { rear } = lengthShoulderRearPoints(bbox, kp, mask);
    expect(rear.x).toBe(xMax);
    expect(rear.x).toBeGreaterThan(kp.leg2.x);
  });

  it("head_left + near-length rows mask: C2 uses line-aware rear envelope", () => {
    const kp = kpHeadLeft();
    const nearRearRight = 862;
    const mask = maskNarrowLengthWideNearRows(
      bbox,
      lengthY,
      bodyLeft,
      narrowLengthRight,
      nearRearRight
    );
    const { shoulder, rear } = lengthShoulderRearPoints(bbox, kp, mask);
    expect(rear.x).toBe(xMax);
    expect(rear.x).toBeGreaterThan(kp.leg2.x);
    expect(shoulder.y).toBe(rear.y);
  });

  it("head_right + mask: narrow length row but C2 at hind-band tail end", () => {
    const kp = kpHeadRight();
    const mask = maskNarrowLengthWideHind(
      bbox,
      lengthY,
      hindTailLeft,
      bodyRight,
      hindTailLeft,
      false
    );
    const { shoulder, rear } = lengthShoulderRearPoints(bbox, kp, mask);
    expect(rear.x).toBe(hindTailLeft);
    expect(rear.x).toBeLessThan(kp.leg2.x);
    expect(shoulder.y).toBe(rear.y);
  });

  it("head_left + mask: rear at body end when single full row", () => {
    const kp = kpHeadLeft();
    const mask = maskWithLengthRow(bodyLeft, bodyRight, lengthY);
    const shoulderBase = headSideShoulderX("head_left", bbox, lengthY, kp.leg1.x, mask);
    const rearBase = tailEndX("head_left", bbox, lengthY, mask, kp.leg2.x);
    const { shoulder, rear } = lengthShoulderRearPoints(bbox, kp, mask);
    expect(rear.x).toBe(xMax);
    expect(rear.x).toBe(rearBase);
    expect(shoulder.x).toBeLessThan(shoulderBase);
  });

  it("head_left: C2 not clamped inward when tail boundary exceeds bbox right", () => {
    const kp = kpHeadLeft();
    const tailBeyondBbox = xMax + 18;
    const mask = maskNarrowLengthWideHind(
      bbox,
      lengthY,
      bodyLeft,
      narrowLengthRight,
      tailBeyondBbox,
      true
    );
    const shoulderOnly = headSideShoulderX("head_left", bbox, lengthY, kp.leg1.x, mask);
    const { shoulder, rear } = lengthShoulderRearPoints(bbox, kp, mask);
    expect(rear.x).toBe(tailBeyondBbox);
    expect(rear.x).toBeGreaterThan(xMax);
    expect(rear.x).toBeGreaterThan(narrowLengthRight);
    const lengthRowExt = narrowLengthRight;
    expect(rear.x).toBeGreaterThan(lengthRowExt);
    expect(shoulder.y).toBe(rear.y);
    const nudgedShoulder = nudgeShoulderTowardHead(
      shoulderOnly,
      rear.x,
      "head_left",
      bbox,
      xMin,
      xMax
    );
    expect(shoulder.x).toBeCloseTo(nudgedShoulder, 5);
  });

  it("head_right + mask: rear at body end when single full row", () => {
    const kp = kpHeadRight();
    const mask = maskWithLengthRow(bodyLeft, bodyRight, lengthY);
    const rearBase = tailEndX("head_right", bbox, lengthY, mask, kp.leg2.x);
    const { shoulder, rear } = lengthShoulderRearPoints(bbox, kp, mask);
    expect(rear.x).toBe(bodyLeft);
    expect(rear.x).toBe(rearBase);
  });

  it("proposeLinesFromKeypoints uses shoulder→rear not full bbox width", () => {
    const lines = proposeLinesFromKeypoints(bbox, kpHeadRight());
    const span = Math.abs(lines.length.b.x - lines.length.a.x);
    expect(span).toBeLessThan(bbox.width * 0.95);
    expect(span).toBeGreaterThan(bbox.width * 0.2);
    expect(lines.length.a.x).toBeGreaterThan(lines.length.b.x);
  });

  it("proposeLinesFromKeypoints + mask: length rear uses hind-band tail end", () => {
    const mask = maskNarrowLengthWideHind(
      bbox,
      lengthY,
      bodyLeft,
      narrowLengthRight,
      hindTailRight,
      true
    );
    const lines = proposeLinesFromKeypoints(bbox, kpHeadLeft(), mask);
    expect(lines.length.b.x).toBe(xMax);
  });
});
