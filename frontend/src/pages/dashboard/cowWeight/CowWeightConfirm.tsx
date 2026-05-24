import { useState, useRef } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import CowWeightOverlay from "@/components/cowWeight/CowWeightOverlay";
import type { CowWeightConfirmState, CowWeightResultState } from "@/lib/cowWeight/navigation";
import type { CowLines, Point2D } from "@/lib/cowWeight/types";
import { clampLinesToBBox } from "@/lib/cowWeight/proposeLines";
import { COW_WEIGHT_DETECTION_MODE, resolveDimensions, saveCowEstimation } from "@/lib/cowWeight/api";
import { compressDataUrl } from "@/lib/cowWeight/imageUtils";
import { toast } from "sonner";
import CowWeightPageShell from "@/components/cowWeight/CowWeightPageShell";
import CowWeightCallout from "@/components/cowWeight/CowWeightCallout";
import CowWeightCowNameField from "@/components/cowWeight/CowWeightCowNameField";
import {
  cowWeightBackLinkClass,
  cowWeightBackLinkStyle,
  cowWeightOutlineButtonClass,
  cowWeightOutlineButtonStyle,
  cowWeightPrimaryButtonClass,
  cowWeightPrimaryButtonStyle,
} from "@/lib/cowWeight/cowWeightTheme";
import { useCowWeightPaths } from "@/lib/cowWeight/cowWeightPaths";

export default function CowWeightConfirm() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const paths = useCowWeightPaths();
  const state = location.state as CowWeightConfirmState | null;

  const [lines, setLines] = useState<CowLines | null>(() => {
    if (!state?.analysis?.lines || !state.analysis.bbox) return state?.analysis?.lines ?? null;
    return clampLinesToBBox(
      state.analysis.lines,
      state.analysis.bbox,
      state.analysis.keypoints?.detected?.facing ?? null
    );
  });
  const [refTapMode, setRefTapMode] = useState(false);
  const [cowName, setCowName] = useState("");
  const [saving, setSaving] = useState(false);
  const saveInFlight = useRef(false);

  if (!state?.dataUrl || !state.analysis || !lines) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">{t("cowWeight.sessionExpired")}</p>
        <Button asChild className={cn("mt-4", cowWeightPrimaryButtonClass)} style={cowWeightPrimaryButtonStyle}>
          <Link to={paths.hub}>{t("cowWeight.back")}</Link>
        </Button>
      </div>
    );
  }

  const { dataUrl, analysis } = state;
  const hasReference = !!lines.reference;

  const overlayImageUrl = analysis.displayImageUrl ?? dataUrl;

  const onReferenceTap = (a: Point2D, b: Point2D) => {
    setLines((prev) =>
      prev
        ? clampLinesToBBox(
            { ...prev, reference: { a, b } },
            analysis.bbox,
            analysis.keypoints?.detected?.facing ?? null
          )
        : prev
    );
    setRefTapMode(false);
    toast.success(t("cowWeight.referenceSet"));
  };

  const onConfirm = async () => {
    if (saveInFlight.current) return;
    saveInFlight.current = true;
    setSaving(true);
    try {
      const dims = resolveDimensions(lines, analysis);
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
          scaleMethod: dims.scaleMethod,
        },
      });
      const next: CowWeightResultState = { estimation: row, mode: COW_WEIGHT_DETECTION_MODE };
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

  return (
    <CowWeightPageShell className="space-y-4">
      <Button variant="ghost" size="sm" asChild className={cowWeightBackLinkClass} style={cowWeightBackLinkStyle}>
        <Link to={paths.upload}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t("cowWeight.retake")}
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{t("cowWeight.confirmTitle")}</CardTitle>
          <CardDescription>
            {t("cowWeight.confirmDesc")} · {analysis.model} · {Math.round(analysis.confidence * 100)}%
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#0a6b74]" /> {t("cowWeight.legendChest")}</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#c92a2a]" /> {t("cowWeight.legendLength")}</span>
            {hasReference && (
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#f59f00]" /> {t("cowWeight.legendReference")}</span>
            )}
          </div>

          <CowWeightOverlay
            imageUrl={overlayImageUrl}
            imageWidth={analysis.imageWidth}
            imageHeight={analysis.imageHeight}
            bbox={analysis.bbox}
            lines={lines}
            mode="plan_b"
            activeStep={6}
            showReference={hasReference}
            onLinesChange={(next) =>
              setLines(
                clampLinesToBBox(
                  next,
                  analysis.bbox,
                  analysis.keypoints?.detected?.facing ?? null
                )
              )
            }
            onReferenceTapMode={refTapMode}
            onReferenceTap={onReferenceTap}
            bodyOutline={analysis.bodyOutline}
          />

          {!hasReference && !refTapMode && (
            <Button
              type="button"
              variant="outline"
              className={cn("w-full", cowWeightOutlineButtonClass)}
              style={cowWeightOutlineButtonStyle}
              onClick={() => setRefTapMode(true)}
            >
              {t("cowWeight.tapReference")}
            </Button>
          )}

          {!hasReference && analysis.confidence < 0.55 && (
            <CowWeightCallout className="rounded-lg">{t("cowWeight.lowConfidenceB")}</CowWeightCallout>
          )}

          <CowWeightCowNameField value={cowName} onChange={setCowName} id="cow-weight-confirm-name" />

          <Button
            className={cn("w-full", cowWeightPrimaryButtonClass)}
            style={cowWeightPrimaryButtonStyle}
            disabled={saving || (refTapMode && !lines.reference)}
            onClick={() => void onConfirm()}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
            {t("cowWeight.confirmEstimate")}
          </Button>
        </CardContent>
      </Card>
    </CowWeightPageShell>
  );
}
