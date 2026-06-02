import { Gradient, type FabricObject } from "fabric";
import {
  DEFAULT_SOLID_COLOR,
  GRADIENT_PRESETS,
  normalizeHex,
  type GradientPreset,
} from "../../lib/photoEditorColorPalette";

export type FillSelection =
  | { type: "solid"; color: string }
  | { type: "gradient"; presetId: string };

export function isGradientFill(fill: unknown): fill is Gradient {
  return Boolean(fill && typeof fill === "object" && "colorStops" in (fill as Gradient));
}

export function parseFillSelection(fill: unknown): FillSelection {
  if (typeof fill === "string") {
    return { type: "solid", color: normalizeHex(fill) || DEFAULT_SOLID_COLOR };
  }
  if (isGradientFill(fill)) {
    const stops = fill.colorStops ?? [];
    const match = GRADIENT_PRESETS.find((p) => {
      if (p.colorStops.length !== stops.length) return false;
      return p.colorStops.every((s, i) => {
        const other = stops[i];
        return (
          Math.abs(s.offset - (other?.offset ?? 0)) < 0.01 &&
          normalizeHex(s.color) === normalizeHex(String(other?.color ?? ""))
        );
      });
    });
    if (match) return { type: "gradient", presetId: match.id };
    return { type: "solid", color: String(stops[0]?.color ?? DEFAULT_SOLID_COLOR) };
  }
  return { type: "solid", color: DEFAULT_SOLID_COLOR };
}

function objectSize(obj: FabricObject): { w: number; h: number } {
  const w = (obj.width ?? 1) * (obj.scaleX ?? 1);
  const h = (obj.height ?? 1) * (obj.scaleY ?? 1);
  return { w: Math.max(w, 1), h: Math.max(h, 1) };
}

function gradientCoords(preset: GradientPreset, w: number, h: number) {
  const rad = (preset.angle * Math.PI) / 180;
  const cx = w / 2;
  const cy = h / 2;
  const len = Math.sqrt(w * w + h * h) / 2;
  return {
    x1: cx - Math.cos(rad) * len,
    y1: cy - Math.sin(rad) * len,
    x2: cx + Math.cos(rad) * len,
    y2: cy + Math.sin(rad) * len,
  };
}

export function buildGradientFill(preset: GradientPreset, obj: FabricObject): Gradient {
  const { w, h } = objectSize(obj);
  return new Gradient({
    type: "linear",
    gradientUnits: "pixels",
    coords: gradientCoords(preset, w, h),
    colorStops: preset.colorStops.map((s) => ({ offset: s.offset, color: s.color })),
  });
}

export function applySolidFill(obj: FabricObject, color: string): void {
  obj.set("fill", normalizeHex(color));
}

export function applyGradientFill(obj: FabricObject, presetId: string): void {
  const preset = GRADIENT_PRESETS.find((p) => p.id === presetId);
  if (!preset) return;
  obj.set("fill", buildGradientFill(preset, obj));
}

export function applyFillSelection(obj: FabricObject, selection: FillSelection): void {
  if (selection.type === "gradient") {
    applyGradientFill(obj, selection.presetId);
  } else {
    applySolidFill(obj, selection.color);
  }
}

export function getSolidColorFromFill(fill: unknown): string {
  const parsed = parseFillSelection(fill);
  return parsed.type === "solid" ? parsed.color : DEFAULT_SOLID_COLOR;
}
