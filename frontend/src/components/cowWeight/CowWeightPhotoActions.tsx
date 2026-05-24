import { useRef, useState } from "react";
import { Camera, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  getFallbackCaptureAttribute,
  isCameraCaptureSupported,
} from "@/lib/cowWeight/captureFromCamera";
import CowWeightCameraDialog from "@/components/cowWeight/CowWeightCameraDialog";
import type { PhotoCaptureSource } from "@/lib/cowWeight/navigation";
import {
  cowWeightOutlineButtonClass,
  cowWeightOutlineButtonStyle,
  cowWeightPrimaryButtonClass,
  cowWeightPrimaryButtonStyle,
} from "@/lib/cowWeight/cowWeightTheme";
import { cn } from "@/lib/utils";

interface CowWeightPhotoActionsProps {
  onImageFile: (file: File, source: PhotoCaptureSource) => void;
  layout?: "stack" | "grid";
  className?: string;
  takePhotoClassName?: string;
  galleryClassName?: string;
}

export default function CowWeightPhotoActions({
  onImageFile,
  layout = "stack",
  className,
  takePhotoClassName,
  galleryClassName,
}: CowWeightPhotoActionsProps) {
  const { t } = useLanguage();
  const galleryRef = useRef<HTMLInputElement>(null);
  const fallbackCameraRef = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  const onGalleryChange = (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    onImageFile(file, "gallery");
  };

  const onTakePhoto = () => {
    if (isCameraCaptureSupported()) {
      setCameraOpen(true);
      return;
    }
    fallbackCameraRef.current?.click();
  };

  const onCameraError = (message: string) => {
    toast.error(message);
    fallbackCameraRef.current?.click();
  };

  const isStack = layout === "stack";

  return (
    <>
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          onGalleryChange(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={fallbackCameraRef}
        type="file"
        accept="image/*"
        capture={getFallbackCaptureAttribute()}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file?.type.startsWith("image/")) onImageFile(file, "camera");
        }}
      />

      <div
        className={cn(isStack ? "flex flex-col gap-2" : "grid sm:grid-cols-2 gap-2", className)}
      >
        <Button
          type="button"
          className={cn(
            cowWeightPrimaryButtonClass,
            isStack && "w-full h-12",
            takePhotoClassName
          )}
          style={cowWeightPrimaryButtonStyle}
          onClick={onTakePhoto}
        >
          <Camera className="h-5 w-5 mr-2 shrink-0" />
          {t("cowWeight.takePhoto")}
        </Button>
        <Button
          type="button"
          className={cn(
            cowWeightOutlineButtonClass,
            isStack && "w-full h-12",
            galleryClassName
          )}
          style={cowWeightOutlineButtonStyle}
          variant="outline"
          onClick={() => galleryRef.current?.click()}
        >
          <ImagePlus className="h-5 w-5 mr-2 shrink-0" />
          {t("cowWeight.chooseGallery")}
        </Button>
      </div>

      <CowWeightCameraDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onCapture={(file) => onImageFile(file, "camera")}
        onError={onCameraError}
      />
    </>
  );
}
