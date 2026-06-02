import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { photoEditorTheme } from "../lib/photoEditorTheme";
import { PHOTO_EDITOR_FONTS, matchFontFamily } from "../lib/photoEditorFonts";

type Props = {
  value: string;
  onChange: (fontFamily: string) => void;
  className?: string;
};

export default function FabricFontPicker({ value, onChange, className }: Props) {
  const { t } = useLanguage();
  const current = matchFontFamily(value);

  return (
    <div className={cn("fabric-editor-font-picker", className)}>
      <p className="fabric-editor-color-section-title">{t("seller.photoEditor.fontFamily")}</p>
      <div className="fabric-editor-font-grid">
        {PHOTO_EDITOR_FONTS.map((font) => {
          const selected = current === font.family;
          return (
            <button
              key={font.id}
              type="button"
              className={cn("fabric-editor-font-tile", selected && "fabric-editor-font-tile--selected")}
              style={selected ? { borderColor: photoEditorTheme.primary } : undefined}
              onClick={() => onChange(font.family)}
              title={font.label}
            >
              <span className="fabric-editor-font-tile-preview" style={{ fontFamily: font.family }}>
                Aa
              </span>
              <span className="fabric-editor-font-tile-label">{font.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
