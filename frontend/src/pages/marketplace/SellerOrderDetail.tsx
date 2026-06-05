import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOrders, formatDeliveryAddressLines } from "@/contexts/OrderContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowLeft,
  ArrowRight,
  Package,
  CheckCircle2,
  Truck,
  MapPin,
  Banknote,
  XCircle,
  RotateCcw,
  User,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ICON_COLORS } from "@/lib/iconColors";
import { VENDOR_THEME, vendorGradient } from "@/lib/vendorTheme";
import {
  SELLER_ORDER_STATUS_STEPS,
  sellerOrderNextActions,
  sellerOrderStatusColors,
} from "@/lib/sellerOrderWorkflow";
import DeliveryReceiptActions from "@/components/marketplace/DeliveryReceiptActions";

export default function SellerOrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getOrder, updateOrderStatus } = useOrders();
  const order = getOrder(orderId || "");

  const isOwner = order && user && order.sellerId === user.id;

  if (!order || !isOwner) {
    return (
      <div className="text-center py-20 space-y-4">
        <Package className="h-16 w-16 mx-auto" style={{ color: `${VENDOR_THEME.primary}40` }} />
        <h2 className="text-xl font-display font-bold text-foreground">Order not found</h2>
        <Button
          onClick={() => navigate("/seller/orders")}
          className="text-white"
          style={{ backgroundColor: VENDOR_THEME.primary }}
        >
          Manage Orders
        </Button>
      </div>
    );
  }

  const action = sellerOrderNextActions[order.status];
  const currentStepIndex = SELLER_ORDER_STATUS_STEPS.findIndex((s) => s.status === order.status);
  const isCancelled = order.status === "cancelled";
  const isReturned = ["return_requested", "returned", "refunded"].includes(order.status);
  const accent = sellerOrderStatusColors[order.status] || VENDOR_THEME.primary;

  const handleAction = () => {
    if (!action) return;
    updateOrderStatus(order.id, action.nextStatus, action.note);
    toast.success(`Order updated to "${action.nextStatus.replace(/_/g, " ")}"`);
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto overflow-hidden">
      <Button variant="ghost" onClick={() => navigate("/seller/orders")}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Manage Orders
      </Button>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between flex-wrap gap-3"
      >
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">
            Order #{order.id.slice(0, 10).toUpperCase()}
          </h1>
          <p className="text-muted-foreground mt-1">
            Placed on{" "}
            {new Date(order.date).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <Badge
          className="text-sm px-3 py-1 capitalize font-bold"
          style={{ backgroundColor: `${accent}1A`, color: accent }}
        >
          {order.status.replace(/_/g, " ")}
        </Badge>
      </motion.div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 min-w-0">
          <DeliveryReceiptActions order={order} variant="seller" />
        </div>
        {action && (
          <Button
            className="text-white shrink-0"
            style={{ backgroundColor: sellerOrderStatusColors[action.nextStatus] || VENDOR_THEME.primary }}
            onClick={handleAction}
          >
            <action.icon className="h-4 w-4 mr-1" />
            {action.label}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>

      {!isCancelled && !isReturned && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="shadow-card overflow-hidden">
            <div className="h-1" style={{ background: vendorGradient() }} />
            <CardHeader>
              <CardTitle className="font-display">Fulfillment Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between relative">
                <div className="absolute top-5 left-0 right-0 h-0.5 bg-border" />
                <div
                  className="absolute top-5 left-0 h-0.5 transition-all duration-500"
                  style={{
                    width: `${Math.max(0, (currentStepIndex / (SELLER_ORDER_STATUS_STEPS.length - 1)) * 100)}%`,
                    backgroundColor: VENDOR_THEME.primary,
                  }}
                />
                {SELLER_ORDER_STATUS_STEPS.map((step, i) => {
                  const done = i <= currentStepIndex;
                  const current = i === currentStepIndex;
                  return (
                    <div
                      key={step.status}
                      className="flex flex-col items-center relative z-10"
                      style={{ width: `${100 / SELLER_ORDER_STATUS_STEPS.length}%` }}
                    >
                      <div
                        className={`h-10 w-10 rounded-full flex items-center justify-center transition-all ${current ? "ring-4 ring-offset-2 ring-sky-300/40" : ""}`}
                        style={{
                          backgroundColor: done ? VENDOR_THEME.primary : "hsl(var(--muted))",
                          color: done ? "white" : "hsl(var(--muted-foreground))",
                        }}
                      >
                        <step.icon className="h-4 w-4" />
                      </div>
                      <span
                        className={`text-xs mt-2 text-center ${done ? "font-medium text-foreground" : "text-muted-foreground"}`}
                      >
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
              {order.trackingId && (
                <div className="mt-6 p-3 rounded-lg bg-muted/30 flex items-center gap-2 text-sm">
                  <Truck className="h-4 w-4" style={{ color: VENDOR_THEME.primary }} />
                  <span className="text-muted-foreground">Tracking ID:</span>
                  <span className="font-mono font-bold text-foreground">{order.trackingId}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {(isCancelled || isReturned) && (
        <Card className="shadow-card overflow-hidden">
          <div className="h-1" style={{ backgroundColor: ICON_COLORS.health }} />
          <CardContent className="p-6 flex items-center gap-4">
            {isCancelled ? (
              <XCircle className="h-8 w-8" style={{ color: ICON_COLORS.health }} />
            ) : (
              <RotateCcw className="h-8 w-8" style={{ color: ICON_COLORS.finance }} />
            )}
            <div>
              <p className="font-bold text-foreground">
                {isCancelled
                  ? "Order Cancelled"
                  : `Return ${order.status === "return_requested" ? "Requested" : order.status === "returned" ? "Completed" : "Refunded"}`}
              </p>
              {order.returnReason && (
                <p className="text-sm text-muted-foreground">Reason: {order.returnReason}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="shadow-card overflow-hidden">
          <div className="h-1" style={{ background: vendorGradient() }} />
          <CardHeader>
            <CardTitle className="font-display">Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...order.timeline].reverse().map((event, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div
                    className="h-3 w-3 rounded-full mt-1.5 shrink-0"
                    style={{
                      backgroundColor:
                        sellerOrderStatusColors[event.status] || VENDOR_THEME.primary,
                    }}
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground capitalize">
                      {event.status.replace(/_/g, " ")}
                    </p>
                    {event.note && <p className="text-xs text-muted-foreground">{event.note}</p>}
                    <p className="text-xs text-muted-foreground">
                      {new Date(event.timestamp).toLocaleString("en-GB")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="shadow-card overflow-hidden">
          <div className="h-1" style={{ background: vendorGradient() }} />
          <CardHeader>
            <CardTitle className="font-display text-base">Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {order.items.map((item) => (
              <div key={item.productId} className="flex items-center gap-3">
                <div className="h-10 w-10 rounded bg-muted/30 flex items-center justify-center shrink-0">
                  <img src={item.image} alt={item.name} className="h-6 w-6 object-contain opacity-50" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">×{item.qty}</p>
                </div>
                <p className="text-sm font-bold text-foreground">
                  ৳{(item.price * item.qty).toLocaleString()}
                </p>
              </div>
            ))}
            <div className="border-t pt-2 space-y-1 text-sm">
              {order.shippingFee > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Shipping</span>
                  <span>৳{order.shippingFee}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-foreground">
                <span>Total</span>
                <span style={{ color: VENDOR_THEME.primary }}>৳{order.total.toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card overflow-hidden">
          <div className="h-1" style={{ background: vendorGradient() }} />
          <CardHeader>
            <CardTitle className="font-display text-base">Buyer & Delivery</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="flex items-center gap-1 text-muted-foreground mb-1">
                <User className="h-3.5 w-3.5" />
                Buyer
              </p>
              <p className="font-medium text-foreground">{order.buyerName}</p>
            </div>
            <div>
              <p className="flex items-center gap-1 text-muted-foreground mb-1">
                <MapPin className="h-3.5 w-3.5" />
                Delivery Address
              </p>
              <p className="font-medium text-foreground">{order.deliveryAddress.recipientName}</p>
              <p className="text-muted-foreground">{order.deliveryAddress.phone}</p>
              {order.deliveryAddress.altPhone && (
                <p className="text-muted-foreground">Alt: {order.deliveryAddress.altPhone}</p>
              )}
              {formatDeliveryAddressLines(order.deliveryAddress).map((line) => (
                <p key={line} className="text-muted-foreground">
                  {line}
                </p>
              ))}
              {order.deliveryAddress.note && (
                <p className="text-muted-foreground italic">Note: {order.deliveryAddress.note}</p>
              )}
            </div>
            <div>
              <p className="flex items-center gap-1 text-muted-foreground mb-1">
                <Banknote className="h-3.5 w-3.5" />
                Payment
              </p>
              <p className="font-medium text-foreground capitalize">
                {order.paymentMethod.replace(/_/g, " ")}
              </p>
              <Badge
                className="mt-1"
                style={{
                  backgroundColor: `${order.paymentStatus === "paid" ? ICON_COLORS.farm : ICON_COLORS.finance}1A`,
                  color: order.paymentStatus === "paid" ? ICON_COLORS.farm : ICON_COLORS.finance,
                }}
              >
                {order.paymentStatus}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
