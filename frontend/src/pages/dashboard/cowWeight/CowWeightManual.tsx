import { useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/contexts/LanguageContext";
import { cowWeightAccentStyle, COW_WEIGHT_THEME, cowWeightBackLinkClass, cowWeightBackLinkStyle, cowWeightOutlineButtonClass, cowWeightOutlineButtonStyle, cowWeightPrimaryButtonClass, cowWeightPrimaryButtonStyle } from "@/lib/cowWeight/cowWeightTheme";
import { COW_WEIGHT_DETECTION_MODE, saveCowEstimation } from "@/lib/cowWeight/api";
import { analyzeCowImageWithCloudDirection } from "@/lib/cowWeight/analyzeCow";
import { computeScanMetrics, WEIGHT_FORMULA_DIVISOR } from "@/lib/cowWeight/scanMetrics";
import {
  estimateManualFromDimensions,
  validateManualDimensions,
} from "@/lib/cowWeight/manualEstimate";
import { compressDataUrl, fileToDataUrl } from "@/lib/cowWeight/imageUtils";
import { parseExifFromFile } from "@/lib/cowWeight/imageExif";
import type { CowWeightResultState, PhotoExifMeta } from "@/lib/cowWeight/navigation";
import CowWeightPageShell from "@/components/cowWeight/CowWeightPageShell";
import CowWeightManualDemoImage from "@/components/cowWeight/CowWeightManualDemoImage";
import CowWeightPhotoActions from "@/components/cowWeight/CowWeightPhotoActions";
import CowWeightCowNameField from "@/components/cowWeight/CowWeightCowNameField";
import CowWeightDisclaimer from "@/components/cowWeight/CowWeightDisclaimer";
import { useCowWeightPaths } from "@/lib/cowWeight/cowWeightPaths";

type Suggestion = {
  chestWidthCm: number;
  bodyLengthCm: number;
  confidence: number;
  scaleMethod: string;
};

export default function CowWeightManual() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const paths = useCowWeightPaths();
  const saveInFlight = useRef(false);

  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [photoExif, setPhotoExif] = useState<PhotoExifMeta | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [cowName, setCowName] = useState("");

  const [chestInput, setChestInput] = useState("");
  const [lengthInput, setLengthInput] = useState("");

  const chest = Number(chestInput);
  const length = Number(lengthInput);
  const validation = useMemo(
    () => validateManualDimensions(chest, length),
    [chest, length]
  );

  const estimate = useMemo(() => {
    if (!validation.ok) return null;
    return estimateManualFromDimensions(chest, length);
  }, [validation, chest, length]);

  const onFile = async (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    try {
      const [nextDataUrl, exif] = await Promise.all([fileToDataUrl(file), parseExifFromFile(file)]);
      setDataUrl(nextDataUrl);
      setPhotoExif(exif ?? null);
      setSuggestion(null);
      toast.success(t("cowWeight.manual.photoReady"));
    } catch {
      toast.error(t("cowWeight.manual.photoFailed"));
    }
  };

  const onSuggest = async () => {
    if (!dataUrl) return;
    setSuggesting(true);
    try {
      const analysis = await analyzeCowImageWithCloudDirection(dataUrl, photoExif);
      const metrics = computeScanMetrics(COW_WEIGHT_DETECTION_MODE, analysis.lines, analysis);
      const next: Suggestion = {
        chestWidthCm: metrics.chestWidthCm,
        bodyLengthCm: metrics.bodyLengthCm,
        confidence: analysis.confidence,
        scaleMethod: metrics.scaleMethod,
      };
      setSuggestion(next);
      toast.success(t("cowWeight.manual.suggestedReady"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("cowWeight.manual.suggestFailed");
      toast.error(msg);
    } finally {
      setSuggesting(false);
    }
  };

  const onUseSuggestion = () => {
    if (!suggestion) return;
    setChestInput(String(suggestion.chestWidthCm));
    setLengthInput(String(suggestion.bodyLengthCm));
  };

  const onClearPhoto = () => {
    setDataUrl(null);
    setPhotoExif(null);
    setSuggestion(null);
  };

  const canSave = !!estimate && !saving && !saveInFlight.current;

  const onSave = async () => {
    if (!estimate || !validation.ok) return;
    if (saveInFlight.current) return;
    saveInFlight.current = true;
    setSaving(true);
    try {
      let filePayload: string | undefined;
      if (dataUrl) {
        try {
          filePayload = await compressDataUrl(dataUrl);
        } catch {
          filePayload = dataUrl;
        }
      }

      const row = await saveCowEstimation({
        detection_mode: COW_WEIGHT_DETECTION_MODE,
        input_method: "manual",
        chest_width_cm: chest,
        body_length_cm: length,
        confidence: suggestion ? 0.65 : 0.5,
        cow_name: cowName.trim() || undefined,
        file_data: filePayload,
        annotation_json: {
          source: "manual_entry",
          userEntered: {
            chest_width_cm: chest,
            body_length_cm: length,
          },
          aiSuggestion: suggestion
            ? {
                chest_width_cm: suggestion.chestWidthCm,
                body_length_cm: suggestion.bodyLengthCm,
                scaleMethod: suggestion.scaleMethod,
                confidence: suggestion.confidence,
              }
            : null,
          formulaDivisor: WEIGHT_FORMULA_DIVISOR,
          photoUsed: !!dataUrl,
          focalLengthMm: photoExif?.focalLengthMm ?? null,
        },
      });

      const next: CowWeightResultState = { estimation: row, mode: COW_WEIGHT_DETECTION_MODE };
      navigate(paths.result, { state: next });
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("cowWeight.saveFailed");
      toast.error(msg);
      if (msg.toLowerCase().includes("sign in") || msg.toLowerCase().includes("session")) {
        navigate("/login", { replace: true, state: { from: location.pathname } });
      }
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  };

  return (
    <CowWeightPageShell>
      <Button variant="ghost" size="sm" asChild className={cowWeightBackLinkClass} style={cowWeightBackLinkStyle}>
        <Link to={paths.hub}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t("cowWeight.back")}
        </Link>
      </Button>

      <CowWeightDisclaimer />

      <Card>
        <CardHeader>
          <CardTitle>{t("cowWeight.manual.cardTitle")}</CardTitle>
          <CardDescription>{t("cowWeight.manual.cardDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <CowWeightManualDemoImage />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("cowWeight.manual.photoTitle")}</CardTitle>
          <CardDescription>{t("cowWeight.manual.photoDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <CowWeightPhotoActions layout="grid" onImageFile={(file) => void onFile(file)} />
          {dataUrl ? (
            <div className="space-y-2">
              <img src={dataUrl} alt="" className="w-full max-h-[min(70vh,720px)] object-contain bg-muted/30 rounded-md border" />
              <Button type="button" size="sm" variant="ghost" className={cowWeightBackLinkClass} style={cowWeightBackLinkStyle} onClick={onClearPhoto}>
                {t("cowWeight.manual.skipPhoto")}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{t("cowWeight.manual.noPhotoHint")}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("cowWeight.manual.aiSuggestTitle")}</CardTitle>
          <CardDescription>{t("cowWeight.manual.aiSuggestDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            type="button"
            disabled={!dataUrl || suggesting}
            className={cowWeightPrimaryButtonClass}
            style={cowWeightPrimaryButtonStyle}
            onClick={() => void onSuggest()}
          >
            {suggesting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {t("cowWeight.manual.suggestBtn")}
          </Button>
          {suggestion ? (
            <div className="rounded-md border p-3 space-y-2" style={{ borderColor: COW_WEIGHT_THEME.farmBorder, backgroundColor: COW_WEIGHT_THEME.farmBg }}>
              <Badge variant="outline">{t("cowWeight.manual.suggestionBadge")}</Badge>
              <p className="text-sm">
                {t("cowWeight.manual.suggestedDims", {
                  chest: suggestion.chestWidthCm.toFixed(2),
                  length: suggestion.bodyLengthCm.toFixed(2),
                })}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cowWeightOutlineButtonClass}
                style={cowWeightOutlineButtonStyle}
                onClick={onUseSuggestion}
              >
                {t("cowWeight.manual.useSuggestion")}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("cowWeight.manual.measureTitle")}</CardTitle>
          <CardDescription>{t("cowWeight.manual.measureDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="manual-chest">{t("cowWeight.manual.chestLabel")}</Label>
              <Input
                id="manual-chest"
                type="number"
                min={0}
                step="0.01"
                value={chestInput}
                onChange={(e) => setChestInput(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-length">{t("cowWeight.manual.lengthLabel")}</Label>
              <Input
                id="manual-length"
                type="number"
                min={0}
                step="0.01"
                value={lengthInput}
                onChange={(e) => setLengthInput(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t("cowWeight.manual.measureHelp")}</p>
          {!validation.ok && (chestInput || lengthInput) ? (
            <p className="text-sm text-destructive">{validation.error}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("cowWeight.manual.resultTitle")}</CardTitle>
          <CardDescription>{t("cowWeight.manual.resultDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-muted/50 p-4 text-center">
              <p className="text-xs text-muted-foreground">{t("cowWeight.liveWeight")}</p>
              <p className="text-2xl font-bold" style={cowWeightAccentStyle("farm")}>
                {estimate ? `${estimate.estimatedLiveWeightKg} kg` : "—"}
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 p-4 text-center">
              <p className="text-xs text-muted-foreground">{t("cowWeight.edibleMeat")}</p>
              <p className="text-2xl font-bold">{estimate ? `${estimate.edibleMeatKg} kg` : "—"}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("cowWeight.manual.formula", { divisor: WEIGHT_FORMULA_DIVISOR })}
          </p>
          {estimate ? (
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell>{t("cowWeight.solidMeat")}</TableCell>
                  <TableCell className="text-right font-medium">{estimate.breakdown.solid_meat_kg} kg</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("cowWeight.bone")}</TableCell>
                  <TableCell className="text-right font-medium">{estimate.breakdown.bone_kg} kg</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("cowWeight.fat")}</TableCell>
                  <TableCell className="text-right font-medium">{estimate.breakdown.fat_kg} kg</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("cowWeight.headMeat")}</TableCell>
                  <TableCell className="text-right font-medium">{estimate.breakdown.head_meat_kg} kg</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("cowWeight.liverHeart")}</TableCell>
                  <TableCell className="text-right font-medium">{estimate.breakdown.liver_heart_kg} kg</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>

      <CowWeightCowNameField value={cowName} onChange={setCowName} id="cow-weight-manual-name" />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={!canSave}
          className={cowWeightPrimaryButtonClass}
          style={cowWeightPrimaryButtonStyle}
          onClick={() => void onSave()}
        >
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          {t("cowWeight.manual.save")}
        </Button>
        <Button type="button" variant="outline" asChild className={cowWeightOutlineButtonClass} style={cowWeightOutlineButtonStyle}>
          <Link to={paths.upload}>{t("cowWeight.manual.tryAiFlow")}</Link>
        </Button>
      </div>
    </CowWeightPageShell>
  );
}
