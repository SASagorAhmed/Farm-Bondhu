import { Badge } from "@/components/ui/badge";
import {
  cowWeightDistanceBarStyle,
  cowWeightDistanceFallbackBarStyle,
} from "@/components/cowWeight/cowWeightCalloutStyles";
import { useLanguage } from "@/contexts/LanguageContext";
import { COW_WEIGHT_THEME } from "@/lib/cowWeight/cowWeightTheme";
import { DEFAULT_CAMERA_DISTANCE_CM } from "@/lib/cowWeight/geometry3d";
import type { CameraDistanceSource } from "@/lib/cowWeight/types";

interface CameraDistanceBarProps {
  cameraDistanceCm?: number | null;
  distanceSource?: CameraDistanceSource | null;
  groundDistanceDetected?: boolean;
  loading?: boolean;
}

export default function CameraDistanceBar({
  cameraDistanceCm,
  distanceSource,
  groundDistanceDetected = true,
  loading,
}: CameraDistanceBarProps) {
  const { t } = useLanguage();
  const detected = groundDistanceDetected;
  const cm = detected ? (cameraDistanceCm ?? DEFAULT_CAMERA_DISTANCE_CM) : DEFAULT_CAMERA_DISTANCE_CM;

  const sourceLabel =
    detected && distanceSource === "cloud"
      ? t("cowWeight.scan.distanceSourceCloud")
      : detected && distanceSource === "local"
        ? t("cowWeight.scan.distanceSourceLocal")
        : detected && distanceSource === "blended"
          ? t("cowWeight.scan.distanceSourceBlended")
          : null;

  const barStyle = detected ? cowWeightDistanceBarStyle : cowWeightDistanceFallbackBarStyle;

  return (
    <div
      className="w-full rounded-b-lg border border-t-4 px-3 py-2.5 space-y-1"
      style={barStyle}
      role="status"
      aria-live="polite"
    >
      <p className="text-[11px] font-medium text-muted-foreground leading-snug">
        {t("cowWeight.scan.groundReferenceTitle")}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {loading ? (
          <span className="text-sm text-muted-foreground animate-pulse">
            {t("cowWeight.scan.cameraDistanceLoading")}
          </span>
        ) : detected ? (
          <p className="text-sm font-semibold text-slate-900">
            {t("cowWeight.scan.groundDistanceDetected").replace("{cm}", String(cm))}
          </p>
        ) : (
          <p className="text-sm font-semibold" style={{ color: COW_WEIGHT_THEME.farmText }}>
            {t("cowWeight.scan.groundDistanceFallback").replace("{cm}", String(cm))}
          </p>
        )}
        {!loading && sourceLabel && (
          <Badge variant="secondary" className="text-[10px] font-normal shrink-0">
            {sourceLabel}
          </Badge>
        )}
      </div>
      {detected ? (
        <p className="text-[10px] text-muted-foreground">{t("cowWeight.scan.distanceGridNote")}</p>
      ) : (
        <p className="text-[10px]" style={{ color: COW_WEIGHT_THEME.farmTextMuted, opacity: 0.9 }}>
          {t("cowWeight.scan.groundDistanceFallbackHint")}
        </p>
      )}
    </div>
  );
}
