import { FabricObject } from "fabric";

export const FABRIC_CUSTOM_PROPS = [
  "dataId",
  "name",
  "objectType",
  "fbSrc",
  "fbNaturalWidth",
  "fbNaturalHeight",
  "fbBrightness",
  "fbContrast",
  "fbSaturation",
  "fbBlur",
  "fbManualWrapWidth",
] as const;

let registered = false;

/** Persist layer ids and filter values across undo and draft save. */
export function registerFabricCustomProperties(): void {
  if (registered) return;
  registered = true;
  const existing = FabricObject.customProperties ?? [];
  for (const key of FABRIC_CUSTOM_PROPS) {
    if (!existing.includes(key)) existing.push(key);
  }
  FabricObject.customProperties = existing;
}
