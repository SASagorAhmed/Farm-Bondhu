/** New scans use plan_b only; plan_c is legacy in saved rows. */
export type DetectionMode = "plan_b" | "plan_c";

/** Wizard steps 1–6 (step 4: bbox scale + optional 1m reference). */
export type ScanStepId = 1 | 2 | 3 | 4 | 5 | 6;

export type PointLabelId = "C1" | "C2" | "L1" | "L2" | "R1" | "R2";

export interface ScanMetrics {
  chestPixels: number;
  lengthPixels: number;
  referencePixels: number | null;
  /** Display / Plan C: single scale. Plan B may also set chestCmPerPixel + lengthCmPerPixel. */
  cmPerPixel: number;
  chestCmPerPixel?: number;
  lengthCmPerPixel?: number;
  chestWidthCm: number;
  bodyLengthCm: number;
  estimatedLiveWeightKg: number;
  edibleMeatKg: number;
  confidence: number;
  scaleMethod: "bbox_assumed_150cm" | "reference_100cm";
  /** Plan B: assumed cow height adjusted for camera standoff. */
  scaleAdjustedForDistance?: boolean;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface LineSegment {
  a: Point2D;
  b: Point2D;
}

export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

export interface CowLines {
  chest: LineSegment;
  length: LineSegment;
  reference?: LineSegment;
}

export interface LegCenters {
  x1: number;
  x2: number;
}

import type { CowBodyDirection } from "./cowDirection";

export interface CowKeypoints {
  leg1: Point2D;
  leg2: Point2D;
  topChest: Point2D;
  lowerChest: Point2D;
  l1: Point2D;
  l2: Point2D;
  chestCenterX: number;
  detected: {
    legs: boolean;
    /** Hind (or front) column was inferred from tail side when only one hoof peak found. */
    legsInferred?: boolean;
    lowerChest: boolean;
    topChest?: boolean;
    length: boolean;
    /** Side-view head direction from silhouette (debug / validation). */
    facing?: "head_left" | "head_right";
    /** Full-body head/tail sides and normal vs reverse (photo coordinates). */
    bodyDirection?: CowBodyDirection;
  };
}

export interface CowAnalysisResult {
  bbox: BBox;
  lines: CowLines;
  imageWidth: number;
  imageHeight: number;
  model: string;
  confidence: number;
  cmPerPixel?: number;
  /** Full keypoint set for Step 1 markers and line proposal */
  keypoints?: CowKeypoints | null;
  /** @deprecated use keypoints — derived leg X for compat */
  legCenters?: LegCenters | null;
  /** JPEG of analysis canvas — same pixel grid as bbox/lines */
  displayImageUrl?: string;
  /** Curved body outline (segmentation or heuristic), image coordinates */
  bodyOutline?: Point2D[];
  /** Head region box (mask heuristic or vision assist), image coordinates */
  headBbox?: BBox | null;
  /** Plan B: estimated camera-to-cow distance (meters) */
  standoffMeters?: number | null;
  standoffSource?: "vision" | "heuristic" | null;
  standoffMethod?: "vision" | "pinhole" | "heuristic" | "blended" | null;
  standoffWarningKey?: string | null;
  focalLengthMm?: number | null;
  /** Set after cloud assist on Analyze or Scan — skip duplicate API when present. */
  directionVerifySource?: "vision" | "local" | "none";
  visionAssistApplied?: boolean;
}

export interface CowEstimationBreakdown {
  solid_meat_kg: number;
  bone_kg: number;
  fat_kg: number;
  head_meat_kg: number;
  liver_heart_kg: number;
}

export interface CowEstimationRow {
  id: string;
  estimated_live_weight_kg: number;
  edible_meat_kg: number;
  breakdown: CowEstimationBreakdown;
  chest_width_cm: number;
  body_length_cm: number;
  detection_mode: DetectionMode;
  confidence?: number | null;
  image_url?: string | null;
  created_at: string;
  annotation_json?: Record<string, unknown> | null;
}
