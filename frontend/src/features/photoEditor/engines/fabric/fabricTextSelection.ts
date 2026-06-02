import type { FabricObject } from "fabric";
import { normalizeHex, DEFAULT_SOLID_COLOR } from "../../lib/photoEditorColorPalette";
import { applySolidFill, parseFillSelection, type FillSelection } from "./fabricFillColor";
import { fitTextToContent } from "./fabricTextHelpers";

export type StyledTextbox = FabricObject & {
  text?: string;
  fill?: unknown;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string | number;
  fontStyle?: string;
  textAlign?: string;
  isEditing?: boolean;
  selectionStart?: number;
  selectionEnd?: number;
  getSelectionStyles?: (
    startIndex?: number,
    endIndex?: number,
  ) => Record<string, unknown> | Record<string, unknown>[];
  setSelectionStyles?: (
    styles: Record<string, unknown>,
    startIndex: number,
    endIndex?: number,
  ) => void;
  initDimensions?: () => void;
  setCoords?: () => void;
};

export type TextStylePatch = Partial<{
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  fontStyle: string;
  fill: string;
}>;

export function asStyledTextbox(obj: FabricObject): StyledTextbox {
  return obj as StyledTextbox;
}

export function hasPartialSelection(text: StyledTextbox): boolean {
  return Boolean(
    text.isEditing &&
      typeof text.selectionStart === "number" &&
      typeof text.selectionEnd === "number" &&
      text.selectionStart !== text.selectionEnd,
  );
}

function styleFromSelection(text: StyledTextbox): Record<string, unknown> | undefined {
  if (!text.isEditing || !text.getSelectionStyles) return undefined;

  if (hasPartialSelection(text)) {
    const styles = text.getSelectionStyles(text.selectionStart, text.selectionEnd);
    if (Array.isArray(styles)) {
      return styles.find((s) => s && typeof s === "object") as Record<string, unknown> | undefined;
    }
    return styles as Record<string, unknown> | undefined;
  }

  const styles = text.getSelectionStyles();
  if (Array.isArray(styles)) {
    return styles.find((s) => s && typeof s === "object") as Record<string, unknown> | undefined;
  }
  return styles as Record<string, unknown> | undefined;
}

export function getActiveTextStyle(text: StyledTextbox, key: keyof TextStylePatch): unknown {
  const selected = styleFromSelection(text);
  if (selected && selected[key] !== undefined && selected[key] !== "") {
    return selected[key];
  }
  return (text as Record<string, unknown>)[key];
}

export function getActiveTextFill(text: StyledTextbox): FillSelection {
  const fill = getActiveTextStyle(text, "fill");
  if (typeof fill === "string") {
    return { type: "solid", color: normalizeHex(fill) || DEFAULT_SOLID_COLOR };
  }
  return parseFillSelection(text.fill);
}

export function applyTextStyle(text: StyledTextbox, styles: TextStylePatch): void {
  if (hasPartialSelection(text) && text.setSelectionStyles) {
    text.setSelectionStyles(styles, text.selectionStart!, text.selectionEnd!);
  } else {
    text.set(styles);
  }
  text.initDimensions?.();
  fitTextToContent(text, { force: true });
  text.setCoords?.();
}

export function applyTextFill(text: StyledTextbox, color: string): void {
  const hex = normalizeHex(color) || DEFAULT_SOLID_COLOR;
  if (hasPartialSelection(text) && text.setSelectionStyles) {
    text.setSelectionStyles({ fill: hex }, text.selectionStart!, text.selectionEnd!);
    text.initDimensions?.();
    fitTextToContent(text, { force: true });
    text.setCoords?.();
  } else {
    applySolidFill(text, hex);
    fitTextToContent(text, { force: true });
  }
}

export function isTextBold(text: StyledTextbox): boolean {
  const weight = getActiveTextStyle(text, "fontWeight");
  return weight === "bold" || weight === 700 || weight === "700";
}

export function isTextItalic(text: StyledTextbox): boolean {
  return getActiveTextStyle(text, "fontStyle") === "italic";
}

export function toggleTextBold(text: StyledTextbox): void {
  applyTextStyle(text, { fontWeight: isTextBold(text) ? "normal" : "bold" });
}

export function toggleTextItalic(text: StyledTextbox): void {
  applyTextStyle(text, { fontStyle: isTextItalic(text) ? "normal" : "italic" });
}

export function setTextFontSize(text: StyledTextbox, size: number): void {
  const clamped = Math.min(200, Math.max(8, size));
  applyTextStyle(text, { fontSize: clamped });
}
