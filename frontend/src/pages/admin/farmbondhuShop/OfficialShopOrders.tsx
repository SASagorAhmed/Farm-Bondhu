import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { MarketplaceOrder, OrderStatus } from "@/contexts/OrderContext";
import { Package, CheckCircle2, Truck, Clock, MapPin, Eye } from "lucide-react";
import { motion } from "framer-motion";
import { ICON_COLORS } from "@/lib/iconColors";
import { toast } from "sonner";
import StatCard from "@/components/dashboard/StatCard";
import { sellerOrderNextActions, sellerOrderStatusColors } from "@/lib/sellerOrderWorkflow";
import {
  fetchOfficialShopOrders,
  officialShopOrdersQueryKey,
  patchOfficialShopOrderStatus,
} from "@/lib/adminFarmBondhuShopApi";
import OfficialShopPageHeader from "./OfficialShopPageHeader";

const statusTabs = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "packed", label: "Packed" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
];

export default function OfficialShopOrders() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("all");

  const { data: orders = [], isLoading, isError, refetch } = useQuery({
    queryKey: officialShopOrdersQueryKey(),
    queryFn: fetchOfficialShopOrders,
  });

  const filtered = tab === "all" ? orders : orders.filter((o) => o.status === tab);

  const pendingCount = orders.filter((o) => o.status === "pending").length;
  const activeCount = orders.filter((o) =>
    ["confirmed", "packed", "shipped", "out_for_delivery"].includes(o.status),
  ).length;
  const deliveredCount = orders.filter((o) => o.status === "delivered").length;

  const updateMutation = useMutation({
    mutationFn: async ({
      order,
      nextStatus,
      note,
    }: {
      order: MarketplaceOrder;
      nextStatus: OrderStatus;
      note?: string;
    }) => {
      const newTimeline = [
        ...order.timeline,
        {
          status: nextStatus,
          timestamp: new Date().toISOString(),
          note: note || `Status updated to ${nextStatus}`,
        },
      ];
      const trackingId =
        nextStatus === "shipped" && !order.trackingId
          ? `FB${order.id.slice(0, 6).toUpperCase()}${Date.now().toString(36).slice(-4).toUpperCase()}`
          : order.trackingId;
      const paymentStatus =
        nextStatus === "delivered" && order.paymentMethod === "cash_on_delivery"
          ? "paid"
          : order.paymentStatus;

      await patchOfficialShopOrderStatus(order.id, {
        status: nextStatus,
        timeline: newTimeline,
        tracking_id: trackingId,
        payment_status: paymentStatus,
      });
    },
    onSuccess: (_data, { nextStatus }) => {
      toast.success(`Order updated to "${nextStatus.replace(/_/g, " ")}"`);
      void queryClient.invalidateQueries({ queryKey: officialShopOrdersQueryKey() });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not update order");
    },
  });

  const handleAction = (order: MarketplaceOrder) => {
    const action = sellerOrderNextActions[order.status];
    if (!action) return;
    updateMutation.mutate({ order, nextStatus: action.nextStatus, note: action.note });
  };

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      <OfficialShopPageHeader title="Orders" description="Fulfill orders for the official FarmBondhu shop" />

      {isError && (
        <p className="text-sm text-destructive">
          Could not load orders.{" "}
          <button type="button" className="underline" onClick={() => refetch()}>
            Retry
          </button>
        </p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Pending" value={pendingCount} icon={<Clock className="h-5 w-5" />} iconColor={ICON_COLORS.finance} index={0} />
        <StatCard title="Active" value={activeCount} icon={<Truck className="h-5 w-5" />} iconColor={ICON_COLORS.orders} index={1} />
        <StatCard title="Delivered" value={deliveredCount} icon={<CheckCircle2 className="h-5 w-5" />} iconColor={ICON_COLORS.farm} index={2} />
        <StatCard title="Total" value={orders.length} icon={<Package className="h-5 w-5" />} iconColor={ICON_COLORS.marketplace} index={3} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          {statusTabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading && <p className="text-center text-muted-foreground py-12">Loading orders…</p>}

      <div className="space-y-3">
        {!isLoading &&
          filtered.map((order, i) => {
            const action = sellerOrderNextActions[order.status];
            const statusColor = sellerOrderStatusColors[order.status] || ICON_COLORS.orders;
            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Card className="shadow-card">
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-display font-semibold text-foreground">#{order.id.slice(0, 8)}</span>
                        <Badge style={{ backgroundColor: statusColor, color: "white" }} className="capitalize">
                          {order.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {order.buyerName} · {order.deliveryAddress?.city || "—"} · ৳{order.total}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button variant="outline" size="sm" onClick={() => navigate(`/admin/orders/${order.id}`)}>
                        <Eye className="h-4 w-4 mr-1" />
                        Admin detail
                      </Button>
                      {action && (
                        <Button size="sm" disabled={updateMutation.isPending} onClick={() => handleAction(order)}>
                          {action.label}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        {!isLoading && filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-12">No orders in this tab.</p>
        )}
      </div>
    </div>
  );
}
