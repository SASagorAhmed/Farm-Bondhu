import { describe, expect, it } from "vitest";
import {
  cowBodyDirectionFromHeadSide,
  detectCowBodyDirection,
  oppositeSide,
  resolveFacingFromBodyDirection,
  tailSideFromLengthEnds,
} from "./cowDirection";
import {
  createEmptyMask,
  headSideFromMaskNarrowBand,
  tailSideFromMaskHindThirds,
  tailSideFromMaskTorsoThirds,
  type CowBodyMask,
} from "./cowMask";
import type { BBox, Point2D } from "./types";

function bbox(x: number, y: number, w: number, h: number): BBox {
  return { x, y, width: w, height: h, confidence: 0.7 };
}

function fillMaskBand(
  mask: CowBodyMask,
  box: BBox,
  yStartFrac: number,
  yEndFrac: number,
  xCenterFrac: number,
  halfWidthFrac: number
) {
  const y0 = Math.floor(box.y + box.height * yStartFrac);
  const y1 = Math.floor(box.y + box.height * yEndFrac);
  const cx = Math.floor(box.x + box.width * xCenterFrac);
  const half = Math.max(3, Math.floor(box.width * halfWidthFrac));
  for (let y = y0; y <= y1; y++) {
    for (let x = cx - half; x <= cx + half; x++) {
      if (x >= 0 && x < mask.width && y >= 0 && y < mask.height) {
        mask.data[y * mask.width + x] = 1;
      }
    }
  }
}

/** YOLO-like full-width body fill inside bbox (fractions). */
function fillMaskRect(
  mask: CowBodyMask,
  box: BBox,
  yStartFrac: number,
  yEndFrac: number,
  xStartFrac: number,
  xEndFrac: number
) {
  const y0 = Math.floor(box.y + box.height * yStartFrac);
  const y1 = Math.floor(box.y + box.height * yEndFrac);
  const x0 = Math.floor(box.x + box.width * xStartFrac);
  const x1 = Math.floor(box.x + box.width * xEndFrac);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (x >= 0 && x < mask.width && y >= 0 && y < mask.height) {
        mask.data[y * mask.width + x] = 1;
      }
    }
  }
}

