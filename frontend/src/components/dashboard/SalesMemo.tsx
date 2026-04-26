import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Download } from "lucide-react";
import { ICON_COLORS } from "@/lib/iconColors";
import { api } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import jsPDF from "jspdf";

interface SaleRow {
  id: string;
  date: string;
  product: string;
  category: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
  buyer: string;
}

interface SalesMemoProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  records: SaleRow[];
}

interface FarmInfo {
  name: string;
  location: string;
  type: string;
}

export default function SalesMemo({ open, onOpenChange, records }: SalesMemoProps) {
  const { user } = useAuth();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [buyerName, setBuyerName] = useState("");
  const [farmInfo, setFarmInfo] = useState<FarmInfo | null>(null);
  const [profileInfo, setProfileInfo] = useState<{ name: string; phone: string; email: string } | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setSelectedIds(new Set());
    setBuyerName("");

    const load = async () => {
      const [{ data: farms }, { data: profile }] = await Promise.all([
        api.from("farms").select("name, location, type").eq("user_id", user.id).limit(1),
        api.from("profiles").select("name, phone, email").eq("id", user.id).single(),
      ]);
      if (farms?.[0]) setFarmInfo({ name: farms[0].name, location: farms[0].location, type: farms[0].type });
      if (profile) setProfileInfo({ name: profile.name, phone: profile.phone || "", email: profile.email });
    };
    load();
  }, [open, user]);

  const toggleId = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === records.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(records.map(r => r.id)));
  };

  useEffect(() => {
    if (selectedIds.size > 0 && !buyerName) {
      const first = records.find(r => selectedIds.has(r.id));
      if (first) setBuyerName(first.buyer);
    }
  }, [selectedIds]);

  const selected = records.filter(r => selectedIds.has(r.id));
  const grandTotal = selected.reduce((s, r) => s + r.total, 0);

  const generatePDF = () => {
    if (selected.length === 0) { toast.error("Select at least one sale item"); return; }
    setGenerating(true);

    try {
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const pw = doc.internal.pageSize.getWidth();
      const ph = doc.internal.pageSize.getHeight();
      const ml = 15; // margin left
      const mr = pw - 15; // margin right
      const contentW = mr - ml;

      const farmName = farmInfo?.name || profileInfo?.name || "My Farm";
      const farmType = farmInfo?.type || "Farm";
      const location = farmInfo?.location || "";
      const phone = profileInfo?.phone || "";
      const email = profileInfo?.email || "";
      const today = new Date().toLocaleDateString("en-GB");
      const memoNo = `MEMO-${Date.now().toString(36).toUpperCase()}`;

      // ── Watermark (behind everything) ──
      doc.setFontSize(72);
      doc.setTextColor(240, 245, 240);
      doc.text(farmName.toUpperCase(), pw / 2, ph / 2, { align: "center", angle: 40 });

      // ══════════════════════════════════════
      // ── GREEN HEADER BAND ──
      // ══════════════════════════════════════
      doc.setFillColor(22, 78, 55); // dark emerald
      doc.rect(0, 0, pw, 28, "F");

      // Farm name in header
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text(farmName.toUpperCase(), ml + 2, 13);

      // Farm type badge
      const farmTypeLabel = farmType.charAt(0).toUpperCase() + farmType.slice(1) + " Farm";
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      const badgeX = ml + 2;
      const badgeY = 18;
      const badgeW = doc.getTextWidth(farmTypeLabel) + 6;
      doc.setFillColor(34, 110, 80); // slightly lighter green
      doc.roundedRect(badgeX, badgeY - 3.5, badgeW, 5.5, 1.5, 1.5, "F");
      doc.setTextColor(200, 240, 220);
      doc.text(farmTypeLabel, badgeX + 3, badgeY);

      // "SALES MEMO" title on right side of header
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(200, 240, 220);
      doc.text("SALES MEMO", mr - 2, 13, { align: "right" });

      // Memo # below title
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(170, 210, 190);
      doc.text(memoNo, mr - 2, 19, { align: "right" });

      // ── SUB-HEADER STRIP (lighter green) ──
      doc.setFillColor(230, 245, 235);
      doc.rect(0, 28, pw, 10, "F");
      doc.setDrawColor(22, 78, 55);
      doc.setLineWidth(0.3);
      doc.line(0, 38, pw, 38);

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(40, 80, 55);
      const contactParts: string[] = [];
      if (location) contactParts.push(`📍 ${location}`);
      if (phone) contactParts.push(`📞 ${phone}`);
      if (email) contactParts.push(`✉ ${email}`);
      doc.text(contactParts.join("    |    "), pw / 2, 34, { align: "center" });

      // ══════════════════════════════════════
      // ── BUYER INFO BOX ──
      // ══════════════════════════════════════
      let y = 44;
      doc.setDrawColor(200, 210, 200);
      doc.setLineWidth(0.4);
      doc.roundedRect(ml, y, contentW, 18, 2, 2, "S");

      // Left column
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(60, 60, 60);
      doc.text("Buyer:", ml + 4, y + 6);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(33, 33, 33);
      const buyerDisplay = buyerName || "—";
      doc.text(buyerDisplay.length > 35 ? buyerDisplay.substring(0, 35) + "…" : buyerDisplay, ml + 20, y + 6);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(60, 60, 60);
      doc.text("Date:", ml + 4, y + 13);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(33, 33, 33);
      doc.text(today, ml + 20, y + 13);

      // Right column
      const midX = pw / 2 + 10;
      doc.setFont("helvetica", "bold");
      doc.setTextColor(60, 60, 60);
      doc.text("Items:", midX, y + 6);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(33, 33, 33);
      doc.text(`${selected.length}`, midX + 16, y + 6);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(60, 60, 60);
      doc.text("Memo #:", midX, y + 13);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(33, 33, 33);
      doc.text(memoNo, midX + 20, y + 13);

      // ══════════════════════════════════════
      // ── TABLE ──
      // ══════════════════════════════════════
      y += 24;
      const cols = {
        num: ml,
        date: ml + 10,
        product: ml + 32,
        cat: ml + 82,
        qty: ml + 110,
        price: ml + 130,
        total: ml + 155,
      };
      const rowH = 7;

      // Table header
      doc.setFillColor(22, 78, 55);
      doc.rect(ml, y, contentW, 8, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      y += 5.5;
      doc.text("#", cols.num + 2, y);
      doc.text("Date", cols.date + 2, y);
      doc.text("Product", cols.product + 2, y);
      doc.text("Category", cols.cat + 2, y);
      doc.text("Qty", cols.qty + 2, y);
      doc.text("Unit Price", cols.price + 2, y);
      doc.text("Total", cols.total + 2, y);
      y += 3.5;

      // Table rows
      doc.setFont("helvetica", "normal");
      selected.forEach((r, i) => {
        if (y > ph - 50) {
          doc.addPage();
          y = 20;
        }
        // Zebra striping
        if (i % 2 === 0) {
          doc.setFillColor(245, 248, 245);
          doc.rect(ml, y - 1, contentW, rowH, "F");
        }
        doc.setFontSize(8);
        doc.setTextColor(50, 50, 50);
        const rowY = y + 4;
        doc.text(`${i + 1}`, cols.num + 2, rowY);
        doc.text(r.date, cols.date + 2, rowY);

        // Truncate long product names
        const maxProductW = cols.cat - cols.product - 4;
        const productLines = doc.splitTextToSize(r.product, maxProductW);
        doc.text(productLines[0], cols.product + 2, rowY);

        const maxCatW = cols.qty - cols.cat - 4;
        const catLines = doc.splitTextToSize(r.category, maxCatW);
        doc.text(catLines[0], cols.cat + 2, rowY);

        doc.text(`${r.quantity} ${r.unit}`, cols.qty + 2, rowY);
        doc.text(`৳${r.unit_price.toLocaleString()}`, cols.price + 2, rowY);

        doc.setFont("helvetica", "bold");
        doc.setTextColor(22, 78, 55);
        doc.text(`৳${r.total.toLocaleString()}`, cols.total + 2, rowY);
        doc.setFont("helvetica", "normal");
        y += rowH;
      });

      // Table bottom border
      doc.setDrawColor(22, 78, 55);
      doc.setLineWidth(0.5);
      doc.line(ml, y, mr, y);

      // ══════════════════════════════════════
      // ── GRAND TOTAL BOX ──
      // ══════════════════════════════════════
      y += 6;
      const totalBoxW = 70;
      const totalBoxX = mr - totalBoxW;
      doc.setFillColor(22, 78, 55);
      doc.roundedRect(totalBoxX, y, totalBoxW, 12, 2, 2, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`Grand Total: ৳${grandTotal.toLocaleString()}`, totalBoxX + totalBoxW / 2, y + 8, { align: "center" });

      // ══════════════════════════════════════
      // ── DUAL SIGNATURES ──
      // ══════════════════════════════════════
      y += 28;
      if (y > ph - 40) { doc.addPage(); y = 30; }

      doc.setDrawColor(160, 160, 160);
      doc.setLineWidth(0.3);

      // Seller signature
      doc.line(ml, y, ml + 60, y);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text("Seller's Signature", ml, y + 5);

      // Buyer signature
      doc.line(mr - 60, y, mr, y);
      doc.text("Buyer's Signature", mr - 60, y + 5);

      // ══════════════════════════════════════
      // ── FOOTER ──
      // ══════════════════════════════════════
      y += 16;
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text("* Goods once sold are not returnable unless defective.", pw / 2, y, { align: "center" });
      doc.text("Thank you for your purchase!", pw / 2, y + 5, { align: "center" });
      doc.text(`Generated by FarmBondhu on ${today}`, pw / 2, y + 10, { align: "center" });

      doc.save(`${farmName.replace(/\s+/g, "_")}_Memo_${memoNo}.pdf`);
      toast.success("Memo PDF downloaded!");
      onOpenChange(false);
    } catch {
      toast.error("Failed to generate PDF");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <FileText className="h-5 w-5" style={{ color: ICON_COLORS.farmBrand }} /> Generate Sales Memo
          </DialogTitle>
          <DialogDescription>Select sale lines, confirm the buyer name, then download a PDF memo.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Buyer Name</Label>
            <Input value={buyerName} onChange={e => setBuyerName(e.target.value)} placeholder="Enter buyer name" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Select Items ({selectedIds.size}/{records.length})</Label>
              <Button variant="ghost" size="sm" onClick={toggleAll} className="text-xs h-7">
                {selectedIds.size === records.length ? "Deselect All" : "Select All"}
              </Button>
            </div>
            <ScrollArea className="h-48 border rounded-lg">
              <div className="p-2 space-y-1">
                {records.map(r => (
                  <label key={r.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors">
                    <Checkbox checked={selectedIds.has(r.id)} onCheckedChange={() => toggleId(r.id)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{r.product}</p>
                      <p className="text-xs text-muted-foreground">{r.date} • {r.quantity} {r.unit} • ৳{r.total.toLocaleString()}</p>
                    </div>
                  </label>
                ))}
                {records.length === 0 && <p className="text-center text-muted-foreground text-sm py-4">No sale records to select</p>}
              </div>
            </ScrollArea>
          </div>

          {selectedIds.size > 0 && (
            <div className="flex justify-between items-center p-3 rounded-lg bg-muted/40 border">
              <span className="text-sm text-muted-foreground">{selectedIds.size} item(s) selected</span>
              <span className="text-sm font-bold" style={{ color: ICON_COLORS.farmBrand }}>৳{grandTotal.toLocaleString()}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="text-white" style={{ backgroundColor: ICON_COLORS.farmBrand }} onClick={generatePDF} disabled={generating || selectedIds.size === 0}>
            <Download className="h-4 w-4 mr-1" /> {generating ? "Generating..." : "Download PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
