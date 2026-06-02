import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { isDraftTitleTaken, normalizeDraftTitle } from "../lib/draftTitleUtils";
import { photoEditorTheme } from "../lib/photoEditorTheme";

type Props = {
  open: boolean;
  initialName: string;
  existingTitles: string[];
  onConfirm: (name: string) => void;
  onCancel: () => void;
};

export default function PhotoEditorProjectNameDialog({
  open,
  initialName,
  existingTitles,
  onConfirm,
  onCancel,
}: Props) {
  const { t } = useLanguage();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setError(null);
    }
  }, [open, initialName]);

  const submit = () => {
    const trimmed = normalizeDraftTitle(name);
    if (!trimmed) {
      setError(t("seller.photoEditor.projectNameRequired"));
      return;
    }
    if (isDraftTitleTaken(trimmed, existingTitles)) {
      setError(t("seller.photoEditor.projectNameTaken"));
      return;
    }
    onConfirm(trimmed);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t("seller.photoEditor.projectNameDialogTitle")}</DialogTitle>
          <DialogDescription>{t("seller.photoEditor.projectNameDialogHint")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="photo-editor-project-name">{t("seller.photoEditor.projectNameLabel")}</Label>
          <Input
            id="photo-editor-project-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            placeholder={t("seller.photoEditor.projectNamePlaceholder")}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            autoFocus
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("seller.photoEditor.backHome")}
          </Button>
          <Button type="button" className="text-white" style={photoEditorTheme.buttonStyle} onClick={submit}>
            {t("seller.photoEditor.projectNameContinue")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
