import type { BBox, Point2D } from "./types";
import { normalizeBBox } from "./yoloDetect";
import {
  buildBodyOutlineFromCanvas,
  buildSegBodyOutline,
  createEmptyMask,
  heuristicMaskFromCanvas,
  maskHasPixelsInBbox,
  type CowBodyMask,
} from "./cowMask";

const YOLO_COW_CLASS_ID = 19;
const CONF_THRESHOLD = 0.35;
const YOLO_INPUT = 640;
const NUM_CLASSES = 80;
const NUM_MASK_COEFF = 32;
const DET_CHANNELS = 4 + NUM_CLASSES + NUM_MASK_COEFF;
const MASK_THRESHOLD = 0.35;

let segSession: import("onnxruntime-web").InferenceSession | null = null;
let segLoading: Promise<import("onnxruntime-web").InferenceSession | null> | null = null;
let segMissingWarned = false;

function segModelUrl(): string {
  return (
    String(import.meta.env.VITE_COW_YOLO_SEG_MODEL_URL || "").trim() || "/models/yolov8n-seg.onnx"
  );
}

export async function loadYoloSegSession(): Promise<import("onnxruntime-web").InferenceSession | null> {
  if (segSession) return segSession;
  if (segLoading) return segLoading;
  segLoading = (async () => {
    try {
      const ort = await import("onnxruntime-web");
      ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/";
      const url = segModelUrl();
      try {
        segSession = await ort.InferenceSession.create(url, {
          executionProviders: ["wasm"],
        });
      } catch {
        const res = await fetch(url);
        if (!res.ok) {
          if (import.meta.env.DEV && !segMissingWarned) {
            segMissingWarned = true;
            console.warn(
              `[cow-weight] Segmentation model not found at ${url}. ` +
                `Run "npm run cow:models:seg" from frontend/ for exact ML body outline.`
            );
          }
          return null;
        }
        const buf = await res.arrayBuffer();
        segSession = await ort.InferenceSession.create(buf, {
          executionProviders: ["wasm"],
        });
      }
      return segSession;
    } catch {
      return null;
    } finally {
      segLoading = null;
    }
  })();
  return segLoading;
}

function letterboxCanvas(
  img: HTMLCanvasElement,
  size: number
): { tensorData: Float32Array; scale: number; padX: number; padY: number } {
  const w = img.width;
  const h = img.height;
  const scale = Math.min(size / w, size / h);
  const nw = Math.round(w * scale);
  const nh = Math.round(h * scale);
  const padX = Math.floor((size - nw) / 2);
  const padY = Math.floor((size - nh) / 2);

  const lb = document.createElement("canvas");
  lb.width = size;
  lb.height = size;
  const ctx = lb.getContext("2d")!;
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(img, padX, padY, nw, nh);

  const { data } = ctx.getImageData(0, 0, size, size);
  const out = new Float32Array(3 * size * size);
  for (let i = 0; i < size * size; i++) {
    const o = i * 4;
    out[i] = data[o] / 255;
    out[i + size * size] = data[o + 1] / 255;
    out[i + 2 * size * size] = data[o + 2] / 255;
  }
  return { tensorData: out, scale, padX, padY };
}

type BestDet = {
  bbox: BBox;
  coeffs: Float32Array;
};

