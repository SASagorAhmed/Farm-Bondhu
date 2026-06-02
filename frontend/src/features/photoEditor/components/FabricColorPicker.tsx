import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { photoEditorTheme } from "../lib/photoEditorTheme";
import {
  EXTENDED_COLORS,
  GRADIENT_PRESETS,
  VIBRANT_COLORS,
  gradientCss,
  hexToRgb,
  normalizeHex,
  rgbToHex,
} from "../lib/photoEditorColorPalette";
import type { FillSelection } from "../engines/fabric/fabricFillColor";

type Props = {
  value: FillSelection;
  onChange: (value: FillSelection) => void;
  allowGradients?: boolean;
  showTitle?: boolean;
  className?: string;
};

export default function FabricColorPicker({
  value,
  onChange,
  allowGradients = true,
  showTitle = true,
  className,
}: Props) {
  const { t } = useLanguage();
  const [customOpen, setCustomOpen] = useState(false);

  const solidColor = value.type === "solid" ? value.color : DEFAULT_FROM_VALUE(value);
  const rgb = useMemo(() => hexToRgb(solidColor), [solidColor]);

  return (
    <div className={cn("fabric-editor-color-picker space-y-3", className)}>
      {showTitle && (
        <p className="fabric-editor-color-section-title">{t("seller.photoEditor.selectColorToChange")}</p>
      )}

      <div className="fabric-editor-color-swatch-grid">
        {VIBRANT_COLORS.map((color) => (
          <SwatchButton
            key={color}
            color={color}
            selected={value.type === "solid" && normalizeHex(value.color) === normalizeHex(color)}
            onClick={() => onChange({ type: "solid", color })}
          />
        ))}
      </div>

      <div>
        <p className="fabric-editor-color-subtitle">{t("seller.photoEditor.moreColors")}</p>
        <div className="fabric-editor-color-swatch-grid">
          {EXTENDED_COLORS.map((color) => (
            <SwatchButton
              key={color}
              color={color}
              selected={value.type === "solid" && normalizeHex(value.color) === normalizeHex(color)}
              onClick={() => onChange({ type: "solid", color })}
            />
          ))}
        </div>
      </div>

      {allowGradients && (
        <div>
          <p className="fabric-editor-color-subtitle">{t("seller.photoEditor.gradientColors")}</p>
          <div className="fabric-editor-color-swatch-grid">
            {GRADIENT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={cn(
                  "fabric-editor-color-swatch fabric-editor-color-gradient-swatch",
                  value.type === "gradient" &&
                    value.presetId === preset.id &&
                    "fabric-editor-color-swatch--selected",
                )}
                style={{
                  background: gradientCss(preset),
                  ...(value.type === "gradient" && value.presetId === preset.id
                    ? { boxShadow: `0 0 0 2px #fff, 0 0 0 4px ${photoEditorTheme.primary}` }
                    : {}),
                }}
                title={preset.label}
                onClick={() => onChange({ type: "gradient", presetId: preset.id })}
              />
            ))}
          </div>
        </div>
      )}

      <div>
        <button
          type="button"
          className="fabric-editor-color-custom-toggle"
          onClick={() => setCustomOpen((o) => !o)}
        >
          {t("seller.photoEditor.customColor")}
        </button>
        {customOpen && (
          <div className="fabric-editor-color-custom-panel space-y-2 mt-2">
            <div className="flex items-center gap-2">
              <Input
                type="color"
                className="h-9 w-12 p-0 border-0 cursor-pointer"
                value={solidColor}
                onChange={(e) => onChange({ type: "solid", color: e.target.value })}
              />
              <Input
                value={solidColor}
                onChange={(e) => {
                  const next = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`;
                  onChange({ type: "solid", color: next });
                }}
                className="font-mono text-xs"
                placeholder="#000000"
              />
            </div>
            <p className="fabric-editor-color-subtitle">{t("seller.photoEditor.rgbColor")}</p>
            <div className="fabric-editor-grid-2">
              {(["r", "g", "b"] as const).map((channel) => (
                <div key={channel} className="fabric-editor-field">
                  <Label className="text-xs uppercase">{channel}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={255}
                    value={rgb[channel]}
                    onChange={(e) => {
                      const next = { ...rgb, [channel]: Number(e.target.value) || 0 };
                      onChange({ type: "solid", color: rgbToHex(next.r, next.g, next.b) });
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DEFAULT_FROM_VALUE(value: FillSelection): string {
  if (value.type === "solid") return value.color;
  const preset = GRADIENT_PRESETS.find((p) => p.id === value.presetId);
  return preset?.colorStops[0]?.color ?? "#111827";
}

function SwatchButton({
  color,
  selected,
  onClick,
}: {
  color: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn("fabric-editor-color-swatch", selected && "fabric-editor-color-swatch--selected")}
      style={{
        backgroundColor: color,
        ...(selected ? { boxShadow: `0 0 0 2px #fff, 0 0 0 4px ${photoEditorTheme.primary}` } : {}),
        ...(normalizeHex(color) === "#ffffff" ? { border: "1px solid hsl(var(--border))" } : {}),
      }}
      title={color}
      onClick={onClick}
    />
  );
}
