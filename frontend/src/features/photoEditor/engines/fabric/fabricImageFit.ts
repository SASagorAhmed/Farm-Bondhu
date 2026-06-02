import type { FabricImage } from "fabric";

export type DocumentSize = { width: number; height: number };

/** Scale and center image to cover the full document (crop overflow). */
export function coverImageToDocument(img: FabricImage, docSize: DocumentSize): void {
  const iw = img.width || 1;
  const ih = img.height || 1;
  const scale = Math.max(docSize.width / iw, docSize.height / ih);
  const scaledW = iw * scale;
  const scaledH = ih * scale;
  img.set({
    originX: "left",
    originY: "top",
    scaleX: scale,
    scaleY: scale,
    left: (docSize.width - scaledW) / 2,
    top: (docSize.height - scaledH) / 2,
  });
  img.setCoords();
}
