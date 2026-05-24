import {

  MASK_HEAD_BAND_Y0,

  MASK_HEAD_BAND_Y1,

  type CowBodyMask,

} from "./cowMask";

import type { ImageSide } from "./cowDirection";

import type { BBox, Point2D } from "./types";



/** Reject vision head boxes wider than this (normalized 0–1). */

export const VISION_HEAD_MAX_NORM_WIDTH = 0.25;

export const HEAD_MAX_WIDTH_FRAC = 0.22;

export const HEAD_MAX_HEIGHT_FRAC = 0.28;



/** Normalized 0–1 bbox from vision API → image pixel BBox. */

export function headBboxFromNormalized(

  norm: { x: number; y: number; width: number; height: number },

  imageWidth: number,

  imageHeight: number,

  confidence = 0.75

): BBox {

  const x = Math.max(0, norm.x * imageWidth);

  const y = Math.max(0, norm.y * imageHeight);

  const w = Math.max(8, norm.width * imageWidth);

  const h = Math.max(8, norm.height * imageHeight);

  return {

    x,

    y,

    width: Math.min(w, imageWidth - x),

    height: Math.min(h, imageHeight - y),

    confidence,

  };

}



/**

 * Shrink head box to neck/nose only — anchor on head end (L2), cap size vs cow bbox.

 */

export function clampHeadBbox(

  box: BBox,

  cowBbox: BBox,

  headPoint: Point2D,

  headSide: ImageSide

): BBox {

  const maxW = cowBbox.width * HEAD_MAX_WIDTH_FRAC;

  const maxH = cowBbox.height * HEAD_MAX_HEIGHT_FRAC;

  const yBand0 = cowBbox.y + cowBbox.height * MASK_HEAD_BAND_Y0;

  const yBand1 = cowBbox.y + cowBbox.height * MASK_HEAD_BAND_Y1;



  let w = Math.min(Math.max(8, box.width), maxW);

  let h = Math.min(Math.max(8, box.height), maxH);



  let x: number;

  if (headSide === "left") {

    x = Math.max(cowBbox.x, headPoint.x - w * 0.9);

    if (x + w > headPoint.x + w * 0.25) {

      x = Math.max(cowBbox.x, headPoint.x - w);

    }

  } else {

    x = Math.min(cowBbox.x + cowBbox.width - w, headPoint.x - w * 0.1);

    x = Math.max(cowBbox.x, x);

  }



  let y = Math.max(yBand0, Math.min(box.y, yBand1 - h));

  h = Math.min(h, yBand1 - y);

  w = Math.min(w, maxW);



  return {

    x,

    y,

    width: w,

    height: h,

    confidence: box.confidence,

  };

}



/**

 * Vision head bbox with oversized rejection + clamp; fallback to mask/L2 heuristic.

 */

export function resolveHeadBboxFromVision(

  norm: { x: number; y: number; width: number; height: number } | null,

  imageWidth: number,

  imageHeight: number,

  cowBbox: BBox,

  headPoint: Point2D,

  headSide: ImageSide,

  bodyMask?: CowBodyMask,

  confidence = 0.75

): BBox | null {

  if (headSide !== "left" && headSide !== "right") return null;



  if (norm && norm.width > VISION_HEAD_MAX_NORM_WIDTH) {

    return headBboxFromHeadPoint(bodyMask, cowBbox, headPoint);

  }



  if (norm) {

    const raw = headBboxFromNormalized(norm, imageWidth, imageHeight, confidence);

    return clampHeadBbox(raw, cowBbox, headPoint, headSide);

  }



  return headBboxFromHeadPoint(bodyMask, cowBbox, headPoint);

}



/**

 * Wedge around L2 (head) after facing order — avoids placing box on tail when headSide is wrong.

 */

export function headBboxFromHeadPoint(

  mask: CowBodyMask | undefined,

  bbox: BBox,

  headPoint: Point2D

): BBox | null {

  const headEndX = headPoint.x;

  const y0 = Math.floor(bbox.y + bbox.height * MASK_HEAD_BAND_Y0);

  const y1 = Math.floor(bbox.y + bbox.height * MASK_HEAD_BAND_Y1);

  const halfW = Math.max(12, bbox.width * 0.14);

  const x0 = Math.max(0, Math.floor(headEndX - halfW));

  const x1 = Math.min(mask?.width ?? bbox.x + bbox.width, Math.ceil(headEndX + halfW));



  let minX = Infinity;

  let minY = Infinity;

  let maxX = -Infinity;

  let maxY = -Infinity;

  let found = false;



  if (mask) {

    for (let y = y0; y <= y1; y++) {

      if (y < 0 || y >= mask.height) continue;

      const off = y * mask.width;

      for (let x = x0; x <= x1; x++) {

        if (x < 0 || x >= mask.width || !mask.data[off + x]) continue;

        found = true;

        minX = Math.min(minX, x);

        maxX = Math.max(maxX, x);

        minY = Math.min(minY, y);

        maxY = Math.max(maxY, y);

      }

    }

  }



  if (!found) {

    const padY = bbox.height * 0.08;

    const fallback: BBox = {

      x: x0,

      y: bbox.y + padY,

      width: Math.max(24, x1 - x0),

      height: Math.max(24, (y1 - y0) * 0.85),

      confidence: 0.45,

    };

    const headSide: ImageSide = headEndX < bbox.x + bbox.width / 2 ? "left" : "right";

    return clampHeadBbox(fallback, bbox, headPoint, headSide);

  }



  const pad = Math.max(4, bbox.width * 0.02);

  const raw: BBox = {

    x: Math.max(0, minX - pad),

    y: Math.max(0, minY - pad),

    width: Math.min(mask!.width, maxX - minX + pad * 2),

    height: Math.min(mask!.height, maxY - minY + pad * 2),

    confidence: 0.55,

  };

  const headSide: ImageSide = headEndX < bbox.x + bbox.width / 2 ? "left" : "right";

  return clampHeadBbox(raw, bbox, headPoint, headSide);

}



/** Legacy wrapper when only headSide + raw length ends are available. */

export function headBboxFromMaskHeuristic(

  mask: CowBodyMask | undefined,

  bbox: BBox,

  headSide: ImageSide,

  lengthEnds?: { l1: Point2D; l2: Point2D } | null

): BBox | null {

  if (headSide !== "left" && headSide !== "right") return null;

  const headPoint =

    lengthEnds != null

      ? headSide === "left"

        ? lengthEnds.l1.x <= lengthEnds.l2.x

          ? lengthEnds.l1

          : lengthEnds.l2

        : lengthEnds.l1.x >= lengthEnds.l2.x

          ? lengthEnds.l1

          : lengthEnds.l2

      : {

          x: headSide === "left" ? bbox.x + bbox.width * 0.12 : bbox.x + bbox.width * 0.88,

          y: bbox.y + bbox.height * 0.32,

        };

  return headBboxFromHeadPoint(mask, bbox, headPoint);

}

