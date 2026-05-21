import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ArrowLeft, ArrowRight, Check, Loader2, RefreshCw } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import CowWeightOverlay from "@/components/cowWeight/CowWeightOverlay";
import ScanStepper from "@/components/cowWeight/ScanStepper";
import ScanDetailPanel from "@/components/cowWeight/ScanDetailPanel";
import ScanLiveSummary from "@/components/cowWeight/ScanLiveSummary";
import type { CowWeightResultState, CowWeightScanState } from "@/lib/cowWeight/navigation";
import type { PhotoExifMeta } from "@/lib/cowWeight/imageExif";
import type { CowKeypoints, CowLines, Point2D, ScanMetrics, ScanStepId } from "@/lib/cowWeight/types";
import { computeScanMetrics } from "@/lib/cowWeight/scanMetrics";
import {
  type CowFacing,
  photoOrientationI18nKey,
  reassignKeypointsForHeadSide,
  resolveStep1Keypoints,
} from "@/lib/cowWeight/cowKeypoints";
import { submitDetectionFeedback } from "@/lib/cowWeight/api";
import type { BBox, CowAnalysisResult } from "@/lib/cowWeight/types";
import { analyzeCowImageWithCloudDirection, repairBodyOutline } from "@/lib/cowWeight/analyzeCow";
import type { DirectionVerifySource } from "@/lib/cowWeight/directionMerge";
import { estimateCameraStandoff } from "@/lib/cowWeight/standoffEstimate";
import type { StandoffEstimate } from "@/lib/cowWeight/standoffEstimate";
import { directionSummaryI18nKeys } from "@/lib/cowWeight/cowDirection";
import { canonicalLinesFromAnalysis } from "@/lib/cowWeight/canonicalScanLines";
import { clampLinesToBBox } from "@/lib/cowWeight/proposeLines";
import { COW_WEIGHT_DETECTION_MODE, resolveDimensions, saveCowEstimation } from "@/lib/cowWeight/api";
import { compressDataUrl } from "@/lib/cowWeight/imageUtils";
import { isBboxRibbonOutline } from "@/lib/cowWeight/cowMask";
import { refineSegBodyOutlineFromImage } from "@/lib/cowWeight/yoloSegDetect";
import { toast } from "sonner";

function standoffFromPreappliedAnalysis(
  analysis: CowAnalysisResult,
  exif: { focalLengthMm?: number | null }
): StandoffEstimate {
  const vision =
    analysis.standoffSource === "vision" && analysis.standoffMeters != null
      ? { standoffDistanceM: analysis.standoffMeters, distanceConfidence: 0.8 }
      : undefined;
  return estimateCameraStandoff(analysis.bbox, analysis.imageHeight, vision, exif);
}

function stepI18nKey(s: ScanStepId, hasReference: boolean) {
  if (s === 4 && hasReference) return "step4c";
  if (s === 4) return "step4b";
  return `step${s}`;
}

