import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOrders } from "@/contexts/OrderContext";
import { useAuth } from "@/contexts/AuthContext";
import { ClipboardList, Package, Truck, CheckCircle, XCircle, Clock, RotateCcw, Eye, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ICON_COLORS } from "@/lib/iconColors";

const statusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
  pending: { color: ICON_COLORS.finance, icon: <Clock className="h-3.5 w-3.5" /> },
  confirmed: { color: ICON_COLORS.marketplace, icon: <CheckCircle className="h-3.5 w-3.5" /> },
  packed: { color: ICON_COLORS.marketplace, icon: <Package className="h-3.5 w-3.5" /> },
  shipped: { color: ICON_COLORS.marketplace, icon: <Truck className="h-3.5 w-3.5" /> },
  out_for_delivery: { color: ICON_COLORS.farm, icon: <Truck className="h-3.5 w-3.5" /> },
  delivered: { color: ICON_COLORS.farm, icon: <CheckCircle className="h-3.5 w-3.5" /> },
  cancelled: { color: ICON_COLORS.health, icon: <XCircle className="h-3.5 w-3.5" /> },
  return_requested: { color: ICON_COLORS.finance, icon: <RotateCcw className="h-3.5 w-3.5" /> },
  returned: { color: ICON_COLORS.health, icon: <RotateCcw className="h-3.5 w-3.5" /> },
  refunded: { color: ICON_COLORS.finance, icon: <RotateCcw className="h-3.5 w-3.5" /> },
};

export default function Orders() {
  const { user } = useAuth();
  const { getOrdersByBuyer } = useOrders();
  const navigate = useNavigate();
  const orders = getOrdersByBuyer(user?.id || "");

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <ClipboardList className="h-16 w-16" style={{ color: `${ICON_COLORS.marketplace}40` }} />
        <h2 className="text-xl font-display font-bold text-foreground">No orders yet</h2>
        <p className="text-muted-foreground">Browse the marketplace to place your first order</p>
        <Button onClick={() => navigate("/marketplace")} className="text-white" style={{ backgroundColor: ICON_COLORS.marketplace }}>Browse Marketplace</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/marketplace")} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">My Orders</h1>
          <p className="text-muted-foreground mt-1">Track your orders and deliveries</p>
        </div>
      </motion.div>

      <div className="space-y-4">
        {orders.map((order, i) => {
          const config = statusConfig[order.status] || statusConfig.pending;
          return (
            <motion.div key={order.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="shadow-card overflow-hidden cursor-pointer hover:shadow-elevated transition-shadow" onClick={() => navigate(`/orders/${order.id}`)}>
                <div className="h-1" style={{ background: `linear-gradient(to right, ${config.color}, ${ICON_COLORS.vet})` }} />
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-display font-bold text-foreground">#{order.id.slice(0, 10).toUpperCase()}</span>
                        <Badge style={{ backgroundColor: `${config.color}1A`, color: config.color }} className="flex items-center gap-1 capitalize text-xs">
                          {config.icon}{order.status.replace(/_/g, " ")}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{new Date(order.date).toLocaleDateString()}</span>
                      </div>
                      <div className="space-y-1">
                        {order.items.map((item, j) => (
                          <div key={j} className="flex justify-between text-sm">
                            <span className="text-foreground">{item.name} × {item.qty}</span>
                            <span className="text-muted-foreground">৳{(item.price * item.qty).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Seller: {order.sellerName}</span>
                        <span className="font-bold" style={{ color: ICON_COLORS.marketplace }}>৳{order.total.toLocaleString()}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="shrink-0">
                      <Eye className="h-4 w-4" style={{ color: ICON_COLORS.marketplace }} />
                    </Button>
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
