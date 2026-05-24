export type CameraFacingMode = "environment" | "user";
export type CameraRole = "front" | "back" | "unknown";

export interface VideoCameraDevice {
  deviceId: string;
  label: string;
  role: CameraRole;
}

export interface OpenPreferredCameraResult {
  stream: MediaStream;
  devices: VideoCameraDevice[];
  activeDeviceId: string;
  canSwitchCamera: boolean;
}

/** Handheld phone/tablet — prefer rear camera for cow photos. */
export function isLikelyHandheldCameraDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;

  if (/iPhone|iPod/i.test(ua)) return true;
  if (/Android/i.test(ua) && /Mobile/i.test(ua)) return true;
  if (/iPad/i.test(ua)) return true;

  const touchPoints = navigator.maxTouchPoints ?? 0;
  if (touchPoints > 1 && (/iPad/i.test(ua) || (/MacIntel/i.test(ua) && touchPoints > 0))) {
    return true;
  }

  if (/Mobile/i.test(ua) && !/Windows NT/i.test(ua)) return true;

  return false;
}

/** Laptop/desktop → front webcam; phone → rear camera (preference only). */
export function getDefaultCameraFacingMode(): CameraFacingMode {
  return isLikelyHandheldCameraDevice() ? "environment" : "user";
}

export function isCameraCaptureSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

export function stopCameraStream(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((track) => track.stop());
}

export function classifyCameraLabel(label: string): CameraRole {
  const l = label.toLowerCase();
  if (/back|rear|environment|world|trás|arrière|rück/i.test(l)) return "back";
  if (/front|user|face|selfie|facetime|integrated|built-?in|webcam|hd camera|facing user/i.test(l)) {
    return "front";
  }
  return "unknown";
}

export function toVideoCameraDevice(device: MediaDeviceInfo): VideoCameraDevice {
  return {
    deviceId: device.deviceId,
    label: device.label || "Camera",
    role: classifyCameraLabel(device.label || ""),
  };
}

export async function listVideoCameras(): Promise<VideoCameraDevice[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((d) => d.kind === "videoinput" && d.deviceId)
    .map(toVideoCameraDevice);
}

/** Request permission so enumerateDevices returns labels (Chrome/Safari). */
export async function ensureCameraPermission(): Promise<void> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
  stopCameraStream(stream);
}

export function pickDefaultCameraDevice(
  cameras: VideoCameraDevice[],
  handheld = isLikelyHandheldCameraDevice()
): VideoCameraDevice | undefined {
  if (cameras.length === 0) return undefined;
  if (cameras.length === 1) return cameras[0];

  if (handheld) {
    return cameras.find((c) => c.role === "back") ?? cameras[0];
  }
  return cameras.find((c) => c.role === "front") ?? cameras[0];
}

export function canSwitchCamera(cameras: VideoCameraDevice[]): boolean {
  return cameras.length >= 2;
}

export function getAlternateDeviceId(
  cameras: VideoCameraDevice[],
  activeDeviceId: string
): string | undefined {
  if (cameras.length < 2) return undefined;
  const idx = cameras.findIndex((c) => c.deviceId === activeDeviceId);
  const next = idx >= 0 ? cameras[(idx + 1) % cameras.length] : cameras[0];
  return next?.deviceId;
}

export function shouldMirrorPreview(
  device: VideoCameraDevice | undefined,
  handheld = isLikelyHandheldCameraDevice()
): boolean {
  if (!device) return !handheld;
  if (device.role === "front") return true;
  if (device.role === "back") return false;
  return !handheld;
}

function buildDeviceConstraints(deviceId: string): MediaStreamConstraints {
  return {
    audio: false,
    video: {
      deviceId: { exact: deviceId },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
  };
}

async function attachStreamToVideo(video: HTMLVideoElement, stream: MediaStream): Promise<void> {
  video.srcObject = stream;
  video.playsInline = true;
  video.muted = true;
  video.autoplay = true;
  await video.play().catch(() => undefined);
}

export async function startCameraWithDevice(
  video: HTMLVideoElement,
  deviceId: string
): Promise<MediaStream> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia(buildDeviceConstraints(deviceId));
    await attachStreamToVideo(video, stream);
    return stream;
  } catch (err) {
    if (err instanceof DOMException && err.name === "OverconstrainedError") {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { deviceId: { ideal: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      await attachStreamToVideo(video, stream);
      return stream;
    }
    throw err;
  }
}

export async function openPreferredCamera(video: HTMLVideoElement): Promise<OpenPreferredCameraResult> {
  await ensureCameraPermission();
  const devices = await listVideoCameras();
  const picked = pickDefaultCameraDevice(devices);
  if (!picked?.deviceId) {
    throw new DOMException("No camera found", "NotFoundError");
  }

  const stream = await startCameraWithDevice(video, picked.deviceId);
  return {
    stream,
    devices,
    activeDeviceId: picked.deviceId,
    canSwitchCamera: canSwitchCamera(devices),
  };
}

export function captureVideoFrameToFile(
  video: HTMLVideoElement,
  fileName = `cow-weight-${Date.now()}.jpg`
): Promise<File> {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) {
    return Promise.reject(new Error("Camera not ready"));
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return Promise.reject(new Error("Canvas not supported"));
  }
  ctx.drawImage(video, 0, 0, w, h);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to capture image"));
          return;
        }
        resolve(new File([blob], fileName, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92
    );
  });
}

export function cameraErrorMessageKey(err: unknown): "cowWeight.camera.permissionDenied" | "cowWeight.camera.unavailable" {
  if (err instanceof DOMException) {
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
      return "cowWeight.camera.permissionDenied";
    }
  }
  return "cowWeight.camera.unavailable";
}

export function getFallbackCaptureAttribute(): "user" | "environment" {
  return isLikelyHandheldCameraDevice() ? "environment" : "user";
}
