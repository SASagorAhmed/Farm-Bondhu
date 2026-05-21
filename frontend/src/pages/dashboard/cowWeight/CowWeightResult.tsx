import { Link, useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/contexts/LanguageContext";
import type { CowWeightResultState } from "@/lib/cowWeight/navigation";

export default function CowWeightResult() {
  const { t } = useLanguage();
  const location = useLocation();
  const state = location.state as CowWeightResultState | null;
  const row = state?.estimation;

  if (!row) {
    return (
      <div className="p-6 text-center space-y-4">
        <p className="text-muted-foreground">{t("cowWeight.noResult")}</p>
        <Button asChild>
          <Link to="/dashboard/cow-weight">{t("cowWeight.back")}</Link>
        </Button>
      </div>
    );
  }

  const b = row.breakdown;

  return (
    <div className="space-y-6 max-w-lg">
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle>{t("cowWeight.resultTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-muted/50 p-4 text-center">
              <p className="text-xs text-muted-foreground">{t("cowWeight.liveWeight")}</p>
              <p className="text-2xl font-bold text-primary">{row.estimated_live_weight_kg} kg</p>
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
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1">
            {t("cowWeight.disclaimer")}
          </p>

          <div className="flex gap-2">
            <Button asChild className="flex-1">
              <Link to={`/dashboard/cow-weight/upload?mode=${state.mode}`}>{t("cowWeight.newEstimate")}</Link>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link to="/dashboard/cow-weight">{t("cowWeight.back")}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
