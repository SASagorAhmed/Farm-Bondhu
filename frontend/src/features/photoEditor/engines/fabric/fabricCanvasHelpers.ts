import type { Canvas, FabricObject } from "fabric";
import { photoEditorTheme } from "../../lib/photoEditorTheme";

export type DocumentSize = { width: number; height: number };

/** Poll until Fabric canvas ref is mounted (draft load must not unmount canvas). */
export async function waitForFabricCanvas(
  fabricRef: { current: Canvas | null },
  timeoutMs = 5000,
): Promise<Canvas | null> {
  const start = Date.now();
  while (!fabricRef.current && Date.now() - start < timeoutMs) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
  return fabricRef.current;
}

export type LayerKind = "image" | "text" | "shape" | "sticker" | "other";

export function layerKindFromObject(obj: FabricObject): LayerKind {
  const objectType = String(obj.get("objectType") ?? "");
  if (objectType === "image" || obj.type === "image") return "image";
  if (objectType === "sticker") return "sticker";
  if (objectType === "text" || obj.type === "textbox" || obj.type === "i-text" || obj.type === "text") {
    return "text";
  }
  if (
    objectType === "shape" ||
    obj.type === "rect" ||
    obj.type === "circle" ||
    obj.type === "triangle" ||
    obj.type === "ellipse" ||
    obj.type === "line" ||
    obj.type === "path" ||
    obj.type === "polygon"
  ) {
    return "shape";
  }
  return "other";
}

export function applyObjectChrome(obj: FabricObject): void {
  obj.set({
    borderColor: photoEditorTheme.primary,
    cornerColor: photoEditorTheme.primary,
    cornerStyle: "circle",
    transparentCorners: false,
    padding: 4,
  });
}

export function findObjectByDataId(canvas: Canvas, dataId: string): FabricObject | undefined {
  return canvas.getObjects().find((o) => String(o.get("dataId") ?? "") === dataId);
}

export function isFabricImage(obj: FabricObject | undefined): boolean {
  return Boolean(obj && obj.type === "image");
}

export function isFabricTextbox(obj: FabricObject | undefined): boolean {
  return Boolean(obj && (obj.type === "textbox" || obj.type === "i-text" || obj.type === "text"));
}

export function layerMove(canvas: Canvas, dataId: string, direction: "up" | "down"): void {
  const obj = findObjectByDataId(canvas, dataId);
  if (!obj) return;
  if (direction === "up") canvas.bringObjectForward(obj);
  else canvas.sendObjectBackwards(obj);
  canvas.requestRenderAll();
}

export function layerToFront(canvas: Canvas, dataId: string): void {
  const obj = findObjectByDataId(canvas, dataId);
  if (!obj) return;
  canvas.bringObjectToFront(obj);
  canvas.requestRenderAll();
}

export function layerToBack(canvas: Canvas, dataId: string): void {
  const obj = findObjectByDataId(canvas, dataId);
  if (!obj) return;
  canvas.sendObjectToBack(obj);
  canvas.requestRenderAll();
}

const BG_LAYER_ID = "bg-image";

/** Canvas stack bottom → top, excluding background image layer. */
export function getLayerStack(canvas: Canvas): FabricObject[] {
  return canvas.getObjects().filter((o) => String(o.get("dataId") ?? "") !== BG_LAYER_ID);
}

function layerCanvasIndex(canvas: Canvas, dataId: string): number {
  const obj = findObjectByDataId(canvas, dataId);
  if (!obj) return -1;
  return getLayerStack(canvas).indexOf(obj);
}

/**
 * Reorder by visual list index (0 = front / top of layers panel).
 */
export function layerReorder(canvas: Canvas, dataId: string, targetVisualIndex: number): void {
  const obj = findObjectByDataId(canvas, dataId);
  if (!obj) return;

  const stack = getLayerStack(canvas);
  if (stack.length < 2) return;

  const clampedVisual = Math.max(0, Math.min(targetVisualIndex, stack.length - 1));
  const targetCanvasIndex = stack.length - 1 - clampedVisual;

  let guard = stack.length * 4;
  while (layerCanvasIndex(canvas, dataId) < targetCanvasIndex && guard-- > 0) {
    canvas.bringObjectForward(obj);
  }
  while (layerCanvasIndex(canvas, dataId) > targetCanvasIndex && guard-- > 0) {
    canvas.sendObjectBackwards(obj);
  }
  canvas.requestRenderAll();
}
