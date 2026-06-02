import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, MapPin, Banknote, Package, Shield } from "lucide-react";
import { motion } from "framer-motion";
import { ICON_COLORS } from "@/lib/iconColors";
import { moduleCachePolicy, queryKeys } from "@/lib/queryClient";
import { fetchAdminOrderDetail } from "@/lib/adminMarketplaceApi";
import OrderTimelineCard, { orderStatusColors } from "@/components/marketplace/OrderTimelineCard";
import { parseDeliveryAddress } from "@/lib/deliveryAddress";
import { formatDeliveryAddressLines } from "@/contexts/OrderContext";

function parseItems(items: unknown): { productId?: string; name: string; qty: number; price: number; image?: string }[] {
  if (!items) return [];
  if (Array.isArray(items)) return items as any[];
  if (typeof items === "string") {
    try {
      const parsed = JSON.parse(items);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseTimeline(timeline: unknown) {
  if (!timeline) return [];
  if (Array.isArray(timeline)) return timeline;
  if (typeof timeline === "string") {
    try {
      const parsed = JSON.parse(timeline);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export default function AdminOrderDetail() {
  const { orderId } = useParams();
  const navigate = useNavigate();

  const { data: order, isLoading, isError } = useQuery({
    queryKey: queryKeys().adminOrderDetail(orderId),
    queryFn: () => fetchAdminOrderDetail(orderId!),
    enabled: Boolean(orderId),
    staleTime: moduleCachePolicy.admin.staleTime,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="text-center py-20 space-y-4">
        <Package className="h-16 w-16 mx-auto text-muted-foreground/40" />
        <h2 className="text-xl font-display font-bold">Order not found</h2>
        <Button variant="outline" onClick={() => navigate("/admin/orders")}>Back to orders</Button>
      </div>
    );
  }

  const items = parseItems(order.items);
  const timeline = parseTimeline(order.timeline);
  const deliveryAddress = parseDeliveryAddress(order.delivery_address);
  const statusColor = orderStatusColors[order.status] || ICON_COLORS.admin;
  const placedDate = order.date || order.created_at;

  return (
    <div className="space-y-6 max-w-4xl">
      <Button variant="ghost" onClick={() => navigate("/admin/orders")}>
        <ArrowLeft className="h-4 w-4 mr-2" />All orders
      </Button>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge className="text-[10px] font-bold" style={{ backgroundColor: `${ICON_COLORS.admin}1A`, color: ICON_COLORS.admin }}>
              <Shield className="h-3 w-3 mr-0.5" /> Admin tracking
            </Badge>
          </div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">
            Order #{order.id.slice(0, 10).toUpperCase()}
          </h1>
          <p className="text-muted-foreground mt-1">
            Placed {new Date(placedDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <Badge className="text-sm px-3 py-1 capitalize font-bold" style={{ backgroundColor: `${statusColor}1A`, color: statusColor }}>
          {order.status.replace(/_/g, " ")}
        </Badge>
      </motion.div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-base font-display">Buyer</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <p className="font-medium">{order.buyer_name}</p>
            <p className="text-muted-foreground font-mono text-xs">{order.buyer_id}</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-base font-display">Seller</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <p className="font-medium">{order.seller_name}</p>
            <p className="text-muted-foreground font-mono text-xs">{order.seller_id}</p>
          </CardContent>
        </Card>
      </div>

      <OrderTimelineCard
        status={order.status}
        trackingId={order.tracking_id}
        estimatedDelivery={order.estimated_delivery || order.estimated_delivery_note}
        timeline={timeline}
        returnReason={order.return_reason || order.return_note}
        progressAccent={ICON_COLORS.admin}
      />

      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="shadow-card overflow-hidden">
          <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.admin}, #7c3aed)` }} />
          <CardHeader><CardTitle className="font-display text-base">Items</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {items.map((item, i) => (
              <div key={item.productId || i} className="flex items-center gap-3">
                <div className="h-10 w-10 rounded bg-accent/30 flex items-center justify-center shrink-0">
                  {item.image ? <img src={item.image} alt="" className="h-6 w-6 object-contain" /> : <Package className="h-4 w-4 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">×{item.qty}</p>
                </div>
                <p className="text-sm font-bold">৳{(Number(item.price) * Number(item.qty)).toLocaleString()}</p>
              </div>
            ))}
            <div className="border-t pt-2 space-y-1 text-sm">
              {Number(order.shipping_fee) > 0 && (
                <div className="flex justify-between text-muted-foreground"><span>Shipping</span><span>৳{Number(order.shipping_fee).toLocaleString()}</span></div>
              )}
              <div className="flex justify-between font-bold"><span>Total</span><span style={{ color: ICON_COLORS.admin }}>৳{Number(order.total).toLocaleString()}</span></div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card overflow-hidden">
          <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.farm}, ${ICON_COLORS.admin})` }} />
          <CardHeader><CardTitle className="font-display text-base">Delivery & Payment</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            {deliveryAddress && (
              <div>
                <p className="flex items-center gap-1 text-muted-foreground mb-1"><MapPin className="h-3.5 w-3.5" />Delivery</p>
                <p className="font-medium">{deliveryAddress.recipientName}</p>
                <p className="text-muted-foreground">{deliveryAddress.phone}</p>
                {formatDeliveryAddressLines(deliveryAddress).map((line) => (
                  <p key={line} className="text-muted-foreground">{line}</p>
                ))}
              </div>
            )}
            <div>
              <p className="flex items-center gap-1 text-muted-foreground mb-1"><Banknote className="h-3.5 w-3.5" />Payment</p>
              <p className="font-medium capitalize">{(order.payment_method || "—").replace(/_/g, " ")}</p>
              <Badge className="mt-1" variant="secondary">{order.payment_status || "unpaid"}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
