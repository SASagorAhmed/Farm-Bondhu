import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { cowWeightCallout, cowWeightCalloutFarmStyle } from "@/components/cowWeight/cowWeightCalloutStyles";

interface CowWeightDisclaimerProps {
  className?: string;
}

export default function CowWeightDisclaimer({ className }: CowWeightDisclaimerProps) {
  const { t } = useLanguage();

  return (
    <p className={cn(cowWeightCallout, className)} style={cowWeightCalloutFarmStyle}>
      {t("cowWeight.disclaimer")}
    </p>
  );
}
