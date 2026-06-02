import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Store, Search, Loader2, Shield, Eye, CheckCircle2, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { ICON_COLORS } from "@/lib/iconColors";
import { moduleCachePolicy, queryKeys } from "@/lib/queryClient";
import { fetchAdminSellerDetail, fetchAdminSellers, type AdminSellerRow } from "@/lib/adminMarketplaceApi";
import { AdminUserAvatar } from "@/components/admin/AdminUserAvatar";
import { AdminMarketplaceModerationActions } from "@/components/admin/AdminMarketplaceModerationActions";
import { useLanguage } from "@/contexts/LanguageContext";
import { format } from "date-fns";

const PAGE_SIZE = 50;

const statusColors: Record<string, string> = {
  active: "bg-secondary/15 text-secondary",
  suspended: "bg-destructive/15 text-destructive",
  deleted: "bg-muted text-muted-foreground",
  approved: "bg-secondary/15 text-secondary",
  blocked: "bg-destructive/15 text-destructive",
};

type SellerDetail = {
  shop?: {
    description?: string | null;
    owner_email?: string;
    owner_phone?: string | null;
    owner_joined?: string;
    logo_url?: string | null;
    owner_name?: string;
    owner_avatar_url?: string | null;
    status?: string;
  };
  stats?: { product_count?: number; revenue?: number };
  recent_orders?: Array<{ id: string; status: string; total: number; buyer_name: string }>;
  marketplace_blocked?: boolean;
  owner_status?: string;
};

