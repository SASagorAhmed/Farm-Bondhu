import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Eye, FileText, Loader2, Pencil, Plus, Printer, Trash2 } from "lucide-react";
import { ICON_COLORS } from "@/lib/iconColors";
import { api } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import SaleRecordFormFields, { type SaleRecordFormValues } from "@/components/dashboard/SaleRecordFormFields";
import SalesMemoPdfPreviewDialog from "@/components/dashboard/SalesMemoPdfPreviewDialog";
import {
  createSalesMemoNo,
  DEFAULT_SALES_MEMO_FOOTER,
  downloadSalesMemoPdf,
  formatSaleLineDate,
  getSalesMemoPdfBlob,
  printSalesMemoPdf,
  salesMemoPreviewLines,
  SALES_MEMO_CATEGORIES,
  SALES_MEMO_FARM_TYPES,
  type SalesMemoDraft,
  type SalesMemoLine,
} from "@/lib/salesMemoPdf";
import {
  saveSalesMemo,
  updateSalesMemo,
  type SalesMemoFormSnapshot,
} from "@/lib/salesMemoStorage";

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
  editingMemoId?: string | null;
  initialSnapshot?: SalesMemoFormSnapshot | null;
  onSaved?: () => void;
  onRecordsChange?: () => void;
}

type CustomLineForm = {
  date: string;
  product: string;
  category: string;
  quantity: number;
  unit: string;
  unitPrice: number;
};

type FormState = SalesMemoFormSnapshot;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyCustomLine(): CustomLineForm {
  return {
    date: todayIso(),
    product: "",
    category: "eggs",
    quantity: 1,
    unit: "pieces",
    unitPrice: 0,
  };
}

const emptySaleForm = (): SaleRecordFormValues => ({
  date: todayIso(),
  product: "",
  category: "eggs",
  quantity: 0,
  unit: "pieces",
  unitPrice: 0,
  buyer: "",
});

function emptyForm(): FormState {
  return {
    memoNo: createSalesMemoNo(),
    memoDate: todayIso(),
    farmName: "",
    farmType: "farm",
    farmLocation: "",
    sellerPhone: "",
    sellerEmail: "",
    buyerName: "",
    footerNote: DEFAULT_SALES_MEMO_FOOTER,
    selectedIds: [],
    customItems: [],
  };
}

function saleRowToLine(r: SaleRow): SalesMemoLine {
  return {
    id: r.id,
    date: r.date,
    product: r.product,
    category: r.category,
    quantity: r.quantity,
    unit: r.unit,
    unitPrice: r.unit_price,
    lineTotal: r.total,
  };
}

function buildDraftFromForm(form: FormState, records: SaleRow[]): SalesMemoDraft {
  const selectedSet = new Set(form.selectedIds);
  const recordItems = records.filter((r) => selectedSet.has(r.id)).map(saleRowToLine);
  const items = [...recordItems, ...form.customItems];
  return {
    memoNo: form.memoNo,
    memoDate: form.memoDate,
    buyerName: form.buyerName,
    farm: {
      name: form.farmName.trim() || "My Farm",
      type: form.farmType,
      location: form.farmLocation.trim() || undefined,
      phone: form.sellerPhone.trim() || undefined,
      email: form.sellerEmail.trim() || undefined,
    },
    items,
    grandTotal: items.reduce((s, i) => s + i.lineTotal, 0),
    footerNote: form.footerNote.trim() || undefined,
  };
}

