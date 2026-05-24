import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  buildAnalysisFromGeometry,
  detectCowGeometry,
} from "@/lib/cowWeight/analyzeCow";
import { fetchCloudDirectionAssist } from "@/lib/cowWeight/runVisionAssist";
import type { CowWeightAnalyzeState, CowWeightScanState } from "@/lib/cowWeight/navigation";
import { toast } from "sonner";
import CowWeightPageShell from "@/components/cowWeight/CowWeightPageShell";
import {
  COW_WEIGHT_THEME,
  cowWeightOutlineButtonClass,
  cowWeightOutlineButtonStyle,
  cowWeightPrimaryButtonClass,
  cowWeightPrimaryButtonStyle,
} from "@/lib/cowWeight/cowWeightTheme";
import CowWeightCameraDialog from "@/components/cowWeight/CowWeightCameraDialog";
import { fileToDataUrl } from "@/lib/cowWeight/imageUtils";
import { parseExifFromFile } from "@/lib/cowWeight/imageExif";
import { useCowWeightPaths } from "@/lib/cowWeight/cowWeightPaths";

type AnalyzePhase = "detect" | "direction" | "markers" | "done";

export default function CowWeightAnalyze() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const paths = useCowWeightPaths();
  const state = location.state as CowWeightAnalyzeState | null;
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<AnalyzePhase>("detect");
  const [cameraOpen, setCameraOpen] = useState(false);

  useEffect(() => {
    if (!state?.dataUrl) {
      navigate(paths.hub, { replace: true });
      return;
    }

    const mode = "plan_b" as const;

    let cancelled = false;
    (async () => {
      try {
        setPhase("detect");
        const geometry = await detectCowGeometry(state.dataUrl);
        if (cancelled) return;

        setPhase("direction");
        const cloud = await fetchCloudDirectionAssist(state.dataUrl, geometry, state.exif ?? null);
        if (cancelled) return;

        setPhase("markers");
        const analysis = buildAnalysisFromGeometry(geometry, {
          forcedFacing: cloud.facing,
          headBbox: cloud.headBbox,
          verifySource: cloud.verifySource,
          assistApplied: cloud.assistApplied,
          standoffMeters: cloud.standoff.meters,
          standoffSource: cloud.standoff.source,
          standoffMethod: cloud.standoff.method,
          standoffWarningKey: cloud.standoff.warningKey,
          focalLengthMm: cloud.standoff.focalLengthMm,
        });
        if (cancelled) return;

        setPhase("done");
        const next: CowWeightScanState = {
          mode,
          dataUrl: state.dataUrl,
          analysis,
          exif: state.exif ?? null,
          photoSource: state.photoSource,
        };
        navigate(paths.scan, { state: next, replace: true });
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : t("cowWeight.analyzeFailed");
        setError(msg);
        toast.error(msg);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [state, navigate, t, paths.hub, paths.scan]);

  const statusText =
    phase === "direction"
      ? t("cowWeight.analyzingDirection")
      : phase === "markers"
        ? t("cowWeight.analyzingMarkers")
        : t("cowWeight.analyzing");

  const photoSource = state?.photoSource ?? "camera";

  const onRetryCapture = async (file: File) => {
    const [dataUrl, exif] = await Promise.all([fileToDataUrl(file), parseExifFromFile(file)]);
    setError(null);
    setPhase("detect");
    navigate(paths.analyze, {
      replace: true,
      state: { mode: "plan_b" as const, dataUrl, exif, photoSource: "camera" },
    });
  };

  const backToUpload = () => navigate(paths.upload);

  if (error) {
    return (
      <CowWeightPageShell>
        <div className="max-w-md mx-auto space-y-4 text-center py-12">
          <p className="text-destructive">{error}</p>
          {photoSource === "gallery" ? (
            <Button
              type="button"
              variant="outline"
              className={cowWeightOutlineButtonClass}
              style={cowWeightOutlineButtonStyle}
              onClick={backToUpload}
            >
              {t("cowWeight.back")}
            </Button>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button
                type="button"
                variant="outline"
                className={cowWeightOutlineButtonClass}
                style={cowWeightOutlineButtonStyle}
                onClick={backToUpload}
              >
                {t("cowWeight.back")}
              </Button>
              <Button
                type="button"
                className={cowWeightPrimaryButtonClass}
                style={cowWeightPrimaryButtonStyle}
                onClick={() => setCameraOpen(true)}
              >
                {t("cowWeight.tryAgain")}
              </Button>
            </div>
          )}
        </div>
        {photoSource === "camera" && (
          <CowWeightCameraDialog
            open={cameraOpen}
            onOpenChange={setCameraOpen}
            onCapture={(file) => void onRetryCapture(file)}
            onError={(msg) => toast.error(msg)}
          />
        )}
      </CowWeightPageShell>
    );
  }

  return (
    <CowWeightPageShell className="flex flex-col items-center justify-center min-h-[50vh]">
      <Loader2 className="h-10 w-10 animate-spin" style={{ color: COW_WEIGHT_THEME.farm }} />
      <p className="text-sm text-muted-foreground">{statusText}</p>
      {state?.dataUrl && (
        <Card className="max-w-xs w-full overflow-hidden opacity-60">
          <CardContent className="p-0">
            <img src={state.dataUrl} alt="" className="w-full h-32 object-cover" />
          </CardContent>
        </Card>
      )}
    </CowWeightPageShell>
  );
}
