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
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const CONFIRM_PHRASE = "greenbondhu";

type AdminGreenbondhuConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  actionLabel: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: (confirmPhrase: string) => void | Promise<void>;
};

export function AdminGreenbondhuConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  actionLabel,
  destructive,
  loading,
  onConfirm,
}: AdminGreenbondhuConfirmDialogProps) {
  const { t } = useLanguage();
  const [phrase, setPhrase] = useState("");
  const matches = phrase.trim().toLowerCase() === CONFIRM_PHRASE;

  useEffect(() => {
    if (!open) setPhrase("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="greenbondhu-confirm">
            {t("adminModeration.confirmLabel")}{" "}
            <span className="font-semibold text-foreground">{CONFIRM_PHRASE}</span>{" "}
            {t("adminModeration.confirmSuffix")}
          </Label>
          <Input
            id="greenbondhu-confirm"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            placeholder={CONFIRM_PHRASE}
            autoComplete="off"
            disabled={loading}
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t("adminModeration.cancel")}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={!matches || loading}
            onClick={() => onConfirm(CONFIRM_PHRASE)}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
