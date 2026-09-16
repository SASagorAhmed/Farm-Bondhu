/** Capture the main remote/call video (not the local PiP preview) and copy it to the clipboard. */

const NO_CALL_VIDEO = "NO_CALL_VIDEO";

export type CopyCallVideoResult = {
  copied: boolean;
  downloaded: boolean;
};

function compactStyle(styleText: string): string {
  return styleText.replace(/\s+/g, "").toLowerCase();
}

function inlineStyleLooksLikePip(styleText: string): boolean {
  const compact = compactStyle(styleText);
  if (!compact.includes("position:absolute") || !compact.includes("right:")) {
    return false;
  }
  // Local preview is pinned to the right; the main feed is not.
  if (compact.includes("left:")) return false;
  return true;
}

function elementArea(el: HTMLElement): number {
  const rect = el.getBoundingClientRect();
  return Math.max(0, rect.width) * Math.max(0, rect.height);
}

/** True when this video sits in Zego's small local-camera overlay (top-right PiP). */
export function isLocalPreviewVideo(video: HTMLVideoElement, stage: HTMLElement): boolean {
  let node: HTMLElement | null = video;
  while (node && node !== stage) {
    const inline = node.getAttribute("style") || "";
    if (inlineStyleLooksLikePip(inline)) return true;
    node = node.parentElement;
  }
  return false;
}

function isLiveCallVideo(video: HTMLVideoElement): boolean {
  return video.videoWidth > 0 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
}

/** Main remote/call feed only — never the local preview tile. */
export function pickMainCallVideo(stage: HTMLElement): HTMLVideoElement | null {
  const videos = Array.from(stage.querySelectorAll("video"));
  const live = videos.filter(isLiveCallVideo);
  if (!live.length) return null;

  const candidates = live.filter((video) => !isLocalPreviewVideo(video, stage));
  if (!candidates.length) return null;

  if (candidates.length === 1) return candidates[0];

  const ranked = candidates
    .map((video) => {
      const layoutArea = elementArea(video);
      const streamArea = video.videoWidth * video.videoHeight;
      return { video, area: layoutArea > 0 ? layoutArea : streamArea };
    })
    .sort((a, b) => b.area - a.area);

  return ranked[0]?.video ?? null;
}

function captureVideoFrameToPng(video: HTMLVideoElement): Promise<Blob> {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) {
    return Promise.reject(new Error(NO_CALL_VIDEO));
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return Promise.reject(new Error("Canvas not supported"));
  }
  ctx.drawImage(video, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to capture image"));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

async function writePngBlobToClipboard(blob: Blob): Promise<boolean> {
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
    return false;
  }

  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return true;
  } catch {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": Promise.resolve(blob) }),
      ]);
      return true;
    } catch {
      return false;
    }
  }
}

function downloadPng(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyMainCallVideoToClipboard(stage: HTMLElement): Promise<CopyCallVideoResult> {
  const video = pickMainCallVideo(stage);
  if (!video) {
    throw new Error(NO_CALL_VIDEO);
  }

  const blob = await captureVideoFrameToPng(video);
  const copied = await writePngBlobToClipboard(blob);
  if (copied) {
    return { copied: true, downloaded: false };
  }

  downloadPng(blob, `call-video-${Date.now()}.png`);
  return { copied: false, downloaded: true };
}

export function callScreenshotErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err || "");
  if (message === NO_CALL_VIDEO) {
    return "No call video to copy yet. Wait until the other person's camera is on.";
  }
  return "Could not copy screenshot. Try Chrome on desktop.";
}

export function callScreenshotSuccessMessage(result: CopyCallVideoResult): string {
  if (result.copied) {
    return "Screenshot copied. Paste it where you need it.";
  }
  return "Screenshot saved. Clipboard copy is not available in this browser.";
}

/** Alt+X — copy main call video; ignored while typing in chat fields. */
export function isCallScreenshotHotkey(event: KeyboardEvent): boolean {
  if (event.repeat) return false;
  const key = event.key.toLowerCase();
  if (key !== "x") return false;
  if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false;
  const t = event.target;
  if (t instanceof HTMLElement) {
    if (t.closest("input, textarea, select, [contenteditable='true']")) return false;
  }
  return true;
}
