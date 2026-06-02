import type { Canvas } from "fabric";
import { FabricImage } from "fabric";
import type { ToastCanvasJson } from "../../types";
import { isToastCanvas } from "../../lib/engineRouting";

export async function importToastDraftImage(
  canvas: Canvas,
  toastJson: ToastCanvasJson,
  docWidth: number,
  docHeight: number,
): Promise<void> {
  const url = toastJson.imageDataUrl;
  if (!url) return;
  const img = await FabricImage.fromURL(url, { crossOrigin: "anonymous" });
  const iw = img.width || 1;
  const ih = img.height || 1;
  const scale = Math.min(docWidth / iw, docHeight / ih);
  const id = `bg-${Date.now()}`;
  img.set({
    left: (docWidth - iw * scale) / 2,
    top: (docHeight - ih * scale) / 2,
    scaleX: scale,
    scaleY: scale,
    dataId: id,
    name: "Background",
    selectable: true,
    objectType: "image",
  });
  canvas.add(img);
  canvas.sendObjectToBack(img);
  canvas.setActiveObject(img);
  canvas.requestRenderAll();
}

export function isToastDraftImportable(json: unknown): json is ToastCanvasJson {
  return isToastCanvas(json) && Boolean((json as ToastCanvasJson).imageDataUrl);
}
