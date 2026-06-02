import type { PresetKey } from "../types";

/** All marketplace presets use the unified Fabric (Canva-style) workspace. */
export function usesFabricEngine(_presetKey: PresetKey): boolean {
  return true;
}

export function isLegacyKonvaCanvas(json: unknown): boolean {
  if (!json || typeof json !== "object") return false;
  const o = json as Record<string, unknown>;
  return Array.isArray(o.elements) && o.engine == null;
}

export function isToastCanvas(json: unknown): json is import("../types").ToastCanvasJson {
  return Boolean(json && typeof json === "object" && (json as { engine?: string }).engine === "toast");
}

export function isFabricCanvas(json: unknown): json is import("../types").FabricCanvasJson {
  return Boolean(json && typeof json === "object" && (json as { engine?: string }).engine === "fabric");
}
