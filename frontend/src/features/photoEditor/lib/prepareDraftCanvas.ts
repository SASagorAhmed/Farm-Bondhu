import { uploadProductImage } from "@/lib/marketplaceProductForm";
import type { EditorDocument } from "../types";
import { dataUrlToFile } from "./photoEditorApply";

async function uploadDataUrlIfNeeded(src: string | undefined): Promise<string | undefined> {
  if (!src || !src.startsWith("data:")) return src;
  const file = await dataUrlToFile(src, "layer.png");
  return uploadProductImage(file);
}

/** Replace inline data URLs with hosted URLs so draft payloads stay small. */
export async function prepareDraftCanvas(doc: EditorDocument): Promise<EditorDocument> {
  const elements = await Promise.all(
    doc.elements.map(async (el) => {
      if (el.type !== "image" || !el.src?.startsWith("data:")) return el;
      const url = await uploadDataUrlIfNeeded(el.src);
      return url ? { ...el, src: url } : el;
    }),
  );
  const backgroundImage = await uploadDataUrlIfNeeded(doc.backgroundImage);
  return { ...doc, elements, backgroundImage };
}