export default function SalesMemo({
  open,
  onOpenChange,
  records,
  editingMemoId = null,
  initialSnapshot = null,
  onSaved,
  onRecordsChange,
}: SalesMemoProps) {
  const { user } = useAuth();
  const userId = user?.id;
  const accent = ICON_COLORS.farmBrand;
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<"preview" | "print" | "save" | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [customLine, setCustomLine] = useState<CustomLineForm>(emptyCustomLine);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [saleEditOpen, setSaleEditOpen] = useState(false);
  const [saleDeleteOpen, setSaleDeleteOpen] = useState(false);
  const [saleAddOpen, setSaleAddOpen] = useState(false);
  const [saleEditId, setSaleEditId] = useState<string | null>(null);
  const [saleDeleteId, setSaleDeleteId] = useState<string | null>(null);
  const [saleForm, setSaleForm] = useState<SaleRecordFormValues>(emptySaleForm);

  const prevOpenRef = useRef(false);
  const sessionRef = useRef(0);
  const lastInitKeyRef = useRef<string | null>(null);
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  const revokePreviewUrl = useCallback((url: string | null) => {
    if (url) URL.revokeObjectURL(url);
  }, []);

  useEffect(() => {
    return () => revokePreviewUrl(pdfPreviewUrl);
  }, [pdfPreviewUrl, revokePreviewUrl]);

  useEffect(() => {
    if (!open) {
      if (prevOpenRef.current) {
        lastInitKeyRef.current = null;
        setPdfPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
      }
      prevOpenRef.current = false;
      return;
    }

    if (!prevOpenRef.current) {
      sessionRef.current += 1;
    }
    prevOpenRef.current = true;

    if (!userId) return;

    const initKey = `${sessionRef.current}:${editingMemoId ?? "new"}`;
    if (lastInitKeyRef.current === initKey) return;
    lastInitKeyRef.current = initKey;

    let cancelled = false;
    setLoading(true);
    setForm(null);
    setCustomLine(emptyCustomLine());
    setPdfPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });

    void (async () => {
      try {
        if (initialSnapshot) {
          if (cancelled) return;
          setForm({
            ...initialSnapshot,
            selectedIds: [...initialSnapshot.selectedIds],
            customItems: initialSnapshot.customItems.map((item) => ({ ...item })),
          });
          return;
        }
      const [{ data: farms }, { data: profile }] = await Promise.all([
          api.from("farms").select("name, location, type").eq("user_id", userId).limit(1),
          api.from("profiles").select("name, phone, email").eq("id", userId).single(),
        ]);
        if (cancelled) return;
        const farm = farms?.[0];
        setForm({
          ...emptyForm(),
          farmName: farm?.name?.trim() || profile?.name?.trim() || "My Farm",
          farmType: farm?.type?.trim() || "farm",
          farmLocation: farm?.location?.trim() || "",
          sellerPhone: profile?.phone?.trim() || "",
          sellerEmail: profile?.email?.trim() || "",
        });
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : "Could not load memo data");
          onOpenChangeRef.current(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, userId, editingMemoId, initialSnapshot]);

  const draft = useMemo(() => (form ? buildDraftFromForm(form, records) : null), [form, records]);
  const preview = useMemo(() => (draft ? salesMemoPreviewLines(draft) : null), [draft]);

  const patch = (patchForm: Partial<FormState>) => {
    setForm((prev) => (prev ? { ...prev, ...patchForm } : prev));
  };

  const toggleId = (id: string) => {
    setForm((prev) => {
      if (!prev) return prev;
      const next = new Set(prev.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      const selectedIds = [...next];
      let buyerName = prev.buyerName;
      if (selectedIds.length > 0 && !buyerName.trim()) {
        const first = records.find((r) => r.id === selectedIds[0]);
        if (first) buyerName = first.buyer;
      }
      return { ...prev, selectedIds, buyerName };
    });
  };

  const toggleAll = () => {
    setForm((prev) => {
      if (!prev) return prev;
      const allSelected = prev.selectedIds.length === records.length;
      return {
        ...prev,
        selectedIds: allSelected ? [] : records.map((r) => r.id),
      };
    });
  };

  const addCustomLine = () => {
    if (!customLine.product.trim()) {
      toast.error("Product name is required");
      return;
    }
    if (customLine.quantity <= 0 || customLine.unitPrice <= 0) {
      toast.error("Quantity and unit price must be greater than zero");
      return;
    }
    const line: SalesMemoLine = {
      id: `custom-${crypto.randomUUID()}`,
      date: customLine.date,
      product: customLine.product.trim(),
      category: customLine.category,
      quantity: customLine.quantity,
      unit: customLine.unit.trim() || "pieces",
      unitPrice: customLine.unitPrice,
      lineTotal: Math.round(customLine.quantity * customLine.unitPrice),
    };
    setForm((prev) => (prev ? { ...prev, customItems: [...prev.customItems, line] } : prev));
    setCustomLine(emptyCustomLine());
    toast.success("Custom line added to memo");
  };

  const removeCustomLine = (id: string) => {
    setForm((prev) =>
      prev ? { ...prev, customItems: prev.customItems.filter((item) => item.id !== id) } : prev,
    );
  };

  const openSaleEdit = (r: SaleRow) => {
    setSaleForm({
      date: r.date,
      product: r.product,
      category: r.category,
      quantity: r.quantity,
      unit: r.unit,
      unitPrice: r.unit_price,
      buyer: r.buyer,
    });
    setSaleEditId(r.id);
    setSaleEditOpen(true);
  };

  const handleSaleEdit = async () => {
    if (!saleEditId) return;
    const total = saleForm.quantity * saleForm.unitPrice;
    const { error } = await api
      .from("sale_records")
      .update({
        date: saleForm.date,
        product: saleForm.product,
        category: saleForm.category,
        quantity: saleForm.quantity,
        unit: saleForm.unit,
        unit_price: saleForm.unitPrice,
        total,
        buyer: saleForm.buyer,
      })
      .eq("id", saleEditId);
    if (error) {
      toast.error("Failed to update sale");
      return;
    }
    setSaleEditOpen(false);
    setSaleEditId(null);
    toast.success("Sale updated");
    onRecordsChange?.();
  };

  const handleSaleDelete = async () => {
    if (!saleDeleteId) return;
    const { error } = await api.from("sale_records").delete().eq("id", saleDeleteId);
    if (error) {
      toast.error("Failed to delete sale");
      return;
    }
    setForm((prev) =>
      prev ? { ...prev, selectedIds: prev.selectedIds.filter((id) => id !== saleDeleteId) } : prev,
    );
    setSaleDeleteOpen(false);
    setSaleDeleteId(null);
    toast.success("Sale deleted");
    onRecordsChange?.();
  };

  const syncSaleToFinances = async (date: string, product: string, total: number) => {
    if (!user) return;
    await api.from("financial_records").insert({
      user_id: user.id,
      date,
      type: "income",
      category: "Sales",
      amount: total,
      description: `Sale: ${product}`,
    });
  };

  const handleSaleAdd = async () => {
    if (!user || !saleForm.product || !saleForm.date || !saleForm.buyer) {
      toast.error("Fill in required fields");
      return;
    }
    const total = saleForm.quantity * saleForm.unitPrice;
    const { data, error } = await api.from("sale_records").insert({
      user_id: user.id,
      date: saleForm.date,
      product: saleForm.product,
      category: saleForm.category,
      quantity: saleForm.quantity,
      unit: saleForm.unit,
      unit_price: saleForm.unitPrice,
      total,
      buyer: saleForm.buyer,
    });
    if (error || !data) {
      toast.error("Failed to record sale");
      return;
    }
    await syncSaleToFinances(saleForm.date, saleForm.product, total);
    const newId = String((data as { id: string }).id);
    setForm((prev) =>
      prev ? { ...prev, selectedIds: [...prev.selectedIds, newId] } : prev,
    );
    setSaleAddOpen(false);
    setSaleForm(emptySaleForm());
    toast.success("Sale recorded");
    onRecordsChange?.();
  };

  const itemCount = (form?.selectedIds.length ?? 0) + (form?.customItems.length ?? 0);

  const validate = (): boolean => {
    if (!form || itemCount === 0) {
      toast.error("Select sale lines or add at least one custom line");
      return false;
    }
    if (!form.buyerName.trim()) {
      toast.error("Buyer name is required on the memo");
      return false;
    }
    if (!form.farmName.trim()) {
      toast.error("Farm name is required");
      return false;
    }
    return true;
  };

  const openPdfPreview = () => {
    if (!draft || !validate()) return;
    setBusy("preview");
    try {
      revokePreviewUrl(pdfPreviewUrl);
      const blob = getSalesMemoPdfBlob(draft);
      setPdfPreviewUrl(URL.createObjectURL(blob));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not generate PDF preview");
    } finally {
      setBusy(null);
    }
  };

  const handleDownloadFromPreview = async () => {
    if (!draft || !form) return;
    setBusy("save");
    try {
      if (editingMemoId) {
        await updateSalesMemo(editingMemoId, draft, form);
      } else {
        await saveSalesMemo(draft, form);
      }
      downloadSalesMemoPdf(draft);
      toast.success("Memo saved to history");
      onSaved?.();
      revokePreviewUrl(pdfPreviewUrl);
      setPdfPreviewUrl(null);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save memo");
    } finally {
      setBusy(null);
    }
  };

  const runPrint = () => {
    if (!draft || !validate()) return;
    setBusy("print");
    try {
      printSalesMemoPdf(draft);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not print sales memo");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
              <FileText className="h-5 w-5" style={{ color: accent }} />
              {editingMemoId ? "Edit sales memo" : "Sales memo — preview & edit"}
          </DialogTitle>
            <DialogDescription>
              Select sale lines or add custom lines, edit sales inline, then preview the PDF before download. Memos are
              saved to history when you download.
            </DialogDescription>
        </DialogHeader>

          {loading || !form || !draft ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading memo…
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
                <div className="space-y-3 rounded-lg border border-border p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Farm (seller)</p>
                  <div>
                    <Label htmlFor="smFarmName">Farm name</Label>
                    <Input
                      id="smFarmName"
                      value={form.farmName}
                      onChange={(e) => patch({ farmName: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="smFarmType">Farm type</Label>
                    <Select value={form.farmType} onValueChange={(v) => patch({ farmType: v })}>
                      <SelectTrigger id="smFarmType">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SALES_MEMO_FARM_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="smFarmLocation">Location</Label>
                    <Textarea
                      id="smFarmLocation"
                      value={form.farmLocation}
                      onChange={(e) => patch({ farmLocation: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="smPhone">Phone</Label>
                      <Input
                        id="smPhone"
                        value={form.sellerPhone}
                        onChange={(e) => patch({ sellerPhone: e.target.value })}
                        placeholder="01XXXXXXXXX"
                      />
                    </div>
          <div>
                      <Label htmlFor="smEmail">Email</Label>
                      <Input
                        id="smEmail"
                        type="email"
                        value={form.sellerEmail}
                        onChange={(e) => patch({ sellerEmail: e.target.value })}
                      />
                    </div>
                  </div>
          </div>

                <div className="space-y-3 rounded-lg border border-border p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Buyer & memo</p>
                  <div>
                    <Label htmlFor="smBuyer">Buyer name</Label>
                    <Input
                      id="smBuyer"
                      value={form.buyerName}
                      onChange={(e) => patch({ buyerName: e.target.value })}
                      placeholder="Enter buyer name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="smMemoNo">Memo #</Label>
                    <Input
                      id="smMemoNo"
                      value={form.memoNo}
                      onChange={(e) => patch({ memoNo: e.target.value })}
                      readOnly={Boolean(editingMemoId)}
                      className={editingMemoId ? "bg-muted/50" : undefined}
                    />
                  </div>
                  <div>
                    <Label htmlFor="smDate">Memo date</Label>
                    <Input
                      id="smDate"
                      type="date"
                      value={form.memoDate}
                      onChange={(e) => patch({ memoDate: e.target.value })}
                    />
                  </div>
          <div>
                    <Label htmlFor="smFooter">Footer note</Label>
                    <Textarea
                      id="smFooter"
                      value={form.footerNote}
                      onChange={(e) => patch({ footerNote: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>

                <div className="space-y-2 rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Label>From sales ({form.selectedIds.length}/{records.length})</Label>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 gap-1"
                        onClick={() => {
                          setSaleForm(emptySaleForm());
                          setSaleAddOpen(true);
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Record sale
                      </Button>
                      {records.length > 0 && (
              <Button variant="ghost" size="sm" onClick={toggleAll} className="text-xs h-7">
                          {form.selectedIds.length === records.length ? "Deselect all" : "Select all"}
              </Button>
                      )}
                    </div>
                  </div>
                  <ScrollArea className="h-32 border rounded-lg">
                    <div className="p-2 space-y-1">
                      {records.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors"
                        >
                          <Checkbox
                            checked={form.selectedIds.includes(r.id)}
                            onCheckedChange={() => toggleId(r.id)}
                          />
                          <label className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleId(r.id)}>
                            <p className="text-sm font-medium text-foreground truncate">{r.product}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatSaleLineDate(r.date)} · {r.quantity} {r.unit} · ৳{r.total.toLocaleString()}
                            </p>
                  </label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => openSaleEdit(r)}
                            aria-label="Edit sale"
                          >
                            <Pencil className="h-3.5 w-3.5" style={{ color: accent }} />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => {
                              setSaleDeleteId(r.id);
                              setSaleDeleteOpen(true);
                            }}
                            aria-label="Delete sale"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      ))}
                      {records.length === 0 && (
                        <p className="text-center text-muted-foreground text-sm py-4">
                          No sale records — record a sale or add custom lines below
                        </p>
                      )}
              </div>
            </ScrollArea>
          </div>

                <div className="space-y-3 rounded-lg border border-border p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Add custom line (memo only)
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="smCustomDate">Date</Label>
                      <Input
                        id="smCustomDate"
                        type="date"
                        value={customLine.date}
                        onChange={(e) => setCustomLine((p) => ({ ...p, date: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="smCustomCategory">Category</Label>
                      <Select
                        value={customLine.category}
                        onValueChange={(v) => setCustomLine((p) => ({ ...p, category: v }))}
                      >
                        <SelectTrigger id="smCustomCategory">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SALES_MEMO_CATEGORIES.map((c) => (
                            <SelectItem key={c.value} value={c.value}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor="smCustomProduct">Product</Label>
                      <Input
                        id="smCustomProduct"
                        value={customLine.product}
                        onChange={(e) => setCustomLine((p) => ({ ...p, product: e.target.value }))}
                        placeholder="Product name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="smCustomQty">Quantity</Label>
                      <Input
                        id="smCustomQty"
                        type="number"
                        min={1}
                        value={customLine.quantity || ""}
                        onChange={(e) =>
                          setCustomLine((p) => ({ ...p, quantity: Number(e.target.value) || 0 }))
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="smCustomUnit">Unit</Label>
                      <Input
                        id="smCustomUnit"
                        value={customLine.unit}
                        onChange={(e) => setCustomLine((p) => ({ ...p, unit: e.target.value }))}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor="smCustomPrice">Unit price (৳)</Label>
                      <Input
                        id="smCustomPrice"
                        type="number"
                        min={0}
                        value={customLine.unitPrice || ""}
                        onChange={(e) =>
                          setCustomLine((p) => ({ ...p, unitPrice: Number(e.target.value) || 0 }))
                        }
                      />
                    </div>
                  </div>
                  <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addCustomLine}>
                    <Plus className="h-4 w-4" />
                    Add line
                  </Button>

                  {form.customItems.length > 0 && (
                    <div className="space-y-1 border rounded-lg divide-y">
                      {form.customItems.map((item, i) => (
                        <div key={item.id} className="flex items-center gap-2 px-2 py-1.5 text-sm">
                          <span className="flex-1 min-w-0 truncate">
                            {item.product} · {formatSaleLineDate(item.date)} · ৳{item.lineTotal.toLocaleString()}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => removeCustomLine(item.id)}
                            aria-label={`Remove custom line ${i + 1}`}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {itemCount > 0 && (
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/40 border text-sm">
                    <span className="text-muted-foreground">{itemCount} line(s) on memo</span>
                    <span className="font-bold" style={{ color: accent }}>
                      ৳{draft.grandTotal.toLocaleString()}
                    </span>
            </div>
          )}
        </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live preview</p>
                <div className="rounded-lg border-2 overflow-hidden text-xs" style={{ borderColor: `${accent}40` }}>
                  <div className="px-3 py-2 text-white font-bold" style={{ backgroundColor: accent }}>
                    <p className="text-sm">{preview?.farmName.toUpperCase()}</p>
                    <p className="text-[10px] font-normal opacity-90">SALES MEMO · {preview?.memoNo}</p>
                  </div>
                  {preview && preview.contactLines.length > 0 && (
                    <div className="px-3 py-1.5 bg-muted/30 text-muted-foreground border-b border-border space-y-0.5">
                      {preview.contactLines.map((line, i) => (
                        <p key={`contact-${i}`}>{line}</p>
                      ))}
                    </div>
                  )}
                  <div className="p-3 grid grid-cols-2 gap-2 border-b border-border bg-muted/20">
                    <p>
                      <span className="text-muted-foreground">Buyer: </span>
                      <span className="text-foreground">{preview?.buyerName}</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Date: </span>
                      <span className="text-foreground">{preview?.memoDate}</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Items: </span>
                      <span className="text-foreground">{preview?.itemCount}</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Type: </span>
                      <span className="text-foreground">{preview?.farmTypeLabel}</span>
                    </p>
                  </div>
                  <div className="px-3 py-2 border-b bg-muted/20">
                    <p className="font-bold text-[10px] uppercase text-muted-foreground mb-1.5">Line items</p>
                    {preview && preview.items.length > 0 ? (
                      <div className="space-y-1">
                        {preview.items.map((item, i) => (
                          <p key={`item-${i}`} className="flex justify-between gap-2 text-foreground">
                            <span className="truncate">
                              {item.index}. {item.date} · {item.product} · {item.qty}
                            </span>
                            <span className="shrink-0 font-medium">{item.lineTotal}</span>
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground italic">Select sale lines or add custom lines</p>
                    )}
                  </div>
                  <div className="px-3 py-2 border-b" style={{ backgroundColor: `${accent}15` }}>
                    <p className="font-bold text-foreground">Grand total: {preview?.grandTotal}</p>
                  </div>
                  <div className="px-3 py-2 bg-muted/30 text-muted-foreground space-y-0.5">
                    {preview?.footerLines.map((line, i) => (
                      <p key={`footer-${i}`}>{line}</p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 flex-wrap">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-1"
              disabled={loading || busy !== null || itemCount === 0}
              onClick={() => runPrint()}
            >
              <Printer className="h-4 w-4" />
              {busy === "print" ? "Preparing…" : "Print memo"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-1"
              disabled={loading || busy !== null || itemCount === 0}
              onClick={openPdfPreview}
            >
              <Eye className="h-4 w-4" />
              {busy === "preview" ? "Generating…" : "Preview PDF"}
            </Button>
            <Button
              type="button"
              className="gap-1 text-white"
              style={{ backgroundColor: accent }}
              disabled={loading || busy !== null || itemCount === 0}
              onClick={openPdfPreview}
            >
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SalesMemoPdfPreviewDialog
        open={Boolean(pdfPreviewUrl)}
        url={pdfPreviewUrl}
        onClose={() => {
          revokePreviewUrl(pdfPreviewUrl);
          setPdfPreviewUrl(null);
        }}
        onDownload={handleDownloadFromPreview}
        downloadLabel={busy === "save" ? "Saving…" : "Download PDF"}
      />

      <Dialog open={saleEditOpen} onOpenChange={setSaleEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Edit sale</DialogTitle>
            <DialogDescription className="sr-only">Update sale fields from memo editor.</DialogDescription>
          </DialogHeader>
          <SaleRecordFormFields form={saleForm} onChange={(patch) => setSaleForm((p) => ({ ...p, ...patch }))} />
          <DialogFooter>
            <Button className="text-white" style={{ backgroundColor: accent }} onClick={handleSaleEdit}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={saleAddOpen} onOpenChange={setSaleAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Record sale</DialogTitle>
            <DialogDescription className="sr-only">Add a sale and include it on this memo.</DialogDescription>
          </DialogHeader>
          <SaleRecordFormFields form={saleForm} onChange={(patch) => setSaleForm((p) => ({ ...p, ...patch }))} />
        <DialogFooter>
            <Button className="text-white" style={{ backgroundColor: accent }} onClick={handleSaleAdd}>
              Record sale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={saleDeleteOpen} onOpenChange={setSaleDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Delete sale</DialogTitle>
            <DialogDescription>This removes the sale record. It cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSaleDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleSaleDelete}>
              Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
