import { FabricImage, filters } from "fabric";

export function applyImageFilters(
  img: FabricImage,
  brightness: number,
  contrast: number,
  saturation: number,
  blur: number,
): void {
  const list = [];
  if (brightness !== 0) {
    list.push(new filters.Brightness({ brightness: (brightness / 100) * 0.5 }));
  }
  if (contrast !== 0) {
    list.push(new filters.Contrast({ contrast: (contrast / 100) * 0.5 }));
  }
  if (saturation !== 0) {
    list.push(new filters.Saturation({ saturation: (saturation / 100) * 0.5 }));
  }
  if (blur > 0) {
    list.push(new filters.Blur({ blur: blur / 20 }));
  }
  img.filters = list;
  img.applyFilters();
  img.set({ fbBrightness: brightness, fbContrast: contrast, fbSaturation: saturation, fbBlur: blur });
}
