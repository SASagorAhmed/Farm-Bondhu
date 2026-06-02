import type { Canvas, FabricObject, TPointerEventInfo } from "fabric";
import { Textbox } from "fabric";
import { applyObjectChrome, isFabricTextbox } from "./fabricCanvasHelpers";
import type { FillSelection } from "./fabricFillColor";
import { applyFillSelection } from "./fabricFillColor";

const MEASURE_WIDTH = 99999;
const WIDTH_PADDING = 4;
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 200;

const SIDE_CONTROLS = new Set(["ml", "mr"]);

export type FitTextOptions = { force?: boolean };

export type CreateTextOptions = {
  text: string;
  fontFamily: string;
  fontSize?: number;
  fill: string;
  fillSelection?: FillSelection;
  dataId?: string;
};

function minWidthForFont(fontSize: number): number {
  return Math.max(20, Math.ceil(fontSize * 0.6));
}

/** Shrink text box width to hug content unless user widened for wrapping. */
export function fitTextToContent(obj: FabricObject, opts?: FitTextOptions): void {
  if (!isFabricTextbox(obj)) return;
  if (opts?.force) obj.set("fbManualWrapWidth", false);
  else if (obj.get("fbManualWrapWidth")) return;

  const textObj = obj as Textbox;
  textObj.set({ width: MEASURE_WIDTH, scaleX: 1, scaleY: 1 });
  textObj.initDimensions();

  const contentW = Math.ceil(textObj.calcTextWidth()) + WIDTH_PADDING;
  const fontSize = Number(textObj.fontSize ?? 16);
  textObj.set({ width: Math.max(contentW, minWidthForFont(fontSize)) });
  textObj.initDimensions();
  textObj.setCoords();
}

export function resetTextAutoFit(obj: FabricObject): void {
  fitTextToContent(obj, { force: true });
}

/** Lock uniform scaling; corner drag converts to fontSize in bindTextAutoFit. */
export function applyTextControls(obj: FabricObject): void {
  if (!isFabricTextbox(obj)) return;
  obj.set({ lockScalingFlip: true });
}

function scaleFontFromCorner(textObj: Textbox): void {
  const scale = textObj.scaleX ?? 1;
  if (Math.abs(scale - 1) < 0.01) return;

  const nextSize = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round((textObj.fontSize ?? 36) * scale)));
  textObj.set({ fontSize: nextSize, scaleX: 1, scaleY: 1 });
  fitTextToContent(textObj, { force: true });
}

function isSideResize(corner?: string): boolean {
  return Boolean(corner && SIDE_CONTROLS.has(corner));
}

export function createTextAtPoint(
  canvas: Canvas,
  point: { x: number; y: number },
  opts: CreateTextOptions,
): Textbox {
  const text = new Textbox(opts.text, {
    left: point.x,
    top: point.y,
    fontSize: opts.fontSize ?? 36,
    fill: opts.fill,
    fontFamily: opts.fontFamily,
    editable: true,
    originX: "left",
    originY: "top",
    dataId: opts.dataId ?? `text-${Date.now()}`,
    name: "Text",
    objectType: "text",
  });
  applyObjectChrome(text);
  applyTextControls(text);
  fitTextToContent(text, { force: true });
  canvas.add(text);
  if (opts.fillSelection?.type === "gradient") {
    applyFillSelection(text, opts.fillSelection);
  }
  return text;
}

/** Refit on edit; corner scale → fontSize; side scale → manual wrap width. */
export function bindTextAutoFit(canvas: Canvas): () => void {
  const onTextChanged = (e: { target?: FabricObject }) => {
    if (e.target) fitTextToContent(e.target);
    canvas.requestRenderAll();
  };

  const onEditingExited = (e: { target?: FabricObject }) => {
    if (e.target) fitTextToContent(e.target);
    canvas.requestRenderAll();
  };

  const onScaling = (e: TPointerEventInfo & { transform?: { corner?: string } }) => {
    const obj = e.target;
    if (!obj || !isFabricTextbox(obj)) return;

    const corner = e.transform?.corner;
    if (isSideResize(corner)) return;

    scaleFontFromCorner(obj as Textbox);
    canvas.requestRenderAll();
  };

  const onModified = (e: TPointerEventInfo & { transform?: { corner?: string } }) => {
    const obj = e.target;
    if (!obj || !isFabricTextbox(obj)) return;

    const corner = e.transform?.corner;
    if (isSideResize(corner)) {
      obj.set("fbManualWrapWidth", true);
      canvas.requestRenderAll();
      return;
    }

    if (!obj.get("fbManualWrapWidth")) {
      fitTextToContent(obj);
    }
    canvas.requestRenderAll();
  };

  canvas.on("text:changed", onTextChanged);
  canvas.on("editing:exited", onEditingExited);
  canvas.on("object:scaling", onScaling);
  canvas.on("object:modified", onModified);
  return () => {
    canvas.off("text:changed", onTextChanged);
    canvas.off("editing:exited", onEditingExited);
    canvas.off("object:scaling", onScaling);
    canvas.off("object:modified", onModified);
  };
}
