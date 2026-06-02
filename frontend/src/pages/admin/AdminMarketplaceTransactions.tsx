import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Receipt, Loader2, Shield, Eye, DollarSign, TrendingUp, AlertCircle, Banknote } from "lucide-react";
import { motion } from "framer-motion";
import { ICON_COLORS } from "@/lib/iconColors";
import { moduleCachePolicy, queryKeys } from "@/lib/queryClient";
import { fetchAdminTransactions, type AdminTransactionRow } from "@/lib/adminMarketplaceApi";
import { format } from "date-fns";

const PAGE_SIZE = 50;

const TYPE_LABELS: Record<string, string> = {
  order_payment: "Payment",
  fulfillment: "Fulfillment",
  refund: "Refund",
};

export default function AdminMarketplaceTransactions() {
  const navigate = useNavigate();
  const [typeFilter, setTypeFilter] = useState("all");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<AdminTransactionRow | null>(null);

  const filterKey = `${typeFilter}|${offset}`;
  const { data, isLoading, isError, error } = useQuery({
    queryKey: queryKeys().adminMarketplaceTransactions(filterKey),
    queryFn: () => fetchAdminTransactions({ type: typeFilter, limit: PAGE_SIZE, offset }),
    staleTime: moduleCachePolicy.admin.staleTime,
  });

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const summary = data?.summary;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${ICON_COLORS.admin}, #7c3aed)` }}>
            <Receipt className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Transactions</h1>
              <Badge className="text-[10px] font-bold" style={{ backgroundColor: `${ICON_COLORS.admin}1A`, color: ICON_COLORS.admin }}>
                <Shield className="h-3 w-3 mr-0.5" /> Admin
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm">Payments, fulfillment events, and refunds (last 30 days summary)</p>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/marketplace/payouts">
            <Banknote className="h-4 w-4 mr-1" />
            Seller payouts
          </Link>
        </Button>
      </motion.div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Volume (30d)", value: `৳${Number(summary.total_volume).toLocaleString()}`, icon: DollarSign, color: ICON_COLORS.farm },
            { label: "Paid", value: summary.paid_count, icon: TrendingUp, color: ICON_COLORS.admin },
            { label: "Unpaid", value: summary.unpaid_count, icon: AlertCircle, color: ICON_COLORS.dashboard },
            { label: "Refunds", value: summary.refund_count, icon: Receipt, color: ICON_COLORS.health },
          ].map((s) => (
            <Card key={s.label} className="shadow-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <s.icon className="h-4 w-4" style={{ color: s.color }} />
                  <span className="text-xs text-muted-foreground">{s.label}</span>
                </div>
                <p className="text-2xl font-bold">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setOffset(0); }}>
        <SelectTrigger className="w-[180px]"><SelectValue placeholder="Type" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          <SelectItem value="order_payment">Payments</SelectItem>
          <SelectItem value="fulfillment">Fulfillment</SelectItem>
          <SelectItem value="refund">Refunds</SelectItem>
        </SelectContent>
      </Select>

      <Card className="shadow-card overflow-hidden">
        <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.admin}, #7c3aed)` }} />
        <CardHeader><CardTitle className="text-lg">Transaction ledger ({total})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : isError ? (
            <p className="text-center text-destructive py-8">
              {error instanceof Error ? error.message : "Failed to load transactions"}
            </p>
          ) : rows.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No transactions</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Buyer</TableHead>
                    <TableHead>Seller</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-sm">{format(new Date(row.created_at), "dd MMM HH:mm")}</TableCell>
                      <TableCell><Badge variant="outline">{TYPE_LABELS[row.type] || row.type}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{row.order_id.slice(0, 8)}…</TableCell>
                      <TableCell className="text-sm">{row.buyer_name}</TableCell>
                      <TableCell className="text-sm">{row.seller_name}</TableCell>
                      <TableCell>৳{Number(row.amount).toLocaleString()}</TableCell>
                      <TableCell className="text-xs capitalize">{(row.payment_method || "—").replace(/_/g, " ")}</TableCell>
                      <TableCell><Badge variant="secondary" className="capitalize">{row.status}</Badge></TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setSelected(row)}><Eye className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex justify-between items-center mt-4">
                <p className="text-xs text-muted-foreground">{offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>Previous</Button>
                  <Button variant="outline" size="sm" disabled={offset + PAGE_SIZE >= total} onClick={() => setOffset(offset + PAGE_SIZE)}>Next</Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Transaction details</DialogTitle>
            <DialogDescription>
              {selected ? `${TYPE_LABELS[selected.type] || selected.type} — Order ${selected.order_id.slice(0, 8)}…` : null}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-muted/50 p-2.5"><p className="text-xs text-muted-foreground">Amount</p><p className="font-medium">৳{Number(selected.amount).toLocaleString()}</p></div>
                <div className="rounded-lg bg-muted/50 p-2.5"><p className="text-xs text-muted-foreground">Status</p><p className="font-medium capitalize">{selected.status}</p></div>
                <div className="rounded-lg bg-muted/50 p-2.5 col-span-2"><p className="text-xs text-muted-foreground">Note</p><p className="font-medium">{selected.note || "—"}</p></div>
              </div>
              <Button className="w-full" variant="outline" onClick={() => { setSelected(null); navigate(`/admin/orders/${selected.order_id}`); }}>
                View full order tracking
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
