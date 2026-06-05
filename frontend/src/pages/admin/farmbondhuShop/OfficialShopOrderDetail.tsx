import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDeliveryAddressLines } from "@/contexts/OrderContext";
import {
  ArrowLeft,
  ArrowRight,
  Package,
  Truck,
  MapPin,
  Banknote,
  XCircle,
  RotateCcw,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { ICON_COLORS } from "@/lib/iconColors";
import {
  SELLER_ORDER_STATUS_STEPS,
  sellerOrderNextActions,
  sellerOrderStatusColors,
} from "@/lib/sellerOrderWorkflow";
import {
  fetchOfficialShopOrder,
  officialShopOrderQueryKey,
  officialShopOrdersQueryKey,
  patchOfficialShopOrderStatus,
} from "@/lib/adminFarmBondhuShopApi";
import OfficialShopPageHeader from "./OfficialShopPageHeader";
import DeliveryReceiptActions from "@/components/marketplace/DeliveryReceiptActions";

export default function OfficialShopOrderDetail() {
  const { orderId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: order, isLoading, isError } = useQuery({
    queryKey: officialShopOrderQueryKey(orderId),
    enabled: Boolean(orderId),
    queryFn: () => fetchOfficialShopOrder(orderId),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!order) return;
      const action = sellerOrderNextActions[order.status];
      if (!action) return;
      const newTimeline = [
        ...order.timeline,
        {
          status: action.nextStatus,
          timestamp: new Date().toISOString(),
          note: action.note || `Status updated to ${action.nextStatus}`,
        },
      ];
      const trackingId =
        action.nextStatus === "shipped" && !order.trackingId
          ? `FB${order.id.slice(0, 6).toUpperCase()}${Date.now().toString(36).slice(-4).toUpperCase()}`
          : order.trackingId;
      const paymentStatus =
        action.nextStatus === "delivered" && order.paymentMethod === "cash_on_delivery"
          ? "paid"
          : order.paymentStatus;
      await patchOfficialShopOrderStatus(order.id, {
        status: action.nextStatus,
        timeline: newTimeline,
        tracking_id: trackingId,
        payment_status: paymentStatus,
      });
    },
    onSuccess: () => {
      toast.success("Order updated");
      void queryClient.invalidateQueries({ queryKey: officialShopOrderQueryKey(orderId) });
      void queryClient.invalidateQueries({ queryKey: officialShopOrdersQueryKey() });
    },
    onError: (err: Error) => toast.error(err.message || "Could not update order"),
  });

  if (isLoading) {
    return <p className="text-center py-16 text-muted-foreground">Loading order…</p>;
  }

  if (isError || !order) {
    return (
      <div className="text-center py-20 space-y-4">
        <Package className="h-16 w-16 mx-auto text-muted-foreground/40" />
        <h2 className="text-xl font-display font-bold text-foreground">Order not found</h2>
        <Button onClick={() => navigate("/admin/farmbondhu-shop/orders")}>Back to orders</Button>
      </div>
    );
  }

  const action = sellerOrderNextActions[order.status];
  const currentStepIndex = SELLER_ORDER_STATUS_STEPS.findIndex((s) => s.status === order.status);
  const isCancelled = order.status === "cancelled";
  const isReturned = ["return_requested", "returned", "refunded"].includes(order.status);
  const accent = sellerOrderStatusColors[order.status] || ICON_COLORS.farm;
  const addressLines = formatDeliveryAddressLines(order.deliveryAddress);

  return (
    <div className="space-y-6 max-w-3xl mx-auto overflow-hidden">
      <OfficialShopPageHeader title={`Order #${order.id.slice(0, 10).toUpperCase()}`} />
      <Button variant="ghost" onClick={() => navigate("/admin/farmbondhu-shop/orders")}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to orders
      </Button>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-muted-foreground mt-1">
            Placed on{" "}
            {new Date(order.date).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <Badge className="text-sm px-3 py-1 capitalize font-bold" style={{ backgroundColor: `${accent}1A`, color: accent }}>
          {order.status.replace(/_/g, " ")}
        </Badge>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 min-w-0">
          <DeliveryReceiptActions order={order} variant="admin" />
        </div>
        {action && (
          <Button
            className="text-white shrink-0"
            style={{ backgroundColor: sellerOrderStatusColors[action.nextStatus] || ICON_COLORS.farm }}
            disabled={updateMutation.isPending}
            onClick={() => updateMutation.mutate()}
          >
            <action.icon className="h-4 w-4 mr-1" />
            {action.label}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>

      {!isCancelled && !isReturned && (
        <Card className="shadow-card overflow-hidden">
          <CardHeader>
            <CardTitle className="font-display">Fulfillment progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between relative">
              <div className="absolute top-5 left-0 right-0 h-0.5 bg-border" />
              <div
                className="absolute top-5 left-0 h-0.5 transition-all duration-500"
                style={{
                  width: `${Math.max(0, (currentStepIndex / (SELLER_ORDER_STATUS_STEPS.length - 1)) * 100)}%`,
                  backgroundColor: ICON_COLORS.farm,
                }}
              />
              {SELLER_ORDER_STATUS_STEPS.map((step, i) => {
                const done = i <= currentStepIndex;
                const current = i === currentStepIndex;
                return (
                  <div key={step.status} className="flex flex-col items-center relative z-10" style={{ width: `${100 / SELLER_ORDER_STATUS_STEPS.length}%` }}>
                    <div
                      className={`h-10 w-10 rounded-full flex items-center justify-center transition-all ${current ? "ring-4 ring-offset-2 ring-emerald-300/40" : ""}`}
                      style={{
                        backgroundColor: done ? ICON_COLORS.farm : "hsl(var(--muted))",
                        color: done ? "white" : "hsl(var(--muted-foreground))",
                      }}
                    >
                      <step.icon className="h-4 w-4" />
                    </div>
                    <span className={`text-xs mt-2 text-center ${done ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
            {order.trackingId && (
              <div className="mt-6 p-3 rounded-lg bg-muted/30 flex items-center gap-2 text-sm">
                <Truck className="h-4 w-4" style={{ color: ICON_COLORS.farm }} />
                <span className="text-muted-foreground">Tracking ID:</span>
                <span className="font-mono font-bold text-foreground">{order.trackingId}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {(isCancelled || isReturned) && (
        <Card className="shadow-card">
          <CardContent className="p-6 flex items-center gap-4">
            {isCancelled ? (
              <XCircle className="h-8 w-8" style={{ color: ICON_COLORS.health }} />
            ) : (
              <RotateCcw className="h-8 w-8" style={{ color: ICON_COLORS.finance }} />
            )}
            <div>
              <p className="font-bold text-foreground">
                {isCancelled
                  ? "Order cancelled"
                  : `Return ${order.status === "return_requested" ? "requested" : order.status === "returned" ? "completed" : "refunded"}`}
              </p>
              {order.returnReason && <p className="text-sm text-muted-foreground">Reason: {order.returnReason}</p>}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-display">Timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...order.timeline].reverse().map((event, i) => (
            <div key={i} className="flex items-start gap-3">
              <div
                className="h-3 w-3 rounded-full mt-1.5 shrink-0"
                style={{ backgroundColor: sellerOrderStatusColors[event.status] || ICON_COLORS.farm }}
              />
              <div>
                <p className="text-sm font-medium text-foreground capitalize">{event.status.replace(/_/g, " ")}</p>
                {event.note && <p className="text-xs text-muted-foreground">{event.note}</p>}
                <p className="text-xs text-muted-foreground">{new Date(event.timestamp).toLocaleString("en-GB")}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-display text-base">Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {order.items.map((item) => (
              <div key={item.productId} className="flex items-center gap-3">
                <div className="h-10 w-10 rounded bg-muted/30 flex items-center justify-center shrink-0">
                  {item.image ? <img src={item.image} alt={item.name} className="h-6 w-6 object-contain opacity-50" /> : <Package className="h-4 w-4 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">×{item.qty}</p>
                </div>
                <p className="text-sm font-bold text-foreground">৳{(item.price * item.qty).toLocaleString()}</p>
              </div>
            ))}
            <div className="border-t pt-2 flex justify-between font-bold text-foreground text-sm">
              <span>Total</span>
              <span>৳{order.total.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-display text-base">Buyer & delivery</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{order.buyerName}</span>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="text-muted-foreground">
                {addressLines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Banknote className="h-4 w-4 text-muted-foreground" />
              <span className="capitalize">{order.paymentMethod.replace(/_/g, " ")} · {order.paymentStatus}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
