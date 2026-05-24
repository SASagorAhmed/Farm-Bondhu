import * as cocoSsd from "@tensorflow-models/coco-ssd";
import "@tensorflow/tfjs";
import type { BBox, Point2D } from "./types";
import { resizeToCanvas } from "./imageUtils";
import { detectCowWithSeg, preloadYoloSegModel } from "./yoloSegDetect";
import type { CowBodyMask } from "./cowMask";

const COCO_COW_CLASS = "cow";
const YOLO_COW_CLASS_ID = 19;
const CONF_THRESHOLD = 0.35;
const YOLO_INPUT = 640;

let onnxSession: import("onnxruntime-web").InferenceSession | null = null;
let onnxLoading: Promise<import("onnxruntime-web").InferenceSession | null> | null = null;
let cocoModel: cocoSsd.ObjectDetection | null = null;
let cocoLoading: Promise<cocoSsd.ObjectDetection> | null = null;

function modelUrl(): string {
  return (
    String(import.meta.env.VITE_COW_YOLO_MODEL_URL || "").trim() || "/models/yolov8n.onnx"
  );
}

async function loadOnnxSession(): Promise<import("onnxruntime-web").InferenceSession | null> {
  if (onnxSession) return onnxSession;
  if (onnxLoading) return onnxLoading;
  onnxLoading = (async () => {
    try {
      const ort = await import("onnxruntime-web");
      ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/";
      const url = modelUrl();
      const res = await fetch(url, { method: "HEAD" });
      if (!res.ok) return null;
      onnxSession = await ort.InferenceSession.create(url, {
        executionProviders: ["wasm"],
      });
      return onnxSession;
    } catch {
      return null;
    } finally {
      onnxLoading = null;
    }
  })();
  return onnxLoading;
}

async function loadCoco(): Promise<cocoSsd.ObjectDetection> {
  if (cocoModel) return cocoModel;
  if (cocoLoading) return cocoLoading;
  cocoLoading = cocoSsd.load({ base: "lite_mobilenet_v2" });
  cocoModel = await cocoLoading;
  return cocoModel;
}

function letterboxCanvas(img: HTMLCanvasElement, size: number): { tensorData: Float32Array; scale: number; padX: number; padY: number } {
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

function parseYoloOutput(
  output: Float32Array,
  dims: readonly number[],
  origW: number,
  origH: number,
  scale: number,
  padX: number,
  padY: number
): BBox | null {
  let channels = 84;
  let numDet = 8400;
  if (dims.length === 3) {
    if (dims[1] === 84) {
      channels = dims[1];
      numDet = dims[2];
    } else {
      channels = dims[2];
      numDet = dims[1];
    }
  }

  let best: BBox | null = null;

  for (let i = 0; i < numDet; i++) {
    let cx: number, cy: number, bw: number, bh: number;
    let bestClass = 0;
    let bestScore = 0;

    if (dims[1] === channels) {
      cx = output[0 * numDet + i];
      cy = output[1 * numDet + i];
      bw = output[2 * numDet + i];
      bh = output[3 * numDet + i];
      for (let c = 0; c < 80; c++) {
        const s = output[(4 + c) * numDet + i];
        if (s > bestScore) {
          bestScore = s;
          bestClass = c;
        }
      }
    } else {
      const base = i * channels;
      cx = output[base];
      cy = output[base + 1];
      bw = output[base + 2];
      bh = output[base + 3];
      for (let c = 0; c < 80; c++) {
        const s = output[base + 4 + c];
        if (s > bestScore) {
          bestScore = s;
          bestClass = c;
        }
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

    if (!best || box.confidence > best.confidence) best = box;
  }

  return best;
}

async function detectWithYolo(canvas: HTMLCanvasElement): Promise<{ bbox: BBox; model: string } | null> {
  const session = await loadOnnxSession();
  if (!session) return null;

  const ort = await import("onnxruntime-web");
  const { tensorData, scale, padX, padY } = letterboxCanvas(canvas, YOLO_INPUT);
  const input = new ort.Tensor("float32", tensorData, [1, 3, YOLO_INPUT, YOLO_INPUT]);
  const feeds: Record<string, import("onnxruntime-web").Tensor> = {};
  feeds[session.inputNames[0]] = input;
  const results = await session.run(feeds);
  const outName = session.outputNames[0];
  const out = results[outName];
  const bbox = parseYoloOutput(
    out.data as Float32Array,
    out.dims,
    canvas.width,
    canvas.height,
    scale,
    padX,
    padY
  );
  if (!bbox) return null;
  return { bbox, model: "yolov8n-onnx" };
}

export function normalizeBBox(bbox: BBox, imageW: number, imageH: number): BBox {
  let { x, y, width, height, confidence } = bbox;
  if (width <= 0 || height <= 0) {
    throw new Error("Invalid detection box.");
  }
  x = Math.max(0, Math.min(imageW - 1, x));
  y = Math.max(0, Math.min(imageH - 1, y));
  width = Math.max(1, Math.min(imageW - x, width));
  height = Math.max(1, Math.min(imageH - y, height));
  return { x, y, width, height, confidence };
}

async function detectWithCoco(canvas: HTMLCanvasElement): Promise<{ bbox: BBox; model: string } | null> {
  const model = await loadCoco();
  const preds = await model.detect(canvas);
  const cows = preds.filter((p) => p.class === COCO_COW_CLASS && p.score >= CONF_THRESHOLD);
  if (!cows.length) return null;
  cows.sort((a, b) => b.score - a.score);
  const c = cows[0];
  const [x, y, w, h] = c.bbox;
  return {
    bbox: normalizeBBox(
      { x, y, width: w, height: h, confidence: c.score },
      canvas.width,
      canvas.height
    ),
    model: "coco-ssd",
  };
}

export type CowDetectionResult = {
  bbox: BBox;
  model: string;
  displayCanvas: HTMLCanvasElement;
  bodyOutline?: Point2D[];
  bodyMask?: CowBodyMask;
};

export async function detectCowInImage(img: HTMLImageElement): Promise<CowDetectionResult> {
  const { canvas } = resizeToCanvas(img, 1280);

  const seg = await detectCowWithSeg(canvas);
  if (seg) {
    return {
      bbox: seg.bbox,
      model: seg.model,
      displayCanvas: canvas,
      bodyOutline: seg.bodyOutline,
      bodyMask: seg.bodyMask,
    };
  }

  const yolo = await detectWithYolo(canvas);
  if (yolo) {
    return {
      bbox: normalizeBBox(yolo.bbox, canvas.width, canvas.height),
      model: yolo.model,
      displayCanvas: canvas,
    };
  }

  const coco = await detectWithCoco(canvas);
  if (coco) {
    return { ...coco, displayCanvas: canvas };
  }

  throw new Error("No cow detected. Use a clear side-view photo and try again.");
}

export function preloadCowModels(): void {
  void loadOnnxSession();
  void loadCoco();
  preloadYoloSegModel();
}
