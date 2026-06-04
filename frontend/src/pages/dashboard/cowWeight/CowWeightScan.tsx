import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import CowWeightHeadSidePanel from "@/components/cowWeight/CowWeightHeadSidePanel";
import { ArrowLeft, ArrowRight, Check, Loader2, RefreshCw } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import CameraDistanceBar from "@/components/cowWeight/CameraDistanceBar";
import CowWeightOverlay from "@/components/cowWeight/CowWeightOverlay";
import ScanStepper from "@/components/cowWeight/ScanStepper";
import ScanCalculationBreakdown from "@/components/cowWeight/ScanCalculationBreakdown";
import ScanDetailPanel from "@/components/cowWeight/ScanDetailPanel";
import ScanLiveSummary from "@/components/cowWeight/ScanLiveSummary";
import type { CowWeightResultState, CowWeightScanState } from "@/lib/cowWeight/navigation";
import type { PhotoExifMeta } from "@/lib/cowWeight/imageExif";
import type { CowKeypoints, CowLines, Point2D, ScanMetrics, ScanStepId } from "@/lib/cowWeight/types";
import { DEFAULT_CAMERA_DISTANCE_CM } from "@/lib/cowWeight/geometry3d";
import { computeScanMetrics } from "@/lib/cowWeight/scanMetrics";
import {
  type CowFacing,
  photoOrientationI18nKey,
  reassignKeypointsForHeadSide,
  resolveStep1Keypoints,
  syncChestKeypointsFromLines,
  syncLengthKeypointsFromLines,
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
import CowWeightPageShell from "@/components/cowWeight/CowWeightPageShell";
import CowWeightDisclaimer from "@/components/cowWeight/CowWeightDisclaimer";
import CowWeightCallout from "@/components/cowWeight/CowWeightCallout";
import CowWeightCowNameField from "@/components/cowWeight/CowWeightCowNameField";
import {
  cowWeightCalloutBadgeOutline,
  cowWeightCalloutBadgeOutlineStyle,
  cowWeightCalloutBox,
  cowWeightCalloutBoxStyle,
  cowWeightCalloutHint,
  cowWeightCalloutHintStyle,
  cowWeightCalloutInline,
  cowWeightCalloutInlineStyle,
  cowWeightCalloutMuted,
  cowWeightCalloutMutedSoft,
  cowWeightCalloutMutedSoftStyle,
  cowWeightCalloutMutedStyle,
  cowWeightCalloutPanel,
  cowWeightCalloutPanelStrong,
  cowWeightCalloutPanelStrongStyle,
  cowWeightCalloutPanelStyle,
  cowWeightCalloutStrong,
  cowWeightCalloutStrongStyle,
} from "@/components/cowWeight/cowWeightCalloutStyles";
import {
  cowWeightBackLinkClass,
  cowWeightBackLinkStyle,
  cowWeightOutlineButtonClass,
  cowWeightOutlineButtonStyle,
  cowWeightPrimaryButtonClass,
  cowWeightPrimaryButtonStyle,
} from "@/lib/cowWeight/cowWeightTheme";
import { useCowWeightPaths } from "@/lib/cowWeight/cowWeightPaths";

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
  const paths = useCowWeightPaths();
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
  const [cowName, setCowName] = useState("");
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
  const detectLinesRef = useRef<CowLines | null>(null);
  const chestKpSyncedRef = useRef(false);

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
        <Button asChild className={cn("mt-4", cowWeightPrimaryButtonClass)} style={cowWeightPrimaryButtonStyle}>
          <Link to={paths.hub}>{t("cowWeight.back")}</Link>
        </Button>
      </div>
    );
  }

  const { dataUrl } = state;
  const analysis = analysisLive;
  const overlayImageUrl = analysis.displayImageUrl ?? dataUrl;
  const effectiveBodyOutline = bodyOutlineRepair ?? analysis.bodyOutline;

  useEffect(() => {
    if (analysis.directionVerifySource != null) {
      setAssistLoading(false);
      return;
    }
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
    if (!lines || !analysis.keypoints || chestKpSyncedRef.current || keypointsOverride) return;
    chestKpSyncedRef.current = true;
    let kp = syncChestKeypointsFromLines(analysis.keypoints, lines.chest);
    kp = syncLengthKeypointsFromLines(kp, lines.length);
    setKeypointsOverride(kp);
  }, [analysis.keypoints, keypointsOverride, lines]);

  useEffect(() => {
    if (!lines) return;
    if (detectLinesRef.current) return;
    detectLinesRef.current = {
      chest: { a: { ...lines.chest.a }, b: { ...lines.chest.b } },
      length: { a: { ...lines.length.a }, b: { ...lines.length.b } },
      reference: lines.reference
        ? { a: { ...lines.reference.a }, b: { ...lines.reference.b } }
        : undefined,
    };
  }, [lines]);

  const sk = stepI18nKey(step, hasReference);
  const liveMetrics = useMemo(
    () => computeScanMetrics(mode, lines, analysis, standoff?.meters),
    [mode, lines, analysis, standoff?.meters]
  );
  const metrics = step >= 2 ? liveMetrics : null;
  const auditMetrics = liveMetrics;
  const detectLinesSnapshot = step >= 2 ? detectLinesRef.current : null;

  const cameraBarMetrics = liveMetrics;
  const groundDistanceDetected =
    analysis.planD?.groundDistanceDetected ??
    cameraBarMetrics?.groundDistanceDetected ??
    true;
  const cameraDistanceDisplayCm = groundDistanceDetected
    ? (cameraBarMetrics?.cameraDistanceCm ??
      analysis.planD?.cameraDistanceCm ??
      DEFAULT_CAMERA_DISTANCE_CM)
    : DEFAULT_CAMERA_DISTANCE_CM;
  const cameraDistanceSource = groundDistanceDetected
    ? (analysis.planD?.distanceSource ?? cameraBarMetrics?.distanceSource ?? "local")
    : "fallback_average";
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
    metrics.scaleMethod === "plan_d_pinhole" &&
    (metrics.chestWidthCm > 90 || metrics.bodyLengthCm > 120);
  const refTapIncomplete = refTapMode && !lines.reference;

  const panelTitle = t(`cowWeight.scan.${sk}.title`);
  const panelDesc = t(`cowWeight.scan.${sk}.desc`);
  const panelMistakes = t(`cowWeight.scan.${sk}.mistakes`);

  const onReferenceTap = (a: Point2D, b: Point2D) => {
    const clampFacing =
      (keypointsOverride ?? analysis.keypoints)?.detected?.facing ?? null;
    setLines((prev) =>
      prev
        ? clampLinesToBBox(
            { ...prev, reference: { a, b } },
            analysis.bbox,
            clampFacing
          )
        : prev
    );
    setRefTapMode(false);
    toast.success(t("cowWeight.referenceSet"));
  };

  const setLinesClamped = (next: CowLines) => {
    const clampFacing =
      (keypointsOverride ?? analysis.keypoints)?.detected?.facing ?? null;
    const clamped = clampLinesToBBox(next, analysis.bbox, clampFacing);
    setLines(clamped);
    if (step === 1) {
      const base = keypointsOverride ?? analysis.keypoints;
      if (base) {
        let kp = syncChestKeypointsFromLines(base, clamped.chest);
        kp = syncLengthKeypointsFromLines(kp, clamped.length);
        setKeypointsOverride(kp);
      }
    }
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
        cow_name: cowName.trim() || undefined,
        file_data: filePayload,
        annotation_json: {
          bbox: analysis.bbox,
          lines,
          model: analysis.model,
          imageWidth: analysis.imageWidth,
          imageHeight: analysis.imageHeight,
          scanWizard: true,
          scaleMethod: dims.scaleMethod,
          planD: analysis.planD ?? null,
          cameraDistanceCm: liveMetrics?.cameraDistanceCm ?? analysis.planD?.cameraDistanceCm ?? null,
          groundDistanceDetected:
            analysis.planD?.groundDistanceDetected ?? liveMetrics?.groundDistanceDetected ?? null,
          distanceSource: analysis.planD?.distanceSource ?? liveMetrics?.distanceSource ?? null,
          cloudPriorCm: analysis.planD?.cloudPriorCm ?? null,
          localPriorCm: analysis.planD?.localPriorCm ?? null,
          r1: liveMetrics?.r1 ?? null,
          r2: liveMetrics?.r2 ?? null,
          bodyHeightCm: liveMetrics?.bodyHeightCm ?? null,
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
      navigate(paths.result, { state: next });
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
    const kp = reassignKeypointsForHeadSide(base, side);
    setKeypointsOverride(kp);
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
      detectLinesRef.current = null;
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
  const headDirectionSourceLabel =
    verifySource === "vision"
      ? t("cowWeight.scan.distanceSourceCloud")
      : verifySource === "local"
        ? t("cowWeight.scan.distanceSourceLocal")
        : null;
  const distanceSourceLabel =
    cameraDistanceSource === "cloud"
      ? t("cowWeight.scan.distanceSourceCloud")
      : cameraDistanceSource === "blended"
        ? t("cowWeight.scan.distanceSourceBlended")
        : t("cowWeight.scan.distanceSourceLocal");
  const orientationSourceLabel =
    headDirectionSourceLabel && distanceSourceLabel
      ? headDirectionSourceLabel === distanceSourceLabel
        ? headDirectionSourceLabel
        : `${headDirectionSourceLabel} + ${distanceSourceLabel}`
      : (headDirectionSourceLabel ?? distanceSourceLabel);

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
      <div className="space-y-2">
        {directionNotDetected && (
          <CowWeightHeadSidePanel
            value={facing}
            onChange={onHeadSideChange}
            notDetected
          />
        )}
        {directionNotDetected && facing && (
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
        <div className={cowWeightCalloutBox} style={cowWeightCalloutBoxStyle}>
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
          <p className={`${cowWeightCalloutStrong} flex items-center gap-1`} style={cowWeightCalloutStrongStyle}>
            <Loader2 className="h-3 w-3 animate-spin" />
            {t("cowWeight.scan.aiAssistLoading")}
          </p>
        )}
        {!assistLoading && verifySource === "vision" && (
          <p className="text-xs font-medium" style={cowWeightCalloutInlineStyle}>{t("cowWeight.scan.cloudVerified")}</p>
        )}
        {!assistLoading && verifySource === "local" && (
          <p className={cowWeightCalloutInline} style={cowWeightCalloutInlineStyle}>{t("cowWeight.scan.localOnly")}</p>
        )}
        {standoff?.warningKey && !assistLoading && (
          <p className={cowWeightCalloutStrong} style={cowWeightCalloutStrongStyle}>{t(standoff.warningKey)}</p>
        )}
        {scanKeypoints && !scanKeypoints.detected?.legs && !assistLoading && (
          <p className={cowWeightCalloutInline} style={cowWeightCalloutInlineStyle}>{t("cowWeight.scan.legsUncertain")}</p>
        )}
        {scanKeypoints?.detected?.legsInferred && !assistLoading && (
          <p className={cowWeightCalloutInline} style={cowWeightCalloutInlineStyle}>{t("cowWeight.scan.legsInferred")}</p>
        )}
        {step === 1 && !analysis.model.includes("seg") && !assistLoading && (
          <p className={cowWeightCalloutPanel} style={cowWeightCalloutPanelStyle}>{t("cowWeight.scan.segModelHint")}</p>
        )}
        {step === 1 && !assistLoading && (
          <p className="text-xs text-muted-foreground">{t("cowWeight.scan.dragKeypointsHint")}</p>
        )}
        {step === 1 && scanKeypoints && !assistLoading && (
          <div className="rounded border border-slate-200 bg-white/90 p-2 space-y-0.5 text-[11px] font-mono text-slate-800">
            <p className="font-semibold text-slate-700">{t("cowWeight.scan.detectedPointsTitle")}</p>
            <p>
              {t("cowWeight.scan.frontLegShort")} ({Math.round(scanKeypoints.leg1.x)},{" "}
              {Math.round(scanKeypoints.leg1.y)})
            </p>
            <p>
              {t("cowWeight.scan.hindLegShort")} ({Math.round(scanKeypoints.leg2.x)},{" "}
              {Math.round(scanKeypoints.leg2.y)})
            </p>
            <p>
              {t("cowWeight.scan.chestCh1")} ({Math.round(lines.chest.a.x)},{" "}
              {Math.round(lines.chest.a.y)})
            </p>
            <p>
              {t("cowWeight.scan.chestCh2")} ({Math.round(lines.chest.b.x)},{" "}
              {Math.round(lines.chest.b.y)})
            </p>
            <p>
              {t("cowWeight.scan.lengthC1Shoulder")} ({Math.round(lines.length.a.x)},{" "}
              {Math.round(lines.length.a.y)})
            </p>
            <p>
              {t("cowWeight.scan.lengthC2Rear")} ({Math.round(lines.length.b.x)},{" "}
              {Math.round(lines.length.b.y)})
            </p>
          </div>
        )}
        {scanKeypoints &&
          (!scanKeypoints.detected?.topChest || !scanKeypoints.detected?.lowerChest) &&
          !assistLoading && (
            <p className={cowWeightCalloutInline} style={cowWeightCalloutInlineStyle}>{t("cowWeight.scan.chestUncertain")}</p>
          )}
        {directionNotDetected && directionKeys.issue && !assistLoading && (
          <p className={cowWeightCalloutStrong} style={cowWeightCalloutStrongStyle}>{t(directionKeys.issue)}</p>
        )}
        {aiSuggestionKey && !assistLoading && (
          <p className={cowWeightCalloutMuted} style={cowWeightCalloutMutedStyle}>
            {assistApplied
              ? t("cowWeight.scan.aiAssistApplied")
              : t("cowWeight.scan.aiSuggestion")}
            : {t(aiSuggestionKey)}
          </p>
        )}
        {!directionNotDetected && directionKeys.head && directionKeys.tail && (
          <p className={cowWeightCalloutMutedSoft} style={cowWeightCalloutMutedSoftStyle}>
            {t(directionKeys.head)} · {t(directionKeys.tail)} · L1={t("cowWeight.scan.l1Tail")} · L2=
            {t("cowWeight.scan.l2Head")}
          </p>
        )}
        {directionKeys.sourceHint && !directionNotDetected && (
          <p className={cowWeightCalloutHint} style={cowWeightCalloutHintStyle}>{t(directionKeys.sourceHint)}</p>
        )}
        {directionNotDetected && (
          <p className={cowWeightCalloutInline} style={cowWeightCalloutInlineStyle}>{t("cowWeight.scan.directionUnknownHint")}</p>
        )}
        </div>
      </div>
    ) : null;

  const step4Extra =
    step === 4 ? (
      <div className="space-y-2">
        {hasReference ? (
          <Badge variant="outline" className={cowWeightCalloutBadgeOutline} style={cowWeightCalloutBadgeOutlineStyle}>
            {t("cowWeight.scan.step4.refActive")}
          </Badge>
        ) : (
          <Badge variant="outline" className={cowWeightCalloutBadgeOutline} style={cowWeightCalloutBadgeOutlineStyle}>
            {t("cowWeight.scan.step4b.lowAccuracy")}
          </Badge>
        )}
        {!hasReference && !refTapMode && (
          <Button
            type="button"
            variant="outline"
            className={cn("w-full", cowWeightOutlineButtonClass)}
            style={cowWeightOutlineButtonStyle}
            onClick={() => setRefTapMode(true)}
          >
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
          <CowWeightCallout className="rounded-lg">{t("cowWeight.lowConfidenceB")}</CowWeightCallout>
        )}
        <CowWeightDisclaimer />
      </>
    ) : null;

  return (
    <CowWeightPageShell className="space-y-4">
      <Button variant="ghost" size="sm" asChild className={cowWeightBackLinkClass} style={cowWeightBackLinkStyle}>
        <Link to={paths.upload}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t("cowWeight.retake")}
        </Link>
      </Button>

      <ScanStepper current={step} labels={stepLabels} />

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="min-w-0 w-full min-h-[320px] flex flex-col">
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
            cameraDistanceCm={cameraDistanceDisplayCm}
            groundDistanceDetected={groundDistanceDetected}
            showGroundDistanceLabel={step >= 1}
          />
          {step >= 1 && (
            <CameraDistanceBar
              cameraDistanceCm={cameraDistanceDisplayCm}
              distanceSource={cameraDistanceSource}
              sourceSummaryLabel={orientationSourceLabel}
              groundDistanceDetected={groundDistanceDetected}
              loading={assistLoading && step === 1}
            />
          )}
        </div>

        <div className="space-y-3 min-w-0 lg:self-start">
          <ScanLiveSummary
            metrics={liveMetrics}
            standoff={standoff}
            hasReference={hasReference}
            step={step}
            assistLoading={assistLoading}
            cameraDistanceCm={cameraDistanceDisplayCm}
            distanceSource={cameraDistanceSource}
            groundDistanceDetected={groundDistanceDetected}
          />
          {lines && auditMetrics && (
            <ScanCalculationBreakdown
              metrics={auditMetrics}
              imageWidthPx={analysis.imageWidth}
              imageHeightPx={analysis.imageHeight}
              bbox={analysis.bbox}
              lines={lines}
              step={step}
              hasReference={hasReference}
              stepShortLabel={stepLabels[step - 1]}
              keypoints={resolveStep1Keypoints(scanKeypoints, lines, analysis.bbox)}
              detectLines={detectLinesSnapshot}
              planD={analysis.planD}
            />
          )}
        <ScanDetailPanel
          title={panelTitle}
          description={panelDesc}
          mistakes={panelMistakes || undefined}
          mistakesTone={step === 1 ? "retake" : "tip"}
          metrics={panelMetrics}
          pixelsOnly={pixelsOnly}
          pixelsField={pixelsField}
          bbox={analysis.bbox}
          model={step === 1 ? analysis.model : undefined}
          bboxHeightPx={analysis.bbox.height}
          bboxWidthPx={analysis.bbox.width}
          showScaleFormulas={step >= 4 && !!panelMetrics}
          extra={
            <>
              {step1OrientationExtra}
              {unusualMeasurementsStrong && (
                <p className={cowWeightCalloutPanelStrong} style={cowWeightCalloutPanelStrongStyle}>
                  {t("cowWeight.scan.unusualMeasurementsStrong")}
                </p>
              )}
              {unusualMeasurements && !unusualMeasurementsStrong && (
                <p className={`${cowWeightCalloutPanel} py-1.5`} style={cowWeightCalloutPanelStyle}>
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

      {step === 6 && (
        <CowWeightCowNameField value={cowName} onChange={setCowName} id="cow-weight-scan-name" />
      )}

      <div className="flex gap-2 justify-between sticky bottom-0 bg-background/95 py-2 border-t">
        <Button
          variant="outline"
          disabled={step === 1}
          className={cowWeightOutlineButtonClass}
          style={cowWeightOutlineButtonStyle}
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t("cowWeight.scan.back")}
        </Button>

        {step < 6 ? (
          <Button
            disabled={!canNext()}
            className={cowWeightPrimaryButtonClass}
            style={cowWeightPrimaryButtonStyle}
            onClick={onNext}
          >
            {t("cowWeight.scan.next")}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button
            disabled={saving || refTapIncomplete}
            className={cowWeightPrimaryButtonClass}
            style={cowWeightPrimaryButtonStyle}
            onClick={() => void onConfirm()}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
            {t("cowWeight.confirmEstimate")}
          </Button>
        )}
      </div>
    </CowWeightPageShell>
  );
}
