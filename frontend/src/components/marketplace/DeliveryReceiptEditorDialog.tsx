import { useEffect, useMemo, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Download, FileText, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import type { DeliveryAddress, MarketplaceOrder } from "@/contexts/OrderContext";
import { VENDOR_THEME } from "@/lib/vendorTheme";
import { ICON_COLORS } from "@/lib/iconColors";
import { fetchDeliveryReceiptSellerInfo } from "@/lib/fetchDeliveryReceiptSellerInfo";
import {
  deliveryReceiptPreviewLines,
  downloadDeliveryReceiptPdf,
  orderRef,
  orderToDeliveryReceiptDraft,
  printDeliveryReceiptPdf,
  type DeliveryReceiptDraft,
} from "@/lib/marketplaceDeliveryReceiptPdf";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: MarketplaceOrder;
  variant?: "seller" | "admin";
}

type FormState = {
  sellerPhone: string;
  sellerLocation: string;
  recipientName: string;
  phone: string;
  altPhone: string;
  division: string;
  district: string;
  upazila: string;
  area: string;
  address: string;
  city: string;
  landmark: string;
  note: string;
};

function formFromDraft(draft: DeliveryReceiptDraft): FormState {
  const d = draft.delivery;
  return {
    sellerPhone: draft.seller.phone || "",
    sellerLocation: draft.seller.location || "",
    recipientName: d.recipientName || draft.buyerName,
    phone: d.phone || "",
    altPhone: d.altPhone || "",
    division: d.division || "",
    district: d.district || "",
    upazila: d.upazila || "",
    area: d.area || "",
    address: d.address || "",
    city: d.city || "",
    landmark: d.landmark || "",
    note: d.note || "",
  };
}

function draftFromForm(base: DeliveryReceiptDraft, form: FormState): DeliveryReceiptDraft {
  const delivery: DeliveryAddress = {
    ...base.delivery,
    recipientName: form.recipientName.trim(),
    phone: form.phone.trim(),
    altPhone: form.altPhone.trim() || undefined,
    division: form.division.trim() || undefined,
    district: form.district.trim() || undefined,
    upazila: form.upazila.trim() || undefined,
    area: form.area.trim(),
    address: form.address.trim(),
    city: form.city.trim() || form.district.trim(),
    landmark: form.landmark.trim() || undefined,
    note: form.note.trim() || undefined,
  };
  return {
    ...base,
    delivery,
    seller: {
      ...base.seller,
      phone: form.sellerPhone.trim() || undefined,
      location: form.sellerLocation.trim() || undefined,
    },
  };
}

