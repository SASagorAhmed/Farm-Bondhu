import type { EditorElement } from "../types";

export const FILTER_DEFAULTS = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  blur: 0,
};

export function elementFilterProps(el: EditorElement) {
  if (el.type !== "image") return {};
  const brightness = el.brightness ?? 0;
  const contrast = el.contrast ?? 0;
  const saturation = el.saturation ?? 0;
  const blur = el.blur ?? 0;
  const hasFilters = brightness || contrast || saturation || blur;
  if (!hasFilters) return {};
  return {
    filters: [
      ...(brightness ? (["Brighten"] as const) : []),
      ...(contrast ? (["Contrast"] as const) : []),
      ...(saturation ? (["HSL"] as const) : []),
      ...(blur ? (["Blur"] as const) : []),
    ],
    brightness: brightness / 100,
    contrast: contrast / 100,
    saturation: saturation / 100,
    blurRadius: blur / 10,
  };
}
