import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Zap, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ICON_COLORS } from "@/lib/iconColors";
import {
  cancelSellerFlashSaleRequest,
  requestSellerFlashSale,
} from "@/lib/sellerFlashSaleApi";
import { useLanguage } from "@/contexts/LanguageContext";

export type SellerFlashSaleProduct = {
  id: string;
  price: number;
  listing_status?: string | null;
  is_flash_sale?: boolean;
  flash_sale_request_status?: string | null;
  flash_sale_review_notes?: string | null;
};

interface Props {
  product: SellerFlashSaleProduct;
  onChanged: () => void;
  compact?: boolean;
}

export default function SellerFlashSaleActions({ product, onChanged, compact }: Props) {
  const { t } = useLanguage();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mrp, setMrp] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const listingStatus = product.listing_status || "approved";
  if (listingStatus !== "approved") return null;

  const requestStatus = product.flash_sale_request_status || null;
  const isLive = Boolean(product.is_flash_sale);

  const submitRequest = async () => {
    setBusy(true);
    const payload: { requested_original_price?: number; notes?: string } = {};
    if (notes.trim()) payload.notes = notes.trim();
    if (mrp.trim()) {
      const n = Number(mrp);
      if (!Number.isFinite(n) || n <= product.price) {
        toast.error(t("seller.flashSale.mrpInvalid"));
        setBusy(false);
        return;
      }
      payload.requested_original_price = n;
    }
    const { ok, error } = await requestSellerFlashSale(product.id, payload);
    setBusy(false);
    if (!ok) {
      toast.error(error || t("seller.flashSale.requestFailed"));
      return;
    }
    toast.success(t("seller.flashSale.requestSubmitted"));
    setDialogOpen(false);
    setMrp("");
    setNotes("");
    onChanged();
  };

  const cancelRequest = async () => {
    setBusy(true);
    const { ok, error } = await cancelSellerFlashSaleRequest(product.id);
    setBusy(false);
    if (!ok) {
      toast.error(error || t("seller.flashSale.cancelFailed"));
      return;
    }
    toast.success(t("seller.flashSale.requestCancelled"));
    onChanged();
  };

  if (isLive) {
    return (
      <Badge
        className={`text-[10px] gap-0.5 ${compact ? "" : "mt-1"}`}
        style={{ backgroundColor: ICON_COLORS.health, color: "white" }}
      >
        <Zap className="h-2.5 w-2.5" />
        {t("seller.flashSale.inFlashSale")}
      </Badge>
    );
  }

  if (requestStatus === "pending") {
    return (
      <div className={`flex flex-wrap items-center gap-1.5 ${compact ? "" : "mt-1"}`}>
        <Badge variant="secondary" className="text-[10px] gap-0.5 bg-amber-100 text-amber-900">
          <Zap className="h-2.5 w-2.5" />
          {t("seller.flashSale.pending")}
        </Badge>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 text-xs px-2"
          disabled={busy}
          onClick={() => void cancelRequest()}
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : t("seller.flashSale.cancelRequest")}
        </Button>
      </div>
    );
  }

  const rejectedNote =
    requestStatus === "rejected" && product.flash_sale_review_notes
      ? product.flash_sale_review_notes
      : null;

  return (
    <div className={compact ? "" : "mt-1 space-y-1"}>
      {requestStatus === "rejected" && (
        <Badge variant="secondary" className="text-[10px] bg-red-100 text-red-800">
          {t("seller.flashSale.rejected")}
        </Badge>
      )}
      {rejectedNote && (
        <p className="text-xs text-destructive max-w-[220px]">{rejectedNote}</p>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 text-xs gap-1"
        onClick={() => setDialogOpen(true)}
      >
        <Zap className="h-3 w-3" />
        {requestStatus === "rejected"
          ? t("seller.flashSale.requestAgain")
          : t("seller.flashSale.request")}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("seller.flashSale.dialogTitle")}</DialogTitle>
            <DialogDescription>{t("seller.flashSale.dialogDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">{t("seller.flashSale.suggestedMrp")}</Label>
              <Input
                type="number"
                min={0}
                placeholder={String(product.price + 50)}
                value={mrp}
                onChange={(e) => setMrp(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("seller.flashSale.salePrice")}: ৳{product.price}
              </p>
            </div>
            <div>
              <Label className="text-xs">{t("seller.flashSale.notesOptional")}</Label>
              <Textarea
                rows={2}
                maxLength={500}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t("adminModeration.cancel")}
            </Button>
            <Button disabled={busy} onClick={() => void submitRequest()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("seller.flashSale.submitRequest")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
