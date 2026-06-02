import { FabricImage, type FabricObject } from "fabric";

export type CropInset = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export const EMPTY_CROP_INSET: CropInset = { left: 0, top: 0, right: 0, bottom: 0 };

export function insetsToCropPixels(insets: CropInset, naturalW: number, naturalH: number) {
  const cropX = (insets.left / 100) * naturalW;
  const cropY = (insets.top / 100) * naturalH;
  const width = Math.max(1, naturalW - cropX - (insets.right / 100) * naturalW);
  const height = Math.max(1, naturalH - cropY - (insets.bottom / 100) * naturalH);
  return { cropX, cropY, width, height };
}

export function cropPixelsToInsets(
  cropX: number,
  cropY: number,
  width: number,
  height: number,
  naturalW: number,
  naturalH: number,
): CropInset {
  if (naturalW <= 0 || naturalH <= 0) return { ...EMPTY_CROP_INSET };
  const left = Math.round((cropX / naturalW) * 100);
  const top = Math.round((cropY / naturalH) * 100);
  const right = Math.round(((naturalW - cropX - width) / naturalW) * 100);
  const bottom = Math.round(((naturalH - cropY - height) / naturalH) * 100);
  return {
    left: Math.max(0, left),
    top: Math.max(0, top),
    right: Math.max(0, right),
    bottom: Math.max(0, bottom),
  };
}

export function getNaturalSize(img: FabricImage): { w: number; h: number } {
  const storedW = Number(img.get("fbNaturalWidth") ?? 0);
  const storedH = Number(img.get("fbNaturalHeight") ?? 0);
  if (storedW > 0 && storedH > 0) return { w: storedW, h: storedH };

  const cropX = img.cropX ?? 0;
  const cropY = img.cropY ?? 0;
  const width = img.width ?? 0;
  const height = img.height ?? 0;
  return { w: Math.max(width + cropX, 1), h: Math.max(height + cropY, 1) };
}

/** Store original pixel dimensions so repeated crops stay stable. */
export function ensureNaturalSize(img: FabricImage): { w: number; h: number } {
  const storedW = Number(img.get("fbNaturalWidth") ?? 0);
  const storedH = Number(img.get("fbNaturalHeight") ?? 0);
  if (storedW > 0 && storedH > 0) return { w: storedW, h: storedH };

  const el = img.getElement() as HTMLImageElement | undefined;
  const fromElementW = el?.naturalWidth ?? 0;
  const fromElementH = el?.naturalHeight ?? 0;
  const inferred = getNaturalSize(img);
  const naturalW = fromElementW > 0 ? fromElementW : inferred.w;
  const naturalH = fromElementH > 0 ? fromElementH : inferred.h;

  img.set({ fbNaturalWidth: naturalW, fbNaturalHeight: naturalH });
  return { w: naturalW, h: naturalH };
}

export function applyCropInsets(img: FabricImage, insets: CropInset): void {
  const { w: naturalW, h: naturalH } = ensureNaturalSize(img);
  const { cropX, cropY, width, height } = insetsToCropPixels(insets, naturalW, naturalH);
  img.clipPath = undefined;
  img.set({ cropX, cropY, width, height });
  img.setCoords();
}

export function readCropInsets(img: FabricImage): CropInset {
  const { w: naturalW, h: naturalH } = getNaturalSize(img);
  const cropX = img.cropX ?? 0;
  const cropY = img.cropY ?? 0;
  const width = img.width ?? naturalW;
  const height = img.height ?? naturalH;
  if (cropX === 0 && cropY === 0 && width >= naturalW && height >= naturalH) {
    return { ...EMPTY_CROP_INSET };
  }
  return cropPixelsToInsets(cropX, cropY, width, height, naturalW, naturalH);
}

export function clearCrop(img: FabricImage): void {
  const { w: naturalW, h: naturalH } = ensureNaturalSize(img);
  img.clipPath = undefined;
  img.set({ cropX: 0, cropY: 0, width: naturalW, height: naturalH });
  img.setCoords();
}

export function normalizeLoadedImage(obj: FabricObject): void {
  if (!(obj instanceof FabricImage)) return;
  ensureNaturalSize(obj);
  if (obj.clipPath) obj.clipPath = undefined;
}
