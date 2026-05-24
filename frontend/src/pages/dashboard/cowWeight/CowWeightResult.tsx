import { Link, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/contexts/LanguageContext";
import { DEFAULT_CAMERA_DISTANCE_CM } from "@/lib/cowWeight/geometry3d";
import type { CowWeightResultState } from "@/lib/cowWeight/navigation";
import type { CameraDistanceSource } from "@/lib/cowWeight/types";
import CowWeightPageShell from "@/components/cowWeight/CowWeightPageShell";
import CowWeightDisclaimer from "@/components/cowWeight/CowWeightDisclaimer";
import { COW_WEIGHT_THEME, cowWeightAccentStyle, cowWeightBackLinkClass, cowWeightBackLinkStyle, cowWeightOutlineButtonClass, cowWeightOutlineButtonStyle, cowWeightPrimaryButtonClass, cowWeightPrimaryButtonStyle } from "@/lib/cowWeight/cowWeightTheme";
import { useCowWeightPaths } from "@/lib/cowWeight/cowWeightPaths";

export default function CowWeightResult() {
  const { t } = useLanguage();
  const location = useLocation();
  const paths = useCowWeightPaths();
  const state = location.state as CowWeightResultState | null;
  const row = state?.estimation;

  if (!row) {
    return (
      <CowWeightPageShell className="text-center">
        <p className="text-muted-foreground">{t("cowWeight.noResult")}</p>
        <Button asChild className={cn("mt-4", cowWeightPrimaryButtonClass)} style={cowWeightPrimaryButtonStyle}>
          <Link to={paths.hub}>{t("cowWeight.back")}</Link>
        </Button>
      </CowWeightPageShell>
    );
  }

  const b = row.breakdown;
  const ann = row.annotation_json as {
    standoffMeters?: number | null;
    cameraDistanceCm?: number | null;
    groundDistanceDetected?: boolean | null;
    distanceSource?: CameraDistanceSource | null;
    focalLengthMm?: number | null;
    previewAtSave?: { liveKg?: number };
  } | null | undefined;

  const detected = ann?.groundDistanceDetected ?? ann?.distanceSource !== "fallback_average";
  const cm = detected
    ? (ann?.cameraDistanceCm ?? DEFAULT_CAMERA_DISTANCE_CM)
    : DEFAULT_CAMERA_DISTANCE_CM;

  const sourceKey =
    ann?.distanceSource === "cloud"
      ? "cowWeight.scan.distanceSourceCloud"
      : ann?.distanceSource === "local"
        ? "cowWeight.scan.distanceSourceLocal"
        : ann?.distanceSource === "blended"
          ? "cowWeight.scan.distanceSourceBlended"
          : null;

  return (
    <CowWeightPageShell>
      <Button variant="ghost" size="sm" asChild className={cowWeightBackLinkClass} style={cowWeightBackLinkStyle}>
        <Link to={paths.hub}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t("cowWeight.back")}
        </Link>
      </Button>

      <Card className="w-full border" style={{ borderColor: COW_WEIGHT_THEME.farmBorder }}>
        <CardHeader>
          <CardTitle>{t("cowWeight.resultTitle")}</CardTitle>
          {row.cow_name ? (
            <CardDescription className="text-base font-medium text-foreground">{row.cow_name}</CardDescription>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {row.image_url ? (
            <img
              src={row.image_url}
              alt=""
              className="w-full max-h-[min(70vh,720px)] object-contain bg-muted/30 rounded-md border"
            />
          ) : null}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-muted/50 p-4 text-center">
              <p className="text-xs text-muted-foreground">{t("cowWeight.liveWeight")}</p>
              <p className="text-2xl font-bold" style={cowWeightAccentStyle("farm")}>{row.estimated_live_weight_kg} kg</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-4 text-center">
              <p className="text-xs text-muted-foreground">{t("cowWeight.edibleMeat")}</p>
              <p className="text-2xl font-bold">{row.edible_meat_kg} kg</p>
            </div>
          </div>

          <Table>
            <TableBody>
              <TableRow><TableCell>{t("cowWeight.solidMeat")}</TableCell><TableCell className="text-right font-medium">{b.solid_meat_kg} kg</TableCell></TableRow>
              <TableRow><TableCell>{t("cowWeight.bone")}</TableCell><TableCell className="text-right font-medium">{b.bone_kg} kg</TableCell></TableRow>
              <TableRow><TableCell>{t("cowWeight.fat")}</TableCell><TableCell className="text-right font-medium">{b.fat_kg} kg</TableCell></TableRow>
              <TableRow><TableCell>{t("cowWeight.headMeat")}</TableCell><TableCell className="text-right font-medium">{b.head_meat_kg} kg</TableCell></TableRow>
              <TableRow><TableCell>{t("cowWeight.liverHeart")}</TableCell><TableCell className="text-right font-medium">{b.liver_heart_kg} kg</TableCell></TableRow>
            </TableBody>
          </Table>

          <p className="text-xs text-muted-foreground">
            {t("cowWeight.dimensions")}: {row.chest_width_cm} × {row.body_length_cm} cm
          </p>
          <p className="text-xs text-muted-foreground">
            {detected
              ? t("cowWeight.result.groundDistanceDetected")
                  .replace("{cm}", String(cm))
                  .replace("{source}", sourceKey ? t(sourceKey) : "—")
              : t("cowWeight.result.groundDistanceFallback").replace("{cm}", String(cm))}
          </p>
          {detected && ann?.standoffMeters != null && ann.standoffMeters > 0 && (
            <p className="text-xs text-muted-foreground">
              {t("cowWeight.scan.standoffSecondary")
                .replace("{m}", String(ann.standoffMeters))
                .replace("{min}", "3")
                .replace("{max}", "4.5")}
            </p>
          )}
          {ann?.focalLengthMm != null && ann.focalLengthMm > 0 && (
            <p className="text-xs text-muted-foreground">
              {t("cowWeight.result.lensExif")}: {Math.round(ann.focalLengthMm)} mm
            </p>
          )}
          <CowWeightDisclaimer className="rounded-lg" />

          <div className="flex gap-2">
            <Button asChild className={cn("flex-1", cowWeightPrimaryButtonClass)} style={cowWeightPrimaryButtonStyle}>
              <Link to={`${paths.upload}?mode=${state.mode}`}>{t("cowWeight.newEstimate")}</Link>
            </Button>
            <Button asChild variant="outline" className={cn("flex-1", cowWeightOutlineButtonClass)} style={cowWeightOutlineButtonStyle}>
              <Link to={paths.hub}>{t("cowWeight.back")}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </CowWeightPageShell>
  );
}
