import { Badge } from "@/components/ui/badge";
import CowWeightGreenbondhuAlert from "@/components/cowWeight/CowWeightGreenbondhuAlert";
import { cowWeightLiveWeightValue } from "@/components/cowWeight/cowWeightCalloutStyles";
import { useLanguage } from "@/contexts/LanguageContext";
import { isStandoffInOptimalBand } from "@/lib/cowWeight/cowWeightResearch";
import {
  COW_WEIGHT_THEME,
  cowWeightAccentStyle,
  cowWeightPanelLayout,
  cowWeightPanelStyle,
  cowWeightTextStyle,
} from "@/lib/cowWeight/cowWeightTheme";
import { DEFAULT_CAMERA_DISTANCE_CM } from "@/lib/cowWeight/geometry3d";
import type { StandoffEstimate } from "@/lib/cowWeight/standoffEstimate";
import type { CameraDistanceSource, ScanMetrics } from "@/lib/cowWeight/types";

interface ScanLiveSummaryProps {
  metrics: ScanMetrics | null;
  standoff: StandoffEstimate | null;
  hasReference: boolean;
  step: number;
  assistLoading?: boolean;
  cameraDistanceCm?: number | null;
  distanceSource?: CameraDistanceSource | null;
  groundDistanceDetected?: boolean;
}

function minimumLabel(template: string): string {
  return template.split("{kg}")[0].replace(/[:：\s]+$/, "");
}

