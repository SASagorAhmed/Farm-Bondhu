import { assistCowDirection, type CowDirectionAssistResult } from "./api";
import { applyDirectionOnlyVision } from "./keypointMerge";
import type { DirectionVerifySource } from "./directionMerge";
import type { CowFacing } from "./cowDirection";
import { estimateCameraStandoff, type StandoffEstimate } from "./standoffEstimate";
import { compressDataUrl } from "./imageUtils";
import type { PhotoExifMeta } from "./imageExif";
import type { CowBodyMask } from "./cowMask";
import type { BBox } from "./types";

export interface CowGeometryForCloud {
  bbox: BBox;
  imageWidth: number;
  imageHeight: number;
  bodyMask?: CowBodyMask;
}

export interface CloudDirectionResult {
  facing: CowFacing | null;
  headBbox: BBox | null;
  verifySource: DirectionVerifySource;
  assistApplied: boolean;
  vision: CowDirectionAssistResult | null;
  standoff: StandoffEstimate;
}

function exifInputFrom(exif?: PhotoExifMeta | null) {
  return { focalLengthMm: exif?.focalLengthMm ?? null };
}

/** Cloud API for head direction + standoff only (no chest/leg merge). */
export async function fetchCloudDirectionAssist(
  dataUrl: string,
  geometry: CowGeometryForCloud,
  exif?: PhotoExifMeta | null
): Promise<CloudDirectionResult> {
  const exifIn = exifInputFrom(exif);
  const heuristicStandoff = estimateCameraStandoff(
    geometry.bbox,
    geometry.imageHeight,
    undefined,
    exifIn
  );

  try {
    const imagePayload = dataUrl.startsWith("data:")
      ? dataUrl
      : await compressDataUrl(dataUrl);
    const result = await assistCowDirection({
      image_data: imagePayload,
      local_hints: {
        predicted_head_side: null,
        directionIssueKey: null,
        bbox: geometry.bbox,
        l1: null,
        l2: null,
      },
    });
    const direction = applyDirectionOnlyVision(
      result,
      geometry.bbox,
      geometry.imageWidth,
      geometry.imageHeight,
      geometry.bodyMask
    );
    const standoff = estimateCameraStandoff(
      geometry.bbox,
      geometry.imageHeight,
      {
        standoffDistanceM: result.standoffDistanceM,
        distanceConfidence: result.distanceConfidence,
      },
      exifIn
    );
    return {
      facing: direction.facing,
      headBbox: direction.headBbox,
      verifySource: direction.verifySource,
      assistApplied: direction.assistApplied,
      vision: result,
      standoff,
    };
  } catch {
    return {
      facing: null,
      headBbox: null,
      verifySource: "none",
      assistApplied: false,
      vision: null,
      standoff: heuristicStandoff,
    };
  }
}
