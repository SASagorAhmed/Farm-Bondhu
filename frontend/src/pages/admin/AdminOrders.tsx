import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/api/client";
import { ShoppingCart, Loader2, Shield, Package, DollarSign, TrendingUp, Search, Eye } from "lucide-react";
import { motion } from "framer-motion";
import { ICON_COLORS } from "@/lib/iconColors";
import { moduleCachePolicy, queryKeys } from "@/lib/queryClient";
import { fetchAdminMarketplaceOrders } from "@/lib/adminMarketplaceApi";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  shipped: "bg-indigo-100 text-indigo-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  return_requested: "bg-orange-100 text-orange-800",
};

const PAGE_SIZE = 100;

export default function AdminOrders() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");

  const filterKey = `${search}|${statusFilter}|${paymentFilter}`;
  const { data, isLoading: loading, isError, error } = useQuery({
    queryKey: queryKeys().adminOrders(filterKey),
    staleTime: moduleCachePolicy.admin.staleTime,
    gcTime: moduleCachePolicy.admin.gcTime,
    queryFn: () =>
      fetchAdminMarketplaceOrders({
        search,
        status: statusFilter,
        payment_status: paymentFilter,
        limit: PAGE_SIZE,
        offset: 0,
      }),
  });

  const orders = data?.data ?? [];

  useEffect(() => {
    const channel = api
      .channel("admin-orders-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      })
      .subscribe();
    return () => {
      api.removeChannel(channel);
    };
  }, [queryClient]);

  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((s, o) => s + Number(o.total || 0), 0);
  const pendingOrders = orders.filter((o) => o.status === "pending").length;
  const deliveredOrders = orders.filter((o) => o.status === "delivered").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-destructive">{error instanceof Error ? error.message : "Failed to load orders"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${ICON_COLORS.admin}, #7c3aed)` }}>
          <ShoppingCart className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Orders Overview</h1>
            <Badge className="text-[10px] font-bold" style={{ backgroundColor: `${ICON_COLORS.admin}1A`, color: ICON_COLORS.admin }}>
              <Shield className="h-3 w-3 mr-0.5" /> Admin View
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">Platform-wide marketplace order monitoring and tracking</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Orders", value: totalOrders, icon: Package, color: ICON_COLORS.cart },
          { label: "Total Revenue", value: `৳${totalRevenue.toLocaleString()}`, icon: DollarSign, color: ICON_COLORS.farm },
          { label: "Pending", value: pendingOrders, icon: ShoppingCart, color: ICON_COLORS.dashboard },
          { label: "Delivered", value: deliveredOrders, icon: TrendingUp, color: ICON_COLORS.trending },
        ].map((s) => (
          <Card key={s.label} className="shadow-card overflow-hidden">
            <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.admin}, #7c3aed)` }} />
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className="h-4 w-4" style={{ color: s.color }} />
                <span className="text-xs text-muted-foreground font-medium">{s.label}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search buyer, seller, order id…" className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="shipped">Shipped</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={paymentFilter} onValueChange={setPaymentFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Payment" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All payment</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="unpaid">Unpaid</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="shadow-card overflow-hidden">
        <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.admin}, #7c3aed)` }} />
        <CardHeader><CardTitle className="text-lg">All Orders</CardTitle></CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No orders yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Seller</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">{o.id.slice(0, 8)}…</TableCell>
                    <TableCell className="font-medium">{o.buyer_name}</TableCell>
                    <TableCell>{o.seller_name}</TableCell>
                    <TableCell>৳{Number(o.total).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={o.payment_status === "paid" ? "default" : "secondary"}>{o.payment_status}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[o.status] || "bg-muted text-muted-foreground"}`}>
                        {o.status.replace(/_/g, " ")}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{new Date(o.date || o.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/orders/${o.id}`)}>
                        <Eye className="h-4 w-4 mr-1" /> View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