function parseBestCowDetection(
  det: Float32Array,
  dims: readonly number[],
  origW: number,
  origH: number,
  scale: number,
  padX: number,
  padY: number
): BestDet | null {
  let channels = DET_CHANNELS;
  let numDet = 8400;
  if (dims.length === 3) {
    if (dims[1] === channels || dims[1] === 116) {
      channels = dims[1];
      numDet = dims[2];
    } else {
      channels = dims[2];
      numDet = dims[1];
    }
  }

  let best: BestDet | null = null;
  const coeffs = new Float32Array(NUM_MASK_COEFF);

  for (let i = 0; i < numDet; i++) {
    let cx: number, cy: number, bw: number, bh: number;
    let bestClass = 0;
    let bestScore = 0;

    if (dims[1] === channels) {
      cx = det[0 * numDet + i];
      cy = det[1 * numDet + i];
      bw = det[2 * numDet + i];
      bh = det[3 * numDet + i];
      for (let c = 0; c < NUM_CLASSES; c++) {
        const s = sigmoid(det[(4 + c) * numDet + i]);
        if (s > bestScore) {
          bestScore = s;
          bestClass = c;
        }
      }
      for (let k = 0; k < NUM_MASK_COEFF; k++) {
        coeffs[k] = det[(4 + NUM_CLASSES + k) * numDet + i];
      }
    } else {
      const base = i * channels;
      cx = det[base];
      cy = det[base + 1];
      bw = det[base + 2];
      bh = det[base + 3];
      for (let c = 0; c < NUM_CLASSES; c++) {
        const s = sigmoid(det[base + 4 + c]);
        if (s > bestScore) {
          bestScore = s;
          bestClass = c;
        }
      }
      for (let k = 0; k < NUM_MASK_COEFF; k++) {
        coeffs[k] = det[base + 4 + NUM_CLASSES + k];
      }
    }

    if (bestClass !== YOLO_COW_CLASS_ID || bestScore < CONF_THRESHOLD) continue;

    const x1 = (cx - bw / 2 - padX) / scale;
    const y1 = (cy - bh / 2 - padY) / scale;
    const x2 = (cx + bw / 2 - padX) / scale;
    const y2 = (cy + bh / 2 - padY) / scale;

    const box: BBox = {
      x: Math.max(0, x1),
      y: Math.max(0, y1),
      width: Math.min(origW, x2) - Math.max(0, x1),
      height: Math.min(origH, y2) - Math.max(0, y1),
      confidence: bestScore,
    };

    if (!best || box.confidence > best.bbox.confidence) {
      best = { bbox: box, coeffs: new Float32Array(coeffs) };
    }
  }

  return best;
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

type ProtoLayout = "nchw" | "nhwc";

function protoLayoutFromDims(dims: readonly number[]): { layout: ProtoLayout; h: number; w: number } | null {
  if (dims.length !== 4) return null;
  if (dims[1] === NUM_MASK_COEFF) {
    return { layout: "nchw", h: dims[2] as number, w: dims[3] as number };
  }
  if (dims[3] === NUM_MASK_COEFF) {
    return { layout: "nhwc", h: dims[1] as number, w: dims[2] as number };
  }
  return null;
}

function readProto(
  proto: Float32Array,
  layout: ProtoLayout,
  w: number,
  h: number,
  x: number,
  y: number,
  k: number
): number {
  if (x < 0 || y < 0 || x >= w || y >= h) return 0;
  if (layout === "nchw") {
    return proto[k * h * w + y * w + x];
  }
  return proto[(y * w + x) * NUM_MASK_COEFF + k];
}

function sampleProtoLogit(
  logits: Float32Array,
  w: number,
  h: number,
  px: number,
  py: number
): number {
  if (px < 0 || py < 0 || px >= w - 1 || py >= h - 1) return -10;
  const x0 = Math.floor(px);
  const y0 = Math.floor(py);
  const xf = px - x0;
  const yf = py - y0;
  const i00 = y0 * w + x0;
  const i10 = y0 * w + x0 + 1;
  const i01 = (y0 + 1) * w + x0;
  const i11 = (y0 + 1) * w + x0 + 1;
  const top = logits[i00] * (1 - xf) + logits[i10] * xf;
  const bot = logits[i01] * (1 - xf) + logits[i11] * xf;
  return top * (1 - yf) + bot * yf;
}

function buildMaskFromProtos(
  coeffs: Float32Array,
  proto: Float32Array,
  protoLayout: ProtoLayout,
  protoH: number,
  protoW: number,
  origW: number,
  origH: number,
  scale: number,
  padX: number,
  padY: number
): CowBodyMask {
  const protoSize = protoH * protoW;
  const logits = new Float32Array(protoSize);

  for (let y = 0; y < protoH; y++) {
    for (let x = 0; x < protoW; x++) {
      let sum = 0;
      for (let k = 0; k < NUM_MASK_COEFF; k++) {
        sum += coeffs[k] * readProto(proto, protoLayout, protoW, protoH, x, y, k);
      }
      logits[y * protoW + x] = sum;
    }
  }

  const mask = createEmptyMask(origW, origH);
  const letterboxToProto = protoW / YOLO_INPUT;

  for (let iy = 0; iy < origH; iy++) {
    for (let ix = 0; ix < origW; ix++) {
      const lx = ix * scale + padX;
      const ly = iy * scale + padY;
      const px = lx * letterboxToProto;
      const py = ly * letterboxToProto;
      if (px < -0.5 || py < -0.5 || px >= protoW || py >= protoH) continue;
      if (sigmoid(sampleProtoLogit(logits, protoW, protoH, px, py)) >= MASK_THRESHOLD) {
        mask.data[iy * origW + ix] = 1;
      }
    }
  }
  return mask;
}

export type CowSegDetection = {
  bbox: BBox;
  bodyOutline: Point2D[];
  bodyMask: CowBodyMask;
  model: string;
};

export async function detectCowWithSeg(
  canvas: HTMLCanvasElement
): Promise<CowSegDetection | null> {
  const session = await loadYoloSegSession();
  if (!session) return null;

  const ort = await import("onnxruntime-web");
  const { tensorData, scale, padX, padY } = letterboxCanvas(canvas, YOLO_INPUT);
  const input = new ort.Tensor("float32", tensorData, [1, 3, YOLO_INPUT, YOLO_INPUT]);
  const feeds: Record<string, import("onnxruntime-web").Tensor> = {};
  feeds[session.inputNames[0]] = input;
  const results = await session.run(feeds);

  let detTensor: import("onnxruntime-web").Tensor | null = null;
  let protoTensor: import("onnxruntime-web").Tensor | null = null;

  let protoLayout: ProtoLayout = "nchw";
  let protoH = 160;
  let protoW = 160;

  for (const name of session.outputNames) {
    const t = results[name];
    const d = t.dims;
    const pl = protoLayoutFromDims(d);
    if (pl) {
      protoTensor = t;
      protoLayout = pl.layout;
      protoH = pl.h;
      protoW = pl.w;
    } else if (d.length === 3 && (d[1] === DET_CHANNELS || d[2] === DET_CHANNELS)) {
      detTensor = t;
    }
  }

  if (!detTensor || !protoTensor) return null;

  const best = parseBestCowDetection(
    detTensor.data as Float32Array,
    detTensor.dims,
    canvas.width,
    canvas.height,
    scale,
    padX,
    padY
  );
  if (!best) return null;

  const bbox = normalizeBBox(best.bbox, canvas.width, canvas.height);

  let bodyMask = buildMaskFromProtos(
    best.coeffs,
    protoTensor.data as Float32Array,
    protoLayout,
    protoH,
    protoW,
    canvas.width,
    canvas.height,
    scale,
    padX,
    padY
  );

  const maskOk = maskHasPixelsInBbox(bodyMask, bbox);
  let bodyOutline = maskOk ? buildSegBodyOutline(bodyMask, bbox) : [];

  const ctx = canvas.getContext("2d");
  if (ctx && (!maskOk || bodyOutline.length < 3)) {
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    bodyMask = heuristicMaskFromCanvas(data, canvas.width, canvas.height, bbox);
    bodyOutline = buildBodyOutlineFromCanvas(data, canvas.width, canvas.height, bbox, false);
    if (bodyOutline.length < 3) {
      bodyOutline = buildSegBodyOutline(bodyMask, bbox);
    }
  }

  return {
    bbox,
    bodyOutline,
    bodyMask,
    model: "yolov8n-seg-onnx",
  };
}

export function preloadYoloSegModel(): void {
  void loadYoloSegSession();
}

/** Re-run YOLO-seg on display image for CapCut-style mask outline (scan page repair). */
export async function refineSegBodyOutlineFromImage(
  imageUrl: string,
  imageWidth: number,
  imageHeight: number
): Promise<{ bodyOutline: Point2D[]; bodyMask: CowBodyMask; bbox: BBox } | null> {
  const { loadImageFromDataUrl } = await import("./imageUtils");
  const img = await loadImageFromDataUrl(imageUrl);
  const canvas = document.createElement("canvas");
  canvas.width = imageWidth;
  canvas.height = imageHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, imageWidth, imageHeight);

  const seg = await detectCowWithSeg(canvas);
  if (!seg || seg.bodyOutline.length < 3) return null;
  return {
    bodyOutline: seg.bodyOutline,
    bodyMask: seg.bodyMask,
    bbox: seg.bbox,
  };
}
