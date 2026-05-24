import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import cowWeightDemoImg from "@/assets/cow-weight-website.png";

interface CowWeightPlanBDemoImageProps {
  className?: string;
}

export default function CowWeightPlanBDemoImage({ className }: CowWeightPlanBDemoImageProps) {
  const { t } = useLanguage();

  return (
    <div className={cn("rounded-lg border bg-muted/30", className)}>
      <img
        src={cowWeightDemoImg}
        alt={t("cowWeight.planBDemoAlt")}
        className="w-full max-w-full h-auto block rounded-lg"
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}
