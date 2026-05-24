import { AlertTriangle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  COW_WEIGHT_RETAKE_ACCENT,
  COW_WEIGHT_RETAKE_BG,
  cowWeightRetakeAlertBox,
  cowWeightRetakeAlertBullet,
  cowWeightRetakeAlertTitle,
} from "@/components/cowWeight/cowWeightCalloutStyles";

const BULLET_KEYS = [
  "cowWeight.scan.step1.retakeWrongAnimal",
  "cowWeight.scan.step1.retakeCutLegs",
  "cowWeight.scan.step1.retakeTooSmall",
] as const;

export default function CowWeightRetakeAlert() {
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
        <div className="min-w-0 flex-1 space-y-2">
          <p className={cowWeightRetakeAlertTitle} style={{ color: "#881337" }}>
            {t("cowWeight.scan.step1.retakeTitle")}
          </p>
          <ul className="space-y-1.5 pl-0.5">
            {BULLET_KEYS.map((key) => (
              <li key={key} className={`flex gap-2 ${cowWeightRetakeAlertBullet}`}>
                <span
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: COW_WEIGHT_RETAKE_ACCENT }}
                  aria-hidden
                />
                <span style={{ color: "#9f1239" }}>{t(key)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
