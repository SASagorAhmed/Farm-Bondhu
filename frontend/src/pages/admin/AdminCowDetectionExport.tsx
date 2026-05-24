import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  downloadCowDetectionFeedbackExport,
  fetchCowDetectionFeedbackStats,
} from "@/lib/cowWeight/api";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

export default function AdminCowDetectionExport() {
  const { t } = useLanguage();
  const [downloading, setDownloading] = useState(false);

  const { data: stats, isLoading } = useQuery({
    queryKey: ["cow-detection-feedback-stats"],
    queryFn: fetchCowDetectionFeedbackStats,
  });

  const onDownload = async () => {
    setDownloading(true);
    try {
      await downloadCowDetectionFeedbackExport();
      toast.success("Export downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>{t("cowWeight.admin.cowDetectionExport")}</CardTitle>
          <CardDescription>
            Farmer corrections from cow weight Step 1. Use the JSON pack or run{" "}
            <code className="text-xs">npm run cow:export-feedback</code> in backend for YOLO folders.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("cowWeight.admin.feedbackCount")}:{" "}
            {isLoading ? "…" : (stats?.total ?? 0)}
          </p>
          <Button disabled={downloading || !stats?.total} onClick={() => void onDownload()}>
            {downloading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
            {t("cowWeight.admin.downloadPack")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
