import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { photoEditorTheme } from "../lib/photoEditorTheme";
import { Image as ImageIcon, Upload } from "lucide-react";

export type UploadImageLayer = { id: string; name: string; thumbSrc?: string };

type Props = {
  imageLayers: UploadImageLayer[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onUploadFiles: (files: File[]) => void;
};

export default function FabricUploadPanel({ imageLayers, selectedId, onSelect, onUploadFiles }: Props) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => inputRef.current?.click();

  return (
    <div className="fabric-editor-upload-panel space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          if (files.length) onUploadFiles(files);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        className="w-full gap-2 text-white"
        style={photoEditorTheme.buttonStyle}
        onClick={openPicker}
      >
        <Upload className="h-4 w-4" />
        {t("seller.photoEditor.toastUploadPhoto")}
      </Button>
      <p className="fabric-editor-hint">{t("seller.photoEditor.uploadHint")}</p>

      <div>
        <h4 className="fabric-editor-upload-gallery-title">{t("seller.photoEditor.uploadedImagesTitle")}</h4>
        {imageLayers.length === 0 ? (
          <p className="fabric-editor-upload-empty">{t("seller.photoEditor.uploadedImagesEmpty")}</p>
        ) : (
          <ul className="fabric-editor-upload-gallery">
            {imageLayers.map((img) => (
              <li key={img.id}>
                <button
                  type="button"
                  className={cn(
                    "fabric-editor-upload-thumb",
                    selectedId === img.id && "fabric-editor-upload-thumb--selected",
                  )}
                  onClick={() => onSelect(img.id)}
                >
                  {img.thumbSrc ? (
                    <img src={img.thumbSrc} alt="" className="fabric-editor-upload-thumb-img" />
                  ) : (
                    <span className="fabric-editor-upload-thumb-fallback">
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    </span>
                  )}
                  <span className="fabric-editor-upload-thumb-name">{img.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
