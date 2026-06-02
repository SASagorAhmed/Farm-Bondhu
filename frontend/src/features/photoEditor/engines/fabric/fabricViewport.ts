import type { Canvas } from "fabric";

export type ViewportFit = {
  scale: number;
  displayWidth: number;
  displayHeight: number;
};

/**
 * Fit document into the artboard frame using cssOnly display dimensions.
 * Identity viewport — no pan offset (avoids misaligned pointer when canvas is nested in a frame).
 */
export function fitCanvasToContainer(
  canvas: Canvas,
  docWidth: number,
  docHeight: number,
  measureEl: HTMLElement,
  padding = 32,
): ViewportFit {
  const availW = Math.max(1, measureEl.clientWidth - padding);
  const availH = Math.max(1, measureEl.clientHeight - padding);
  const scale = Math.max(0.05, Math.min(availW / docWidth, availH / docHeight, 1));

  const displayWidth = Math.round(docWidth * scale);
  const displayHeight = Math.round(docHeight * scale);

  canvas.setDimensions({ width: docWidth, height: docHeight });
  canvas.setDimensions({ width: displayWidth, height: displayHeight }, { cssOnly: true });
  canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
  canvas.setZoom(1);
  canvas.calcOffset();
  canvas.requestRenderAll();

  return { scale, displayWidth, displayHeight };
}

/** Export at full document resolution regardless of on-screen display scale. */
export function withExportViewport<T>(canvas: Canvas, fn: () => T): T {
  const docW = canvas.width;
  const docH = canvas.height;
  const cssW = canvas.getWidth();
  const cssH = canvas.getHeight();
  const vpt = [...canvas.viewportTransform] as [number, number, number, number, number, number];

  canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
  canvas.setZoom(1);
  canvas.setDimensions({ width: docW, height: docH });
  canvas.setDimensions({ width: docW, height: docH }, { cssOnly: true });

  try {
    return fn();
  } finally {
    canvas.setDimensions({ width: docW, height: docH });
    canvas.setDimensions({ width: cssW, height: cssH }, { cssOnly: true });
    canvas.setViewportTransform(vpt);
    canvas.calcOffset();
    canvas.requestRenderAll();
  }
}
