import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Zap, Loader2, Clock } from "lucide-react";
import { toast } from "sonner";
import { MARKETPLACE_THEME, marketplaceGradient } from "@/lib/marketplaceTheme";
import {
  adminRejectFlashSaleRequest,
  adminSetProductFlashSale,
  fetchAdminFlashSaleRequests,
  type AdminFlashSaleRequestRow,
} from "@/lib/adminFlashSaleApi";
import { moduleCachePolicy } from "@/lib/queryClient";

function defaultFlashEndLocal(): string {
  const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatRequestedAt(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

interface Props {
  onChanged: () => void;
}

export default function AdminFlashSalePendingRequests({ onChanged }: Props) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<
    Record<string, { flashEnd: string; originalPrice: string; rejectNotes: string }>
  >({});

  const { data: pending = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-flash-sale-requests", "pending"],
    staleTime: moduleCachePolicy.admin.staleTime,
    gcTime: moduleCachePolicy.admin.gcTime,
    queryFn: () => fetchAdminFlashSaleRequests("pending"),
  });

  const getDraft = (row: AdminFlashSaleRequestRow) => {
    const existing = drafts[row.id];
    if (existing) return existing;
    const suggested =
      row.flash_sale_requested_original_price != null
        ? String(row.flash_sale_requested_original_price)
        : String(Number(row.price) + 50);
    return { flashEnd: defaultFlashEndLocal(), originalPrice: suggested, rejectNotes: "" };
  };

  const setDraft = (
    id: string,
    row: AdminFlashSaleRequestRow,
    patch: Partial<{ flashEnd: string; originalPrice: string; rejectNotes: string }>,
  ) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...getDraft(row), ...patch },
    }));
  };

  const approve = async (row: AdminFlashSaleRequestRow) => {
    const draft = getDraft(row);
    const salePrice = Number(row.price);
    const originalPrice = Number(draft.originalPrice);
    if (!draft.flashEnd) {
      toast.error("End time is required");
      return;
    }
    if (!Number.isFinite(originalPrice) || originalPrice <= salePrice) {
      toast.error("MRP must be higher than sale price");
      return;
    }
    setSavingId(row.id);
    const { ok, error } = await adminSetProductFlashSale(row.id, {
      is_flash_sale: true,
      flash_sale_end: new Date(draft.flashEnd).toISOString(),
      original_price: originalPrice,
    });
    setSavingId(null);
    if (!ok) {
      toast.error(error || "Approve failed");
      return;
    }
    toast.success("Flash sale approved");
    void refetch();
    onChanged();
  };

  const reject = async (row: AdminFlashSaleRequestRow) => {
    setSavingId(row.id);
    const draft = getDraft(row);
    const { ok, error } = await adminRejectFlashSaleRequest(
      row.id,
      draft.rejectNotes.trim() || undefined,
    );
    setSavingId(null);
    if (!ok) {
      toast.error(error || "Reject failed");
      return;
    }
    toast.success("Request rejected");
    void refetch();
    onChanged();
  };

  return (
    <Card className="shadow-card overflow-hidden">
      <div className="h-1" style={{ background: marketplaceGradient() }} />
      <CardHeader>
        <CardTitle className="text-lg font-display flex items-center gap-2">
          <Clock className="h-5 w-5" style={{ color: MARKETPLACE_THEME.accent }} />
          Pending flash sale requests ({pending.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading requests…
          </p>
        ) : isError ? (
          <p className="px-6 pb-6 text-sm text-destructive">Could not load pending requests.</p>
        ) : pending.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">No pending seller requests.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shop</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Suggested MRP</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Seller note</TableHead>
                <TableHead className="min-w-[240px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.map((row) => {
                const draft = getDraft(row);
                const shopLabel =
                  row.shop_name?.trim() ||
                  row.seller_name?.trim() ||
                  row.owner_name?.trim() ||
                  "—";
                return (
                  <TableRow key={row.id}>
                    <TableCell className="text-muted-foreground">{shopLabel}</TableCell>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>৳{Number(row.price).toLocaleString()}</TableCell>
                    <TableCell>
                      {row.flash_sale_requested_original_price != null
                        ? `৳${Number(row.flash_sale_requested_original_price).toLocaleString()}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatRequestedAt(row.flash_sale_requested_at)}
                    </TableCell>
                    <TableCell className="text-sm max-w-[160px] truncate">
                      {row.flash_sale_request_notes || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">MRP (৳)</Label>
                            <Input
                              type="number"
                              className="h-8"
                              value={draft.originalPrice}
                              onChange={(e) => setDraft(row.id, row, { originalPrice: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Ends at</Label>
                            <Input
                              type="datetime-local"
                              className="h-8"
                              value={draft.flashEnd}
                              onChange={(e) => setDraft(row.id, row, { flashEnd: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="text-white flex-1"
                            style={{ backgroundColor: MARKETPLACE_THEME.primary }}
                            disabled={savingId === row.id}
                            onClick={() => void approve(row)}
                          >
                            {savingId === row.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <>
                                <Zap className="h-3.5 w-3.5 mr-1" />
                                Approve
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={savingId === row.id}
                            onClick={() => void reject(row)}
                          >
                            Reject
                          </Button>
                        </div>
                        <Textarea
                          rows={1}
                          placeholder="Reject reason (optional)"
                          className="text-xs min-h-[32px]"
                          value={draft.rejectNotes}
                          onChange={(e) => setDraft(row.id, row, { rejectNotes: e.target.value })}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/** Hook for tab badge count */
export function useAdminFlashSalePendingCount() {
  return useQuery({
    queryKey: ["admin-flash-sale-requests", "pending"],
    staleTime: moduleCachePolicy.admin.staleTime,
    queryFn: () => fetchAdminFlashSaleRequests("pending"),
    select: (rows) => rows.length,
  });
}
