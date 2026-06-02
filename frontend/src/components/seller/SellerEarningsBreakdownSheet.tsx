import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CheckCircle2, AlertCircle, ExternalLink, Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { queryKeys } from "@/lib/queryClient";
import { fetchSellerEarningsBreakdown, type SellerEarningsBreakdown } from "@/lib/sellerPayoutApi";
import { VENDOR_THEME } from "@/lib/vendorTheme";
import { sellerOrderStatusColors } from "@/lib/sellerOrderWorkflow";

export type EarningsBreakdownTab = "included" | "excluded" | "formula";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: EarningsBreakdownTab;
  /** Override breakdown fetch (e.g. admin official shop). */
  fetchBreakdown?: () => Promise<SellerEarningsBreakdown>;
  breakdownQueryKey?: readonly unknown[];
  manageOrdersPath?: string;
  orderDetailPathPrefix?: string;
};

function formatMoney(value: number) {
  return `৳${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function shortId(id: string) {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

export default function SellerEarningsBreakdownSheet({
  open,
  onOpenChange,
  defaultTab = "included",
  fetchBreakdown,
  breakdownQueryKey,
  manageOrdersPath = "/seller/orders",
  orderDetailPathPrefix = "/seller/orders",
}: Props) {
  const { user } = useAuth();
  const { t } = useLanguage();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: breakdownQueryKey ?? queryKeys().sellerEarningsBreakdown(user?.id),
    queryFn: fetchBreakdown ?? fetchSellerEarningsBreakdown,
    enabled: open && (fetchBreakdown ? true : Boolean(user?.id)),
    staleTime: 0,
    refetchOnMount: "always",
  });

  const summary = data?.summary;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("seller.payouts.breakdown.title")}</SheetTitle>
          <SheetDescription>{t("seller.payouts.breakdown.rule")}</SheetDescription>
        </SheetHeader>

        <Button variant="outline" size="sm" className="mt-3" asChild>
          <Link to={manageOrdersPath} onClick={() => onOpenChange(false)}>
            <ExternalLink className="h-3.5 w-3.5 mr-1" />
            {t("seller.payouts.breakdown.manageOrders")}
          </Link>
        </Button>

        {isLoading && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("seller.payouts.breakdown.loading")}
          </p>
        )}

        {isError && (
          <p className="text-sm text-destructive py-6">
            {error instanceof Error ? error.message : t("seller.payouts.breakdown.loadFailed")}
          </p>
        )}

        {data && !isLoading && (
          <Tabs defaultValue={defaultTab} className="mt-4">
            <TabsList className="w-full">
              <TabsTrigger value="included" className="flex-1">
                {t("seller.payouts.breakdown.tabIncluded")} ({data.included_count})
              </TabsTrigger>
              <TabsTrigger value="excluded" className="flex-1">
                {t("seller.payouts.breakdown.tabExcluded")}
              </TabsTrigger>
              <TabsTrigger value="formula" className="flex-1">
                {t("seller.payouts.breakdown.tabFormula")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="included" className="space-y-3 mt-3">
              <div
                className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                  data.verification.matches
                    ? "border-emerald-500/40 bg-emerald-500/10"
                    : "border-destructive/40 bg-destructive/10"
                }`}
              >
                {data.verification.matches ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
                )}
                <span>
                  {data.verification.matches
                    ? t("seller.payouts.breakdown.verificationMatch")
                    : t("seller.payouts.breakdown.verificationMismatch")}
                </span>
              </div>

              {data.included_orders.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  {t("seller.payouts.breakdown.noIncluded")}
                </p>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("seller.payouts.breakdown.colOrder")}</TableHead>
                        <TableHead>{t("seller.payouts.breakdown.colBuyer")}</TableHead>
                        <TableHead>{t("seller.payouts.breakdown.colDate")}</TableHead>
                        <TableHead className="text-right">
                          {t("seller.payouts.breakdown.colAmount")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.included_orders.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-mono text-xs">
                            <Link
                              to={`${orderDetailPathPrefix}/${row.id}`}
                              className="hover:underline"
                              style={{ color: VENDOR_THEME.primary }}
                              onClick={() => onOpenChange(false)}
                            >
                              {shortId(row.id)}
                            </Link>
                          </TableCell>
                          <TableCell className="max-w-[100px] truncate">{row.buyer_name}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            {format(new Date(row.delivered_at || row.created_at), "dd MMM yyyy")}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatMoney(row.total)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell colSpan={3}>{t("seller.payouts.breakdown.includedTotal")}</TableCell>
                        <TableCell className="text-right">{formatMoney(data.included_total)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="excluded" className="space-y-4 mt-3">
              <p className="text-sm text-muted-foreground">{t("seller.payouts.breakdown.excludedIntro")}</p>

              {data.excluded_by_status.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {t("seller.payouts.breakdown.noExcluded")}
                </p>
              ) : (
                <div className="space-y-3">
                  {data.excluded_by_status.map((group) => (
                    <div key={group.status} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className="capitalize"
                          style={{
                            borderColor: sellerOrderStatusColors[group.status] || undefined,
                            color: sellerOrderStatusColors[group.status] || undefined,
                          }}
                        >
                          {group.status.replace(/_/g, " ")}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {t("seller.payouts.breakdown.excludedOrders").replace(
                            "{count}",
                            String(group.count),
                          )}{" "}
                          · {t("seller.payouts.breakdown.excludedSubtotal")}{" "}
                          {formatMoney(group.total_amount)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t("seller.payouts.breakdown.markDeliveredHint")}
                      </p>
                      {data.excluded_sample
                        .filter((o) => o.status === group.status)
                        .slice(0, 5)
                        .map((o) => (
                          <div
                            key={o.id}
                            className="flex items-center justify-between text-sm border-t pt-2"
                          >
                            <div>
                              <span className="font-mono text-xs">{shortId(o.id)}</span>
                              <span className="text-muted-foreground"> · {o.buyer_name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{formatMoney(o.total)}</span>
                              <Button variant="link" size="sm" className="h-auto p-0" asChild>
                                <Link
                                  to={`${orderDetailPathPrefix}/${o.id}`}
                                  onClick={() => onOpenChange(false)}
                                >
                                  {t("seller.payouts.breakdown.viewOrder")}
                                </Link>
                              </Button>
                            </div>
                          </div>
                        ))}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="formula" className="mt-3">
              {summary && (
                <div className="space-y-2 text-sm rounded-lg border p-4">
                  <FormulaRow
                    label={t("seller.payouts.breakdown.formulaGross")}
                    value={formatMoney(summary.gross_earnings)}
                    bold
                  />
                  <FormulaRow
                    label={t("seller.payouts.breakdown.formulaFee")}
                    value={`− ${formatMoney(summary.platform_fee)}`}
                    muted
                  />
                  <FormulaRow
                    label={t("seller.payouts.breakdown.formulaNet")}
                    value={formatMoney(summary.net_earnings)}
                    bold
                  />
                  <FormulaRow
                    label={t("seller.payouts.breakdown.formulaWithdrawn")}
                    value={`− ${formatMoney(summary.withdrawn_total)}`}
                    muted
                  />
                  <FormulaRow
                    label={t("seller.payouts.breakdown.formulaPending")}
                    value={`− ${formatMoney(summary.pending_withdraw_total)}`}
                    muted
                  />
                  <div className="border-t pt-2 mt-2">
                    <FormulaRow
                      label={t("seller.payouts.breakdown.formulaAvailable")}
                      value={formatMoney(summary.available_balance)}
                      bold
                      accent
                    />
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}

function FormulaRow({
  label,
  value,
  bold,
  muted,
  accent,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className={muted ? "text-muted-foreground" : ""}>{label}</span>
      <span
        className={bold ? "font-semibold" : ""}
        style={accent ? { color: VENDOR_THEME.primary } : undefined}
      >
        {value}
      </span>
    </div>
  );
}
