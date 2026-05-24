import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  buildCalculationBreakdown,
  CALCULATION_GROUP_ORDER,
  canBuildAudit,
  stepFocusRowIds,
  type CalculationBreakdownGroup,
  type CalculationBreakdownRow,
} from "@/lib/cowWeight/calculationBreakdown";
import { auditGroupTheme, AUDIT_STEP_FOCUS } from "@/lib/cowWeight/cowWeightAuditTheme";
import type {
  BBox,
  CowAnalysisResult,
  CowKeypoints,
  CowLines,
  ScanMetrics,
  ScanStepId,
} from "@/lib/cowWeight/types";

interface ScanCalculationBreakdownProps {
  metrics: ScanMetrics | null;
  imageWidthPx: number;
  imageHeightPx: number;
  bbox: BBox;
  lines: CowLines;
  step: ScanStepId;
  hasReference: boolean;
  stepShortLabel?: string;
  keypoints?: CowKeypoints | null;
  detectLines?: CowLines | null;
  planD?: CowAnalysisResult["planD"] | null;
}

const MICRO_STEP_KEYS: Record<ScanStepId, string> = {
  1: "cowWeight.audit.microStep1",
  2: "cowWeight.audit.microStep2",
  3: "cowWeight.audit.microStep3",
  4: "cowWeight.audit.microStep4",
  5: "cowWeight.audit.microStep5",
  6: "cowWeight.audit.microStep6",
};

function AuditRow({
  row,
  label,
  highlighted,
}: {
  row: CalculationBreakdownRow;
  label: string;
  highlighted: boolean;
}) {
  const num = String(row.lineNumber).padStart(3, "0");
  return (
    <div
      className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] gap-x-2 gap-y-0.5 text-xs font-mono rounded px-1.5 py-0.5 -mx-0.5"
      style={
        highlighted
          ? {
              backgroundColor: AUDIT_STEP_FOCUS.bg,
              boxShadow: `inset 0 0 0 1px ${AUDIT_STEP_FOCUS.ring}`,
            }
          : undefined
      }
    >
      <span
        className={`tabular-nums font-semibold ${highlighted ? "" : "text-muted-foreground"}`}
        style={highlighted ? { color: AUDIT_STEP_FOCUS.accent } : undefined}
      >
        #{num}
      </span>
      <span
        className={`truncate ${highlighted ? "font-bold" : "text-muted-foreground"}`}
        style={highlighted ? { color: "#0f172a" } : undefined}
      >
        {label}
      </span>
      <span
        className="text-right font-semibold tabular-nums text-slate-900"
        style={highlighted ? { color: "#0f172a" } : undefined}
      >
        {row.value}
      </span>
      {row.detail && (
        <span className="col-span-3 text-[10px] text-muted-foreground/90 pl-[2.5rem] leading-snug">
          {row.detail}
        </span>
      )}
    </div>
  );
}

function AuditGroupSection({
  group,
  rows,
  focusIds,
  t,
}: {
  group: CalculationBreakdownGroup;
  rows: CalculationBreakdownRow[];
  focusIds: Set<string>;
  t: (key: string) => string;
}) {
  if (rows.length === 0) return null;

  const theme = auditGroupTheme(group);

  return (
    <section
      className="rounded-md border overflow-hidden"
      style={{ borderColor: `${theme.accent}40`, backgroundColor: theme.bg }}
    >
      <div
        className="px-2.5 py-1.5 border-b"
        style={{ borderColor: `${theme.accent}33`, borderLeftWidth: 3, borderLeftColor: theme.accent }}
      >
        <h3 className="text-xs font-bold tracking-tight" style={{ color: theme.accent }}>
          {t(theme.labelKey)}
        </h3>
      </div>
      <div className="space-y-0.5 px-2 py-1.5 bg-white/70">
        {rows.map((row) => (
          <AuditRow
            key={row.id}
            row={row}
            label={t(row.labelKey)}
            highlighted={focusIds.has(row.id)}
          />
        ))}
      </div>
    </section>
  );
}

export default function ScanCalculationBreakdown({
  metrics,
  imageWidthPx,
  imageHeightPx,
  bbox,
  lines,
  step,
  hasReference,
  stepShortLabel,
  keypoints,
  detectLines,
  planD,
}: ScanCalculationBreakdownProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  const breakdown = useMemo(() => {
    if (!metrics || !canBuildAudit(metrics, planD)) return null;
    return buildCalculationBreakdown({
      metrics,
      imageWidthPx,
      imageHeightPx,
      bbox,
      lines,
      hasReference,
      keypoints,
      detectLines,
      planD,
    });
  }, [
    metrics,
    imageWidthPx,
    imageHeightPx,
    bbox,
    lines,
    hasReference,
    keypoints,
    detectLines,
    planD,
  ]);

  const focusIds = useMemo(
    () => new Set(stepFocusRowIds(step, hasReference)),
    [step, hasReference],
  );

  const rowsByGroup = useMemo(() => {
    if (!breakdown) return null;
    const map = new Map<CalculationBreakdownGroup, CalculationBreakdownRow[]>();
    for (const g of CALCULATION_GROUP_ORDER) {
      map.set(g, []);
    }
    for (const row of breakdown.rows) {
      map.get(row.group)?.push(row);
    }
    return map;
  }, [breakdown]);

  if (!breakdown || !rowsByGroup) return null;

  const bannerLabel = stepShortLabel ?? t(`cowWeight.scan.step${step}.short`);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="shrink-0 w-full">
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
        <CollapsibleTrigger className="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-slate-50/80 transition-colors">
          <span
            className="mt-0.5 w-1 self-stretch min-h-[2.5rem] rounded-full shrink-0"
            style={{ backgroundColor: AUDIT_STEP_FOCUS.accent }}
            aria-hidden
          />
          <span className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900">{t("cowWeight.audit.title")}</p>
            <p className="text-xs font-bold text-slate-700 mt-0.5">
              {t("cowWeight.audit.viewingStep")} {step}: {bannerLabel}
            </p>
            {!open && (
              <p className="text-[10px] text-muted-foreground mt-1">{t("cowWeight.audit.tapToExpand")}</p>
            )}
          </span>
          <span className="shrink-0 text-muted-foreground mt-0.5" aria-hidden>
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </span>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-slate-100 px-3 pb-3 pt-2 space-y-3 max-h-[min(60vh,520px)] overflow-y-auto">
            <div
              className="rounded-md px-2.5 py-2 space-y-1"
              style={{ backgroundColor: AUDIT_STEP_FOCUS.bg, borderLeft: `3px solid ${AUDIT_STEP_FOCUS.accent}` }}
            >
              <p className="text-xs font-bold text-slate-900">
                {t("cowWeight.audit.viewingStep")} {step}: {bannerLabel}
              </p>
              <p className="text-[10px] text-slate-700 leading-snug font-medium">
                {t(MICRO_STEP_KEYS[step])}
              </p>
              <p className="text-[10px] text-muted-foreground">{t("cowWeight.audit.scrollHint")}</p>
            </div>

            <div className="space-y-2.5">
              {CALCULATION_GROUP_ORDER.map((group) => (
                <AuditGroupSection
                  key={group}
                  group={group}
                  rows={rowsByGroup.get(group) ?? []}
                  focusIds={focusIds}
                  t={t}
                />
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}
