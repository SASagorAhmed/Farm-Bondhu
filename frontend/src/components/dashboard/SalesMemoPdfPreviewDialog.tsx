import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { ICON_COLORS } from "@/lib/iconColors";

type Props = {
  open: boolean;
  url: string | null;
  title?: string;
  onClose: () => void;
  onDownload?: () => void;
  downloadLabel?: string;
};

export default function SalesMemoPdfPreviewDialog({
  open,
  url,
  title = "Sales memo PDF preview",
  onClose,
  onDownload,
  downloadLabel = "Download PDF",
}: Props) {
  const accent = ICON_COLORS.farmBrand;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Review the generated memo, then download when ready.</DialogDescription>
        </DialogHeader>
        <div className="h-[70vh] overflow-hidden rounded-xl border bg-muted/20">
          {url ? (
            <iframe src={url} title={title} className="h-full w-full bg-white" />
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          {onDownload && (
            <Button
              type="button"
              className="gap-1 text-white"
              style={{ backgroundColor: accent }}
              onClick={onDownload}
            >
              <Download className="h-4 w-4" />
              {downloadLabel}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
