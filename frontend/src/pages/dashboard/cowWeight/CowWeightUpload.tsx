import { useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { fileToDataUrl } from "@/lib/cowWeight/imageUtils";
import { parseExifFromFile } from "@/lib/cowWeight/imageExif";
import CowWeightPlanBDemoImage from "@/components/cowWeight/CowWeightPlanBDemoImage";
import CowWeightPhotoActions from "@/components/cowWeight/CowWeightPhotoActions";
import CowWeightPageShell from "@/components/cowWeight/CowWeightPageShell";
import type { PhotoCaptureSource } from "@/lib/cowWeight/navigation";
import { cowWeightBackLinkClass, cowWeightBackLinkStyle } from "@/lib/cowWeight/cowWeightTheme";
import { useCowWeightPaths } from "@/lib/cowWeight/cowWeightPaths";

const MODE = "plan_b" as const;

export default function CowWeightUpload() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const paths = useCowWeightPaths();
  const [params] = useSearchParams();
  useEffect(() => {
    if (params.get("mode") === "plan_c") {
      navigate(paths.upload, { replace: true });
    }
  }, [params, navigate, paths.upload]);

  const onFile = async (file: File | undefined, photoSource: PhotoCaptureSource) => {
    if (!file || !file.type.startsWith("image/")) return;
    const [dataUrl, exif] = await Promise.all([fileToDataUrl(file), parseExifFromFile(file)]);
    navigate(paths.analyze, {
      state: { mode: MODE, dataUrl, exif, photoSource },
    });
  };

  const tips = t("cowWeight.tipsUpload");

  return (
    <CowWeightPageShell>
      <Button variant="ghost" size="sm" asChild className={cowWeightBackLinkClass} style={cowWeightBackLinkStyle}>
        <Link to={paths.hub}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t("cowWeight.back")}
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{t("cowWeight.planBTitle")}</CardTitle>
          <CardDescription>{t("cowWeight.planBDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CowWeightPlanBDemoImage />
          <p className="text-sm text-muted-foreground whitespace-pre-line">{tips}</p>

          <CowWeightPhotoActions
            layout="stack"
            onImageFile={(file, source) => void onFile(file, source)}
          />
        </CardContent>
      </Card>
    </CowWeightPageShell>
  );
}
