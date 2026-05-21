import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import ScaleFormulaBlock from "@/components/cowWeight/ScaleFormulaBlock";
import type { ScanMetrics, BBox } from "@/lib/cowWeight/types";
import { bboxSummary } from "@/lib/cowWeight/scanMetrics";

interface ScanDetailPanelProps {
  title: string;
  description: string;
  mistakes?: string;
  metrics?: ScanMetrics | null;
  bbox?: BBox;
  model?: string;
  pixelsOnly?: boolean;
  pixelsField?: "both" | "chest" | "length";
  bboxHeightPx?: number;
  bboxWidthPx?: number;
  showScaleFormulas?: boolean;
  extra?: React.ReactNode;
}

export default function ScanDetailPanel({
  title,
  description,
  mistakes,
  metrics,
  bbox,
  model,
  pixelsOnly = false,
  pixelsField = "both",
  bboxHeightPx,
  bboxWidthPx,
  showScaleFormulas = false,
  extra,
}: ScanDetailPanelProps) {
  const box = bbox ? bboxSummary(bbox) : null;

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-base">
        <p className="text-muted-foreground leading-relaxed text-[15px] sm:text-base">{description}</p>

        {model && box && (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-1 text-sm font-mono">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">AI model</span>
              <span>{model}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">BBox (px)</span>
              <span>
                {box.width} × {box.height}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Confidence</span>
              <Badge variant={box.confidencePct >= 50 ? "secondary" : "outline"}>{box.confidencePct}%</Badge>
            </div>
          </div>
        )}

        {metrics && (
          <div className="rounded-lg border p-3 space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              {(pixelsField === "both" || pixelsField === "chest") && (
                <>
                  <span className="text-muted-foreground">Chest (px)</span>
                  <span className="font-mono text-right">{metrics.chestPixels}</span>
                </>
              )}
              {(pixelsField === "both" || pixelsField === "length") && (
                <>
                  <span className="text-muted-foreground">Length (px)</span>
                  <span className="font-mono text-right">{metrics.lengthPixels}</span>
                </>
              )}
              {!pixelsOnly && (
                <>
                  <span className="text-muted-foreground">cm / pixel</span>
                  <span className="font-mono text-right">{metrics.cmPerPixel}</span>
                  <span className="text-muted-foreground">Chest (cm)</span>
                  <span className="font-mono text-right font-semibold">{metrics.chestWidthCm}</span>
                  <span className="text-muted-foreground">Length (cm)</span>
                  <span className="font-mono text-right font-semibold">{metrics.bodyLengthCm}</span>
                </>
              )}
            </div>
            {!pixelsOnly && metrics.estimatedLiveWeightKg > 0 && (
              <>
                <hr />
                <div className="flex justify-between">
                  <span>Live weight (est.)</span>
                  <span className="font-bold text-primary">{metrics.estimatedLiveWeightKg} kg</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Edible meat (55%)</span>
                  <span>{metrics.edibleMeatKg} kg</span>
                </div>
              </>
            )}
            {!pixelsOnly && (
              <Badge variant="outline" className="text-xs">
                {metrics.scaleMethod === "reference_100cm"
                  ? "Scale: 1m reference"
                  : "Scale: chest from height, length from width (Plan B)"}
              </Badge>
            )}
          </div>
        )}

        {showScaleFormulas &&
          metrics &&
          bboxHeightPx != null &&
          bboxHeightPx > 0 &&
          bboxWidthPx != null &&
          bboxWidthPx > 0 && (
          <ScaleFormulaBlock
            metrics={metrics}
            bboxHeightPx={bboxHeightPx}
            bboxWidthPx={bboxWidthPx}
            showWeight={!pixelsOnly && metrics.estimatedLiveWeightKg > 0}
          />
        )}

        {mistakes && (
          <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">{mistakes}</p>
        )}

        {extra}
      </CardContent>
    </Card>
  );
}
