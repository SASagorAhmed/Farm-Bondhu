import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useCart } from "@/contexts/CartContext";
import { useOrders, DeliveryAddress } from "@/contexts/OrderContext";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, MapPin, CreditCard, Banknote, Smartphone, ShieldCheck, Truck } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ICON_COLORS } from "@/lib/iconColors";

const paymentMethods = [
  { id: "cash_on_delivery", label: "Cash on Delivery", icon: Banknote, desc: "Pay when you receive the product" },
  { id: "bkash", label: "bKash", icon: Smartphone, desc: "Pay via bKash mobile wallet" },
  { id: "nagad", label: "Nagad", icon: Smartphone, desc: "Pay via Nagad mobile wallet" },
  { id: "card", label: "Card Payment", icon: CreditCard, desc: "Visa / Mastercard" },
];

export default function Checkout() {
  const navigate = useNavigate();
  const { items, total, clearCart } = useCart();
  const { placeOrder } = useOrders();
  const { user } = useAuth();

  const [address, setAddress] = useState<DeliveryAddress>({
    recipientName: user?.name || "",
    phone: user?.phone || "",
    address: "",
    area: "",
    city: user?.location || "",
    note: "",
  });
  const [paymentMethod, setPaymentMethod] = useState("cash_on_delivery");
  const [placing, setPlacing] = useState(false);

  const hasFreeDelivery = items.some(i => i.product.freeDelivery);
  const shippingFee = hasFreeDelivery ? 0 : 60;
  const grandTotal = total + shippingFee;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <ShieldCheck className="h-16 w-16" style={{ color: `${ICON_COLORS.marketplace}40` }} />
        <h2 className="text-xl font-display font-bold text-foreground">No items to checkout</h2>
        <Button onClick={() => navigate("/marketplace")} className="text-white" style={{ backgroundColor: ICON_COLORS.marketplace }}>Browse Marketplace</Button>
      </div>
    );
  }

  const handlePlaceOrder = async () => {
    if (!address.recipientName || !address.phone || !address.address || !address.area || !address.city) {
      toast.error("Please fill in all delivery address fields");
      return;
    }
    setPlacing(true);
    try {
      const order = await placeOrder({
        items,
        deliveryAddress: address,
        paymentMethod,
        buyerId: user?.id || "guest",
        buyerName: user?.name || "Guest",
      });
      clearCart();
      toast.success("Order placed successfully! 🎉");
      navigate(`/orders/${order.id}`);
    } catch (err) {
      toast.error("Failed to place order");
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto overflow-hidden">
      <Button variant="ghost" onClick={() => navigate("/cart")}><ArrowLeft className="h-4 w-4 mr-2" />Back to Cart</Button>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Checkout</h1>
        <p className="text-muted-foreground mt-1">Complete your order</p>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left column - Forms */}
        <div className="lg:col-span-2 space-y-6">
          {/* Delivery Address */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="shadow-card overflow-hidden">
              <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.marketplace}, ${ICON_COLORS.farm})` }} />
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display">
                  <MapPin className="h-5 w-5" style={{ color: ICON_COLORS.marketplace }} />
                  Delivery Address
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Recipient Name *</Label>
                    <Input value={address.recipientName} onChange={e => setAddress(a => ({ ...a, recipientName: e.target.value }))} placeholder="Full name" />
                  </div>
                  <div>
                    <Label>Phone Number *</Label>
                    <Input value={address.phone} onChange={e => setAddress(a => ({ ...a, phone: e.target.value }))} placeholder="01XXXXXXXXX" />
                  </div>
                </div>
                <div>
                  <Label>Street Address *</Label>
                  <Input value={address.address} onChange={e => setAddress(a => ({ ...a, address: e.target.value }))} placeholder="House/Road/Block" />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Area *</Label>
                    <Input value={address.area} onChange={e => setAddress(a => ({ ...a, area: e.target.value }))} placeholder="e.g. Sadar" />
                  </div>
                  <div>
                    <Label>City *</Label>
                    <Input value={address.city} onChange={e => setAddress(a => ({ ...a, city: e.target.value }))} placeholder="e.g. Mymensingh" />
                  </div>
                </div>
                <div>
                  <Label>Delivery Note (optional)</Label>
                  <Textarea value={address.note} onChange={e => setAddress(a => ({ ...a, note: e.target.value }))} placeholder="Any special instructions for delivery..." rows={2} />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Payment Method */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="shadow-card overflow-hidden">
              <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.finance}, ${ICON_COLORS.marketplace})` }} />
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display">
                  <CreditCard className="h-5 w-5" style={{ color: ICON_COLORS.finance }} />
                  Payment Method
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-3">
                  {paymentMethods.map(pm => (
                    <label key={pm.id} className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-all ${paymentMethod === pm.id ? "border-2 bg-accent/30" : "border-border hover:bg-accent/10"}`} style={paymentMethod === pm.id ? { borderColor: ICON_COLORS.marketplace } : undefined}>
                      <RadioGroupItem value={pm.id} />
                      <pm.icon className="h-5 w-5 shrink-0" style={{ color: paymentMethod === pm.id ? ICON_COLORS.marketplace : undefined }} />
                      <div>
                        <p className="font-medium text-foreground">{pm.label}</p>
                        <p className="text-xs text-muted-foreground">{pm.desc}</p>
                      </div>
                    </label>
                  ))}
                </RadioGroup>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Right column - Order Summary */}
        <div className="space-y-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="shadow-card overflow-hidden sticky top-4">
              <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.marketplace}, ${ICON_COLORS.vet})` }} />
              <CardHeader>
                <CardTitle className="font-display">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {items.map(item => (
                  <div key={item.product.id} className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-lg bg-accent/30 flex items-center justify-center shrink-0">
                      <img src={item.product.image} alt={item.product.name} className="h-8 w-8 object-contain opacity-50" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.product.name}</p>
                      <p className="text-xs text-muted-foreground">×{item.quantity}</p>
                    </div>
                    <p className="text-sm font-medium text-foreground">৳{(item.product.price * item.quantity).toLocaleString()}</p>
                  </div>
                ))}

                <div className="border-t pt-3 space-y-2 text-sm">
                  <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>৳{total.toLocaleString()}</span></div>
                  <div className="flex justify-between text-muted-foreground">
                    <span className="flex items-center gap-1"><Truck className="h-3.5 w-3.5" />Delivery</span>
                    <span style={{ color: shippingFee === 0 ? ICON_COLORS.farm : undefined }}>{shippingFee === 0 ? "FREE" : `৳${shippingFee}`}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between items-center">
                    <span className="font-display font-bold text-lg text-foreground">Total</span>
                    <span className="font-display font-bold text-2xl" style={{ color: ICON_COLORS.marketplace }}>৳{grandTotal.toLocaleString()}</span>
                  </div>
                </div>

                <Button
                  className="w-full h-12 text-white text-base font-bold"
                  style={{ backgroundColor: ICON_COLORS.marketplace }}
                  onClick={handlePlaceOrder}
                  disabled={placing}
                >
                  {placing ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Placing Order...
                    </span>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4 mr-2" />
                      Place Order — ৳{grandTotal.toLocaleString()}
                    </>
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  By placing this order you agree to Firmbondhu's terms of service
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
