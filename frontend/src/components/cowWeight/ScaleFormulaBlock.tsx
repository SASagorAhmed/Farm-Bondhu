import { useLanguage } from "@/contexts/LanguageContext";
import type { ScanMetrics } from "@/lib/cowWeight/types";
import { scaleFormulaVars } from "@/lib/cowWeight/scanMetrics";

function applyVars(template: string, vars: Record<string, string | number>): string {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.split(`{${key}}`).join(String(value));
  }
  return out;
}

interface ScaleFormulaBlockProps {
  metrics: ScanMetrics;
  bboxHeightPx: number;
  bboxWidthPx: number;
  showWeight?: boolean;
}

export default function ScaleFormulaBlock({
  metrics,
  bboxHeightPx,
  bboxWidthPx,
  showWeight = true,
}: ScaleFormulaBlockProps) {
  const { t } = useLanguage();
  if (metrics.cmPerPixel <= 0) return null;

  const v = scaleFormulaVars(metrics, bboxHeightPx, bboxWidthPx);
  const isPlanC = metrics.scaleMethod === "reference_100cm" && v.refPx;

  const scaleLines: string[] = [];
  if (isPlanC) {
    scaleLines.push(
      applyVars(t("cowWeight.scan.formulaScaleC"), {
        refPx: v.refPx ?? "—",
        cmPerPixel: v.cmPerPixel,
      })
    );
  } else {
    scaleLines.push(
      applyVars(t("cowWeight.scan.formulaScaleBChest"), {
        bboxHeight: v.bboxHeight,
        chestCmPerPixel: v.chestCmPerPixel,
      })
    );
    scaleLines.push(
      applyVars(t("cowWeight.scan.formulaScaleBLength"), {
        bboxWidth: v.bboxWidth,
        lengthSpanPx: v.lengthSpanPx,
        lengthCmPerPixel: v.lengthCmPerPixel,
      })
    );
  }

  const chestLine = applyVars(t("cowWeight.scan.formulaChest"), {
    chestPx: v.chestPx,
    cmPerPixel: isPlanC ? v.cmPerPixel : v.chestCmPerPixel,
    chestCm: metrics.chestWidthCm,
  });

  const lengthLine = applyVars(t("cowWeight.scan.formulaLength"), {
    lengthPx: v.lengthPx,
    cmPerPixel: isPlanC ? v.cmPerPixel : v.lengthCmPerPixel,
    lengthCm: metrics.bodyLengthCm,
  });

  const weightLine =
    showWeight && metrics.estimatedLiveWeightKg > 0
      ? applyVars(t("cowWeight.scan.formulaWeight"), {
          chestCm: metrics.chestWidthCm,
          lengthCm: metrics.bodyLengthCm,
          weightKg: metrics.estimatedLiveWeightKg,
        })
      : null;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 space-y-1.5 text-xs font-mono leading-relaxed">
      <p className="text-[11px] font-sans font-semibold text-muted-foreground uppercase tracking-wide">
        {t("cowWeight.scan.formulasTitle")}
      </p>
      {scaleLines.map((line, i) => (
        <p key={i} className="text-slate-800">
          {line}
        </p>
      ))}
      <p className="text-slate-800">{chestLine}</p>
      <p className="text-slate-800">{lengthLine}</p>
      {weightLine && <p className="text-slate-800 pt-0.5 border-t border-slate-200">{weightLine}</p>}
    </div>
  );
}
