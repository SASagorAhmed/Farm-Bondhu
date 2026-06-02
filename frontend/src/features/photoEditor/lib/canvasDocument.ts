import type { EditorDocument, EditorElement } from "../types";

export function newElementId(): string {
  return crypto.randomUUID();
}

export function cloneDocument(doc: EditorDocument): EditorDocument {
  return JSON.parse(JSON.stringify(doc)) as EditorDocument;
}

export function defaultElementName(type: EditorElement["type"], index: number): string {
  const labels: Record<EditorElement["type"], string> = {
    image: "Image",
    text: "Text",
    rect: "Rectangle",
    circle: "Circle",
    line: "Line",
    sticker: "Sticker",
  };
  return `${labels[type]} ${index}`;
}
