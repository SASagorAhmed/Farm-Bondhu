import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { photoEditorTheme } from "../lib/photoEditorTheme";
import { PHOTO_EDITOR_SHAPES, type PhotoEditorShapeKind } from "../lib/photoEditorShapes";
import { STICKER_OPTIONS } from "../lib/stickers";
import type { PhotoEditorTool, PresetKey } from "../types";
import type { PresetDefinition } from "../lib/presets";
import FabricUploadPanel, { type UploadImageLayer } from "./FabricUploadPanel";
import FabricFontPicker from "./FabricFontPicker";
import FabricColorPicker from "./FabricColorPicker";
import type { FillSelection } from "../engines/fabric/fabricFillColor";

export type FabricToolPanelProps = {
  activeTool: PhotoEditorTool;
  preset: PresetDefinition;
  presetParam: PresetKey;
  presetLocked: boolean;
  docSize: { width: number; height: number };
  bgColor: string;
  onBgColorChange: (color: string) => void;
  onBgImageUpload: (file: File) => void;
  onRemoveBgImage: () => void;
  hasBgImage: boolean;
  customW: string;
  customH: string;
  onCustomW: (v: string) => void;
  onCustomH: (v: string) => void;
  onApplyCustomSize: () => void;
  imageLayers: UploadImageLayer[];
  selectedId: string | null;
  onImageLayerSelect: (id: string) => void;
  onUploadFiles: (files: File[]) => void;
  defaultTextFont: string;
  onDefaultTextFontChange: (fontFamily: string) => void;
  defaultTextFill: FillSelection;
  onDefaultTextFillChange: (fill: FillSelection) => void;
  onAddShape: (kind: PhotoEditorShapeKind) => void;
  onAddSticker: (emoji: string) => void;
  cropInset: { left: number; top: number; right: number; bottom: number };
  onCropInsetChange: (edge: "left" | "top" | "right" | "bottom", value: number) => void;
  onResetCrop: () => void;
  onFitImageToCanvas: () => void;
  onFillImageToCanvas: () => void;
  hasSelectedImage: boolean;
  adjustValues: { brightness: number; contrast: number; saturation: number; blur: number };
  onAdjustChange: (key: "brightness" | "contrast" | "saturation" | "blur", value: number) => void;
};

function ToolSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="fabric-editor-rail-section">
      <h3 className="fabric-editor-rail-title">{title}</h3>
      {children}
    </div>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="fabric-editor-field">
      <div className="flex justify-between items-center">
        <Label className="text-xs">{label}</Label>
        <span className="fabric-editor-range-value">{value}</span>
      </div>
      <Input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