export default function CowWeightScan() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as CowWeightScanState | null;

  const visionPreApplied = state?.analysis?.directionVerifySource != null;

  const [step, setStep] = useState<ScanStepId>(1);
  const [keypointsOverride, setKeypointsOverride] = useState<CowKeypoints | null>(null);
  const [lines, setLines] = useState<CowLines | null>(() =>
    state?.analysis?.lines && state.analysis.bbox
      ? canonicalLinesFromAnalysis(state.analysis)
      : (state?.analysis?.lines ?? null)
  );
  const [refTapMode, setRefTapMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveInFlight = useRef(false);
  const [bodyOutlineRepair, setBodyOutlineRepair] = useState<Point2D[] | undefined>();
  const [headBbox, setHeadBbox] = useState<BBox | null>(() => state?.analysis?.headBbox ?? null);
  const [analysisLive, setAnalysisLive] = useState<CowAnalysisResult | null>(
    () => state?.analysis ?? null
  );
  const [assistLoading, setAssistLoading] = useState(() => !visionPreApplied);
  const [assistApplied, setAssistApplied] = useState(
    () => state?.analysis?.visionAssistApplied ?? false
  );
  const [verifySource, setVerifySource] = useState<DirectionVerifySource | "pending">(
    () => state?.analysis?.directionVerifySource ?? "pending"
  );
  const [reanalyzing, setReanalyzing] = useState(false);
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [standoff, setStandoff] = useState<StandoffEstimate | null>(() => {
    if (!state?.analysis?.directionVerifySource) return null;
    return standoffFromPreappliedAnalysis(state.analysis, {
      focalLengthMm: state.exif?.focalLengthMm ?? null,
    });
  });
  const photoExif: PhotoExifMeta | null = state?.exif ?? null;
  const initialPrediction = useRef<{ headSide: string; facing: string | null } | null>(
    (() => {
      const kp = state?.analysis?.keypoints;
      if (!kp) return null;
      const localDir = kp.detected?.bodyDirection;
      return {
        headSide: localDir?.headSide ?? "unknown",
        facing: kp.detected?.facing ?? null,
      };
    })()
  );
  const detectPreviewMetricsRef = useRef<ScanMetrics | null>(null);
  const [detectPreviewMetrics, setDetectPreviewMetrics] = useState<ScanMetrics | null>(null);

  const mode = COW_WEIGHT_DETECTION_MODE;
  const hasReference = !!lines?.reference;

  const exifInput = useMemo(
    () => ({ focalLengthMm: photoExif?.focalLengthMm ?? null }),
    [photoExif?.focalLengthMm]
  );

  const stepLabels = useMemo(
    () => [
      t("cowWeight.scan.step1.short"),
      t("cowWeight.scan.step2.short"),
      t("cowWeight.scan.step3.short"),
      t("cowWeight.scan.step4b.short"),
      t("cowWeight.scan.step5.short"),
      t("cowWeight.scan.step6.short"),
    ],
    [t]
  );

  if (!state?.dataUrl || !analysisLive || !lines) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">{t("cowWeight.sessionExpired")}</p>
        <Button asChild className="mt-4">
          <Link to="/dashboard/cow-weight">{t("cowWeight.back")}</Link>
        </Button>
      </div>
    );
  }

  const { dataUrl } = state;
  const analysis = analysisLive;
  const overlayImageUrl = analysis.displayImageUrl ?? dataUrl;
  const effectiveBodyOutline = bodyOutlineRepair ?? analysis.bodyOutline;

  useEffect(() => {
    if (analysis.directionVerifySource != null) return;
    setStandoff(estimateCameraStandoff(analysis.bbox, analysis.imageHeight, undefined, exifInput));
  }, [analysis.bbox.height, analysis.bbox.width, analysis.directionVerifySource, analysis.imageHeight, exifInput]);

  useEffect(() => {
    const localBox =
      keypointsOverride?.detected?.bodyDirection?.headBbox ??
      analysis.headBbox ??
      analysis.keypoints?.detected?.bodyDirection?.headBbox ??
      null;
    setHeadBbox(localBox);
  }, [analysis.headBbox, analysis.keypoints, keypointsOverride]);

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

  useEffect(() => {
    if (!lines) return;
    if (detectPreviewMetricsRef.current) return;
    const snap = computeScanMetrics(mode, lines, analysis, null);
    detectPreviewMetricsRef.current = snap;
    setDetectPreviewMetrics(snap);
  }, [mode, lines, analysis]);

  const sk = stepI18nKey(step, hasReference);
  const liveMetrics = useMemo(
    () => computeScanMetrics(mode, lines, analysis, standoff?.meters),
    [mode, lines, analysis, standoff?.meters]
  );
  const summaryMetrics = step === 1 ? detectPreviewMetrics : liveMetrics;
  const metrics = step >= 2 ? liveMetrics : null;
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
    metrics.scaleMethod === "bbox_assumed_150cm" &&
    (metrics.chestWidthCm > 90 || metrics.bodyLengthCm > 120);
  const refTapIncomplete = refTapMode && !lines.reference;

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
    if (step === 4 && refTapIncomplete) return false;
    return step < 6;
  };

  const onNext = () => {
    if (step === 4 && refTapIncomplete) {
      toast.error(t("cowWeight.scan.step4c.needReference"));
      return;
    }
    // Step 1→2: keep canonical Detect `lines` for weight (see strictweight.md).
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
      const dims = resolveDimensions(lines, {
        ...analysis,
        standoffMeters: standoff?.meters ?? analysis.standoffMeters,
      });
      let filePayload: string | undefined;
      try {
        filePayload = await compressDataUrl(dataUrl);
      } catch {
        filePayload = dataUrl;
      }
      const row = await saveCowEstimation({
        detection_mode: COW_WEIGHT_DETECTION_MODE,
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
          scaleMethod: dims.scaleMethod,
          standoffMeters: standoff?.meters ?? null,
          standoffSource: standoff?.method ?? standoff?.source ?? null,
          standoffMethod: standoff?.method ?? null,
          focalLengthMm: standoff?.focalLengthMm ?? photoExif?.focalLengthMm ?? null,
          previewAtSave: liveMetrics
            ? {
                liveKg: liveMetrics.estimatedLiveWeightKg,
                chestCm: liveMetrics.chestWidthCm,
                lengthCm: liveMetrics.bodyLengthCm,
              }
            : null,
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

  const onKeypointsChange = (kp: CowKeypoints) => {
    setKeypointsOverride(kp);
    // Step 1: markers only; weight stays on canonical `lines` until chest/length steps.
  };

  const onHeadSideChange = (side: CowFacing) => {
    const base = keypointsOverride ?? analysis.keypoints;
    if (!base) return;
    setKeypointsOverride(reassignKeypointsForHeadSide(base, side));
  };

  const onReanalyze = async () => {
    setReanalyzing(true);
    try {
      setAssistLoading(true);
      setVerifySource("pending");
      const next = await analyzeCowImageWithCloudDirection(dataUrl, photoExif);
      setAnalysisLive(next);
      setKeypointsOverride(null);
      setBodyOutlineRepair(undefined);
      setHeadBbox(next.headBbox ?? null);
      setAssistApplied(next.visionAssistApplied ?? false);
      setVerifySource(next.directionVerifySource ?? "none");
      setStandoff(standoffFromPreappliedAnalysis(next, exifInput));
      initialPrediction.current = null;
      detectPreviewMetricsRef.current = null;
      setDetectPreviewMetrics(null);
      setStep(1);
      setLines(canonicalLinesFromAnalysis(next));
      navigate(location.pathname, { state: { mode, dataUrl, analysis: next, exif: photoExif }, replace: true });
      toast.success(t("cowWeight.scan.reanalyzeDone"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("cowWeight.analyzeFailed"));
    } finally {
      setAssistLoading(false);
      setReanalyzing(false);
    }
  };

  const onSaveDetectionFeedback = async () => {
    if (!facing) return;
    const pred = initialPrediction.current;
    const correctedSide = facing === "head_left" ? "left" : "right";
    const predictedSide = pred?.facing === "head_left" ? "left" : pred?.facing === "head_right" ? "right" : pred?.headSide;
    if (predictedSide === correctedSide) {
      toast.message(t("cowWeight.scan.feedbackNoChange"));
      return;
    }
    setFeedbackSaving(true);
    try {
      let filePayload: string | undefined;
      try {
        filePayload = await compressDataUrl(dataUrl);
      } catch {
        filePayload = dataUrl;
      }
      await submitDetectionFeedback({
        detection_mode: mode,
        corrected_head_side: correctedSide,
        predicted_head_side: predictedSide ?? null,
        predicted_facing: pred?.facing ?? null,
        predicted_head_bbox: bodyDirection?.headBbox ?? headBbox ?? null,
        local_model: analysis.model,
        vision_model: assistApplied ? "openrouter-vision" : null,
        annotation_json: {
          bbox: analysis.bbox,
          headBbox,
          imageWidth: analysis.imageWidth,
          imageHeight: analysis.imageHeight,
          keypoints: scanKeypoints,
          verifySource,
          standoff,
        },
        file_data: filePayload,
      });
      toast.success(t("cowWeight.scan.feedbackThanks"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("cowWeight.saveFailed"));
    } finally {
      setFeedbackSaving(false);
    }
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
    assistApplied && facing
      ? facing === "head_left"
        ? "cowWeight.scan.headOnPhotoLeft"
        : "cowWeight.scan.headOnPhotoRight"
      : directionNotDetected &&
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
        {step === 1 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            disabled={reanalyzing || assistLoading}
            onClick={() => void onReanalyze()}
          >
            {reanalyzing ? (
              <Loader2 className="h-3 w-3 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-3 w-3 mr-2" />
            )}
            {t("cowWeight.scan.reanalyze")}
          </Button>
        )}
        {assistLoading && (
          <p className="text-xs text-amber-900 flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t("cowWeight.scan.aiAssistLoading")}
          </p>
        )}
        {!assistLoading && verifySource === "vision" && (
          <p className="text-xs text-emerald-800 font-medium">{t("cowWeight.scan.cloudVerified")}</p>
        )}
        {!assistLoading && verifySource === "local" && (
          <p className="text-xs text-amber-800">{t("cowWeight.scan.localOnly")}</p>
        )}
        {standoff?.warningKey && !assistLoading && (
          <p className="text-xs text-orange-900 font-medium">{t(standoff.warningKey)}</p>
        )}
        {scanKeypoints && !scanKeypoints.detected?.legs && !assistLoading && (
          <p className="text-xs text-orange-800">{t("cowWeight.scan.legsUncertain")}</p>
        )}
        {scanKeypoints?.detected?.legsInferred && !assistLoading && (
          <p className="text-xs text-amber-800">{t("cowWeight.scan.legsInferred")}</p>
        )}
        {step === 1 && !analysis.model.includes("seg") && !assistLoading && (
          <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded px-2 py-1">
            {t("cowWeight.scan.segModelHint")}
          </p>
        )}
        {step === 1 && !assistLoading && (
          <p className="text-xs text-muted-foreground">{t("cowWeight.scan.dragKeypointsHint")}</p>
        )}
        {scanKeypoints &&
          (!scanKeypoints.detected?.topChest || !scanKeypoints.detected?.lowerChest) &&
          !assistLoading && (
            <p className="text-xs text-orange-800">{t("cowWeight.scan.chestUncertain")}</p>
          )}
        {directionNotDetected && directionKeys.issue && !assistLoading && (
          <p className="text-xs text-orange-900 font-medium">{t(directionKeys.issue)}</p>
        )}
        {aiSuggestionKey && !assistLoading && (
          <p className="text-xs text-amber-900/90">
            {assistApplied
              ? t("cowWeight.scan.aiAssistApplied")
              : t("cowWeight.scan.aiSuggestion")}
            : {t(aiSuggestionKey)}
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
        {facing && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-full"
            disabled={feedbackSaving}
            onClick={() => void onSaveDetectionFeedback()}
          >
            {feedbackSaving ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : null}
            {t("cowWeight.scan.saveCorrection")}
          </Button>
        )}
      </div>
    ) : null;

  const step4Extra =
    step === 4 ? (
      <div className="space-y-2">
        {hasReference ? (
          <Badge variant="outline" className="text-emerald-800 border-emerald-300 bg-emerald-50">
            {t("cowWeight.scan.step4.refActive")}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-amber-800 border-amber-300 bg-amber-50">
            {t("cowWeight.scan.step4b.lowAccuracy")}
          </Badge>
        )}
        {!hasReference && !refTapMode && (
          <Button type="button" variant="outline" className="w-full" onClick={() => setRefTapMode(true)}>
            {t("cowWeight.scan.step4.calibrateStick")}
          </Button>
        )}
        {!hasReference && (
          <p className="text-xs text-muted-foreground">{t("cowWeight.scan.step4.optionalRef")}</p>
        )}
      </div>
    ) : null;

  const step6Extra =
    step === 6 ? (
      <>
        {!hasReference && analysis.confidence < 0.55 && (
          <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">{t("cowWeight.lowConfidenceB")}</p>
        )}
        <p className="text-xs text-muted-foreground">{t("cowWeight.disclaimer")}</p>
      </>
    ) : null;

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/dashboard/cow-weight/upload">
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
            showReference={hasReference || refTapMode}
            editable={
              step === 1 || (step >= 2 && (step !== 4 || hasReference || refTapMode))
            }
            onKeypointsChange={onKeypointsChange}
            onLinesChange={setLinesClamped}
            onReferenceTapMode={refTapMode}
            onReferenceTap={onReferenceTap}
            orientationLabel={orientationLabel}
            headDirection={facing ? bodyDirection : null}
            headBbox={headBbox}
            bodyOutline={effectiveBodyOutline}
            outlineSourceLabel={outlineSourceLabel}
          />
        </div>

        <div className="space-y-3 min-w-0 lg:self-start">
          <ScanLiveSummary
            metrics={summaryMetrics}
            standoff={standoff}
            hasReference={hasReference}
            step={step}
            assistLoading={assistLoading}
            detectLocked={step === 1}
          />
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
          <Button disabled={saving || refTapIncomplete} onClick={() => void onConfirm()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
            {t("cowWeight.confirmEstimate")}
          </Button>
        )}
      </div>
    </div>
  );
}
