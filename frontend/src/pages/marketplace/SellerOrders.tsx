import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOrders, OrderStatus, MarketplaceOrder } from "@/contexts/OrderContext";
import { useAuth } from "@/contexts/AuthContext";
import { Package, CheckCircle2, Truck, Clock, MapPin, Eye, ArrowRight, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { ICON_COLORS } from "@/lib/iconColors";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import StatCard from "@/components/dashboard/StatCard";

const statusTabs = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "packed", label: "Packed" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "return_requested", label: "Returns" },
];

const statusColors: Record<string, string> = {
  pending: ICON_COLORS.finance,
  confirmed: ICON_COLORS.marketplace,
  packed: ICON_COLORS.marketplace,
  shipped: ICON_COLORS.marketplace,
  out_for_delivery: ICON_COLORS.farm,
  delivered: ICON_COLORS.farm,
  cancelled: ICON_COLORS.health,
  return_requested: ICON_COLORS.finance,
};

const nextActions: Record<string, { label: string; nextStatus: OrderStatus; note: string; icon: React.ElementType }> = {
  pending: { label: "Confirm Order", nextStatus: "confirmed", note: "Seller confirmed the order", icon: CheckCircle2 },
  confirmed: { label: "Mark as Packed", nextStatus: "packed", note: "Product packed and ready for pickup", icon: Package },
  packed: { label: "Handover to Logistics", nextStatus: "shipped", note: "Parcel handed to delivery partner", icon: Truck },
  shipped: { label: "Mark Out for Delivery", nextStatus: "out_for_delivery", note: "Parcel out for final delivery", icon: Truck },
  out_for_delivery: { label: "Mark Delivered", nextStatus: "delivered", note: "Product delivered to customer", icon: CheckCircle2 },
  return_requested: { label: "Accept Return", nextStatus: "returned" as OrderStatus, note: "Return accepted and processed", icon: CheckCircle2 },
};

export default function SellerOrders() {
  const { user } = useAuth();
  const { getOrdersBySeller, updateOrderStatus } = useOrders();
  const navigate = useNavigate();
  const [tab, setTab] = useState("all");

  const myOrders = getOrdersBySeller(user?.id || "");
  const filtered = tab === "all" ? myOrders : myOrders.filter(o => o.status === tab);

  const pendingCount = myOrders.filter(o => o.status === "pending").length;
  const activeCount = myOrders.filter(o => ["confirmed", "packed", "shipped", "out_for_delivery"].includes(o.status)).length;
  const deliveredCount = myOrders.filter(o => o.status === "delivered").length;
  const totalRevenue = myOrders.filter(o => o.paymentStatus === "paid").reduce((s, o) => s + o.total, 0);

  const handleAction = (order: MarketplaceOrder) => {
    const action = nextActions[order.status];
    if (!action) return;
    updateOrderStatus(order.id, action.nextStatus, action.note);
    toast.success(`Order updated to "${action.nextStatus.replace(/_/g, " ")}"`);
  };

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Manage Orders</h1>
          <p className="text-muted-foreground mt-1">Review, confirm, pack, and ship orders</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Pending" value={pendingCount} icon={<Clock className="h-5 w-5" />} iconColor={ICON_COLORS.finance} index={0} />
        <StatCard title="Active" value={activeCount} icon={<Package className="h-5 w-5" />} iconColor={ICON_COLORS.marketplace} index={1} />
        <StatCard title="Delivered" value={deliveredCount} icon={<CheckCircle2 className="h-5 w-5" />} iconColor={ICON_COLORS.farm} index={2} />
        <StatCard title="Revenue" value={`৳${totalRevenue.toLocaleString()}`} icon={<Truck className="h-5 w-5" />} iconColor={ICON_COLORS.finance} index={3} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          {statusTabs.map(t => (
            <TabsTrigger key={t.value} value={t.value} className="text-xs">
              {t.label}
              {t.value !== "all" && (
                <span className="ml-1 text-[10px]">
                  ({myOrders.filter(o => o.status === t.value).length})
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="space-y-4">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">No orders in this category</div>
        )}
        {filtered.map((order, i) => {
          const action = nextActions[order.status];
          return (
            <motion.div key={order.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="shadow-card overflow-hidden">
                <div className="h-1" style={{ background: `linear-gradient(to right, ${statusColors[order.status] || ICON_COLORS.marketplace}, ${ICON_COLORS.vet})` }} />
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-display font-bold text-foreground">#{order.id.slice(0, 10).toUpperCase()}</span>
                        <Badge style={{ backgroundColor: `${statusColors[order.status]}1A`, color: statusColors[order.status] }} className="capitalize text-xs">
                          {order.status.replace(/_/g, " ")}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{new Date(order.date).toLocaleDateString()}</span>
                      </div>

                      {/* Items */}
                      <div className="space-y-1">
                        {order.items.map(item => (
                          <div key={item.productId} className="flex items-center gap-2 text-sm">
                            <span className="text-foreground">{item.name}</span>
                            <span className="text-muted-foreground">×{item.qty}</span>
                            <span className="text-muted-foreground">৳{(item.price * item.qty).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>

                      {/* Buyer info */}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Buyer: <span className="font-medium text-foreground">{order.buyerName}</span></span>
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{order.deliveryAddress.city}</span>
                        <span>Payment: <span className="capitalize">{order.paymentMethod.replace(/_/g, " ")}</span></span>
                      </div>

                      <p className="text-lg font-bold" style={{ color: ICON_COLORS.marketplace }}>৳{order.total.toLocaleString()}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 items-end shrink-0">
                      {action && (
                        <Button size="sm" className="text-white" style={{ backgroundColor: statusColors[action.nextStatus] || ICON_COLORS.marketplace }} onClick={() => handleAction(order)}>
                          <action.icon className="h-3.5 w-3.5 mr-1" />
                          {action.label}
                          <ArrowRight className="h-3.5 w-3.5 ml-1" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/orders/${order.id}`)}>
                        <Eye className="h-3.5 w-3.5 mr-1" />Details
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
