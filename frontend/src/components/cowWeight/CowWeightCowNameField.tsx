import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";

interface CowWeightCowNameFieldProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  className?: string;
}

export default function CowWeightCowNameField({
  value,
  onChange,
  id = "cow-weight-name",
  className,
}: CowWeightCowNameFieldProps) {
  const { t } = useLanguage();

  return (
    <div className={className ?? "space-y-2"}>
      <Label htmlFor={id}>{t("cowWeight.cowName.label")}</Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("cowWeight.cowName.placeholder")}
        maxLength={80}
      />
      <p className="text-xs text-muted-foreground">{t("cowWeight.cowName.hint")}</p>
    </div>
  );
}
