import type { CowAnalysisResult } from "./types";
import { loadImageFromDataUrl } from "./imageUtils";
import { clampLinesToBBox, proposeLinesFromBBox } from "./proposeLines";
import { detectCowKeypoints, legCentersFromKeypoints } from "./cowKeypoints";
import type { CowFacing } from "./cowDirection";
import { detectReferenceLine, cmPerPixelFromReference } from "./referenceScale";
import { detectCowInImage } from "./yoloDetect";
import {
  buildBodyOutlineFromCanvas,
  buildSegBodyOutline,
  heuristicMaskFromCanvas,
  isBboxRibbonOutline,
  maskHasPixelsInBbox,
  type CowBodyMask,
} from "./cowMask";
import { fetchCloudDirectionAssist } from "./runVisionAssist";
import type { PhotoExifMeta } from "./imageExif";
import type { DirectionVerifySource } from "./directionMerge";
import type { BBox, Point2D } from "./types";

function resolveBodyMaskAndOutline(
  displayCanvas: HTMLCanvasElement,
  bbox: BBox,
  bodyMask: CowBodyMask | undefined,
  bodyOutline: Point2D[] | undefined
): { bodyMask: CowBodyMask | undefined; bodyOutline: Point2D[] | undefined } {
  const ctx = displayCanvas.getContext("2d");
  if (!ctx) return { bodyMask, bodyOutline };

  let mask = bodyMask;
  let outline = bodyOutline;

  const maskOk = mask && maskHasPixelsInBbox(mask, bbox);
  if (maskOk && !outline?.length) {
    outline = buildSegBodyOutline(mask, bbox);
  }
  if (!maskOk || !outline?.length) {
    const data = ctx.getImageData(0, 0, displayCanvas.width, displayCanvas.height).data;
    const heuristic = heuristicMaskFromCanvas(
      data,
      displayCanvas.width,
      displayCanvas.height,
      bbox
    );
    mask = heuristic;
    outline = buildBodyOutlineFromCanvas(
      data,
      displayCanvas.width,
      displayCanvas.height,
      bbox,
      false
    );
  }

  if (outline?.length && isBboxRibbonOutline(outline, bbox)) {
    outline = undefined;
  }

  return {
    bodyMask: mask,
    bodyOutline: outline?.length ? outline : undefined,
  };
}

export interface CowGeometry {
  displayCanvas: HTMLCanvasElement;
  bbox: BBox;
  model: string;
  bodyMask?: CowBodyMask;
  bodyOutline?: Point2D[];
  imageWidth: number;
  imageHeight: number;
  displayImageUrl: string;
}

/** Stage A: YOLO bbox + mask (unchanged). */
export async function detectCowGeometry(dataUrl: string): Promise<CowGeometry> {
  const img = await loadImageFromDataUrl(dataUrl);
  const { bbox, model, displayCanvas, bodyOutline: segOutline, bodyMask: segMask } =
    await detectCowInImage(img);

  const resolved = resolveBodyMaskAndOutline(displayCanvas, bbox, segMask, segOutline);

  return {
    displayCanvas,
    bbox,
    model,
    bodyMask: resolved.bodyMask,
    bodyOutline: resolved.bodyOutline,
    imageWidth: displayCanvas.width,
    imageHeight: displayCanvas.height,
    displayImageUrl: displayCanvas.toDataURL("image/jpeg", 0.92),
  };
}

