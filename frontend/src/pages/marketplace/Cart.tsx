import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useCart } from "@/contexts/CartContext";
import { Trash2, Plus, Minus, ShoppingBag, ArrowLeft, Truck, Store } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  MARKETPLACE_THEME,
  computeCartShippingByShop,
  DEFAULT_DELIVERY_DHAKA,
  formatBdt,
  marketplaceGradient,
} from "@/lib/marketplaceTheme";
import { cartLineKey, resolveLinePrice } from "@/lib/wholesalePricing";
import { useMemo } from "react";
import { getSellerDisplayName } from "@/lib/marketplaceProduct";

export default function Cart() {
  const {
    items,
    updateQuantity,
    removeItem,
    selectedTotal,
    getSelectedItems,
    toggleSelected,
    selectShop,
    isSelected,
    selectedKeys,
  } = useCart();
  const navigate = useNavigate();

  const selectedItems = getSelectedItems();

  const shopGroups = useMemo(() => {
    const groups = new Map<string, typeof items>();
    for (const item of items) {
      const sellerId = item.product.sellerId || "unknown";
      const existing = groups.get(sellerId) || [];
      existing.push(item);
      groups.set(sellerId, existing);
    }
    return [...groups.entries()].map(([sellerId, shopItems]) => ({
      sellerId,
      sellerName: getSellerDisplayName(shopItems[0]?.product),
      items: shopItems,
    }));
  }, [items]);

  const { shops: shippingByShop, total: shippingFee } = useMemo(
    () => computeCartShippingByShop(selectedItems),
    [selectedItems],
  );

  const grandTotal = selectedTotal + shippingFee;

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
          <p className="text-muted-foreground mt-1">
            {selectedItems.length} of {items.length} line(s) selected
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/marketplace")}>
          <ArrowLeft className="h-4 w-4 mr-1" />Continue Shopping
        </Button>
      </motion.div>

      {shopGroups.map((shop, shopIndex) => {
        const shopSelected = shop.items.every((item) =>
          isSelected(cartLineKey(item.product.id, item.priceTier)),
        );
        const shopShipping = shippingByShop.find((s) => s.sellerId === shop.sellerId);

        return (
          <Card key={shop.sellerId} className="shadow-card overflow-hidden">
            <div className="h-1" style={{ background: marketplaceGradient() }} />
            <div className="flex items-center justify-between px-4 py-3 border-b bg-accent/20">
              <div className="flex items-center gap-2 min-w-0">
                <Checkbox
                  checked={shopSelected}
                  onCheckedChange={(checked) => selectShop(shop.sellerId, Boolean(checked))}
                  aria-label={`Select all from ${shop.sellerName}`}
                />
                <Store className="h-4 w-4 ml-2 shrink-0 text-muted-foreground" />
                <p className="font-medium text-sm truncate ml-1">{shop.sellerName}</p>
              </div>
              {shopShipping && selectedItems.some((i) => i.product.sellerId === shop.sellerId) && (
                <p className="text-xs text-muted-foreground shrink-0">
                  Delivery from {formatBdt(shopShipping.breakdown.total || 0)}
                </p>
              )}
            </div>
            <CardContent className="p-0 divide-y divide-border">
              {shop.items.map((item, i) => {
                const lineKey = cartLineKey(item.product.id, item.priceTier);
                const resolved = resolveLinePrice(item.product, item.quantity, item.priceTier);
                const lineTotal = resolved.unitPrice * item.quantity;
                const checked = isSelected(lineKey);

                return (
                  <motion.div
                    key={lineKey}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: (shopIndex * 0.05) + (i * 0.03) }}
                    className={`flex items-center gap-3 p-4 ${checked ? "" : "opacity-60"}`}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleSelected(lineKey)}
                      aria-label={`Select ${item.product.name}`}
                    />
                    <div className="h-16 w-16 rounded-lg bg-accent/30 flex items-center justify-center shrink-0">
                      {item.product.image ? (
                        <img src={item.product.image} alt={item.product.name} className="h-10 w-10 object-contain" />
                      ) : (
                        <ShoppingBag className="h-8 w-8 text-muted-foreground/30" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-foreground truncate">{item.product.name}</p>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {resolved.priceTier}
                        </Badge>
                        {item.product.freeDelivery && (
                          <Badge className="text-[10px]" style={{ backgroundColor: MARKETPLACE_THEME.primary }}>
                            Free delivery
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatBdt(resolved.unitPrice)}/{item.product.unit}
                      </p>
                      {item.priceTier === "wholesale" && resolved.thresholdHint && (
                        <p className="text-xs text-amber-700 mt-1">{resolved.thresholdHint}</p>
                      )}
                    </div>
                    <div className="flex items-center border rounded-md">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.product.id, item.quantity - 1, item.priceTier)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="px-3 text-sm font-medium text-foreground">{item.quantity}</span>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.product.id, item.quantity + 1, item.priceTier)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="font-bold text-foreground w-24 text-right">
                      {formatBdt(lineTotal)}
                    </p>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeItem(item.product.id, item.priceTier)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </motion.div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}

      <Card className="shadow-card overflow-hidden">
        <div className="h-1" style={{ background: marketplaceGradient() }} />
        <CardContent className="p-6 space-y-4">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Subtotal (selected)</span>
            <span>{formatBdt(selectedTotal)}</span>
          </div>

          {shippingByShop.map((shop) => (
            <div key={shop.sellerId} className="space-y-1">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Truck className="h-3.5 w-3.5" />
                  {shop.sellerName} delivery
                </span>
                <span style={{ color: shop.breakdown.total === 0 ? MARKETPLACE_THEME.trustIcon : undefined }}>
                  {shop.breakdown.total === 0 ? "FREE" : formatBdt(shop.breakdown.total)}
                </span>
              </div>
            </div>
          ))}

          {!selectedKeys.size && (
            <p className="text-xs text-destructive">Select at least one item to checkout.</p>
          )}

          <p className="text-xs text-muted-foreground">
            Delivery is charged per shop and per top category. Default rates: Dhaka metro {formatBdt(DEFAULT_DELIVERY_DHAKA)}, other areas from {formatBdt(120)}. Final fee depends on your address at checkout.
          </p>

          <div className="border-t pt-3 flex justify-between items-center">
            <span className="font-display font-bold text-lg text-foreground">Estimated total</span>
            <span className="font-display font-bold text-2xl" style={{ color: MARKETPLACE_THEME.primary }}>
              {formatBdt(grandTotal)}
            </span>
          </div>
          <Button
            className="w-full text-white h-12 text-base"
            style={{ backgroundColor: MARKETPLACE_THEME.primary }}
            disabled={!selectedKeys.size}
            onClick={() => navigate("/checkout")}
          >
            Proceed to Checkout — {formatBdt(grandTotal)}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
