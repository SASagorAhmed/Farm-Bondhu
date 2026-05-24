import { AlertTriangle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  COW_WEIGHT_RETAKE_ACCENT,
  COW_WEIGHT_RETAKE_BG,
  cowWeightRetakeAlertBox,
  cowWeightRetakeAlertTitle,
} from "@/components/cowWeight/cowWeightCalloutStyles";

export default function CowWeightGreenbondhuAlert() {
  const { t } = useLanguage();

  return (
    <div
      className={cowWeightRetakeAlertBox}
      role="alert"
      style={{
        backgroundColor: COW_WEIGHT_RETAKE_BG,
        borderColor: `${COW_WEIGHT_RETAKE_ACCENT}55`,
        borderLeftWidth: 4,
        borderLeftColor: COW_WEIGHT_RETAKE_ACCENT,
      }}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle
          className="h-5 w-5 shrink-0 mt-0.5"
          style={{ color: COW_WEIGHT_RETAKE_ACCENT }}
          aria-hidden
        />
        <div className="min-w-0 flex-1 space-y-1">
          <p className={cowWeightRetakeAlertTitle} style={{ color: "#881337" }}>
            {t("cowWeight.scan.greenbondhuAiAlertTitle")}
          </p>
          <p className="text-xs leading-snug" style={{ color: "#9f1239" }}>
            {t("cowWeight.scan.greenbondhuAiDisclaimer")}
          </p>
        </div>
      </div>
    </div>
  );
}