export function buildAnalysisFromGeometry(
  geometry: CowGeometry,
  direction?: {
    forcedFacing: CowFacing | null;
    headBbox: BBox | null;
    verifySource: DirectionVerifySource;
    assistApplied: boolean;
    standoffMeters: number;
    standoffSource: "vision" | "heuristic";
    standoffMethod: import("./standoffEstimate").StandoffMethod;
    standoffWarningKey?: string | null;
    focalLengthMm?: number | null;
  }
): CowAnalysisResult {
  const { displayCanvas, bbox, bodyMask, bodyOutline } = geometry;

  const keypoints = detectCowKeypoints(displayCanvas, bbox, bodyMask ?? undefined, {
    forcedFacing: direction?.forcedFacing ?? null,
    directionSource: direction?.assistApplied ? "vision" : "local",
    visionHeadBbox: direction?.headBbox ?? null,
  });

  const legCenters = legCentersFromKeypoints(keypoints);
  const lines = clampLinesToBBox(proposeLinesFromBBox(bbox, keypoints), bbox);

  let cmPerPixel: number | undefined;
  let confidence = bbox.confidence;

  const ref = detectReferenceLine(displayCanvas, bbox);
  if (ref) {
    lines.reference = ref;
    cmPerPixel = cmPerPixelFromReference(ref);
  } else {
    confidence = Math.min(confidence, 0.55);
  }

  const headBbox =
    direction?.headBbox ?? keypoints.detected?.bodyDirection?.headBbox ?? null;

  return {
    bbox,
    lines,
    keypoints,
    legCenters: keypoints.detected.legs ? legCenters : null,
    imageWidth: geometry.imageWidth,
    imageHeight: geometry.imageHeight,
    model: geometry.model,
    confidence,
    cmPerPixel,
    displayImageUrl: geometry.displayImageUrl,
    bodyOutline:
      bodyOutline?.length && !isBboxRibbonOutline(bodyOutline, bbox) ? bodyOutline : undefined,
    headBbox,
    standoffMeters: direction?.standoffMeters,
    standoffSource: direction?.standoffSource ?? null,
    standoffMethod: direction?.standoffMethod ?? null,
    standoffWarningKey: direction?.standoffWarningKey ?? null,
    focalLengthMm: direction?.focalLengthMm ?? null,
    directionVerifySource: direction?.verifySource,
    visionAssistApplied: direction?.assistApplied ?? false,
  };
}

/** Cloud direction, then YOLO/mask keypoints once (no post-merge chest/legs). */
export async function analyzeCowImageWithCloudDirection(
  dataUrl: string,
  exif?: PhotoExifMeta | null
): Promise<CowAnalysisResult> {
  const geometry = await detectCowGeometry(dataUrl);
  const cloud = await fetchCloudDirectionAssist(dataUrl, geometry, exif);
  return buildAnalysisFromGeometry(geometry, {
    forcedFacing: cloud.facing,
    headBbox: cloud.headBbox,
    verifySource: cloud.verifySource,
    assistApplied: cloud.assistApplied,
    standoffMeters: cloud.standoff.meters,
    standoffSource: cloud.standoff.source,
    standoffMethod: cloud.standoff.method,
    standoffWarningKey: cloud.standoff.warningKey,
    focalLengthMm: cloud.standoff.focalLengthMm,
  });
}

export async function analyzeCowImage(dataUrl: string): Promise<CowAnalysisResult> {
  const geometry = await detectCowGeometry(dataUrl);
  return buildAnalysisFromGeometry(geometry);
}

/** Recompute outline from display image when analysis state lacks it (e.g. stale session). */
export async function repairBodyOutline(
  imageUrl: string,
  imageWidth: number,
  imageHeight: number,
  bbox: BBox
): Promise<Point2D[] | undefined> {
  const img = await loadImageFromDataUrl(imageUrl);
  const canvas = document.createElement("canvas");
  canvas.width = imageWidth;
  canvas.height = imageHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;
  ctx.drawImage(img, 0, 0, imageWidth, imageHeight);
  const data = ctx.getImageData(0, 0, imageWidth, imageHeight).data;
  const outline = buildBodyOutlineFromCanvas(data, imageWidth, imageHeight, bbox, false);
  if (outline.length < 3 || isBboxRibbonOutline(outline, bbox)) return undefined;
  return outline;
}

export async function analyzeCowFromFile(file: File): Promise<{
  dataUrl: string;
  analysis: CowAnalysisResult;
}> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Failed to read file"));
    r.readAsDataURL(file);
  });
  const analysis = await analyzeCowImage(dataUrl);
  return { dataUrl, analysis };
}
