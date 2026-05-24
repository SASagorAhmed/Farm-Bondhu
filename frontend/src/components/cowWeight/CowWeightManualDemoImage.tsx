import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import cowWeightManualDemoImg from "@/assets/cow-weight-manual-website.png";

interface CowWeightManualDemoImageProps {
  className?: string;
}

export default function CowWeightManualDemoImage({ className }: CowWeightManualDemoImageProps) {
  const { t } = useLanguage();

  return (
    <div className={cn("rounded-lg border bg-muted/30", className)}>
      <img
        src={cowWeightManualDemoImg}
        alt={t("cowWeight.manual.demoAlt")}
        className="w-full max-w-full h-auto block rounded-lg"
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}
