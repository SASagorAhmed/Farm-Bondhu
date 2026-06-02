import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Users, Search, Loader2, Shield, Eye } from "lucide-react";
import { motion } from "framer-motion";
import { ICON_COLORS } from "@/lib/iconColors";
import { moduleCachePolicy, queryKeys } from "@/lib/queryClient";
import { fetchAdminBuyerDetail, fetchAdminBuyers, type AdminBuyerRow } from "@/lib/adminMarketplaceApi";
import { AdminUserAvatar } from "@/components/admin/AdminUserAvatar";
import { AdminMarketplaceModerationActions } from "@/components/admin/AdminMarketplaceModerationActions";
import { useLanguage } from "@/contexts/LanguageContext";
import { format } from "date-fns";

const PAGE_SIZE = 50;

const statusColors: Record<string, string> = {
  active: "bg-secondary/15 text-secondary",
  suspended: "bg-destructive/15 text-destructive",
  deleted: "bg-muted text-muted-foreground",
};

type BuyerDetail = {
  profile?: {
    phone?: string | null;
    location?: string | null;
    avatar_url?: string | null;
    status?: string;
  };
  stats?: { order_count?: number; total_spent?: number };
  roles?: string[];
  address_count?: number;
  recent_orders?: Array<{ id: string; status: string; total: number; seller_name: string }>;
  marketplace_blocked?: boolean;
  status?: string;
};

