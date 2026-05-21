import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { isLiveWeightPlausible, isStandoffInOptimalBand } from "@/lib/cowWeight/cowWeightResearch";
import { WEIGHT_FORMULA_DIVISOR } from "@/lib/cowWeight/scanMetrics";
import type { StandoffEstimate } from "@/lib/cowWeight/standoffEstimate";
import type { ScanMetrics } from "@/lib/cowWeight/types";

interface ScanLiveSummaryProps {
  metrics: ScanMetrics | null;
  standoff: StandoffEstimate | null;
  hasReference: boolean;
  step: number;
  assistLoading?: boolean;
  /** Step 1: weight frozen from initial lines (no standoff nudge). */
  detectLocked?: boolean;
}

export default function ScanLiveSummary({
  metrics,
  standoff,
  hasReference,
  step,
  assistLoading,
  detectLocked,
}: ScanLiveSummaryProps) {
  const { t } = useLanguage();

  const isPreview = step < 5;
  const showWeight = metrics && metrics.estimatedLiveWeightKg > 0;
  const showDistance = standoff && !hasReference && !assistLoading;
  const showMeat = !isPreview && showWeight;
  const weightLoading = assistLoading && step === 1 && !showWeight;
  const reserveDistanceSlot = step === 1 && !hasReference;

  return (
    <div
      className={`rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2 text-sm shrink-0 w-full ${
        detectLocked ? "min-h-[14rem]" : "min-h-[8rem]"
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {t("cowWeight.scan.liveSummaryTitle")}
      </p>

      <div className="min-h-[2.75rem] flex flex-col justify-center">
        {weightLoading && (
          <p className="text-sm text-muted-foreground animate-pulse">{t("cowWeight.scan.liveWeightCalculating")}</p>
        )}
        {showWeight && (
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-muted-foreground">
              {isPreview ? t("cowWeight.scan.liveWeightPreview") : t("cowWeight.liveWeight")}
            </span>
            <span
              className={`text-xl font-bold tabular-nums ${
                isLiveWeightPlausible(metrics!.estimatedLiveWeightKg) ? "text-primary" : "text-amber-800"
              }`}
            >
              ~{metrics!.estimatedLiveWeightKg} kg
            </span>
          </div>
        )}
      </div>

      {detectLocked && showWeight && (
        <>
          <p className="text-xs text-muted-foreground tabular-nums">
            {t("cowWeight.scan.strictDimensions")
              .replace("{chest}", String(metrics!.chestWidthCm))
              .replace("{length}", String(metrics!.bodyLengthCm))}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {t("cowWeight.scan.strictFormula").replace("{divisor}", String(WEIGHT_FORMULA_DIVISOR))}
          </p>
          <Badge variant="outline" className="text-[10px] font-normal">
            {t("cowWeight.scan.detectLockedHint")}
          </Badge>
        </>
      )}

      {showMeat && (
        <div className="flex justify-between text-muted-foreground text-xs">
          <span>{t("cowWeight.edibleMeat")}</span>
          <span className="font-medium tabular-nums">~{metrics!.edibleMeatKg} kg</span>
        </div>
      )}

      {(showDistance || reserveDistanceSlot) && (
        <div
          className={`min-h-[5.25rem] space-y-1 pt-1 border-t ${
            showDistance ? "border-primary/10" : "border-transparent"
          }`}
        >
          {showDistance ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted-foreground">{t("cowWeight.scan.cameraDistance")}</span>
                <span className="font-semibold tabular-nums">
                  ~{standoff!.meters} m
                  {isStandoffInOptimalBand(standoff!.meters) && (
                    <Badge variant="secondary" className="ml-2 text-[10px] py-0">
                      {t("cowWeight.scan.optimalDistance")}
                    </Badge>
                  )}
                </span>
              </div>
              {standoff!.focalLengthMm != null && standoff!.focalLengthMm > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t("cowWeight.scan.lensExif").replace("{mm}", String(Math.round(standoff.focalLengthMm)))}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground">
                {t("cowWeight.scan.recommendedDistance")
                  .replace("{min}", String(standoff.recommendedBand.min))
                  .replace("{max}", String(standoff.recommendedBand.max))}
              </p>
            </>
          ) : null}
        </div>
      )}

      {metrics?.scaleAdjustedForDistance && !detectLocked && (
        <p className="text-[11px] text-amber-800">{t("cowWeight.scan.scaleDistanceAdjusted")}</p>
      )}

      {!detectLocked && (
        <p className="text-[10px] text-muted-foreground leading-snug">{t("cowWeight.scan.researchNote")}</p>
      )}
    </div>
  );
}
