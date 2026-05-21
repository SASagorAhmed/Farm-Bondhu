import { useEffect, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  buildAnalysisFromGeometry,
  detectCowGeometry,
} from "@/lib/cowWeight/analyzeCow";
import { fetchCloudDirectionAssist } from "@/lib/cowWeight/runVisionAssist";
import type { CowWeightAnalyzeState, CowWeightScanState } from "@/lib/cowWeight/navigation";
import { toast } from "sonner";

type AnalyzePhase = "detect" | "direction" | "markers" | "done";

export default function CowWeightAnalyze() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as CowWeightAnalyzeState | null;
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<AnalyzePhase>("detect");

  useEffect(() => {
    if (!state?.dataUrl) {
      navigate("/dashboard/cow-weight", { replace: true });
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
        };
        navigate("/dashboard/cow-weight/scan", { state: next, replace: true });
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
  }, [state, navigate, t]);

  const statusText =
    phase === "direction"
      ? t("cowWeight.analyzingDirection")
      : phase === "markers"
        ? t("cowWeight.analyzingMarkers")
        : t("cowWeight.analyzing");

  if (error) {
    return (
      <div className="max-w-md mx-auto space-y-4 text-center py-12">
        <p className="text-destructive">{error}</p>
        <Link to="/dashboard/cow-weight/upload" className="text-primary underline text-sm">
          {t("cowWeight.tryAgain")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{statusText}</p>
      {state?.dataUrl && (
        <Card className="max-w-xs overflow-hidden opacity-60">
          <CardContent className="p-0">
            <img src={state.dataUrl} alt="" className="w-full h-32 object-cover" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
