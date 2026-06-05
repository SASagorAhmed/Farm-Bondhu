import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DollarSign, Wallet, TrendingUp, Clock, BadgePercent, Info } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ICON_COLORS } from "@/lib/iconColors";
import StatCard from "@/components/dashboard/StatCard";
import {
  createOfficialShopWithdrawal,
  fetchOfficialShopEarningsBreakdown,
  fetchOfficialShopEarningsSummary,
  fetchOfficialShopWithdrawals,
  officialShopEarningsQueryKey,
  officialShopWithdrawalsQueryKey,
} from "@/lib/adminFarmBondhuShopApi";
import SellerEarningsBreakdownSheet, {
  type EarningsBreakdownTab,
} from "@/components/seller/SellerEarningsBreakdownSheet";
import OfficialShopPageHeader from "./OfficialShopPageHeader";
import { format } from "date-fns";
import { toast } from "sonner";

function formatMoney(value: number) {
  return `৳${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function OfficialShopPayouts() {
  const queryClient = useQueryClient();
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [breakdownTab, setBreakdownTab] = useState<EarningsBreakdownTab>("included");
  const [requestAmount, setRequestAmount] = useState("");
  const [requestNote, setRequestNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: summary, isLoading } = useQuery({
    queryKey: officialShopEarningsQueryKey(),
    queryFn: fetchOfficialShopEarningsSummary,
  });

  const { data: withdrawals = [] } = useQuery({
    queryKey: officialShopWithdrawalsQueryKey(),
    queryFn: fetchOfficialShopWithdrawals,
  });

  const openBreakdown = (tab: EarningsBreakdownTab) => {
    setBreakdownTab(tab);
    setBreakdownOpen(true);
  };

  const chartData = summary?.monthly_trend?.length
    ? summary.monthly_trend
    : [{ month: "—", amount: 0 }];

  const submitWithdrawal = async () => {
    if (!summary) return;
    const amount = Number(requestAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid withdrawal amount");
      return;
    }
    if (amount > summary.available_balance) {
      toast.error("Amount exceeds available balance");
      return;
    }
    setSubmitting(true);
    try {
      await createOfficialShopWithdrawal({
        request_amount: amount,
        note: requestNote.trim() || null,
      });
      toast.success("Withdrawal request submitted");
      setRequestAmount("");
      setRequestNote("");
      void queryClient.invalidateQueries({ queryKey: officialShopEarningsQueryKey() });
      void queryClient.invalidateQueries({ queryKey: officialShopWithdrawalsQueryKey() });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Withdrawal request failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <OfficialShopPageHeader title="Payouts" description="Official shop earnings and withdrawal requests" />

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Platform shop earnings</AlertTitle>
        <AlertDescription>
          Figures reflect delivered orders for the official FarmBondhu seller account. Withdrawal requests use the
          same seller payout pipeline as marketplace sellers.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Gross sales"
          value={isLoading ? "…" : formatMoney(summary?.gross_earnings ?? 0)}
          icon={<DollarSign className="h-5 w-5" />}
          iconColor={ICON_COLORS.finance}
          index={0}
          onClick={() => openBreakdown("included")}
        />
        <StatCard
          title="Net earnings"
          value={isLoading ? "…" : formatMoney(summary?.net_earnings ?? 0)}
          icon={<Wallet className="h-5 w-5" />}
          iconColor={ICON_COLORS.farm}
          index={1}
        />
        <StatCard
          title="Available"
          value={isLoading ? "…" : formatMoney(summary?.available_balance ?? 0)}
          icon={<TrendingUp className="h-5 w-5" />}
          iconColor={ICON_COLORS.marketplace}
          index={2}
        />
        <StatCard
          title="Platform fee"
          value={isLoading ? "…" : formatMoney(summary?.platform_fee ?? 0)}
          icon={<BadgePercent className="h-5 w-5" />}
          iconColor={ICON_COLORS.orders}
          index={3}
          onClick={() => openBreakdown("excluded")}
        />
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-lg font-display">Monthly earnings trend</CardTitle>
        </CardHeader>
        <CardContent className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value: number) => formatMoney(value)} />
              <Area type="monotone" dataKey="amount" stroke={ICON_COLORS.farm} fill={`${ICON_COLORS.farm}33`} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg font-display">Request withdrawal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="withdrawAmount">Amount (BDT)</Label>
              <Input
                id="withdrawAmount"
                type="number"
                min="0"
                step="0.01"
                value={requestAmount}
                onChange={(e) => setRequestAmount(e.target.value)}
                placeholder={summary ? formatMoney(summary.available_balance) : "0.00"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="withdrawNote">Note (optional)</Label>
              <Textarea
                id="withdrawNote"
                value={requestNote}
                onChange={(e) => setRequestNote(e.target.value)}
                rows={3}
              />
            </div>
            <Button
              className="text-white"
              style={{ backgroundColor: ICON_COLORS.farm }}
              disabled={submitting || isLoading}
              onClick={() => void submitWithdrawal()}
            >
              Submit withdrawal request
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg font-display flex items-center gap-2">
              <Clock className="h-5 w-5" style={{ color: ICON_COLORS.finance }} />
              Withdrawal history
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {withdrawals.length === 0 && (
              <p className="text-sm text-muted-foreground">No withdrawal requests yet.</p>
            )}
            {withdrawals.map((w) => (
              <div key={w.id} className="flex items-center justify-between gap-2 border-b pb-2 last:border-0">
                <div>
                  <p className="font-medium">{formatMoney(w.request_amount)}</p>
                  <p className="text-xs text-muted-foreground">
                    {w.created_at ? format(new Date(w.created_at), "dd MMM yyyy") : "—"}
                  </p>
                </div>
                <Badge variant="outline" className="capitalize">
                  {w.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <SellerEarningsBreakdownSheet
        open={breakdownOpen}
        onOpenChange={setBreakdownOpen}
        defaultTab={breakdownTab}
        fetchBreakdown={fetchOfficialShopEarningsBreakdown}
        breakdownQueryKey={["admin-official-shop-earnings-breakdown"]}
        manageOrdersPath="/admin/farmbondhu-shop/orders"
        orderDetailPathPrefix="/admin/farmbondhu-shop/orders"
      />
    </div>
  );
}
