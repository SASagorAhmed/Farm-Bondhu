/**
 * Plan D: joint camera distance + dynamic r1/r2 for cow weight scan.
 */

import type { BBox, CowLines } from "./types";
import { TYPICAL_LENGTH_SPAN_FRAC } from "./pixelsToCm";
import { lineLengthPx } from "./imageUtils";
import { heightLineFromBBox } from "./geometry2d";
import {
  jointSelectCameraDistance,
  type JointZResult,
  cmPerPxFromReferenceDynamic,
} from "./geometry3d";
import { dimensionsFromPlanDScale, measureHeightLineCm } from "./measureSegments";
import { referenceCmDefault } from "./referenceScale";

export type PlanDScaleMethod = "plan_d_pinhole" | "plan_d_pinhole_stick" | "reference_100cm";

export interface PlanDScale extends JointZResult {
  scaleMethod: PlanDScaleMethod;
  bodyLengthPriorCm: number;
  groundY: number;
}

export interface PlanDScaleInput {
  bbox: BBox;
  lines: CowLines;
  imageWidthPx: number;
  imageHeightPx: number;
  focalLengthMm?: number | null;
  focalLength35mm?: number | null;
  standoffMeters?: number | null;
  /** Cloud direction assist used for standoff prior. */
  visionUsed?: boolean;
}

export function computePlanDScale(input: PlanDScaleInput): PlanDScale {
  const { bbox, lines, imageWidthPx, imageHeightPx } = input;
  const lengthSpanPx =
    lineLengthPx(lines.length) > 0
      ? lineLengthPx(lines.length)
      : bbox.width * TYPICAL_LENGTH_SPAN_FRAC;

  const standoffPriorCm =
    input.standoffMeters != null && input.standoffMeters > 0
      ? input.standoffMeters * 100
      : null;

  const joint = jointSelectCameraDistance({
    imageWidthPx,
    imageHeightPx,
    bboxHeightPx: bbox.height,
    bboxWidthPx: bbox.width,
    lengthSpanPx,
    focalLengthMm: input.focalLengthMm,
    standoffPriorCm,
    visionUsed: input.visionUsed ?? false,
  });

  const heightLine = heightLineFromBBox(bbox);
  const bodyHeightCm =
    measureHeightLineCm(heightLine.a, heightLine.b, joint.r1) || joint.bodyHeightCm;

  return {
    ...joint,
    bodyHeightCm,
    scaleMethod: "plan_d_pinhole",
    bodyLengthPriorCm: dimensionsFromPlanDScale(lines, joint.r1, joint.r2).body_length_cm,
    groundY: bbox.y + bbox.height,
  };
}

export function referenceCmForLine(
  planD: PlanDScale | undefined,
  hasPhysicalStick: boolean
): number {
  if (hasPhysicalStick) return referenceCmDefault();
  return planD?.bodyHeightCm ?? referenceCmDefault();
}

export function cmPerPixelFromReferencePlanD(
  referencePx: number,
  planD: PlanDScale | undefined,
  physicalStick: boolean
): number {
  const refCm = referenceCmForLine(planD, physicalStick);
  return cmPerPxFromReferenceDynamic(referencePx, refCm);
}
