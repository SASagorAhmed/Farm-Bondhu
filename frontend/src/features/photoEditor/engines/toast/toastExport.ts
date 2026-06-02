/** Minimal TOAST ImageEditor instance surface used for export */
export type ToastEditorInstance = {
  toDataURL: (options?: { format?: string; quality?: number }) => string;
  resizeCanvasDimension?: (dim: { width: number; height: number }) => void;
  loadImageFromURL: (url: string, name: string) => Promise<unknown>;
  loadImageFromFile?: (file: File, name: string) => Promise<unknown>;
  undo?: () => void;
  redo?: () => void;
};

export function exportToastPng(instance: ToastEditorInstance): string | null {
  try {
    const dataUrl = instance.toDataURL({ format: "png", quality: 1 });
    return dataUrl || null;
  } catch {
    return null;
  }
}

/** Heuristic: blank/solid exports are very small base64 payloads */
export function isLikelyEmptyExport(dataUrl: string | null): boolean {
  if (!dataUrl) return true;
  return dataUrl.length < 5000;
}
