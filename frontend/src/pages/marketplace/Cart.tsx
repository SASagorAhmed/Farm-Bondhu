import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";
import { Trash2, Plus, Minus, ShoppingBag, ArrowLeft, Truck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MARKETPLACE_THEME, computeShippingFee, formatBdt, marketplaceGradient } from "@/lib/marketplaceTheme";

export default function Cart() {
  const { items, updateQuantity, removeItem, total } = useCart();
  const navigate = useNavigate();
  const shippingFee = computeShippingFee(items);
  const grandTotal = total + shippingFee;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <ShoppingBag className="h-16 w-16 text-muted-foreground/30" />
        <h2 className="text-xl font-display font-bold text-foreground">Your cart is empty</h2>
        <p className="text-muted-foreground">Browse the marketplace to add products</p>
        <Button
          onClick={() => navigate("/marketplace")}
          className="text-white"
          style={{ backgroundColor: MARKETPLACE_THEME.primary }}
        >
          Browse Marketplace
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto max-w-full overflow-hidden">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Cart</h1>
          <p className="text-muted-foreground mt-1">{items.length} item(s) in your cart</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/marketplace")}>
          <ArrowLeft className="h-4 w-4 mr-1" />Continue Shopping
        </Button>
      </motion.div>

      <Card className="shadow-card overflow-hidden">
        <div className="h-1" style={{ background: marketplaceGradient() }} />
        <CardContent className="p-0 divide-y divide-border">
          {items.map((item, i) => (
            <motion.div
              key={item.product.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-4 p-4"
            >
              <div className="h-16 w-16 rounded-lg bg-accent/30 flex items-center justify-center shrink-0">
                {item.product.image ? (
                  <img src={item.product.image} alt={item.product.name} className="h-10 w-10 object-contain" />
                ) : (
                  <ShoppingBag className="h-8 w-8 text-muted-foreground/30" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{item.product.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatBdt(item.product.price)}/{item.product.unit}
                </p>
              </div>
              <div className="flex items-center border rounded-md">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.product.id, item.quantity - 1)}>
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="px-3 text-sm font-medium text-foreground">{item.quantity}</span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.product.id, item.quantity + 1)}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <p className="font-bold text-foreground w-24 text-right">
                {formatBdt(item.product.price * item.quantity)}
              </p>
              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeItem(item.product.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </motion.div>
          ))}
        </CardContent>
      </Card>

      <Card className="shadow-card overflow-hidden">
        <div className="h-1" style={{ background: marketplaceGradient() }} />
        <CardContent className="p-6 space-y-4">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatBdt(total)}</span>
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Truck className="h-3.5 w-3.5" />Delivery
            </span>
            <span style={{ color: shippingFee === 0 ? MARKETPLACE_THEME.trustIcon : undefined }}>
              {shippingFee === 0 ? "FREE" : formatBdt(shippingFee)}
            </span>
          </div>
          <div className="border-t pt-3 flex justify-between items-center">
            <span className="font-display font-bold text-lg text-foreground">Total</span>
            <span className="font-display font-bold text-2xl" style={{ color: MARKETPLACE_THEME.primary }}>
              {formatBdt(grandTotal)}
            </span>
          </div>
          <Button
            className="w-full text-white h-12 text-base"
            style={{ backgroundColor: MARKETPLACE_THEME.primary }}
            onClick={() => navigate("/checkout")}
          >
            Proceed to Checkout — {formatBdt(grandTotal)}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
