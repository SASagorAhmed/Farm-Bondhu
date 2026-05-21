import type { CowAnalysisResult, DetectionMode } from "./types";
import { loadImageFromDataUrl, resizeToCanvas } from "./imageUtils";
import { clampLinesToBBox, proposeLinesFromBBox } from "./proposeLines";
import { detectCowKeypoints, legCentersFromKeypoints } from "./cowKeypoints";
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

export async function analyzeCowImage(
  dataUrl: string,
  mode: DetectionMode
): Promise<CowAnalysisResult> {
  const img = await loadImageFromDataUrl(dataUrl);
  const { bbox, model, displayCanvas, bodyOutline: segOutline, bodyMask: segMask } =
    await detectCowInImage(img);

  const resolved = resolveBodyMaskAndOutline(
    displayCanvas,
    bbox,
    segMask,
    segOutline
  );
  const bodyMask = resolved.bodyMask;
  const bodyOutline = resolved.bodyOutline;

  const keypoints = detectCowKeypoints(displayCanvas, bbox, bodyMask ?? undefined);
  const legCenters = legCentersFromKeypoints(keypoints);
  const lines = clampLinesToBBox(proposeLinesFromBBox(bbox, keypoints), bbox);

  let cmPerPixel: number | undefined;
  let confidence = bbox.confidence;

  if (mode === "plan_c") {
    const ref = detectReferenceLine(displayCanvas, bbox);
    if (ref) {
      lines.reference = ref;
      cmPerPixel = cmPerPixelFromReference(ref);
    } else {
      confidence = Math.min(confidence, 0.45);
    }
  } else {
    confidence = Math.min(confidence, 0.55);
  }

  return {
    bbox,
    lines,
    keypoints,
    legCenters: keypoints.detected.legs ? legCenters : null,
    imageWidth: displayCanvas.width,
    imageHeight: displayCanvas.height,
    model,
    confidence,
    cmPerPixel,
    displayImageUrl: displayCanvas.toDataURL("image/jpeg", 0.92),
    bodyOutline:
      bodyOutline?.length && !isBboxRibbonOutline(bodyOutline, bbox) ? bodyOutline : undefined,
  };
}

export async function analyzeCowFromFile(file: File, mode: DetectionMode): Promise<{
  dataUrl: string;
  analysis: CowAnalysisResult;
}> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Failed to read file"));
    r.readAsDataURL(file);
  });
  const analysis = await analyzeCowImage(dataUrl, mode);
  return { dataUrl, analysis };
}
