import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import CowWeightOverlay from "@/components/cowWeight/CowWeightOverlay";
import ScanStepper from "@/components/cowWeight/ScanStepper";
import ScanDetailPanel from "@/components/cowWeight/ScanDetailPanel";
import type { CowWeightResultState, CowWeightScanState } from "@/lib/cowWeight/navigation";
import type { CowKeypoints, CowLines, Point2D, ScanStepId } from "@/lib/cowWeight/types";
import { computeScanMetrics } from "@/lib/cowWeight/scanMetrics";
import {
  type CowFacing,
  photoOrientationI18nKey,
  reassignKeypointsForHeadSide,
  resolveStep1Keypoints,
} from "@/lib/cowWeight/cowKeypoints";
import { directionSummaryI18nKeys } from "@/lib/cowWeight/cowDirection";
import {
  clampLinesToBBox,
  proposeChestFromBBox,
  proposeLinesFromBBox,
  shouldReproposeChest,
} from "@/lib/cowWeight/proposeLines";
import { resolveDimensions, saveCowEstimation } from "@/lib/cowWeight/api";
import { compressDataUrl } from "@/lib/cowWeight/imageUtils";
import { repairBodyOutline } from "@/lib/cowWeight/analyzeCow";
import { isBboxRibbonOutline } from "@/lib/cowWeight/cowMask";
import { refineSegBodyOutlineFromImage } from "@/lib/cowWeight/yoloSegDetect";
import type { Point2D } from "@/lib/cowWeight/types";
import { toast } from "sonner";

function stepI18nKey(s: ScanStepId, mode: "plan_b" | "plan_c") {
  if (s === 4) return mode === "plan_c" ? "step4c" : "step4b";
  return `step${s}`;
}