export default function FabricToolPanel(props: FabricToolPanelProps) {
  const { t } = useLanguage();
  const toolTitle = (tool: PhotoEditorTool) => {
    const keys: Record<PhotoEditorTool, string> = {
      preset: "seller.photoEditor.toolPreset",
      upload: "seller.photoEditor.toolUpload",
      crop: "seller.photoEditor.toolCrop",
      adjust: "seller.photoEditor.toolAdjust",
      text: "seller.photoEditor.toolText",
      shapes: "seller.photoEditor.toolShapes",
      stickers: "seller.photoEditor.toolStickers",
      background: "seller.photoEditor.toolBackground",
      layers: "seller.photoEditor.toolLayers",
    };
    return t(keys[tool]);
  };

  return (
    <ToolSection title={toolTitle(props.activeTool)}>
      {props.activeTool === "preset" && (
        <div className="space-y-2">
          <p className="fabric-editor-hint">
            {t(props.preset.labelKey)} · {props.preset.aspectLabel} · {props.docSize.width}×
            {props.docSize.height}px
          </p>
          {props.presetLocked ? (
            <p className="fabric-editor-hint">{t("seller.photoEditor.canvasSizeLocked")}</p>
          ) : (
            <div className="fabric-editor-grid-2">
              <div className="fabric-editor-field">
                <Label className="text-xs">W</Label>
                <Input value={props.customW} onChange={(e) => props.onCustomW(e.target.value)} />
              </div>
              <div className="fabric-editor-field">
                <Label className="text-xs">H</Label>
                <Input value={props.customH} onChange={(e) => props.onCustomH(e.target.value)} />
              </div>
              <Button size="sm" className="col-span-2" onClick={props.onApplyCustomSize}>
                Apply size
              </Button>
            </div>
          )}
        </div>
      )}

      {props.activeTool === "upload" && (
        <FabricUploadPanel
          imageLayers={props.imageLayers}
          selectedId={props.selectedId}
          onSelect={props.onImageLayerSelect}
          onUploadFiles={props.onUploadFiles}
        />
      )}

      {props.activeTool === "crop" && (
        <div className="space-y-2">
          <p className="fabric-editor-hint">{t("seller.photoEditor.cropHint")}</p>
          {props.hasSelectedImage ? (
            <>
              {(["left", "top", "right", "bottom"] as const).map((edge) => (
                <RangeField
                  key={edge}
                  label={edge}
                  min={0}
                  max={40}
                  value={props.cropInset[edge]}
                  onChange={(v) => props.onCropInsetChange(edge, v)}
                />
              ))}
              <Button size="sm" variant="outline" className="w-full" onClick={props.onResetCrop}>
                {t("seller.photoEditor.resetCrop")}
              </Button>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" className="flex-1" onClick={props.onFitImageToCanvas}>
                  {t("seller.photoEditor.fitToCanvas")}
                </Button>
                <Button size="sm" variant="secondary" className="flex-1" onClick={props.onFillImageToCanvas}>
                  {t("seller.photoEditor.fillCanvas")}
                </Button>
              </div>
            </>
          ) : (
            <p className="fabric-editor-warn">{t("seller.photoEditor.selectImageFirst")}</p>
          )}
        </div>
      )}

      {props.activeTool === "adjust" && (
        <div className="space-y-2">
          <p className="fabric-editor-hint">{t("seller.photoEditor.adjustHint")}</p>
          {props.hasSelectedImage ? (
            <>
              <RangeField
                label={t("seller.photoEditor.brightness")}
                min={-100}
                max={100}
                value={props.adjustValues.brightness}
                onChange={(v) => props.onAdjustChange("brightness", v)}
              />
              <RangeField
                label={t("seller.photoEditor.contrast")}
                min={-100}
                max={100}
                value={props.adjustValues.contrast}
                onChange={(v) => props.onAdjustChange("contrast", v)}
              />
              <RangeField
                label={t("seller.photoEditor.saturation")}
                min={-100}
                max={100}
                value={props.adjustValues.saturation}
                onChange={(v) => props.onAdjustChange("saturation", v)}
              />
              <RangeField
                label={t("seller.photoEditor.blur")}
                min={0}
                max={100}
                value={props.adjustValues.blur}
                onChange={(v) => props.onAdjustChange("blur", v)}
              />
            </>
          ) : (
            <p className="fabric-editor-warn">{t("seller.photoEditor.selectImageFirst")}</p>
          )}
        </div>
      )}

      {props.activeTool === "text" && (
        <div className="space-y-3">
          <FabricFontPicker value={props.defaultTextFont} onChange={props.onDefaultTextFontChange} />
          <FabricColorPicker value={props.defaultTextFill} onChange={props.onDefaultTextFillChange} />
          <p className="fabric-editor-hint">{t("seller.photoEditor.clickCanvasToAddText")}</p>
          <p className="fabric-editor-hint">{t("seller.photoEditor.textboxHint")}</p>
        </div>
      )}

      {props.activeTool === "shapes" && (
        <div className="grid grid-cols-3 gap-2">
          {PHOTO_EDITOR_SHAPES.map(({ id, icon: Icon, labelKey }) => (
            <Button
              key={id}
              type="button"
              variant="outline"
              className="flex flex-col gap-1 h-auto py-3 px-2"
              title={t(labelKey)}
              onClick={() => props.onAddShape(id)}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="text-[10px] leading-tight">{t(labelKey)}</span>
            </Button>
          ))}
        </div>
      )}

      {props.activeTool === "stickers" && (
        <div className="grid grid-cols-4 gap-2">
          {STICKER_OPTIONS.map((s) => (
            <Button key={s.id} variant="outline" className="h-12 text-2xl" onClick={() => props.onAddSticker(s.emoji)}>
              {s.emoji}
            </Button>
          ))}
        </div>
      )}

      {props.activeTool === "background" && (
        <div className="space-y-2">
          <FabricColorPicker
            value={{ type: "solid", color: props.bgColor }}
            onChange={(fill) => {
              if (fill.type === "solid") props.onBgColorChange(fill.color);
            }}
            allowGradients={false}
          />
          <div className="fabric-editor-field">
            <Label className="text-xs">{t("seller.photoEditor.bgImage")}</Label>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) props.onBgImageUpload(f);
                e.target.value = "";
              }}
            />
          </div>
          {props.hasBgImage && (
            <Button size="sm" variant="outline" className="w-full" onClick={props.onRemoveBgImage}>
              {t("seller.photoEditor.removeBgImage")}
            </Button>
          )}
          <p className="fabric-editor-hint">{t("seller.photoEditor.bgImageFillHint")}</p>
        </div>
      )}

      {props.activeTool === "layers" && (
        <p className="fabric-editor-hint">{t("seller.photoEditor.layersToolHint")}</p>
      )}
    </ToolSection>
  );
}