export default function AdminMarketplaceBuyers() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filterKey = `${search}|${offset}`;
  const { data, isLoading, isError, error } = useQuery({
    queryKey: queryKeys().adminMarketplaceBuyers(filterKey),
    queryFn: () => fetchAdminBuyers({ search, limit: PAGE_SIZE, offset }),
    staleTime: moduleCachePolicy.admin.staleTime,
  });

  const buyers = data?.data ?? [];
  const total = data?.total ?? 0;

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["admin-buyer-detail", selectedId],
    queryFn: () => fetchAdminBuyerDetail(selectedId!),
    enabled: Boolean(selectedId),
  });

  const selected = useMemo(() => buyers.find((b) => b.id === selectedId), [buyers, selectedId]);
  const detailData = detail as BuyerDetail | undefined;
  const displayStatus = detailData?.status || detailData?.profile?.status || selected?.status || "active";
  const marketplaceBlocked = detailData?.marketplace_blocked ?? selected?.marketplace_blocked ?? false;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${ICON_COLORS.admin}, #7c3aed)` }}>
          <Users className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">{t("adminModeration.buyersTitle")}</h1>
            <Badge className="text-[10px] font-bold" style={{ backgroundColor: `${ICON_COLORS.admin}1A`, color: ICON_COLORS.admin }}>
              <Shield className="h-3 w-3 mr-0.5" /> Admin
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">{t("adminModeration.buyersSubtitle")}</p>
        </div>
      </motion.div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("adminModeration.searchBuyers")}
          className="pl-10"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
        />
      </div>

      <Card className="shadow-card overflow-hidden">
        <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.admin}, #7c3aed)` }} />
        <CardHeader><CardTitle className="text-lg">{t("adminModeration.buyersTitle")} ({total})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : isError ? (
            <p className="text-center text-destructive py-8">
              {error instanceof Error ? error.message : t("adminModeration.loadBuyersFailed")}
            </p>
          ) : buyers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{t("adminModeration.noBuyers")}</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12" />
                    <TableHead>{t("adminModeration.name")}</TableHead>
                    <TableHead>{t("adminModeration.email")}</TableHead>
                    <TableHead>{t("adminModeration.phone")}</TableHead>
                    <TableHead>{t("adminModeration.location")}</TableHead>
                    <TableHead>{t("adminModeration.orders")}</TableHead>
                    <TableHead>{t("adminModeration.totalSpent")}</TableHead>
                    <TableHead>{t("adminModeration.status")}</TableHead>
                    <TableHead>{t("adminModeration.joined")}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {buyers.map((b: AdminBuyerRow) => (
                    <TableRow key={b.id}>
                      <TableCell>
                        <AdminUserAvatar name={b.name} avatarUrl={b.avatar_url} className="h-8 w-8" />
                      </TableCell>
                      <TableCell className="font-medium">{b.name}</TableCell>
                      <TableCell className="text-sm">{b.email}</TableCell>
                      <TableCell className="text-sm">{b.phone || "—"}</TableCell>
                      <TableCell className="text-sm">{b.location || "—"}</TableCell>
                      <TableCell>{b.order_count}</TableCell>
                      <TableCell>৳{Number(b.total_spent).toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Badge className={statusColors[b.status] || "bg-muted text-muted-foreground"}>{b.status}</Badge>
                          {b.marketplace_blocked ? (
                            <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-400">
                              {t("adminModeration.blockedShort")}
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{format(new Date(b.created_at), "dd MMM yyyy")}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedId(b.id)}>
                          <Eye className="h-4 w-4" />
                        </Button>
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
            <DialogTitle className="font-display">{t("adminModeration.buyerDetails")}</DialogTitle>
            <DialogDescription>
              {selected ? `${selected.name} — ${selected.email}` : null}
            </DialogDescription>
          </DialogHeader>
          {detailLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : detailData ? (
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-3">
                <AdminUserAvatar
                  name={selected?.name}
                  avatarUrl={detailData.profile?.avatar_url || selected?.avatar_url}
                  className="h-14 w-14"
                  fallbackClassName="text-base"
                />
                <div>
                  <p className="font-semibold">{selected?.name}</p>
                  <p className="text-muted-foreground text-xs">{selected?.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-muted/50 p-2.5"><p className="text-xs text-muted-foreground">{t("adminModeration.phone")}</p><p className="font-medium">{detailData.profile?.phone || "—"}</p></div>
                <div className="rounded-lg bg-muted/50 p-2.5"><p className="text-xs text-muted-foreground">{t("adminModeration.location")}</p><p className="font-medium">{detailData.profile?.location || "—"}</p></div>
                <div className="rounded-lg bg-muted/50 p-2.5"><p className="text-xs text-muted-foreground">{t("adminModeration.orders")}</p><p className="font-medium">{detailData.stats?.order_count ?? 0}</p></div>
                <div className="rounded-lg bg-muted/50 p-2.5"><p className="text-xs text-muted-foreground">{t("adminModeration.totalSpent")}</p><p className="font-medium">৳{Number(detailData.stats?.total_spent || 0).toLocaleString()}</p></div>
                <div className="rounded-lg bg-muted/50 p-2.5 col-span-2"><p className="text-xs text-muted-foreground">{t("adminModeration.roles")}</p><p className="font-medium">{(detailData.roles || []).join(", ") || "—"}</p></div>
                <div className="rounded-lg bg-muted/50 p-2.5 col-span-2"><p className="text-xs text-muted-foreground">{t("adminModeration.savedAddresses")}</p><p className="font-medium">{detailData.address_count ?? 0}</p></div>
              </div>

              {selectedId ? (
                <AdminMarketplaceModerationActions
                  role="buyer"
                  userId={selectedId}
                  status={displayStatus}
                  marketplaceBlocked={marketplaceBlocked}
                  onDeleted={() => setSelectedId(null)}
                />
              ) : null}

              {(detailData.recent_orders || []).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t("adminModeration.recentOrders")}</p>
                  <div className="space-y-2">
                    {(detailData.recent_orders || []).map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        className="w-full text-left rounded-lg border border-border p-2.5 hover:bg-muted/50"
                        onClick={() => { setSelectedId(null); navigate(`/admin/orders/${o.id}`); }}
                      >
                        <div className="flex justify-between gap-2">
                          <span className="font-mono text-xs">{o.id.slice(0, 8)}…</span>
                          <Badge variant="secondary" className="capitalize text-[10px]">{o.status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{o.seller_name} · ৳{Number(o.total).toLocaleString()}</p>
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