export default function AdminMarketplaceSellers() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [verified, setVerified] = useState("all");
  const [offset, setOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filterKey = `${search}|${verified}|${offset}`;
  const { data, isLoading, isError, error } = useQuery({
    queryKey: queryKeys().adminMarketplaceSellers(filterKey),
    queryFn: () => fetchAdminSellers({ search, verified, limit: PAGE_SIZE, offset }),
    staleTime: moduleCachePolicy.admin.staleTime,
  });

  const sellers = data?.data ?? [];
  const total = data?.total ?? 0;

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["admin-seller-detail", selectedId],
    queryFn: () => fetchAdminSellerDetail(selectedId!),
    enabled: Boolean(selectedId),
  });

  const selected = useMemo(() => sellers.find((s) => s.user_id === selectedId), [sellers, selectedId]);
  const detailData = detail as SellerDetail | undefined;
  const displayStatus = detailData?.owner_status || selected?.owner_status || "active";
  const marketplaceBlocked = detailData?.marketplace_blocked ?? selected?.marketplace_blocked ?? false;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${ICON_COLORS.admin}, #7c3aed)` }}>
          <Store className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">{t("adminModeration.sellersTitle")}</h1>
            <Badge className="text-[10px] font-bold" style={{ backgroundColor: `${ICON_COLORS.admin}1A`, color: ICON_COLORS.admin }}>
              <Shield className="h-3 w-3 mr-0.5" /> Admin
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">{t("adminModeration.sellersSubtitle")}</p>
        </div>
      </motion.div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t("adminModeration.searchSellers")} className="pl-10" value={search} onChange={(e) => { setSearch(e.target.value); setOffset(0); }} />
        </div>
        <Select value={verified} onValueChange={(v) => { setVerified(v); setOffset(0); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Verified" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("adminModeration.allShops")}</SelectItem>
            <SelectItem value="yes">{t("adminModeration.verifiedYes")}</SelectItem>
            <SelectItem value="no">{t("adminModeration.verifiedNo")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="shadow-card overflow-hidden">
        <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.admin}, #7c3aed)` }} />
        <CardHeader><CardTitle className="text-lg">{t("adminModeration.sellersTitle")} ({total})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : isError ? (
            <p className="text-center text-destructive py-8">
              {error instanceof Error ? error.message : t("adminModeration.loadSellersFailed")}
            </p>
          ) : sellers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{t("adminModeration.noSellers")}</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12" />
                    <TableHead>{t("adminModeration.shop")}</TableHead>
                    <TableHead>{t("adminModeration.owner")}</TableHead>
                    <TableHead>{t("adminModeration.email")}</TableHead>
                    <TableHead>{t("adminModeration.location")}</TableHead>
                    <TableHead>{t("adminModeration.products")}</TableHead>
                    <TableHead>{t("adminModeration.orders")}</TableHead>
                    <TableHead>{t("adminModeration.revenue")}</TableHead>
                    <TableHead>{t("adminModeration.verified")}</TableHead>
                    <TableHead>{t("adminModeration.status")}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sellers.map((s: AdminSellerRow) => (
                    <TableRow key={s.user_id}>
                      <TableCell>
                        <AdminUserAvatar
                          name={s.shop_name}
                          avatarUrl={s.logo_url}
                          className="h-8 w-8 rounded-lg"
                        />
                      </TableCell>
                      <TableCell className="font-medium">{s.shop_name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <AdminUserAvatar name={s.owner_name} avatarUrl={s.owner_avatar_url} className="h-7 w-7" />
                          <span>{s.owner_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{s.owner_email}</TableCell>
                      <TableCell className="text-sm">{s.location || "—"}</TableCell>
                      <TableCell>{s.product_count}</TableCell>
                      <TableCell>{s.order_count}</TableCell>
                      <TableCell>৳{Number(s.revenue).toLocaleString()}</TableCell>
                      <TableCell>
                        {s.is_verified ? (
                          <Badge className="gap-1" style={{ backgroundColor: `${ICON_COLORS.farm}1A`, color: ICON_COLORS.farm }}>
                            <CheckCircle2 className="h-3 w-3" /> {t("adminModeration.verifiedYes")}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">{t("adminModeration.verifiedNo")}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Badge className={statusColors[s.owner_status] || statusColors[s.status] || "bg-muted text-muted-foreground"}>
                            {s.owner_status || s.status}
                          </Badge>
                          {s.marketplace_blocked ? (
                            <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-400">
                              {t("adminModeration.blockedShort")}
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedId(s.user_id)}><Eye className="h-4 w-4" /></Button>
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

      <Dialog open={!!selectedId} onOpenChange={(open) => { if (!open) setSelectedId(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{t("adminModeration.sellerDetails")}</DialogTitle>
            <DialogDescription>
              {selected ? `${selected.shop_name} — ${selected.owner_name}` : null}
            </DialogDescription>
          </DialogHeader>
          {detailLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : detailData ? (
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-3">
                <AdminUserAvatar
                  name={selected?.shop_name}
                  logoUrl={detailData.shop?.logo_url || selected?.logo_url}
                  avatarUrl={detailData.shop?.owner_avatar_url}
                  className="h-14 w-14 rounded-xl"
                  fallbackClassName="text-base rounded-xl"
                />
                <div>
                  <p className="font-semibold">{selected?.shop_name}</p>
                  <p className="text-muted-foreground text-xs">{selected?.owner_name} · {selected?.owner_email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-muted/50 p-2.5 col-span-2"><p className="text-xs text-muted-foreground">{t("adminModeration.description")}</p><p className="font-medium">{detailData.shop?.description || "—"}</p></div>
                <div className="rounded-lg bg-muted/50 p-2.5"><p className="text-xs text-muted-foreground">{t("adminModeration.email")}</p><p className="font-medium">{detailData.shop?.owner_email}</p></div>
                <div className="rounded-lg bg-muted/50 p-2.5"><p className="text-xs text-muted-foreground">{t("adminModeration.phone")}</p><p className="font-medium">{detailData.shop?.owner_phone || "—"}</p></div>
                <div className="rounded-lg bg-muted/50 p-2.5"><p className="text-xs text-muted-foreground">{t("adminModeration.products")}</p><p className="font-medium">{detailData.stats?.product_count ?? 0}</p></div>
                <div className="rounded-lg bg-muted/50 p-2.5"><p className="text-xs text-muted-foreground">{t("adminModeration.revenue")}</p><p className="font-medium">৳{Number(detailData.stats?.revenue || 0).toLocaleString()}</p></div>
                <div className="rounded-lg bg-muted/50 p-2.5 col-span-2"><p className="text-xs text-muted-foreground">{t("adminModeration.joined")}</p><p className="font-medium">{detailData.shop?.owner_joined ? format(new Date(detailData.shop.owner_joined), "dd MMM yyyy") : "—"}</p></div>
              </div>

              {selectedId ? (
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="gap-1" asChild>
                    <Link to={`/admin/marketplace?tab=flash-sale&shop=${encodeURIComponent(selectedId)}`}>
                      <Zap className="h-3.5 w-3.5" />
                      Flash sale
                    </Link>
                  </Button>
                  <AdminMarketplaceModerationActions
                    role="seller"
                    userId={selectedId}
                    status={displayStatus}
                    marketplaceBlocked={marketplaceBlocked}
                    onDeleted={() => setSelectedId(null)}
                  />
                </div>
              ) : null}

              {(detailData.recent_orders || []).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t("adminModeration.recentOrders")}</p>
                  <div className="space-y-2">
                    {(detailData.recent_orders || []).map((o) => (
                      <button key={o.id} type="button" className="w-full text-left rounded-lg border border-border p-2.5 hover:bg-muted/50" onClick={() => { setSelectedId(null); navigate(`/admin/orders/${o.id}`); }}>
                        <div className="flex justify-between gap-2">
                          <span className="font-mono text-xs">{o.id.slice(0, 8)}…</span>
                          <Badge variant="secondary" className="capitalize text-[10px]">{o.status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{o.buyer_name} · ৳{Number(o.total).toLocaleString()}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
