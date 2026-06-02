import { describe, expect, it } from "vitest";
import {
  cropPixelsToInsets,
  insetsToCropPixels,
} from "./fabricImageCrop";

describe("fabricImageCrop", () => {
  it("converts insets to crop pixels", () => {
    const result = insetsToCropPixels({ left: 10, top: 5, right: 20, bottom: 15 }, 1000, 800);
    expect(result).toEqual({ cropX: 100, cropY: 40, width: 700, height: 640 });
  });

  it("clamps crop width and height to at least 1px", () => {
    const result = insetsToCropPixels({ left: 49, top: 49, right: 49, bottom: 49 }, 100, 100);
    expect(result.width).toBeGreaterThanOrEqual(1);
    expect(result.height).toBeGreaterThanOrEqual(1);
  });

  it("converts crop pixels back to insets", () => {
    const insets = cropPixelsToInsets(100, 40, 700, 640, 1000, 800);
    expect(insets).toEqual({ left: 10, top: 5, right: 20, bottom: 15 });
  });

  it("round-trips inset conversion", () => {
    const original = { left: 12, top: 8, right: 25, bottom: 10 };
    const pixels = insetsToCropPixels(original, 1200, 900);
    const roundTrip = cropPixelsToInsets(
      pixels.cropX,
      pixels.cropY,
      pixels.width,
      pixels.height,
      1200,
      900,
    );
    expect(roundTrip).toEqual(original);
  });
});