export default function CowWeightScan() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as CowWeightScanState | null;

  const [step, setStep] = useState<ScanStepId>(1);
  const [keypointsOverride, setKeypointsOverride] = useState<CowKeypoints | null>(null);
  const [lines, setLines] = useState<CowLines | null>(() => {
    if (!state?.analysis?.lines || !state.analysis.bbox) return state?.analysis?.lines ?? null;
    let initial = clampLinesToBBox(state.analysis.lines, state.analysis.bbox);
    if (
      shouldReproposeChest(
        initial.chest,
        state.analysis.bbox,
        state.analysis.legCenters,
        state.analysis.keypoints
      )
    ) {
      initial = {
        ...initial,
        chest: proposeChestFromBBox(state.analysis.bbox, state.analysis.keypoints ?? state.analysis.legCenters),
      };
    }
    return initial;
  });
  const [refTapMode, setRefTapMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveInFlight = useRef(false);
  const [bodyOutlineRepair, setBodyOutlineRepair] = useState<Point2D[] | undefined>();

  const mode = state?.mode ?? "plan_b";

  const stepLabels = useMemo(
    () => [
      t("cowWeight.scan.step1.short"),
      t("cowWeight.scan.step2.short"),
      t("cowWeight.scan.step3.short"),
      mode === "plan_c" ? t("cowWeight.scan.step4c.short") : t("cowWeight.scan.step4b.short"),
      t("cowWeight.scan.step5.short"),
      t("cowWeight.scan.step6.short"),
    ],
    [t, mode]
  );

  if (!state?.dataUrl || !state.analysis || !lines) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">{t("cowWeight.sessionExpired")}</p>
        <Button asChild className="mt-4">
          <Link to="/dashboard/cow-weight">{t("cowWeight.back")}</Link>
        </Button>
      </div>
    );
  }

  const { dataUrl, analysis } = state;
  const overlayImageUrl = analysis.displayImageUrl ?? dataUrl;
  const effectiveBodyOutline = bodyOutlineRepair ?? analysis.bodyOutline;

  useEffect(() => {
    let cancelled = false;
    const outlineBad =
      !analysis.bodyOutline?.length ||
      isBboxRibbonOutline(analysis.bodyOutline, analysis.bbox);

    (async () => {
      if (analysis.model.includes("seg")) {
        const seg = await refineSegBodyOutlineFromImage(
          overlayImageUrl,
          analysis.imageWidth,
          analysis.imageHeight
        );
        if (!cancelled && seg?.bodyOutline.length) {
          setBodyOutlineRepair(seg.bodyOutline);
          return;
        }
      }

      if (!outlineBad && analysis.bodyOutline) {
        setBodyOutlineRepair(analysis.bodyOutline);
        return;
      }

      const outline = await repairBodyOutline(
        overlayImageUrl,
        analysis.imageWidth,
        analysis.imageHeight,
        analysis.bbox
      );
      if (!cancelled && outline?.length) setBodyOutlineRepair(outline);
    })();

    return () => {
      cancelled = true;
    };
  }, [analysis.bodyOutline, analysis.bbox, analysis.imageHeight, analysis.imageWidth, analysis.model, overlayImageUrl]);
  const sk = stepI18nKey(step, mode);
  const metrics = step >= 2 ? computeScanMetrics(mode, lines, analysis) : null;
  const showMetricsPanel = step >= 5;
  const pixelsOnly = step === 2 || step === 3;
  const pixelsField = step === 2 ? "chest" : step === 3 ? "length" : "both";
  const unusualMeasurements =
    metrics &&
    step >= 5 &&
    (metrics.chestWidthCm < 35 ||
      metrics.chestWidthCm > 85 ||
      metrics.bodyLengthCm < 70 ||
      metrics.bodyLengthCm > 200);

  const unusualMeasurementsStrong =
    metrics &&
    step >= 5 &&
    mode === "plan_b" &&
    (metrics.chestWidthCm > 90 || metrics.bodyLengthCm > 120);
  const needsRefTap = mode === "plan_c" && !analysis.cmPerPixel && !lines.reference;

  const panelTitle = t(`cowWeight.scan.${sk}.title`);
  const panelDesc = t(`cowWeight.scan.${sk}.desc`);
  const panelMistakes = t(`cowWeight.scan.${sk}.mistakes`);

  const onReferenceTap = (a: Point2D, b: Point2D) => {
    setLines((prev) =>
      prev ? clampLinesToBBox({ ...prev, reference: { a, b } }, analysis.bbox) : prev
    );
    setRefTapMode(false);
    toast.success(t("cowWeight.referenceSet"));
  };

  const setLinesClamped = (next: CowLines) => {
    setLines(clampLinesToBBox(next, analysis.bbox));
  };

  const canNext = (): boolean => {
    if (step === 1) {
      const kp = keypointsOverride ?? analysis.keypoints;
      if (!kp?.detected?.facing) return false;
    }
    if (step === 4 && mode === "plan_c" && needsRefTap && !lines.reference) return false;
    return step < 6;
  };

  const onNext = () => {
    if (step === 4 && mode === "plan_c" && needsRefTap && !lines.reference) {
      toast.error(t("cowWeight.scan.step4c.needReference"));
      return;
    }
    if (step === 1) {
      const scanKeypoints = keypointsOverride ?? analysis.keypoints;
      const kp = scanKeypoints ?? analysis.legCenters;
      setLines((prev) =>
        prev
          ? clampLinesToBBox(
              scanKeypoints
                ? proposeLinesFromBBox(analysis.bbox, scanKeypoints)
                : { ...prev, chest: proposeChestFromBBox(analysis.bbox, kp) },
              analysis.bbox
            )
          : prev
      );
    }
    if (step < 6) setStep((step + 1) as ScanStepId);
  };

  const onBack = () => {
    if (step > 1) {
      setRefTapMode(false);
      setStep((step - 1) as ScanStepId);
    }
  };

  const onConfirm = async () => {
    if (saveInFlight.current) return;
    saveInFlight.current = true;
    setSaving(true);
    try {
      const dims = resolveDimensions(mode, lines, analysis);
      let filePayload: string | undefined;
      try {
        filePayload = await compressDataUrl(dataUrl);
      } catch {
        filePayload = dataUrl;
      }
      const row = await saveCowEstimation({
        detection_mode: mode,
        chest_width_cm: dims.chest_width_cm,
        body_length_cm: dims.body_length_cm,
        confidence: dims.confidence,
        file_data: filePayload,
        annotation_json: {
          bbox: analysis.bbox,
          lines,
          model: analysis.model,
          imageWidth: analysis.imageWidth,
          imageHeight: analysis.imageHeight,
          scanWizard: true,
        },
      });
      const next: CowWeightResultState = { estimation: row, mode };
      navigate("/dashboard/cow-weight/result", { state: next });
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("cowWeight.saveFailed");
      toast.error(msg);
      if (msg.toLowerCase().includes("sign in") || msg.toLowerCase().includes("session")) {
        navigate("/login", { replace: true, state: { from: location.pathname } });
      }
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  };

  const panelMetrics =
    showMetricsPanel
      ? metrics
      : step === 4 && metrics
        ? { ...metrics, estimatedLiveWeightKg: 0, edibleMeatKg: 0 }
        : pixelsOnly && metrics
          ? { ...metrics, estimatedLiveWeightKg: 0, edibleMeatKg: 0, chestWidthCm: 0, bodyLengthCm: 0, cmPerPixel: 0 }
          : null;

  const scanKeypoints = keypointsOverride ?? analysis.keypoints;
  const facing = scanKeypoints?.detected?.facing;

  const onHeadSideChange = (side: CowFacing) => {
    const base = keypointsOverride ?? analysis.keypoints;
    if (!base) return;
    const kp = reassignKeypointsForHeadSide(base, side);
    setKeypointsOverride(kp);
    setLines((prev) =>
      prev
        ? clampLinesToBBox({ ...prev, length: { a: { ...kp.l1 }, b: { ...kp.l2 } } }, analysis.bbox)
        : prev
    );
  };
  const bodyDirection = scanKeypoints?.detected?.bodyDirection;
  const directionNotDetected =
    !facing ||
    !bodyDirection ||
    bodyDirection.headSide === "unknown" ||
    !!bodyDirection.directionIssueKey;

  const directionKeys = directionSummaryI18nKeys(bodyDirection);
  const orientationI18nKey = photoOrientationI18nKey(facing);
  const orientationLabel = orientationI18nKey ? t(orientationI18nKey) : null;

  const outlineSourceLabel =
    effectiveBodyOutline && effectiveBodyOutline.length >= 3
      ? analysis.model.includes("seg")
        ? t("cowWeight.scan.outlineSeg")
        : t("cowWeight.scan.outlineEstimated")
      : null;
  const aiSuggestionKey =
    directionNotDetected &&
    bodyDirection &&
    bodyDirection.headSide !== "unknown"
      ? bodyDirection.headSide === "left"
        ? "cowWeight.scan.headOnPhotoLeft"
        : "cowWeight.scan.headOnPhotoRight"
      : null;

  const step1OrientationExtra =
    step === 1 && scanKeypoints ? (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-2 text-sm">
        <div className="flex flex-wrap justify-between gap-2 items-center">
          <span className="text-muted-foreground font-medium">{t("cowWeight.scan.orientationLabel")}</span>
          <div className="flex flex-wrap gap-1 justify-end">
            {directionNotDetected ? (
              <Badge variant="secondary" className="bg-orange-200 text-orange-950 hover:bg-orange-200">
                {t("cowWeight.scan.notDetected")}
              </Badge>
            ) : (
              <>
                {orientationLabel && (
                  <Badge variant="secondary" className="bg-amber-200 text-amber-950 hover:bg-amber-200">
                    {orientationLabel}
                  </Badge>
                )}
                {directionKeys.direction && (
                  <Badge
                    variant="secondary"
                    className={
                      bodyDirection?.isReversed
                        ? "bg-orange-200 text-orange-950 hover:bg-orange-200"
                        : "bg-emerald-200 text-emerald-950 hover:bg-emerald-200"
                    }
                  >
                    {t(directionKeys.direction)}
                  </Badge>
                )}
              </>
            )}
          </div>
        </div>
        {directionNotDetected && directionKeys.issue && (
          <p className="text-xs text-orange-900 font-medium">{t(directionKeys.issue)}</p>
        )}
        {aiSuggestionKey && (
          <p className="text-xs text-amber-900/90">
            {t("cowWeight.scan.aiSuggestion")}: {t(aiSuggestionKey)}
          </p>
        )}
        {!directionNotDetected && directionKeys.head && directionKeys.tail && (
          <p className="text-xs text-amber-900/80">
            {t(directionKeys.head)} · {t(directionKeys.tail)} · L1={t("cowWeight.scan.l1Tail")} · L2=
            {t("cowWeight.scan.l2Head")}
          </p>
        )}
        {directionKeys.sourceHint && !directionNotDetected && (
          <p className="text-xs text-amber-800/90">{t(directionKeys.sourceHint)}</p>
        )}
        {directionNotDetected && (
          <p className="text-xs text-orange-800">{t("cowWeight.scan.directionUnknownHint")}</p>
        )}
        <ToggleGroup
          type="single"
          value={facing ?? ""}
          onValueChange={(v) => {
            if (v === "head_left" || v === "head_right") onHeadSideChange(v);
          }}
          className="w-full grid grid-cols-2 gap-1"
        >
          <ToggleGroupItem value="head_left" className="flex-1 text-xs sm:text-sm">
            {t("cowWeight.scan.headLeft")}
          </ToggleGroupItem>
          <ToggleGroupItem value="head_right" className="flex-1 text-xs sm:text-sm">
            {t("cowWeight.scan.headRight")}
          </ToggleGroupItem>
        </ToggleGroup>
        <p className="text-xs text-muted-foreground">{t("cowWeight.scan.headSideHint")}</p>
      </div>
    ) : null;

  const step4Extra =
    step === 4 && mode === "plan_b" ? (
      <Badge variant="outline" className="text-amber-800 border-amber-300 bg-amber-50">
        {t("cowWeight.scan.step4b.lowAccuracy")}
      </Badge>
    ) : step === 4 && mode === "plan_c" && needsRefTap && !refTapMode ? (
      <Button type="button" variant="outline" className="w-full" onClick={() => setRefTapMode(true)}>
        {t("cowWeight.tapReference")}
      </Button>
    ) : null;

  const step6Extra =
    step === 6 ? (
      <>
        {mode === "plan_b" && analysis.confidence < 0.55 && (
          <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">{t("cowWeight.lowConfidenceB")}</p>
        )}
        <p className="text-xs text-muted-foreground">{t("cowWeight.disclaimer")}</p>
      </>
    ) : null;

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <Button variant="ghost" size="sm" asChild>
        <Link to={`/dashboard/cow-weight/upload?mode=${mode}`}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t("cowWeight.retake")}
        </Link>
      </Button>

      <ScanStepper current={step} labels={stepLabels} />

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="min-w-0 w-full min-h-[320px]">
          <CowWeightOverlay
            imageUrl={overlayImageUrl}
            imageWidth={analysis.imageWidth}
            imageHeight={analysis.imageHeight}
            bbox={analysis.bbox}
            lines={lines}
            keypoints={resolveStep1Keypoints(scanKeypoints, lines, analysis.bbox)}
            mode={mode}
            activeStep={step}
            showReference={mode === "plan_c"}
            editable={step >= 2 && (step !== 4 || mode === "plan_c")}
            onLinesChange={setLinesClamped}
            onReferenceTapMode={refTapMode}
            onReferenceTap={onReferenceTap}
            orientationLabel={orientationLabel}
            headDirection={facing ? bodyDirection : null}
            bodyOutline={effectiveBodyOutline}
            outlineSourceLabel={outlineSourceLabel}
          />
        </div>

        <ScanDetailPanel
          title={panelTitle}
          description={panelDesc}
          mistakes={panelMistakes || undefined}
          metrics={panelMetrics}
          pixelsOnly={pixelsOnly}
          pixelsField={pixelsField}
          bbox={step === 1 ? analysis.bbox : undefined}
          model={step === 1 ? analysis.model : undefined}
          bboxHeightPx={analysis.bbox.height}
          bboxWidthPx={analysis.bbox.width}
          showScaleFormulas={step >= 4 && !!panelMetrics}
          extra={
            <>
              {step1OrientationExtra}
              {unusualMeasurementsStrong && (
                <p className="text-xs text-amber-900 bg-amber-100 border border-amber-300 rounded px-2 py-1.5 font-medium">
                  {t("cowWeight.scan.unusualMeasurementsStrong")}
                </p>
              )}
              {unusualMeasurements && !unusualMeasurementsStrong && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                  {t("cowWeight.scan.unusualMeasurements")}
                </p>
              )}
              {step4Extra}
              {step6Extra}
            </>
          }
        />
      </div>

      <div className="flex gap-2 justify-between sticky bottom-0 bg-background/95 py-2 border-t">
        <Button variant="outline" disabled={step === 1} onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t("cowWeight.scan.back")}
        </Button>

        {step < 6 ? (
          <Button disabled={!canNext()} onClick={onNext}>
            {t("cowWeight.scan.next")}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button disabled={saving || (mode === "plan_c" && needsRefTap && !lines.reference)} onClick={() => void onConfirm()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
            {t("cowWeight.confirmEstimate")}
          </Button>
        )}
      </div>
    </div>
  );
}
