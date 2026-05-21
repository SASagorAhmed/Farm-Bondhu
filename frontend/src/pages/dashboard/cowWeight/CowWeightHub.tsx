import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Scan, Ruler, History, ArrowRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { preloadCowModels } from "@/lib/cowWeight/yoloDetect";
import { fetchCowEstimations } from "@/lib/cowWeight/api";
import type { CowEstimationRow } from "@/lib/cowWeight/types";

export default function CowWeightHub() {
  const { t } = useLanguage();
  const [history, setHistory] = useState<CowEstimationRow[]>([]);

  useEffect(() => {
    preloadCowModels();
    fetchCowEstimations()
      .then(setHistory)
      .catch(() => setHistory([]));
  }, []);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("cowWeight.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("cowWeight.subtitle")}</p>
      </div>

      <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        {t("cowWeight.disclaimer")}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="hover:border-primary/40 transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Scan className="h-5 w-5 text-primary" />
              {t("cowWeight.planBTitle")}
            </CardTitle>
            <CardDescription>{t("cowWeight.planBDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/dashboard/cow-weight/upload?mode=plan_b">
                {t("cowWeight.startUpload")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:border-primary/40 transition-colors border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Ruler className="h-5 w-5 text-primary" />
              {t("cowWeight.planCTitle")}
            </CardTitle>
            <CardDescription>{t("cowWeight.planCDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full" variant="default">
              <Link to="/dashboard/cow-weight/upload?mode=plan_c">
                {t("cowWeight.startUpload")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4" />
              {t("cowWeight.recentEstimates")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {history.slice(0, 5).map((row) => (
              <Link
                key={row.id}
                to={`/dashboard/cow-weight/result`}
                state={{ estimation: row, mode: row.detection_mode }}
                className="flex justify-between items-center text-sm border rounded-lg px-3 py-2 hover:bg-muted/50"
              >
                <span>
                  {new Date(row.created_at).toLocaleDateString()} · {row.detection_mode === "plan_c" ? "Plan C" : "Plan B"}
                </span>
                <span className="font-semibold">{row.estimated_live_weight_kg} kg</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
