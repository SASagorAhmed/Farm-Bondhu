import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DollarSign,
  Wallet,
  TrendingUp,
  Clock,
  BanknoteIcon,
  BadgePercent,
  Landmark,
  ShoppingBag,
  AlertCircle,
} from "lucide-react";
import { motion } from "framer-motion";
import { ICON_COLORS } from "@/lib/iconColors";
import { VENDOR_THEME, vendorGradient } from "@/lib/vendorTheme";
import StatCard from "@/components/dashboard/StatCard";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryClient";
import {
  createSellerWithdrawalRequest,
  fetchSellerEarningsSummary,
  fetchSellerWithdrawals,
  type SellerEarningsSummary,
} from "@/lib/sellerPayoutApi";
import SellerEarningsBreakdownSheet, {
  type EarningsBreakdownTab,
} from "@/components/seller/SellerEarningsBreakdownSheet";
import { format } from "date-fns";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  approved: ICON_COLORS.farm,
  paid: ICON_COLORS.farm,
  pending: ICON_COLORS.finance,
  rejected: ICON_COLORS.health,
};

function formatMoney(value: number) {
  return `৳${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function normalizeEarningsSummary(data: SellerEarningsSummary): SellerEarningsSummary {
  if (data && typeof data.gross_earnings === "number") return data;
  const legacy = data as SellerEarningsSummary & { summary?: SellerEarningsSummary };
  if (legacy?.summary && typeof legacy.summary.gross_earnings === "number") return legacy.summary;
  return data;
}

function statDisplayValue(
  loading: boolean,
  showValues: boolean,
  amount: number | undefined,
): string {
  if (loading) return "…";
  if (!showValues) return "—";
  return formatMoney(amount ?? 0);
}

export default function Payouts() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [requestAmount, setRequestAmount] = useState("");
  const [requestNote, setRequestNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [breakdownTab, setBreakdownTab] = useState<EarningsBreakdownTab>("included");

  const openBreakdown = (tab: EarningsBreakdownTab) => {
    setBreakdownTab(tab);
    setBreakdownOpen(true);
  };

  const {
    data: summary,
    isLoading: summaryLoading,
    isError: summaryError,
    error: summaryErrorDetail,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: queryKeys().sellerEarnings(user?.id),
    enabled: Boolean(user?.id),
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: fetchSellerEarningsSummary,
    select: (data) => normalizeEarningsSummary(data),
  });

  const { data: withdrawals = [], isLoading: withdrawalsLoading } = useQuery({
    queryKey: queryKeys().sellerWithdrawals(user?.id),
    enabled: Boolean(user?.id),
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: fetchSellerWithdrawals,
  });

  const loading = summaryLoading;
  const showStatValues = !summaryLoading && !summaryError && summary != null;
  const chartData = summary?.monthly_trend?.length
    ? summary.monthly_trend
    : [{ month: "—", amount: 0 }];

  const submitWithdrawal = async () => {
    if (!summary) return;
    const amount = Number(requestAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error(t("seller.payouts.invalidAmount"));
      return;
    }
    if (amount > summary.available_balance) {
      toast.error(t("seller.payouts.exceedsBalance"));
      return;
    }
    setSubmitting(true);
    try {
      await createSellerWithdrawalRequest({
        request_amount: amount,
        note: requestNote.trim() || null,
      });
      toast.success(t("seller.payouts.requestSubmitted"));
      setRequestAmount("");
      setRequestNote("");
      void queryClient.invalidateQueries({ queryKey: queryKeys().sellerEarnings(user?.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys().sellerWithdrawals(user?.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys().sellerEarningsBreakdown(user?.id) });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("seller.payouts.requestFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between flex-wrap gap-3"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">
            {t("seller.payouts.title")}
          </h1>
          <p className="text-muted-foreground mt-1">{t("seller.payouts.subtitle")}</p>
        </div>
      </motion.div>

      {summaryError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t("seller.payouts.loadErrorTitle")}</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-2">
            <span>
              {summaryErrorDetail instanceof Error
                ? summaryErrorDetail.message
                : t("seller.payouts.loadError")}
            </span>
            <Button type="button" variant="outline" size="sm" onClick={() => void refetchSummary()}>
              {t("seller.payouts.retry")}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="space-y-1">
          <StatCard
            title={t("seller.payouts.grossSales")}
            value={statDisplayValue(summaryLoading, showStatValues, summary?.gross_earnings)}
            icon={<TrendingUp className="h-5 w-5" />}
            iconColor={VENDOR_THEME.primary}
            index={0}
            onClick={() => openBreakdown("included")}
          />
          {summary != null && (
            <p className="text-xs text-muted-foreground px-1">
              {t("seller.payouts.deliveredCount").replace("{count}", String(summary.order_count))}
            </p>
          )}
        </div>
        <StatCard
          title={t("seller.payouts.platformFee")}
          value={statDisplayValue(summaryLoading, showStatValues, summary?.platform_fee)}
          icon={<BadgePercent className="h-5 w-5" />}
          iconColor={ICON_COLORS.health}
          index={1}
          onClick={() => openBreakdown("formula")}
        />
        <StatCard
          title={t("seller.payouts.netEarnings")}
          value={statDisplayValue(summaryLoading, showStatValues, summary?.net_earnings)}
          icon={<Wallet className="h-5 w-5" />}
          iconColor={ICON_COLORS.farm}
          index={2}
          onClick={() => openBreakdown("formula")}
        />
        <StatCard
          title={t("seller.payouts.availableBalance")}
          value={statDisplayValue(summaryLoading, showStatValues, summary?.available_balance)}
          icon={<Landmark className="h-5 w-5" />}
          iconColor={VENDOR_THEME.primaryDark}
          index={3}
        />
        <StatCard
          title={t("seller.payouts.withdrawn")}
          value={statDisplayValue(summaryLoading, showStatValues, summary?.withdrawn_total)}
          icon={<DollarSign className="h-5 w-5" />}
          iconColor={ICON_COLORS.finance}
          index={4}
        />
        <StatCard
          title={t("seller.payouts.pendingWithdrawal")}
          value={statDisplayValue(summaryLoading, showStatValues, summary?.pending_withdraw_total)}
          icon={<Clock className="h-5 w-5" />}
          iconColor={ICON_COLORS.finance}
          index={5}
        />
      </div>

      <Card className="shadow-card overflow-hidden">
        <div className="h-1" style={{ background: vendorGradient() }} />
        <CardHeader>
          <CardTitle className="text-lg font-display">{t("seller.payouts.earningsTrend")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            {loading ? (
              <p className="text-center text-muted-foreground py-16">{t("seller.payouts.loading")}</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="sellerEarnGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={VENDOR_THEME.primary} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={VENDOR_THEME.primary} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" axisLine={false} tickLine={false} className="text-xs" />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    className="text-xs"
                    tickFormatter={(v) => `৳${(Number(v) / 1000).toFixed(0)}k`}
                  />
                  <Tooltip formatter={(v: number) => [formatMoney(v), t("seller.payouts.earnings")]} />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke={VENDOR_THEME.primary}
                    fill="url(#sellerEarnGrad)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-lg font-display">{t("seller.payouts.requestWithdrawal")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t("seller.payouts.availableHint")}{" "}
            <span className="font-semibold text-foreground">
              {statDisplayValue(summaryLoading, showStatValues, summary?.available_balance)}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">{t("seller.payouts.feeNote")}</p>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t("seller.payouts.amountLabel")}</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={requestAmount}
                onChange={(e) => setRequestAmount(e.target.value)}
                placeholder={t("seller.payouts.amountPlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("seller.payouts.noteLabel")}</Label>
              <Textarea
                value={requestNote}
                onChange={(e) => setRequestNote(e.target.value)}
                placeholder={t("seller.payouts.notePlaceholder")}
                className="min-h-[44px]"
              />
            </div>
          </div>
          <Button
            className="text-white"
            style={{ backgroundColor: VENDOR_THEME.primary }}
            onClick={() => void submitWithdrawal()}
            disabled={submitting || loading || summaryError || !summary?.available_balance}
          >
            <BanknoteIcon className="h-4 w-4 mr-1" />
            {submitting ? t("seller.payouts.submitting") : t("seller.payouts.requestWithdrawal")}
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-lg font-display">{t("seller.payouts.withdrawalHistory")}</CardTitle>
        </CardHeader>
        <CardContent>
          {withdrawalsLoading ? (
            <p className="text-center text-muted-foreground py-8">{t("seller.payouts.loading")}</p>
          ) : withdrawals.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{t("seller.payouts.noWithdrawals")}</p>
          ) : (
            <div className="space-y-3">
              {withdrawals.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card flex-wrap gap-2"
                >
                  <div>
                    <p className="font-medium">{formatMoney(row.request_amount)}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(row.created_at), "MMM dd, yyyy")} • {row.status.toUpperCase()}
                    </p>
                    {row.note ? (
                      <p className="text-xs text-muted-foreground mt-1">
                        <span className="font-medium">{t("seller.payouts.yourNote")}:</span> {row.note}
                      </p>
                    ) : null}
                    {row.review_note ? (
                      <p className="text-xs text-muted-foreground mt-1">
                        <span className="font-medium">{t("seller.payouts.adminReason")}:</span>{" "}
                        {row.review_note}
                      </p>
                    ) : null}
                  </div>
                  <Badge
                    style={{
                      backgroundColor: `${statusColors[row.status] || ICON_COLORS.finance}1A`,
                      color: statusColors[row.status] || ICON_COLORS.finance,
                    }}
                    className="capitalize"
                  >
                    {row.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-lg font-display flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" style={{ color: VENDOR_THEME.primary }} />
            {t("seller.payouts.deliveredOrders")}
          </CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={() => openBreakdown("included")}>
            {t("seller.payouts.viewBreakdown")}
          </Button>
        </CardHeader>
        <CardContent>
          {summary != null && summary.order_count > 0 && (
            <p className="text-xs text-muted-foreground mb-3">
              {summary.history.length >= summary.order_count
                ? t("seller.payouts.showingAllDelivered").replace("{count}", String(summary.order_count))
                : t("seller.payouts.showingPartialDelivered")
                    .replace("{shown}", String(summary.history.length))
                    .replace("{count}", String(summary.order_count))}
            </p>
          )}
          {loading ? (
            <p className="text-center text-muted-foreground py-8">{t("seller.payouts.loading")}</p>
          ) : !summary?.history?.length ? (
            <p className="text-center text-muted-foreground py-8">{t("seller.payouts.noDeliveredOrders")}</p>
          ) : (
            <div className="space-y-3">
              {summary.history.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card"
                >
                  <div>
                    <p className="font-medium">{row.buyer_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(row.delivered_at || row.created_at), "MMM dd, yyyy")}
                    </p>
                  </div>
                  <p className="text-lg font-bold" style={{ color: VENDOR_THEME.primaryDark }}>
                    {formatMoney(row.total)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <SellerEarningsBreakdownSheet
        open={breakdownOpen}
        onOpenChange={setBreakdownOpen}
        defaultTab={breakdownTab}
      />
    </div>
  );
}
