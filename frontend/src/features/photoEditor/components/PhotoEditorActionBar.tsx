import { Button } from "@/components/ui/button";
import { Download, ImagePlus, Loader2, Save } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { photoEditorTheme } from "../lib/photoEditorTheme";

interface Props {
  onSaveDraft: () => void;
  onDownload: () => void;
  onApply?: () => void;
  applyLabelKey?: string;
  showApply?: boolean;
  saving?: boolean;
  className?: string;
}

export default function PhotoEditorActionBar({
  onSaveDraft,
  onDownload,
  onApply,
  applyLabelKey,
  showApply,
  saving,
  className = "",
}: Props) {
  const { t } = useLanguage();
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 border-t bg-card shrink-0 safe-area-pb ${className}`}
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="flex-1 gap-1 min-w-0"
        disabled={saving}
        onClick={onSaveDraft}
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" /> : <Save className="h-3.5 w-3.5 shrink-0" />}
        <span className="truncate">{t("seller.photoEditor.saveDraft")}</span>
      </Button>
      <Button type="button" variant="outline" size="sm" className="gap-1 shrink-0" onClick={onDownload}>
        <Download className="h-3.5 w-3.5" />
        <span className="hidden xs:inline">{t("seller.photoEditor.download")}</span>
      </Button>
      {showApply && onApply && applyLabelKey && (
        <Button
          type="button"
          size="sm"
          className="flex-1 gap-1 text-white min-w-0"
          style={photoEditorTheme.buttonStyle}
          onClick={onApply}
        >
          <ImagePlus className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{t(applyLabelKey)}</span>
        </Button>
      )}
    </div>
  );
}