export default function ScanLiveSummary({
  metrics,
  standoff,
  hasReference,
  step,
  assistLoading,
  cameraDistanceCm: cameraDistanceCmProp,
  distanceSource,
  groundDistanceDetected: groundDistanceDetectedProp,
}: ScanLiveSummaryProps) {
  const { t } = useLanguage();

  const isDetectStep = step === 1;
  const isPreview = step < 5;
  const showWeight = metrics && metrics.estimatedLiveWeightKg > 0;
  const detected =
    groundDistanceDetectedProp ?? metrics?.groundDistanceDetected ?? true;
  const planDCm = detected
    ? (cameraDistanceCmProp ?? metrics?.cameraDistanceCm ?? DEFAULT_CAMERA_DISTANCE_CM)
    : DEFAULT_CAMERA_DISTANCE_CM;
  const showPlanDDistance = !hasReference && step >= 1;
  const showStandoffMeters =
    detected && standoff && !hasReference && !assistLoading && step >= 1;
  const showMeat = !isPreview && showWeight;
  const weightLoading = assistLoading && step === 1 && !showWeight;
  const reserveDistanceSlot = step === 1 && !hasReference;
  const minimumLiveWeightKg = metrics?.estimatedLiveWeightKg ?? 0;
  const minimumEdibleMeatKg = Number((minimumLiveWeightKg * 0.55).toFixed(1));

  const sourceLabel =
    detected && distanceSource === "cloud"
      ? t("cowWeight.scan.distanceSourceCloud")
      : detected && distanceSource === "local"
        ? t("cowWeight.scan.distanceSourceLocal")
        : detected && distanceSource === "blended"
          ? t("cowWeight.scan.distanceSourceBlended")
          : null;

  const textStyle = cowWeightTextStyle();
  const mutedText = COW_WEIGHT_THEME.farmTextMuted;

  return (
    <div
      className={`${cowWeightPanelLayout} ${isDetectStep ? "min-h-[12rem]" : "min-h-[8rem]"}`}
      style={cowWeightPanelStyle("farm")}
    >
      <p className="text-[11px] font-bold uppercase tracking-wide" style={textStyle}>
        {t("cowWeight.scan.liveSummaryTitle")}
      </p>

      <div className="min-h-[2.75rem] flex flex-col justify-center">
        {weightLoading && (
          <p className="text-sm animate-pulse text-muted-foreground">{t("cowWeight.scan.liveWeightCalculating")}</p>
        )}
        {showWeight && (
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-muted-foreground font-medium">
              {isPreview ? t("cowWeight.scan.liveWeightPreview") : t("cowWeight.liveWeight")}
            </span>
            <span
              className={cowWeightLiveWeightValue}
              style={cowWeightAccentStyle("farm")}
            >
              ~{metrics!.estimatedLiveWeightKg} kg
            </span>
          </div>
        )}
      </div>

      {isDetectStep && (
        <div className="grid grid-cols-2 gap-2">
          <div
            className="rounded-lg border bg-white/70 px-2.5 py-2 shadow-sm"
            style={{ borderColor: COW_WEIGHT_THEME.farmBorder }}
          >
            <p className="text-[10px] font-medium leading-tight" style={{ color: COW_WEIGHT_THEME.farmTextMuted }}>
              {minimumLabel(t("cowWeight.scan.minLiveWeight"))}
            </p>
            <p className="mt-1 text-base font-bold tabular-nums leading-none" style={cowWeightAccentStyle("farm")}>
              {minimumLiveWeightKg} kg
            </p>
          </div>
          <div
            className="rounded-lg border bg-white/70 px-2.5 py-2 shadow-sm"
            style={{ borderColor: COW_WEIGHT_THEME.farmBorder }}
          >
            <p className="text-[10px] font-medium leading-tight" style={{ color: COW_WEIGHT_THEME.farmTextMuted }}>
              {minimumLabel(t("cowWeight.scan.minEdibleMeat"))}
            </p>
            <p className="mt-1 text-base font-bold tabular-nums leading-none" style={cowWeightAccentStyle("farm")}>
              {minimumEdibleMeatKg} kg
            </p>
          </div>
        </div>
      )}

      {showMeat && (
        <div className="flex justify-between text-muted-foreground text-xs">
          <span>{t("cowWeight.edibleMeat")}</span>
          <span className="font-medium tabular-nums" style={cowWeightAccentStyle("farm")}>
            ~{metrics!.edibleMeatKg} kg
          </span>
        </div>
      )}

      {(showPlanDDistance || reserveDistanceSlot) && (
        <div
          className={`min-h-[5.25rem] space-y-1.5 pt-1 border-t ${
            showPlanDDistance ? "" : "border-transparent"
          }`}
          style={{ borderColor: COW_WEIGHT_THEME.farmBorder }}
        >
          {showPlanDDistance ? (
            <>
              <p className="text-[10px] font-medium text-muted-foreground">
                {t("cowWeight.scan.groundReferenceTitle")}
              </p>
              {detected ? (
                <>
                  <p className="text-sm font-semibold text-slate-900">
                    {t("cowWeight.scan.groundDistanceDetected").replace("{cm}", String(planDCm))}
                  </p>
                  {sourceLabel && (
                    <Badge variant="secondary" className="text-[10px] font-normal">
                      {sourceLabel}
                    </Badge>
                  )}
                  <p className="text-[10px] text-muted-foreground">{t("cowWeight.scan.distanceGridNote")}</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold" style={textStyle}>
                    {t("cowWeight.scan.groundDistanceFallback").replace("{cm}", String(planDCm))}
                  </p>
                  <p className="text-[10px]" style={{ color: mutedText, opacity: 0.9 }}>
                    {t("cowWeight.scan.groundDistanceFallbackHint")}
                  </p>
                </>
              )}
              {showStandoffMeters && (
                <p className="text-[11px] text-muted-foreground pt-0.5">
                  {t("cowWeight.scan.standoffSecondary")
                    .replace("{m}", String(standoff!.meters))
                    .replace("{min}", String(standoff!.recommendedBand.min))
                    .replace("{max}", String(standoff!.recommendedBand.max))}
                  {isStandoffInOptimalBand(standoff!.meters) && (
                    <Badge variant="outline" className="ml-2 text-[10px] py-0">
                      {t("cowWeight.scan.optimalDistance")}
                    </Badge>
                  )}
                </p>
              )}
              {detected && standoff?.focalLengthMm != null && standoff.focalLengthMm > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t("cowWeight.scan.lensExif").replace("{mm}", String(Math.round(standoff.focalLengthMm)))}
                </p>
              )}
            </>
          ) : assistLoading ? (
            <p className="text-sm text-muted-foreground animate-pulse">
              {t("cowWeight.scan.cameraDistanceLoading")}
            </p>
          ) : null}
        </div>
      )}

      {metrics?.scaleAdjustedForDistance && !isDetectStep && (
        <p className="text-[11px]" style={{ color: COW_WEIGHT_THEME.farmTextMuted }}>
          {t("cowWeight.scan.scaleDistanceAdjusted")}
        </p>
      )}

      {isDetectStep ? (
        <CowWeightGreenbondhuAlert />
      ) : (
        <p className="text-[10px] text-muted-foreground leading-snug">{t("cowWeight.scan.researchNote")}</p>
      )}
    </div>
  );
}
