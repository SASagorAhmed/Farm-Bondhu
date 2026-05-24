import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, FlipHorizontal, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  type VideoCameraDevice,
  cameraErrorMessageKey,
  captureVideoFrameToFile,
  getAlternateDeviceId,
  openPreferredCamera,
  shouldMirrorPreview,
  startCameraWithDevice,
  stopCameraStream,
} from "@/lib/cowWeight/captureFromCamera";
import {
  cowWeightPrimaryButtonClass,
  cowWeightPrimaryButtonStyle,
} from "@/lib/cowWeight/cowWeightTheme";
import { cn } from "@/lib/utils";

interface CowWeightCameraDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (file: File) => void;
  onError?: (message: string) => void;
}

export default function CowWeightCameraDialog({
  open,
  onOpenChange,
  onCapture,
  onError,
}: CowWeightCameraDialogProps) {
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [videoDevices, setVideoDevices] = useState<VideoCameraDevice[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const [canSwitchCamera, setCanSwitchCamera] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const activeDevice = videoDevices.find((d) => d.deviceId === activeDeviceId);
  const mirrorPreview = shouldMirrorPreview(activeDevice);

  const stopStream = useCallback(() => {
    stopCameraStream(streamRef.current);
    streamRef.current = null;
    const video = videoRef.current;
    if (video) {
      video.srcObject = null;
    }
    setReady(false);
  }, []);

  const resetDeviceState = useCallback(() => {
    setVideoDevices([]);
    setActiveDeviceId(null);
    setCanSwitchCamera(false);
  }, []);

  const startWithDevice = useCallback(
    async (deviceId: string) => {
      const video = videoRef.current;
      if (!video) return;

      stopStream();
      setLoading(true);
      try {
        const stream = await startCameraWithDevice(video, deviceId);
        streamRef.current = stream;
        setActiveDeviceId(deviceId);
        setReady(true);
      } catch (err) {
        const key = cameraErrorMessageKey(err);
        onError?.(t(key));
        onOpenChange(false);
      } finally {
        setLoading(false);
      }
    },
    [onError, onOpenChange, stopStream, t]
  );

  const openCamera = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    stopStream();
    resetDeviceState();
    setLoading(true);
    try {
      const result = await openPreferredCamera(video);
      streamRef.current = result.stream;
      setVideoDevices(result.devices);
      setActiveDeviceId(result.activeDeviceId);
      setCanSwitchCamera(result.canSwitchCamera);
      setReady(true);
    } catch (err) {
      const key = cameraErrorMessageKey(err);
      onError?.(t(key));
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }, [onError, onOpenChange, resetDeviceState, stopStream, t]);

  useEffect(() => {
    if (!open) {
      stopStream();
      resetDeviceState();
      return;
    }
    const frame = requestAnimationFrame(() => {
      void openCamera();
    });
    return () => {
      cancelAnimationFrame(frame);
      stopStream();
    };
  }, [open, openCamera, resetDeviceState, stopStream]);

  const onSwitchCamera = () => {
    if (!canSwitchCamera || !activeDeviceId) return;
    const nextId = getAlternateDeviceId(videoDevices, activeDeviceId);
    if (nextId) void startWithDevice(nextId);
  };

  const onCaptureClick = async () => {
    const video = videoRef.current;
    if (!video || !ready || capturing) return;

    setCapturing(true);
    try {
      const file = await captureVideoFrameToFile(video);
      stopStream();
      resetDeviceState();
      onOpenChange(false);
      onCapture(file);
    } catch {
      onError?.(t("cowWeight.camera.unavailable"));
    } finally {
      setCapturing(false);
    }
  };

  const onCancel = () => {
    stopStream();
    resetDeviceState();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : onCancel())}>
      <DialogContent className="max-w-lg p-4 sm:p-6 gap-4">
        <DialogHeader>
          <DialogTitle>{t("cowWeight.camera.title")}</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <video
            ref={videoRef}
            className={cn(
              "w-full aspect-[4/3] object-cover rounded-lg bg-black",
              mirrorPreview && "scale-x-[-1]"
            )}
            playsInline
            muted
          />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-2">
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onCancel}>
            {t("cowWeight.camera.cancel")}
          </Button>
          {canSwitchCamera && (
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={onSwitchCamera}
              disabled={loading}
            >
              <FlipHorizontal className="h-4 w-4 mr-2" />
              {t("cowWeight.camera.switch")}
            </Button>
          )}
          <Button
            type="button"
            className={cn("w-full sm:flex-1", cowWeightPrimaryButtonClass)}
            style={cowWeightPrimaryButtonStyle}
            onClick={() => void onCaptureClick()}
            disabled={!ready || capturing}
          >
            {capturing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Camera className="h-4 w-4 mr-2" />
            )}
            {t("cowWeight.camera.capture")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