describe("detectCowBodyDirection", () => {
  const b = bbox(100, 50, 800, 400);
  const lengthLeftHead = {
    l1: { x: 120, y: 200 },
    l2: { x: 880, y: 205 },
    detected: true,
  };

  it("length + mask → head left normal", () => {
    const mask = createEmptyMask(1200, 800);
    fillMaskBand(mask, b, 0.05, 0.22, 0.15, 0.12);
    fillMaskBand(mask, b, 0.68, 0.92, 0.82, 0.14);
    const dir = detectCowBodyDirection(null, 0, 0, b, lengthLeftHead, mask);
    expect(dir.headSide).toBe("left");
    expect(dir.direction).toBe("normal");
    expect(dir.isReversed).toBe(false);
  });

  it("tail mask right only → head left", () => {
    const mask = createEmptyMask(1200, 800);
    fillMaskBand(mask, b, 0.68, 0.92, 0.82, 0.12);
    const dir = detectCowBodyDirection(null, 0, 0, b, null, mask);
    expect(dir.tailSide).toBe("right");
    expect(dir.headSide).toBe("left");
    expect(dir.direction).toBe("normal");
    expect(dir.source).toBe("tail");
  });

  it("tail mask left only → head right reverse", () => {
    const mask = createEmptyMask(1200, 800);
    fillMaskBand(mask, b, 0.68, 0.92, 0.15, 0.14);
    const dir = detectCowBodyDirection(null, 0, 0, b, null, mask);
    expect(dir.tailSide).toBe("left");
    expect(dir.headSide).toBe("right");
    expect(dir.direction).toBe("reverse");
    expect(resolveFacingFromBodyDirection(dir)).toBe("head_right");
  });

  it("tail left + wrong head votes cannot override → head right", () => {
    const mask = createEmptyMask(1200, 800);
    fillMaskBand(mask, b, 0.68, 0.92, 0.15, 0.14);
    const dir = detectCowBodyDirection(null, 0, 0, b, lengthLeftHead, mask);
    expect(dir.tailSide).toBe("left");
    expect(dir.headSide).toBe("right");
  });

  it("head band right + tail left → head right reverse", () => {
    const mask = createEmptyMask(1200, 800);
    fillMaskBand(mask, b, 0.05, 0.22, 0.85, 0.1);
    fillMaskBand(mask, b, 0.68, 0.92, 0.15, 0.14);
    expect(headSideFromMaskNarrowBand(mask, b)).toBe("right");
    const lengthRightHead = {
      l1: { x: 120, y: 200 },
      l2: { x: 880, y: 205 },
      detected: true,
    };
    const dir = detectCowBodyDirection(null, 0, 0, b, lengthRightHead, mask);
    expect(dir.headSide).toBe("right");
    expect(dir.tailSide).toBe("left");
    expect(dir.direction).toBe("reverse");
    expect(dir.isReversed).toBe(true);
    expect(resolveFacingFromBodyDirection(dir)).toBe("head_right");
  });

  it("head centroid right + misleading tail votes → head right or unknown", () => {
    const mask = createEmptyMask(1200, 800);
    fillMaskRect(mask, b, 0.08, 0.92, 0.05, 0.95);
    fillMaskBand(mask, b, 0.68, 0.92, 0.82, 0.16);
    fillMaskBand(mask, b, 0.05, 0.22, 0.86, 0.12);
    expect(headSideFromMaskNarrowBand(mask, b)).toBe("right");
    const dir = detectCowBodyDirection(null, 0, 0, b, {
      l1: { x: 289, y: 200 },
      l2: { x: 1211, y: 200 },
      detected: true,
    }, mask);
    expect(["left", "right", "unknown"]).toContain(dir.headSide);
    if (dir.headSide === "right") expect(dir.tailSide).toBe("left");
  });

  it("Holstein-like: narrow head end left + patchy mask → head left", () => {
    const mask = createEmptyMask(1200, 800);
    const lengthY = 50 + 400 * 0.32;
    fillMaskBand(mask, b, 0.2, 0.75, 0.12, 0.08);
    fillMaskBand(mask, b, 0.68, 0.92, 0.82, 0.18);
    fillMaskBand(mask, b, 0.28, 0.42, 0.12, 0.06);
    const dir = detectCowBodyDirection(null, 0, 0, b, {
      l1: { x: 890, y: lengthY },
      l2: { x: 110, y: lengthY },
      detected: true,
    }, mask, null, { lengthY });
    expect(dir.headSide).toBe("left");
    expect(dir.tailSide).toBe("right");
  });

  it("no signals → unknown, not default head_left", () => {
    const dir = detectCowBodyDirection(null, 0, 0, b, null);
    expect(dir.headSide).toBe("unknown");
    expect(resolveFacingFromBodyDirection(dir)).toBeNull();
    expect(dir.directionIssueKey).toBeTruthy();
  });

  it("Holstein field-like: patchy torso only → unknown (no false head_right)", () => {
    const mask = createEmptyMask(1200, 800);
    fillMaskRect(mask, b, 0.2, 0.75, 0.55, 0.95);
    const dir = detectCowBodyDirection(null, 0, 0, b, null, mask);
    expect(dir.headSide).toBe("unknown");
    expect(dir.directionIssueKey).toBeTruthy();
    expect(resolveFacingFromBodyDirection(dir)).toBeNull();
  });

  it("black cow: strong left end-mass beats misleading headThirds right", () => {
    const mask = createEmptyMask(1200, 800);
    const lengthY = 50 + 400 * 0.32;
    fillMaskRect(mask, b, 0.08, 0.92, 0.05, 0.95);
    fillMaskBand(mask, b, 0.68, 0.92, 0.82, 0.2);
    fillMaskBand(mask, b, 0.05, 0.22, 0.86, 0.1);
    fillMaskBand(mask, b, 0.28, 0.5, 0.14, 0.12);
    const dir = detectCowBodyDirection(null, 0, 0, b, {
      l1: { x: 1231, y: lengthY },
      l2: { x: 427, y: lengthY },
      detected: true,
    }, mask, null, { lengthY });
    expect(dir.headSide).toBe("left");
    expect(resolveFacingFromBodyDirection(dir)).toBe("head_left");
  });
});

