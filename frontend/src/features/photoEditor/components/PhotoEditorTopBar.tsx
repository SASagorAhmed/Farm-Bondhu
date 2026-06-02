import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Redo2, Undo2, Download, Save, Loader2, ImagePlus } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { photoEditorTheme } from "../lib/photoEditorTheme";
import type { AutoSaveStatus } from "../hooks/usePhotoEditorAutoSave";

interface Props {
  title: string;
  onTitleChange?: (title: string) => void;
  onTitleBlur?: () => void;
  onTitleFocus?: () => void;
  titleError?: string | null;
  onBack: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSaveDraft: () => void;
  onDownload: () => void;
  onApply?: () => void;
  applyLabelKey?: string;
  saving?: boolean;
  saveStatus?: AutoSaveStatus;
  lastSavedAt?: Date | null;
  showApply?: boolean;
  /** Hide primary actions on small screens (shown in bottom bar instead). */
  hideActionsOnMobile?: boolean;
}

function SaveStatusLabel({
  saveStatus,
  saving,
}: {
  saveStatus?: AutoSaveStatus;
  saving?: boolean;
}) {
  const { t } = useLanguage();

  if (saving || saveStatus === "saving") {
    return (
      <span className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground shrink-0">
        <Loader2 className="h-3 w-3 animate-spin" />
        {t("seller.photoEditor.autoSaving")}
      </span>
    );
  }

  if (saveStatus === "pending") {
    return (
      <span className="hidden sm:inline text-xs text-muted-foreground shrink-0">
        {t("seller.photoEditor.autoSaving")}
      </span>
    );
  }

  if (saveStatus === "saved") {
    return (
      <span className="hidden sm:inline text-xs text-muted-foreground shrink-0">
        {t("seller.photoEditor.autoSaved")}
      </span>
    );
  }

  if (saveStatus === "error") {
    return (
      <span className="hidden sm:inline text-xs text-destructive shrink-0">
        {t("seller.photoEditor.autoSaveFailed")}
      </span>
    );
  }

  return null;
}

export default function PhotoEditorTopBar({
  title,
  onTitleChange,
  onTitleBlur,
  onTitleFocus,
  titleError,
  onBack,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSaveDraft,
  onDownload,
  onApply,
  applyLabelKey,
  saving,
  saveStatus,
  showApply,
  hideActionsOnMobile = true,
}: Props) {
  const { t } = useLanguage();
  const actionClass = hideActionsOnMobile ? "hidden md:flex" : "flex";

  return (
    <header className="sticky top-0 z-20 flex flex-col shrink-0 border-b bg-card">
      <div className="h-1" style={{ background: photoEditorTheme.gradient }} />
      <div className="flex items-center gap-2 px-3 py-2">
        <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        {onTitleChange ? (
          <div className="flex flex-col flex-1 min-w-0 max-w-[240px]">
            <Input
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              onBlur={onTitleBlur}
              onFocus={onTitleFocus}
              aria-invalid={Boolean(titleError)}
              className="h-8 text-sm font-medium"
            />
            {titleError && (
              <span className="text-[10px] text-destructive truncate mt-0.5">{titleError}</span>
            )}
          </div>
        ) : (
          <span className="text-sm font-semibold truncate flex-1 min-w-0">{title}</span>
        )}
        <SaveStatusLabel saveStatus={saveStatus} saving={saving} />
        <div className="flex items-center gap-1 shrink-0">
          <Button type="button" variant="outline" size="icon" className="h-8 w-8" disabled={!canUndo} onClick={onUndo}>
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="icon" className="h-8 w-8" disabled={!canRedo} onClick={onRedo}>
            <Redo2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className={`items-center gap-1 px-3 pb-2 flex-wrap ${actionClass}`}>
        <Button type="button" variant="outline" size="sm" className="gap-1" disabled={saving} onClick={onSaveDraft}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {t("seller.photoEditor.saveDraft")}
        </Button>
        <Button type="button" variant="outline" size="sm" className="gap-1" onClick={onDownload}>
          <Download className="h-3.5 w-3.5" />
          {t("seller.photoEditor.download")}
        </Button>
        {showApply && onApply && applyLabelKey && (
          <Button
            type="button"
            size="sm"
            className="gap-1 text-white"
            style={photoEditorTheme.buttonStyle}
            onClick={onApply}
          >
            <ImagePlus className="h-3.5 w-3.5" />
            {t(applyLabelKey)}
          </Button>
        )}
      </div>
    </header>
  );
}
