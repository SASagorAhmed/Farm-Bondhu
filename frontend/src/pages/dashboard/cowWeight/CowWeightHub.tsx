import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Scan, History, ArrowRight, Ruler, Beef } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { preloadCowModels } from "@/lib/cowWeight/yoloDetect";
import { fetchCowEstimations } from "@/lib/cowWeight/api";
import type { CowEstimationRow } from "@/lib/cowWeight/types";
import CowWeightPlanBDemoImage from "@/components/cowWeight/CowWeightPlanBDemoImage";
import CowWeightManualDemoImage from "@/components/cowWeight/CowWeightManualDemoImage";
import CowWeightPageShell from "@/components/cowWeight/CowWeightPageShell";
import CowWeightDisclaimer from "@/components/cowWeight/CowWeightDisclaimer";
import { COW_WEIGHT_THEME, cowWeightAccentStyle, cowWeightOutlineButtonClass, cowWeightOutlineButtonStyle, cowWeightPrimaryButtonClass, cowWeightPrimaryButtonStyle } from "@/lib/cowWeight/cowWeightTheme";
import { useCowWeightPaths } from "@/lib/cowWeight/cowWeightPaths";

function historyModeLabel(row: CowEstimationRow, t: (k: string) => string): string {
  if (row.input_method === "manual") return t("cowWeight.historyManual");
  if (row.detection_mode === "plan_c") return t("cowWeight.historyLegacyRef");
  return t("cowWeight.historyPlanB");
}

export default function CowWeightHub() {
  const { t } = useLanguage();
  const paths = useCowWeightPaths();
  const [history, setHistory] = useState<CowEstimationRow[]>([]);

  useEffect(() => {
    preloadCowModels();
    fetchCowEstimations()
      .then(setHistory)
      .catch(() => setHistory([]));
  }, []);

  return (
    <CowWeightPageShell>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("cowWeight.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("cowWeight.subtitle")}</p>
      </div>

      <CowWeightDisclaimer />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          className="transition-colors border"
          style={{ borderColor: COW_WEIGHT_THEME.farmBorder }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = `${COW_WEIGHT_THEME.farm}99`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = COW_WEIGHT_THEME.farmBorder;
          }}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Scan className="h-5 w-5" style={{ color: COW_WEIGHT_THEME.farm }} />
              {t("cowWeight.planBTitle")}
            </CardTitle>
            <CardDescription>{t("cowWeight.planBDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <CowWeightPlanBDemoImage />
            <Button asChild className={cn("w-full", cowWeightPrimaryButtonClass)} style={cowWeightPrimaryButtonStyle}>
              <Link to={paths.upload}>
                {t("cowWeight.startUpload")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card
          className="transition-colors border"
          style={{ borderColor: COW_WEIGHT_THEME.farmBorder }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = `${COW_WEIGHT_THEME.farm}99`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = COW_WEIGHT_THEME.farmBorder;
          }}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Ruler className="h-5 w-5" style={{ color: COW_WEIGHT_THEME.farm }} />
              {t("cowWeight.manual.cardTitle")}
            </CardTitle>
            <CardDescription>{t("cowWeight.manual.cardDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <CowWeightManualDemoImage />
            <Button asChild variant="outline" className={cn("w-full", cowWeightOutlineButtonClass)} style={cowWeightOutlineButtonStyle}>
              <Link to={paths.manual}>
                {t("cowWeight.manual.cardCta")}
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
                to={paths.result}
                state={{ estimation: row, mode: row.detection_mode }}
                className="flex items-center gap-3 text-sm border rounded-lg px-3 py-2 hover:bg-muted/50"
              >
                <div
                  className="h-10 w-10 shrink-0 rounded-md border overflow-hidden flex items-center justify-center"
                  style={{
                    borderColor: COW_WEIGHT_THEME.farmBorder,
                    backgroundColor: row.image_url ? undefined : COW_WEIGHT_THEME.farmBg,
                  }}
                >
                  {row.image_url ? (
                    <img
                      src={row.image_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Beef className="h-5 w-5" style={{ color: COW_WEIGHT_THEME.farm }} />
                  )}
                </div>
                <span className="flex-1 min-w-0">
                  <span className="block font-medium truncate">{row.cow_name ?? row.id.slice(0, 8)}</span>
                  <span className="block text-xs text-muted-foreground truncate">
                    {new Date(row.created_at).toLocaleDateString()} · {historyModeLabel(row, t)}
                  </span>
                </span>
                <span className="font-semibold shrink-0" style={cowWeightAccentStyle("farm")}>
                  {row.estimated_live_weight_kg} kg
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </CowWeightPageShell>
  );
}
