import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import type { CowFacing } from "@/lib/cowWeight/cowKeypoints";
import {
  COW_WEIGHT_HEAD_SIDE_ACCENT,
  COW_WEIGHT_HEAD_SIDE_BG,
  cowWeightHeadSideOptionBase,
  cowWeightHeadSidePanel,
} from "@/components/cowWeight/cowWeightCalloutStyles";

const OPTIONS: { value: CowFacing; labelKey: string }[] = [
  { value: "head_left", labelKey: "cowWeight.scan.headLeft" },
  { value: "head_right", labelKey: "cowWeight.scan.headRight" },
];

interface CowWeightHeadSidePanelProps {
  value: CowFacing | null | undefined;
  onChange: (side: CowFacing) => void;
  notDetected?: boolean;
}

export default function CowWeightHeadSidePanel({
  value,
  onChange,
  notDetected = false,
}: CowWeightHeadSidePanelProps) {
  const { t } = useLanguage();

  return (
    <div
      className={cowWeightHeadSidePanel}
      style={{
        backgroundColor: COW_WEIGHT_HEAD_SIDE_BG,
        borderColor: `${COW_WEIGHT_HEAD_SIDE_ACCENT}55`,
        borderLeftWidth: 4,
        borderLeftColor: COW_WEIGHT_HEAD_SIDE_ACCENT,
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-slate-900">
          {notDetected ? t("cowWeight.scan.headDirectionRequired") : t("cowWeight.scan.orientationLabel")}
        </p>
        {notDetected && (
          <span className="text-[10px] font-semibold uppercase tracking-wide rounded-md border border-slate-300 bg-slate-100 text-slate-700 px-2 py-0.5">
            {t("cowWeight.scan.notDetected")}
          </span>
        )}
      </div>

      <div
        className="grid grid-cols-2 gap-2 w-full"
        role="group"
        aria-label={t("cowWeight.scan.orientationLabel")}
      >
        {OPTIONS.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={selected}
              className={cn(cowWeightHeadSideOptionBase)}
              style={
                selected
                  ? {
                      backgroundColor: COW_WEIGHT_HEAD_SIDE_ACCENT,
                      borderColor: COW_WEIGHT_HEAD_SIDE_ACCENT,
                      color: "#ffffff",
                    }
                  : {
                      backgroundColor: COW_WEIGHT_HEAD_SIDE_BG,
                      borderColor: `${COW_WEIGHT_HEAD_SIDE_ACCENT}66`,
                      color: "#1e3a8a",
                    }
              }
              onClick={() => onChange(opt.value)}
            >
              {t(opt.labelKey)}
            </button>
          );
        })}
      </div>

      <p className="text-[11px] text-slate-600 leading-snug">
        {notDetected ? t("cowWeight.scan.headDirectionRequiredHint") : t("cowWeight.scan.headSideHint")}
      </p>
    </div>
  );
}
