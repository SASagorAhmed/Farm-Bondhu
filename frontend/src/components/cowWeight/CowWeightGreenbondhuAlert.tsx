import { AlertTriangle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  COW_WEIGHT_RETAKE_ACCENT,
  COW_WEIGHT_RETAKE_BG,
} from "@/components/cowWeight/cowWeightCalloutStyles";

export default function CowWeightGreenbondhuAlert() {
  const { t } = useLanguage();

  return (
    <div
      className="overflow-hidden rounded-xl border shadow-sm"
      role="alert"
      style={{
        backgroundColor: COW_WEIGHT_RETAKE_BG,
        borderColor: `${COW_WEIGHT_RETAKE_ACCENT}66`,
      }}
    >
      <div className="flex items-center gap-2 px-3 py-2" style={{ backgroundColor: COW_WEIGHT_RETAKE_ACCENT }}>
        <span className="rounded-full bg-white/20 p-1">
          <AlertTriangle className="h-3.5 w-3.5 text-white" aria-hidden />
        </span>
        <p className="text-xs font-bold uppercase tracking-wide text-white">
          {t("cowWeight.scan.greenbondhuAiAlertTitle")}
        </p>
      </div>
      <div className="px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-xs leading-snug" style={{ color: "#9f1239" }}>
            {t("cowWeight.scan.greenbondhuAiDisclaimer")}
          </p>
        </div>
      </div>
    </div>
  );
}