export default function DeliveryReceiptEditorDialog({
  open,
  onOpenChange,
  order,
  variant = "seller",
}: Props) {
  const accent = variant === "admin" ? ICON_COLORS.farm : VENDOR_THEME.primary;
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<"download" | "print" | null>(null);
  const [baseDraft, setBaseDraft] = useState<DeliveryReceiptDraft | null>(null);
  const [form, setForm] = useState<FormState | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setBaseDraft(null);
    setForm(null);

    void (async () => {
      try {
        const sellerInfo = await fetchDeliveryReceiptSellerInfo(order);
        if (cancelled) return;
        const draft = orderToDeliveryReceiptDraft(order, sellerInfo);
        setBaseDraft(draft);
        setForm(formFromDraft(draft));
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : "Could not load receipt data");
          onOpenChange(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, order, onOpenChange]);

  const draft = useMemo(() => {
    if (!baseDraft || !form) return null;
    return draftFromForm(baseDraft, form);
  }, [baseDraft, form]);

  const preview = useMemo(
    () => (draft ? deliveryReceiptPreviewLines(draft) : null),
    [draft],
  );

  const patch = (patchForm: Partial<FormState>) => {
    setForm((prev) => (prev ? { ...prev, ...patchForm } : prev));
  };

  const validate = (): boolean => {
    if (!form?.recipientName.trim()) {
      toast.error("Recipient name is required");
      return false;
    }
    if (!form.phone.trim()) {
      toast.error("Customer phone is required on the delivery slip");
      return false;
    }
    if (!form.address.trim() && !form.area.trim()) {
      toast.error("Add a street address or area for delivery");
      return false;
    }
    if (!form.sellerPhone.trim()) {
      toast.error("Add your phone so the courier can reach you");
      return false;
    }
    return true;
  };

  const run = (mode: "download" | "print") => {
    if (!draft || !validate()) return;
    setBusy(mode);
    try {
      if (mode === "download") {
        downloadDeliveryReceiptPdf(draft, variant);
        toast.success("Delivery receipt downloaded");
        onOpenChange(false);
      } else {
        printDeliveryReceiptPdf(draft, variant);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not generate delivery receipt");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <FileText className="h-5 w-5" style={{ color: accent }} />
            Delivery receipt — preview & edit
          </DialogTitle>
          <DialogDescription>
            Order #{orderRef(order.id)} · Edit delivery details if the customer requested a change. Changes apply to
            this PDF only — update the order separately if the address should be saved permanently.
          </DialogDescription>
        </DialogHeader>

        {loading || !form || !draft ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading receipt…
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-3 rounded-lg border border-border p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">From (seller)</p>
                <div>
                  <Label htmlFor="drSellerPhone">Your phone</Label>
                  <Input
                    id="drSellerPhone"
                    value={form.sellerPhone}
                    onChange={(e) => patch({ sellerPhone: e.target.value })}
                    placeholder="01XXXXXXXXX"
                  />
                </div>
                <div>
                  <Label htmlFor="drSellerLocation">Pickup location</Label>
                  <Textarea
                    id="drSellerLocation"
                    value={form.sellerLocation}
                    onChange={(e) => patch({ sellerLocation: e.target.value })}
                    rows={3}
                    placeholder="Shop / warehouse address for courier pickup"
                  />
                </div>
              </div>

              <div className="space-y-3 rounded-lg border border-border p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Deliver to (customer)
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label htmlFor="drRecipient">Recipient name</Label>
                    <Input
                      id="drRecipient"
                      value={form.recipientName}
                      onChange={(e) => patch({ recipientName: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="drPhone">Phone</Label>
                    <Input id="drPhone" value={form.phone} onChange={(e) => patch({ phone: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="drAltPhone">Alt phone</Label>
                    <Input
                      id="drAltPhone"
                      value={form.altPhone}
                      onChange={(e) => patch({ altPhone: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="drDivision">Division</Label>
                    <Input
                      id="drDivision"
                      value={form.division}
                      onChange={(e) => patch({ division: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="drDistrict">District</Label>
                    <Input
                      id="drDistrict"
                      value={form.district}
                      onChange={(e) => patch({ district: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="drUpazila">Upazila</Label>
                    <Input id="drUpazila" value={form.upazila} onChange={(e) => patch({ upazila: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="drArea">Area</Label>
                    <Input id="drArea" value={form.area} onChange={(e) => patch({ area: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="drAddress">Street address</Label>
                    <Textarea
                      id="drAddress"
                      value={form.address}
                      onChange={(e) => patch({ address: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="drLandmark">Landmark</Label>
                    <Input
                      id="drLandmark"
                      value={form.landmark}
                      onChange={(e) => patch({ landmark: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="drNote">Delivery note</Label>
                    <Textarea
                      id="drNote"
                      value={form.note}
                      onChange={(e) => patch({ note: e.target.value })}
                      rows={2}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border overflow-hidden">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-3 py-2 border-b bg-muted/30">
                  Products (read-only)
                </p>
                <div className="divide-y max-h-40 overflow-y-auto">
                  {draft.items.map((item, i) => (
                    <div key={`${item.name}-${i}`} className="flex justify-between gap-2 px-3 py-2 text-sm">
                      <span className="truncate text-foreground">
                        {item.name} ×{item.qty}
                      </span>
                      <span className="shrink-0 font-medium">৳{item.lineTotal.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between px-3 py-2 text-sm font-bold border-t bg-muted/20">
                  <span>Total</span>
                  <span style={{ color: accent }}>৳{draft.total.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live preview</p>
              <div
                className="rounded-lg border-2 overflow-hidden text-xs"
                style={{ borderColor: `${accent}40` }}
              >
                <div className="px-3 py-2 text-white font-bold" style={{ backgroundColor: accent }}>
                  DELIVERY HANDOVER RECEIPT · #{orderRef(draft.orderId)}
                </div>
                <div className="grid grid-cols-2 divide-x divide-border">
                  <div className="p-3 space-y-1.5">
                    <p className="font-bold text-[10px] uppercase text-muted-foreground">From (seller)</p>
                    {preview?.from.map((row) => (
                      <p key={row.label}>
                        <span className="text-muted-foreground">{row.label}: </span>
                        <span className="text-foreground">{row.value}</span>
                      </p>
                    ))}
                  </div>
                  <div className="p-3 space-y-1">
                    <p className="font-bold text-[10px] uppercase text-muted-foreground">Deliver to</p>
                    {preview?.to.map((line, i) => (
                      <p key={`to-${i}`} className="text-foreground break-words">
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
                <div className="px-3 py-2 border-t bg-muted/20">
                  <p className="font-bold text-[10px] uppercase text-muted-foreground mb-1.5">Products</p>
                  <div className="space-y-1">
                    {preview?.products.rows.map((item, i) => (
                      <p key={`${item.name}-${i}`} className="flex justify-between gap-2 text-foreground">
                        <span className="truncate">
                          {i + 1}. {item.name} ×{item.qty}
                        </span>
                        <span className="shrink-0">৳{item.lineTotal.toLocaleString()}</span>
                      </p>
                    ))}
                    {preview && preview.products.overflowCount > 0 && (
                      <p className="italic text-muted-foreground">
                        +{preview.products.overflowCount} more item(s) on PDF
                      </p>
                    )}
                  </div>
                </div>
                <div className="px-3 py-2 border-t bg-muted/30 text-muted-foreground">
                  <p className="font-medium text-foreground">{preview?.payment}</p>
                  <p className="mt-1">
                    Courier slip — grows taller for long addresses; second page if needed.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            className="gap-1"
            disabled={loading || busy !== null}
            onClick={() => run("print")}
          >
            <Printer className="h-4 w-4" />
            {busy === "print" ? "Preparing…" : "Print receipt"}
          </Button>
          <Button
            type="button"
            className="gap-1 text-white"
            style={{ backgroundColor: accent }}
            disabled={loading || busy !== null}
            onClick={() => run("download")}
          >
            <Download className="h-4 w-4" />
            {busy === "download" ? "Generating…" : "Download PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