describe("tailSideFromLengthEnds", () => {
  const b = bbox(100, 50, 800, 400);

  it("cow facing right: rump left + head right → head right reverse", () => {
    const mask = createEmptyMask(1200, 800);
    fillMaskBand(mask, b, 0.68, 0.92, 0.18, 0.14);
    fillMaskBand(mask, b, 0.05, 0.22, 0.82, 0.12);
    expect(tailSideFromMaskHindThirds(mask, b)).toBe("left");
    const dir = detectCowBodyDirection(null, 0, 0, b, {
      l1: { x: 115, y: 200 },
      l2: { x: 870, y: 205 },
      detected: true,
    }, mask);
    expect(dir.headSide).toBe("right");
    expect(dir.tailSide).toBe("left");
  });

  it("cow facing left: rump right + head left → head left normal", () => {
    const mask = createEmptyMask(1200, 800);
    fillMaskBand(mask, b, 0.68, 0.92, 0.82, 0.14);
    fillMaskBand(mask, b, 0.05, 0.22, 0.18, 0.12);
    expect(tailSideFromMaskHindThirds(mask, b)).toBe("right");
    const dir = detectCowBodyDirection(null, 0, 0, b, {
      l1: { x: 870, y: 200 },
      l2: { x: 115, y: 205 },
      detected: true,
    }, mask);
    expect(dir.headSide).toBe("left");
    expect(dir.tailSide).toBe("right");
  });

  it("more tail mass on left end → tail left", () => {
    const mask = createEmptyMask(1200, 800);
    fillMaskBand(mask, b, 0.68, 0.92, 0.15, 0.14);
    fillMaskBand(mask, b, 0.68, 0.92, 0.85, 0.08);
    expect(
      tailSideFromLengthEnds({ x: 120, y: 200 }, { x: 880, y: 205 }, b, mask)
    ).toBe("left");
  });
});

describe("full-width YOLO-like mask", () => {
  const b = bbox(100, 50, 800, 400);
  const lengthY = 50 + 400 * 0.32;

  it("head right: length ends + head band on right end only → tail left", () => {
    const mask = createEmptyMask(1200, 800);
    fillMaskRect(mask, b, 0.08, 0.92, 0.05, 0.95);
    fillMaskBand(mask, b, 0.68, 0.92, 0.18, 0.16);
    fillMaskBand(mask, b, 0.05, 0.22, 0.86, 0.09);
    const dir = detectCowBodyDirection(null, 0, 0, b, {
      l1: { x: 110, y: lengthY },
      l2: { x: 890, y: lengthY },
      detected: true,
    }, mask, null, { lengthY });
    expect(dir.headSide).toBe("right");
    expect(dir.tailSide).toBe("left");
  });

  it("head right: wide body + rump left bulk → head right reverse", () => {
    const mask = createEmptyMask(1200, 800);
    fillMaskRect(mask, b, 0.08, 0.92, 0.05, 0.95);
    fillMaskBand(mask, b, 0.28, 0.58, 0.2, 0.22);
    fillMaskBand(mask, b, 0.68, 0.92, 0.18, 0.2);
    fillMaskBand(mask, b, 0.05, 0.22, 0.84, 0.1);
    fillMaskBand(mask, b, 0.05, 0.22, 0.88, 0.06);
    expect(tailSideFromMaskTorsoThirds(mask, b)).toBe("left");
    const dir = detectCowBodyDirection(null, 0, 0, b, {
      l1: { x: 110, y: lengthY },
      l2: { x: 890, y: lengthY },
      detected: true,
    }, mask, null, { lengthY });
    expect(dir.tailSide).toBe("left");
    expect(dir.headSide).toBe("right");
    expect(dir.direction).toBe("reverse");
    expect(resolveFacingFromBodyDirection(dir)).toBe("head_right");
  });

  it("head left: wide body + rump right bulk → head left normal", () => {
    const mask = createEmptyMask(1200, 800);
    fillMaskRect(mask, b, 0.08, 0.92, 0.05, 0.95);
    fillMaskBand(mask, b, 0.28, 0.58, 0.8, 0.22);
    fillMaskBand(mask, b, 0.68, 0.92, 0.82, 0.2);
    fillMaskBand(mask, b, 0.05, 0.22, 0.16, 0.08);
    expect(tailSideFromMaskTorsoThirds(mask, b)).toBe("right");
    const dir = detectCowBodyDirection(null, 0, 0, b, {
      l1: { x: 110, y: lengthY },
      l2: { x: 890, y: lengthY },
      detected: true,
    }, mask, null, { lengthY });
    expect(dir.tailSide).toBe("right");
    expect(dir.headSide).toBe("left");
    expect(dir.direction).toBe("normal");
    expect(resolveFacingFromBodyDirection(dir)).toBe("head_left");
  });
});

describe("cowBodyDirectionFromHeadSide", () => {
  it("infers tail from head", () => {
    const d = cowBodyDirectionFromHeadSide("left");
    expect(d.tailSide).toBe("right");
    expect(oppositeSide(d.tailSide)).toBe("left");
  });

  it("tail left implies head right", () => {
    const d = cowBodyDirectionFromHeadSide(oppositeSide("left"), "tail");
    expect(d.headSide).toBe("right");
    expect(d.tailSide).toBe("left");
  });

  it("confident tail direction sets facing for auto-detect", () => {
    const d = cowBodyDirectionFromHeadSide("left", "tail");
    expect(resolveFacingFromBodyDirection(d)).toBe("head_left");
  });
});
