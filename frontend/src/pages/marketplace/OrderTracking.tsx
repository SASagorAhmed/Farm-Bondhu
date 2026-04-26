import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOrders, OrderStatus } from "@/contexts/OrderContext";
import { ArrowLeft, Package, CheckCircle2, Truck, MapPin, Clock, XCircle, RotateCcw, Banknote } from "lucide-react";
import { motion } from "framer-motion";
import { ICON_COLORS } from "@/lib/iconColors";
import { toast } from "sonner";

const STATUS_STEPS: { status: OrderStatus; label: string; icon: React.ElementType }[] = [
  { status: "pending", label: "Order Placed", icon: Clock },
  { status: "confirmed", label: "Seller Confirmed", icon: CheckCircle2 },
  { status: "packed", label: "Packed", icon: Package },
  { status: "shipped", label: "Shipped", icon: Truck },
  { status: "out_for_delivery", label: "Out for Delivery", icon: Truck },
  { status: "delivered", label: "Delivered", icon: CheckCircle2 },
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
  returned: ICON_COLORS.health,
  refunded: ICON_COLORS.finance,
};

export default function OrderTracking() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { getOrder, cancelOrder, requestReturn } = useOrders();
  const order = getOrder(orderId || "");

  if (!order) {
    return (
      <div className="text-center py-20 space-y-4">
        <Package className="h-16 w-16 mx-auto" style={{ color: `${ICON_COLORS.marketplace}40` }} />
        <h2 className="text-xl font-display font-bold text-foreground">Order not found</h2>
        <Button onClick={() => navigate("/orders")} className="text-white" style={{ backgroundColor: ICON_COLORS.marketplace }}>View All Orders</Button>
      </div>
    );
  }

  const currentStepIndex = STATUS_STEPS.findIndex(s => s.status === order.status);
  const isCancelled = order.status === "cancelled";
  const isReturned = ["return_requested", "returned", "refunded"].includes(order.status);
  const canCancel = ["pending", "confirmed"].includes(order.status);
  const canReturn = order.status === "delivered";

  const handleCancel = () => {
    cancelOrder(order.id);
    toast.success("Order cancelled successfully");
  };

  const handleReturn = () => {
    navigate(`/orders/${order.id}/return`);
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto overflow-hidden">
      <Button variant="ghost" onClick={() => navigate("/orders")}><ArrowLeft className="h-4 w-4 mr-2" />All Orders</Button>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Order #{order.id.slice(0, 10).toUpperCase()}</h1>
          <p className="text-muted-foreground mt-1">Placed on {new Date(order.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
        <Badge className="text-sm px-3 py-1 capitalize font-bold" style={{ backgroundColor: `${statusColors[order.status]}1A`, color: statusColors[order.status] }}>
          {order.status.replace(/_/g, " ")}
        </Badge>
      </motion.div>

      {/* Status Timeline */}
      {!isCancelled && !isReturned && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="shadow-card overflow-hidden">
            <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.marketplace}, ${ICON_COLORS.farm})` }} />
            <CardHeader>
              <CardTitle className="font-display">Order Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between relative">
                {/* Progress line */}
                <div className="absolute top-5 left-0 right-0 h-0.5 bg-border" />
                <div className="absolute top-5 left-0 h-0.5 transition-all duration-500" style={{
                  width: `${Math.max(0, (currentStepIndex / (STATUS_STEPS.length - 1)) * 100)}%`,
                  backgroundColor: ICON_COLORS.marketplace,
                }} />

                {STATUS_STEPS.map((step, i) => {
                  const done = i <= currentStepIndex;
                  const current = i === currentStepIndex;
                  return (
                    <div key={step.status} className="flex flex-col items-center relative z-10" style={{ width: `${100 / STATUS_STEPS.length}%` }}>
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center transition-all ${current ? "ring-4 ring-offset-2 ring-sky-300/40" : ""}`} style={{
                        backgroundColor: done ? ICON_COLORS.marketplace : "hsl(var(--muted))",
                        color: done ? "white" : "hsl(var(--muted-foreground))",
                      }}>
                        <step.icon className="h-4 w-4" />
                      </div>
                      <span className={`text-xs mt-2 text-center ${done ? "font-medium text-foreground" : "text-muted-foreground"}`}>{step.label}</span>
                    </div>
                  );
                })}
              </div>

              {order.trackingId && (
                <div className="mt-6 p-3 rounded-lg bg-accent/30 flex items-center gap-2 text-sm">
                  <Truck className="h-4 w-4" style={{ color: ICON_COLORS.marketplace }} />
                  <span className="text-muted-foreground">Tracking ID:</span>
                  <span className="font-mono font-bold text-foreground">{order.trackingId}</span>
                </div>
              )}
              {order.estimatedDelivery && order.status !== "delivered" && (
                <p className="mt-3 text-sm text-muted-foreground">Estimated delivery: <span className="font-medium text-foreground">{order.estimatedDelivery}</span></p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Cancelled / Return status */}
      {(isCancelled || isReturned) && (
        <Card className="shadow-card overflow-hidden">
          <div className="h-1" style={{ backgroundColor: ICON_COLORS.health }} />
          <CardContent className="p-6 flex items-center gap-4">
            {isCancelled ? <XCircle className="h-8 w-8" style={{ color: ICON_COLORS.health }} /> : <RotateCcw className="h-8 w-8" style={{ color: ICON_COLORS.finance }} />}
            <div>
              <p className="font-bold text-foreground">{isCancelled ? "Order Cancelled" : `Return ${order.status === "return_requested" ? "Requested" : order.status === "returned" ? "Completed" : "Refunded"}`}</p>
              {order.returnReason && <p className="text-sm text-muted-foreground">Reason: {order.returnReason}</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timeline Events */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="shadow-card overflow-hidden">
          <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.marketplace}, ${ICON_COLORS.vet})` }} />
          <CardHeader>
            <CardTitle className="font-display">Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...order.timeline].reverse().map((event, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="h-3 w-3 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: statusColors[event.status] || ICON_COLORS.marketplace }} />
                  <div>
                    <p className="text-sm font-medium text-foreground capitalize">{event.status.replace(/_/g, " ")}</p>
                    {event.note && <p className="text-xs text-muted-foreground">{event.note}</p>}
                    <p className="text-xs text-muted-foreground">{new Date(event.timestamp).toLocaleString("en-GB")}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid sm:grid-cols-2 gap-4">
        {/* Items */}
        <Card className="shadow-card overflow-hidden">
          <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.marketplace}, ${ICON_COLORS.vet})` }} />
          <CardHeader><CardTitle className="font-display text-base">Items</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {order.items.map(item => (
              <div key={item.productId} className="flex items-center gap-3">
                <div className="h-10 w-10 rounded bg-accent/30 flex items-center justify-center shrink-0">
                  <img src={item.image} alt={item.name} className="h-6 w-6 object-contain opacity-50" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">×{item.qty}</p>
                </div>
                <p className="text-sm font-bold text-foreground">৳{(item.price * item.qty).toLocaleString()}</p>
              </div>
            ))}
            <div className="border-t pt-2 space-y-1 text-sm">
              {order.shippingFee > 0 && <div className="flex justify-between text-muted-foreground"><span>Shipping</span><span>৳{order.shippingFee}</span></div>}
              <div className="flex justify-between font-bold text-foreground"><span>Total</span><span style={{ color: ICON_COLORS.marketplace }}>৳{order.total.toLocaleString()}</span></div>
            </div>
          </CardContent>
        </Card>

        {/* Delivery & Payment Info */}
        <Card className="shadow-card overflow-hidden">
          <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.farm}, ${ICON_COLORS.marketplace})` }} />
          <CardHeader><CardTitle className="font-display text-base">Delivery & Payment</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="flex items-center gap-1 text-muted-foreground mb-1"><MapPin className="h-3.5 w-3.5" />Delivery Address</p>
              <p className="font-medium text-foreground">{order.deliveryAddress.recipientName}</p>
              <p className="text-muted-foreground">{order.deliveryAddress.phone}</p>
              <p className="text-muted-foreground">{order.deliveryAddress.address}, {order.deliveryAddress.area}, {order.deliveryAddress.city}</p>
            </div>
            <div>
              <p className="flex items-center gap-1 text-muted-foreground mb-1"><Banknote className="h-3.5 w-3.5" />Payment</p>
              <p className="font-medium text-foreground capitalize">{order.paymentMethod.replace(/_/g, " ")}</p>
              <Badge className="mt-1" style={{ backgroundColor: `${order.paymentStatus === "paid" ? ICON_COLORS.farm : ICON_COLORS.finance}1A`, color: order.paymentStatus === "paid" ? ICON_COLORS.farm : ICON_COLORS.finance }}>{order.paymentStatus}</Badge>
            </div>
            <p className="text-muted-foreground">Sold by: <span className="font-medium text-foreground">{order.sellerName}</span></p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      {(canCancel || canReturn) && (
        <div className="flex gap-3 justify-end">
          {canCancel && (
            <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={handleCancel}>
              <XCircle className="h-4 w-4 mr-1" />Cancel Order
            </Button>
          )}
          {canReturn && (
            <Button variant="outline" onClick={handleReturn} style={{ borderColor: `${ICON_COLORS.finance}40`, color: ICON_COLORS.finance }}>
              <RotateCcw className="h-4 w-4 mr-1" />Request Return
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
