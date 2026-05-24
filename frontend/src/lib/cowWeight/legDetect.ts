import type { BBox, LegCenters } from "./types";
import { detectCowKeypoints, legCentersFromKeypoints } from "./cowKeypoints";

export type { LegCenters };

/**
 * Detect front/hind leg column X positions (legacy API).
 * Prefer detectCowKeypoints for full keypoint set.
 */
export function detectLegCenters(canvas: HTMLCanvasElement, bbox: BBox): LegCenters | null {
  const kp = detectCowKeypoints(canvas, bbox);
  if (!kp.detected.legs) return null;
  return legCentersFromKeypoints(kp);
}
