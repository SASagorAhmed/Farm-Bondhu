import { useEffect, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { analyzeCowImage } from "@/lib/cowWeight/analyzeCow";
import type { CowWeightAnalyzeState, CowWeightScanState } from "@/lib/cowWeight/navigation";
import { toast } from "sonner";

export default function CowWeightAnalyze() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as CowWeightAnalyzeState | null;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!state?.dataUrl || !state?.mode) {
      navigate("/dashboard/cow-weight", { replace: true });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const analysis = await analyzeCowImage(state.dataUrl, state.mode);
        if (cancelled) return;
        const next: CowWeightScanState = {
          mode: state.mode,
          dataUrl: state.dataUrl,
          analysis,
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

  if (error) {
    return (
      <div className="max-w-md mx-auto space-y-4 text-center py-12">
        <p className="text-destructive">{error}</p>
        <Link to={`/dashboard/cow-weight/upload?mode=${state?.mode || "plan_b"}`} className="text-primary underline text-sm">
          {t("cowWeight.tryAgain")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{t("cowWeight.analyzing")}</p>
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
