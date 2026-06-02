import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Banknote, Loader2, Shield } from "lucide-react";
import { motion } from "framer-motion";
import { ICON_COLORS } from "@/lib/iconColors";
import { moduleCachePolicy, queryKeys } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  fetchAdminSellerWithdrawalDetails,
  fetchAdminSellerWithdrawals,
  reviewAdminSellerWithdrawal,
  type AdminSellerWithdrawalDetails,
} from "@/lib/sellerPayoutApi";
import { toast } from "sonner";

export default function AdminMarketplaceSellerPayouts() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkHandled = useRef(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [reviewNote, setReviewNote] = useState<Record<string, string>>({});
  const [actingId, setActingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [details, setDetails] = useState<AdminSellerWithdrawalDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const requestIdFromUrl = searchParams.get("request");

  const { data: withdrawals = [], isLoading } = useQuery({
    queryKey: queryKeys().adminSellerWithdrawals(statusFilter),
    queryFn: () => fetchAdminSellerWithdrawals(statusFilter),
    staleTime: moduleCachePolicy.admin.staleTime,
  });

  const clearRequestParam = useCallback(() => {
    if (!searchParams.has("request")) return;
    const next = new URLSearchParams(searchParams);
    next.delete("request");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const loadDetails = useCallback(
    async (id: string) => {
      setSelectedId(id);
      setDetailsLoading(true);
      try {
        const data = await fetchAdminSellerWithdrawalDetails(id);
        setDetails(data);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("admin.marketplace.payouts.detailsFailed"));
        setDetails(null);
      } finally {
        setDetailsLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    if (!requestIdFromUrl || isLoading || deepLinkHandled.current) return;
    const match = withdrawals.find((w) => w.id === requestIdFromUrl);
    if (!match) {
      if (statusFilter !== "all") {
        setStatusFilter("all");
      }
      return;
    }
    deepLinkHandled.current = true;
    void loadDetails(requestIdFromUrl);
    requestAnimationFrame(() => {
      document.getElementById(`withdrawal-row-${requestIdFromUrl}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  }, [requestIdFromUrl, isLoading, withdrawals, statusFilter, loadDetails]);

  useEffect(() => {
    if (!requestIdFromUrl) {
      deepLinkHandled.current = false;
    }
  }, [requestIdFromUrl]);

  const handleReview = async (id: string, action: "approve" | "reject") => {
    setActingId(id);
    try {
      await reviewAdminSellerWithdrawal(id, action, reviewNote[id] || null);
      toast.success(
        action === "approve"
          ? t("admin.marketplace.payouts.approved")
          : t("admin.marketplace.payouts.rejected"),
      );
      void queryClient.invalidateQueries({ queryKey: ["admin-seller-withdrawals"] });
      if (selectedId === id) await loadDetails(id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("admin.marketplace.payouts.reviewFailed"));
    } finally {
      setActingId(null);
    }
  };

  const pendingCount = withdrawals.filter((w) => w.status === "pending").length;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/admin/marketplace/transactions">
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t("admin.marketplace.payouts.backTransactions")}
          </Link>
        </Button>
        <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${ICON_COLORS.admin}, #7c3aed)` }}>
          <Banknote className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">
              {t("admin.marketplace.payouts.title")}
            </h1>
            <Badge className="text-[10px] font-bold" style={{ backgroundColor: `${ICON_COLORS.admin}1A`, color: ICON_COLORS.admin }}>
              <Shield className="h-3 w-3 mr-0.5" /> Admin
            </Badge>
            {pendingCount > 0 && (
              <Badge variant="secondary">{pendingCount} {t("admin.marketplace.payouts.pending")}</Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm">{t("admin.marketplace.payouts.subtitle")}</p>
        </div>
      </motion.div>

      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("admin.marketplace.payouts.filterStatus")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("admin.marketplace.payouts.allStatuses")}</SelectItem>
            <SelectItem value="pending">{t("admin.marketplace.payouts.statusPending")}</SelectItem>
            <SelectItem value="approved">{t("admin.marketplace.payouts.statusApproved")}</SelectItem>
            <SelectItem value="rejected">{t("admin.marketplace.payouts.statusRejected")}</SelectItem>
            <SelectItem value="paid">{t("admin.marketplace.payouts.statusPaid")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="shadow-card overflow-hidden">
        <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.admin}, #7c3aed)` }} />
        <CardHeader>
          <CardTitle className="text-lg font-display">{t("admin.marketplace.payouts.requestsTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8 flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> {t("admin.marketplace.payouts.loading")}
            </p>
          ) : withdrawals.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{t("admin.marketplace.payouts.empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.marketplace.payouts.colSeller")}</TableHead>
                  <TableHead>{t("admin.marketplace.payouts.colAmount")}</TableHead>
                  <TableHead>{t("admin.marketplace.payouts.colStatus")}</TableHead>
                  <TableHead>{t("admin.marketplace.payouts.colDate")}</TableHead>
                  <TableHead>{t("admin.marketplace.payouts.colSellerNote")}</TableHead>
                  <TableHead>{t("admin.marketplace.payouts.colReviewNote")}</TableHead>
                  <TableHead>{t("admin.marketplace.payouts.colActions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withdrawals.map((w) => (
                  <TableRow
                    key={w.id}
                    id={`withdrawal-row-${w.id}`}
                    className={
                      selectedId === w.id || requestIdFromUrl === w.id
                        ? "ring-2 ring-inset ring-primary/40 bg-muted/30"
                        : undefined
                    }
                  >
                    <TableCell>
                      <div className="font-medium">{w.shop_name || w.seller_name || "Seller"}</div>
                      <div className="text-xs text-muted-foreground">{w.seller_email || "-"}</div>
                    </TableCell>
                    <TableCell className="font-medium">৳{Number(w.request_amount || 0).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          w.status === "pending"
                            ? "secondary"
                            : w.status === "approved" || w.status === "paid"
                              ? "default"
                              : "outline"
                        }
                      >
                        {w.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{new Date(w.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="max-w-[180px] text-xs text-muted-foreground truncate">{w.note || "—"}</TableCell>
                    <TableCell className="max-w-[180px]">
                      <input
                        className="w-full rounded border px-2 py-1 text-sm bg-background"
                        value={reviewNote[w.id] || ""}
                        onChange={(e) => setReviewNote((prev) => ({ ...prev, [w.id]: e.target.value }))}
                        placeholder={t("admin.marketplace.payouts.reviewPlaceholder")}
                        disabled={w.status !== "pending" || actingId === w.id}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void loadDetails(w.id)}
                          disabled={detailsLoading && selectedId === w.id}
                        >
                          {t("admin.marketplace.payouts.details")}
                        </Button>
                        {w.status === "pending" && (
                          <>
                            <Button size="sm" onClick={() => void handleReview(w.id, "approve")} disabled={actingId === w.id}>
                              {t("admin.marketplace.payouts.approve")}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => void handleReview(w.id, "reject")}
                              disabled={actingId === w.id}
                            >
                              {t("admin.marketplace.payouts.reject")}
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {selectedId && (
            <div className="mt-6 rounded-lg border p-4 bg-muted/20 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-base">{t("admin.marketplace.payouts.detailsTitle")}</h3>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSelectedId(null);
                    setDetails(null);
                    clearRequestParam();
                  }}
                >
                  {t("admin.marketplace.payouts.close")}
                </Button>
              </div>
              {detailsLoading ? (
                <p className="text-sm text-muted-foreground">{t("admin.marketplace.payouts.loadingDetails")}</p>
              ) : !details ? (
                <p className="text-sm text-muted-foreground">{t("admin.marketplace.payouts.noDetails")}</p>
              ) : (
                <div className="space-y-4">
                  <div className="grid md:grid-cols-4 gap-3">
                    {[
                      { label: t("admin.marketplace.payouts.gross"), value: details.summary?.gross_earnings },
                      { label: t("admin.marketplace.payouts.platformFee"), value: details.summary?.platform_fee },
                      { label: t("admin.marketplace.payouts.net"), value: details.summary?.net_earnings },
                      { label: t("admin.marketplace.payouts.available"), value: details.summary?.available_balance },
                    ].map((s) => (
                      <Card key={s.label}>
                        <CardContent className="p-3">
                          <p className="text-xs text-muted-foreground">{s.label}</p>
                          <p className="font-semibold">৳{Number(s.value || 0).toFixed(2)}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  {details.summary?.order_count != null && (
                    <p className="text-xs text-muted-foreground">
                      {t("admin.marketplace.payouts.grossEligibility").replace(
                        "{count}",
                        String(details.summary.order_count),
                      )}
                    </p>
                  )}
                  <div className="grid md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">{t("admin.marketplace.payouts.sellerProfile")}</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm space-y-1">
                        <p>
                          <span className="text-muted-foreground">{t("admin.marketplace.payouts.shop")}:</span>{" "}
                          {details.seller_profile?.shop_name || "—"}
                        </p>
                        <p>
                          <span className="text-muted-foreground">{t("admin.marketplace.payouts.name")}:</span>{" "}
                          {details.seller_profile?.name || "—"}
                        </p>
                        <p>
                          <span className="text-muted-foreground">{t("admin.marketplace.payouts.email")}:</span>{" "}
                          {details.seller_profile?.email || "—"}
                        </p>
                        <p>
                          <span className="text-muted-foreground">{t("admin.marketplace.payouts.phone")}:</span>{" "}
                          {details.seller_profile?.phone || "—"}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">{t("admin.marketplace.payouts.requestContext")}</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm space-y-1">
                        <p>
                          <span className="text-muted-foreground">{t("admin.marketplace.payouts.colAmount")}:</span> ৳
                          {Number(details.request?.request_amount || 0).toFixed(2)}
                        </p>
                        <p>
                          <span className="text-muted-foreground">{t("admin.marketplace.payouts.colStatus")}:</span>{" "}
                          {details.request?.status}
                        </p>
                        <p>
                          <span className="text-muted-foreground">{t("admin.marketplace.payouts.colSellerNote")}:</span>{" "}
                          {details.request?.note || "—"}
                        </p>
                        <p>
                          <span className="text-muted-foreground">{t("admin.marketplace.payouts.colReviewNote")}:</span>{" "}
                          {details.request?.review_note || "—"}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">{t("admin.marketplace.payouts.recentOrders")}</CardTitle>
                    </CardHeader>
                    <CardContent className="max-h-48 overflow-y-auto text-sm space-y-2">
                      {details.orders.length === 0 ? (
                        <p className="text-muted-foreground">{t("admin.marketplace.payouts.noOrders")}</p>
                      ) : (
                        details.orders.slice(0, 15).map((o) => (
                          <div key={o.id} className="flex justify-between border-b pb-1">
                            <span>{o.buyer_name}</span>
                            <span className="font-medium">৳{Number(o.total || 0).toFixed(2)}</span>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
