import { describe, expect, it, vi, beforeEach } from "vitest";
import { fetchCloudDirectionAssist } from "./runVisionAssist";
import type { BBox } from "./types";

vi.mock("./api", () => ({
  assistCowDirection: vi.fn(),
}));

import { assistCowDirection } from "./api";

const bbox: BBox = { x: 80, y: 60, width: 500, height: 350, confidence: 0.8 };

const geometry = {
  bbox,
  imageWidth: 800,
  imageHeight: 600,
};

describe("fetchCloudDirectionAssist", () => {
  beforeEach(() => {
    vi.mocked(assistCowDirection).mockReset();
  });

  it("returns vision facing without keypoint merge", async () => {
    vi.mocked(assistCowDirection).mockResolvedValue({
      headSide: "left",
      confidence: 0.9,
      headBbox: { x: 0.1, y: 0.2, width: 0.12, height: 0.18 },
      frontLeg: { x: 0.2, y: 0.8 },
      hindLeg: { x: 0.8, y: 0.8 },
      topChest: { x: 0.5, y: 0.25 },
      lowerChest: { x: 0.5, y: 0.45 },
      standoffDistanceM: 4,
      distanceConfidence: 0.7,
      reason: "clear",
    });

    const result = await fetchCloudDirectionAssist("data:image/jpeg;base64,abc", geometry);

    expect(result.verifySource).toBe("vision");
    expect(result.facing).toBe("head_left");
    expect(result.assistApplied).toBe(true);
  });

  it("falls back when API fails", async () => {
    vi.mocked(assistCowDirection).mockRejectedValue(new Error("network"));

    const result = await fetchCloudDirectionAssist("data:image/jpeg;base64,abc", geometry);

    expect(result.verifySource).toBe("none");
    expect(result.facing).toBeNull();
    expect(result.standoff.meters).toBeGreaterThan(0);
  });
});
