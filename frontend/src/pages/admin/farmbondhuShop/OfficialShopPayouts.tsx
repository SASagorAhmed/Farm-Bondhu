import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DollarSign, Wallet, TrendingUp, Clock, BadgePercent, Info } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ICON_COLORS } from "@/lib/iconColors";
import StatCard from "@/components/dashboard/StatCard";
import {
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

function formatMoney(value: number) {
  return `৳${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function OfficialShopPayouts() {
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [breakdownTab, setBreakdownTab] = useState<EarningsBreakdownTab>("included");

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

  return (
    <div className="space-y-6">
      <OfficialShopPageHeader title="Payouts" description="Official shop earnings and withdrawal history" />

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

      <SellerEarningsBreakdownSheet
        open={breakdownOpen}
        onOpenChange={setBreakdownOpen}
        defaultTab={breakdownTab}
        fetchBreakdown={fetchOfficialShopEarningsBreakdown}
        breakdownQueryKey={["admin-official-shop-earnings-breakdown"]}
        manageOrdersPath="/admin/farmbondhu-shop/orders"
        orderDetailPathPrefix="/admin/orders"
      />
    </div>
  );
}
