import { useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, ImagePlus, ArrowLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { DetectionMode } from "@/lib/cowWeight/types";
import { fileToDataUrl } from "@/lib/cowWeight/imageUtils";

function parseMode(raw: string | null): DetectionMode {
  return raw === "plan_c" ? "plan_c" : "plan_b";
}

export default function CowWeightUpload() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const mode = parseMode(params.get("mode"));
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const onFile = async (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    const dataUrl = await fileToDataUrl(file);
    navigate("/dashboard/cow-weight/analyze", { state: { mode, dataUrl } });
  };

  const tips = mode === "plan_c" ? t("cowWeight.tipsPlanC") : t("cowWeight.tipsPlanB");

  return (
    <div className="space-y-6 max-w-lg">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/dashboard/cow-weight">
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t("cowWeight.back")}
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>
            {mode === "plan_c" ? t("cowWeight.planCTitle") : t("cowWeight.planBTitle")}
          </CardTitle>
          <CardDescription>{t("cowWeight.uploadSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground whitespace-pre-line">{tips}</p>

          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />

          <Button className="w-full h-12" type="button" onClick={() => cameraRef.current?.click()}>
            <Camera className="h-5 w-5 mr-2" />
            {t("cowWeight.takePhoto")}
          </Button>
          <Button className="w-full h-12" type="button" variant="outline" onClick={() => galleryRef.current?.click()}>
            <ImagePlus className="h-5 w-5 mr-2" />
            {t("cowWeight.chooseGallery")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
