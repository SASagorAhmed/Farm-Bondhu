import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, FileText, Printer } from "lucide-react";
import type { MarketplaceOrder } from "@/contexts/OrderContext";
import { VENDOR_THEME } from "@/lib/vendorTheme";
import { ICON_COLORS } from "@/lib/iconColors";
import { isDeliveryReceiptEligible } from "@/lib/marketplaceDeliveryReceiptPdf";
import DeliveryReceiptEditorDialog from "@/components/marketplace/DeliveryReceiptEditorDialog";

interface Props {
  order: MarketplaceOrder;
  variant?: "seller" | "admin";
  compact?: boolean;
}

export default function DeliveryReceiptActions({ order, variant = "seller", compact = false }: Props) {
  const [editorOpen, setEditorOpen] = useState(false);
  const accent = variant === "admin" ? ICON_COLORS.farm : VENDOR_THEME.primary;

  if (!isDeliveryReceiptEligible(order.status)) {
    return null;
  }

  if (compact) {
    return (
      <>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1"
          onClick={() => setEditorOpen(true)}
          title="Edit and download delivery receipt"
        >
          <FileText className="h-3.5 w-3.5" />
          Receipt
        </Button>
        <DeliveryReceiptEditorDialog open={editorOpen} onOpenChange={setEditorOpen} order={order} variant={variant} />
      </>
    );
  }

  return (
    <>
      <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 space-y-3">
        <div className="flex items-start gap-2">
          <FileText className="h-4 w-4 mt-0.5 shrink-0" style={{ color: accent }} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">Delivery handover receipt</p>
            <p className="text-xs text-muted-foreground">
              Preview and edit seller phone or customer address before printing. One 5:2 slip with seller, customer,
              and product details for your delivery partner.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            className="gap-1 text-white"
            style={{ backgroundColor: accent }}
            onClick={() => setEditorOpen(true)}
          >
            <Download className="h-3.5 w-3.5" />
            Download PDF
          </Button>
          <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => setEditorOpen(true)}>
            <Printer className="h-3.5 w-3.5" />
            Print receipt
          </Button>
        </div>
      </div>
      <DeliveryReceiptEditorDialog open={editorOpen} onOpenChange={setEditorOpen} order={order} variant={variant} />
    </>
  );
}
