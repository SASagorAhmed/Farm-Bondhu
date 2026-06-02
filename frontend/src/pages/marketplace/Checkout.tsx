import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/contexts/CartContext";
import { useOrders, DeliveryAddress, formatDeliveryAddressLines } from "@/contexts/OrderContext";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, MapPin, CreditCard, Banknote, Smartphone, ShieldCheck, Truck, Star, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ICON_COLORS } from "@/lib/iconColors";
import { MARKETPLACE_THEME, computeCartShippingByShop, formatBdt, marketplaceGradient } from "@/lib/marketplaceTheme";
import { previewOrderQuote } from "@/lib/orderPreviewApi";
import { cartLineKey, type OrderPreviewLine, type OrderPreviewQuote } from "@/lib/wholesalePricing";
import { laneLabel } from "@/lib/marketplaceLaneLabels";
import { getSellerDisplayName } from "@/lib/marketplaceProduct";
import PaymentMethodStrip from "@/components/marketplace/PaymentMethodStrip";
import UserAddressForm from "@/components/address/UserAddressForm";
import type { SavedUserAddress } from "@/lib/bangladeshLocations";
import {
  createUserAddress,
  fetchUserAddresses,
  payloadToDeliveryAddress,
  savedAddressToDeliveryAddress,
} from "@/lib/userAddressesApi";

const paymentMethods = [
  { id: "cash_on_delivery", label: "Cash on Delivery", icon: Banknote, desc: "Pay when you receive the product" },
  { id: "bkash", label: "bKash", icon: Smartphone, desc: "Pay via bKash mobile wallet" },
  { id: "nagad", label: "Nagad", icon: Smartphone, desc: "Pay via Nagad mobile wallet" },
  { id: "card", label: "Card Payment", icon: CreditCard, desc: "Visa / Mastercard" },
];

export default function Checkout() {
  const navigate = useNavigate();
  const { getSelectedItems, selectedTotal, removeSelectedItems, items, selectedKeys } = useCart();
  const selectedItems = useMemo(() => getSelectedItems(), [getSelectedItems, items, selectedKeys]);
  const { placeOrder } = useOrders();
  const { user } = useAuth();

  const [savedAddresses, setSavedAddresses] = useState<SavedUserAddress[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [addressMode, setAddressMode] = useState<"saved" | "new">("new");
  const [selectedSavedId, setSelectedSavedId] = useState<string>("");
  const [deliveryAddress, setDeliveryAddress] = useState<DeliveryAddress | null>(null);
  const [newAddressConfirmed, setNewAddressConfirmed] = useState(false);
  const [saveToProfile, setSaveToProfile] = useState(false);
  const [pendingAddressPayload, setPendingAddressPayload] = useState<Record<string, unknown> | null>(null);
  const [deliveryNote, setDeliveryNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash_on_delivery");
  const [placing, setPlacing] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [shopQuotes, setShopQuotes] = useState<Array<{ sellerId: string; sellerName: string; quote: OrderPreviewQuote }>>([]);
  const [serverSubtotal, setServerSubtotal] = useState<number | null>(null);
  const [serverShipping, setServerShipping] = useState<number | null>(null);
  const [serverTotal, setServerTotal] = useState<number | null>(null);

  const loadAddresses = useCallback(async () => {
    setLoadingAddresses(true);
    try {
      const list = await fetchUserAddresses();
      setSavedAddresses(list);
      if (list.length > 0) {
        const defaultAddr = list.find((a) => a.isDefault) || list[0];
        setSelectedSavedId(defaultAddr.id);
        setAddressMode("saved");
        setDeliveryAddress(savedAddressToDeliveryAddress(defaultAddr));
        setNewAddressConfirmed(true);
      } else {
        setAddressMode("new");
        setDeliveryAddress(null);
        setNewAddressConfirmed(false);
      }
    } catch {
      setAddressMode("new");
      setNewAddressConfirmed(false);
    } finally {
      setLoadingAddresses(false);
    }
  }, []);

  useEffect(() => {
    void loadAddresses();
  }, [loadAddresses]);

  const activeAddress = useMemo(() => {
    if (addressMode === "saved" && selectedSavedId) {
      const addr = savedAddresses.find((a) => a.id === selectedSavedId);
      if (addr) return savedAddressToDeliveryAddress(addr, deliveryNote || undefined);
    }
    if (deliveryAddress && newAddressConfirmed) {
      return { ...deliveryAddress, note: deliveryNote || undefined };
    }
    return null;
  }, [addressMode, selectedSavedId, savedAddresses, deliveryAddress, deliveryNote, newAddressConfirmed]);

  const pricedLines = useMemo(
    () => shopQuotes.flatMap((sq) => sq.quote.pricedLines || []),
    [shopQuotes],
  );

  const clientShipping = computeCartShippingByShop(selectedItems, {
    division: activeAddress?.division,
    district: activeAddress?.district || activeAddress?.city,
  }).total;

  const shippingFee = serverShipping ?? clientShipping;
  const checkoutSubtotal = serverSubtotal ?? selectedTotal;
  const grandTotal = serverTotal ?? selectedTotal + clientShipping;

  useEffect(() => {
    if (!selectedItems.length) {
      setShopQuotes([]);
      setServerSubtotal(null);
      setServerShipping(null);
      setServerTotal(null);
      setPreviewError(null);
      return;
    }

    let cancelled = false;
    const loadPreview = async () => {
      setPreviewLoading(true);
      try {
        const sellerGroups = new Map<string, typeof selectedItems>();
        selectedItems.forEach((item) => {
          const group = sellerGroups.get(item.product.sellerId) || [];
          group.push(item);
          sellerGroups.set(item.product.sellerId, group);
        });

        let subtotal = 0;
        let shipping = 0;
        let orderTotal = 0;
        const quotes: Array<{ sellerId: string; sellerName: string; quote: OrderPreviewQuote }> = [];
        const errors: string[] = [];

        for (const [sellerId, sellerItems] of sellerGroups) {
          const quote = await previewOrderQuote({
            sellerId,
            items: sellerItems.map((i) => ({
              productId: i.product.id,
              qty: i.quantity,
              priceTier: i.priceTier,
            })),
            deliveryAddress: activeAddress,
          });

          if (!quote.ok) {
            errors.push(...(quote.errors || ["Preview failed"]));
            continue;
          }

          subtotal += quote.subtotal || 0;
          shipping += quote.shippingFee || 0;
          orderTotal += quote.total || 0;
          quotes.push({
            sellerId,
            sellerName: getSellerDisplayName(sellerItems[0]?.product),
            quote,
          });
        }

        if (cancelled) return;
        setShopQuotes(quotes);
        setServerSubtotal(subtotal);
        setServerShipping(shipping);
        setServerTotal(orderTotal);
        setPreviewError(errors.length ? errors.join("; ") : null);
      } catch (err) {
        if (!cancelled) {
          setPreviewError(err instanceof Error ? err.message : "Could not preview order");
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    };

    void loadPreview();
    return () => {
      cancelled = true;
    };
  }, [selectedItems, activeAddress]);

  if (!selectedItems.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <ShieldCheck className="h-16 w-16" style={{ color: `${MARKETPLACE_THEME.primary}40` }} />
        <h2 className="text-xl font-display font-bold text-foreground">No items selected</h2>
        <Button onClick={() => navigate("/cart")} className="text-white" style={{ backgroundColor: MARKETPLACE_THEME.primary }}>Back to Cart</Button>
      </div>
    );
  }

  const handleSelectSaved = (id: string) => {
    setSelectedSavedId(id);
    setAddressMode("saved");
    setNewAddressConfirmed(true);
    setSaveToProfile(false);
    setPendingAddressPayload(null);
    const addr = savedAddresses.find((a) => a.id === id);
    if (addr) setDeliveryAddress(savedAddressToDeliveryAddress(addr));
  };

  const handlePlaceOrder = async () => {
    if (!user?.id) {
      toast.error("Please sign in to place an order");
      return;
    }
    if (!activeAddress?.recipientName || !activeAddress.phone || !activeAddress.address) {
      toast.error("Please complete your delivery address");
      return;
    }
    if (!activeAddress.division && !activeAddress.city) {
      toast.error("Please select division and district");
      return;
    }

    setPlacing(true);
    try {
      if (saveToProfile && pendingAddressPayload) {
        await createUserAddress({ ...pendingAddressPayload, is_default: savedAddresses.length === 0 });
      }

      const purchasedKeys = selectedItems.map((i) => cartLineKey(i.product.id, i.priceTier));
      const order = await placeOrder({
        items: selectedItems,
        deliveryAddress: activeAddress,
        paymentMethod,
        buyerId: user.id,
        buyerName: user.name || "Buyer",
      });
      removeSelectedItems(purchasedKeys);
      toast.success("Order placed successfully!");
      navigate(`/orders/${order.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to place order");
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
        <div className="lg:col-span-2 space-y-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="shadow-card overflow-hidden">
              <div className="h-1" style={{ background: marketplaceGradient() }} />
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display">
                  <MapPin className="h-5 w-5" style={{ color: MARKETPLACE_THEME.primary }} />
                  Delivery Address
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingAddresses && (
                  <p className="text-sm text-muted-foreground">Loading saved addresses...</p>
                )}

                {!loadingAddresses && savedAddresses.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No saved addresses yet.{" "}
                    <Link to="/profile" className="text-primary underline">Add one in Profile</Link>{" "}
                    for faster checkout next time.
                  </p>
                )}

                {!loadingAddresses && savedAddresses.length > 0 && (
                  <RadioGroup
                    value={addressMode === "new" ? "new" : selectedSavedId}
                    onValueChange={(val) => {
                      if (val === "new") {
                        setAddressMode("new");
                        setDeliveryAddress(null);
                        setNewAddressConfirmed(false);
                        setSaveToProfile(false);
                        setPendingAddressPayload(null);
                      } else {
                        handleSelectSaved(val);
                      }
                    }}
                    className="space-y-2"
                  >
                    {savedAddresses.map((addr) => (
                      <label
                        key={addr.id}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                          addressMode === "saved" && selectedSavedId === addr.id
                            ? "border-2 bg-accent/30"
                            : "border-border hover:bg-accent/10"
                        }`}
                        style={
                          addressMode === "saved" && selectedSavedId === addr.id
                            ? { borderColor: MARKETPLACE_THEME.primary }
                            : undefined
                        }
                      >
                        <RadioGroupItem value={addr.id} className="mt-1" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm">{addr.fullName}</p>
                            <Badge variant="outline" className="text-[10px] capitalize">{addr.addressType}</Badge>
                            {addr.isDefault && (
                              <Badge className="text-[10px] gap-1"><Star className="h-3 w-3" />Default</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{addr.phone}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {addr.fullAddress}, {addr.upazila}, {addr.district}, {addr.division}
                          </p>
                        </div>
                      </label>
                    ))}
                    <label
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        addressMode === "new" ? "border-2 bg-accent/30" : "border-border hover:bg-accent/10"
                      }`}
                      style={addressMode === "new" ? { borderColor: MARKETPLACE_THEME.primary } : undefined}
                    >
                      <RadioGroupItem value="new" />
                      <p className="font-medium text-sm">Use a new address</p>
                    </label>
                  </RadioGroup>
                )}

                {addressMode === "new" && (
                  <div className="space-y-3">
                    <UserAddressForm
                      key="checkout-new-address"
                      initial={{
                        fullName: user?.name || "",
                        phone: user?.phone || "",
                      }}
                      submitLabel="Use this address"
                      showDefaultToggle={false}
                      onSubmit={async (payload) => {
                        setDeliveryAddress(payloadToDeliveryAddress(payload));
                        setPendingAddressPayload(payload);
                        setNewAddressConfirmed(true);
                        toast.success("Address confirmed for this order");
                      }}
                    />
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={saveToProfile} onCheckedChange={(v) => setSaveToProfile(Boolean(v))} />
                      Save this address to my profile
                    </label>
                  </div>
                )}

                {activeAddress && (
                  <div className="rounded-lg border bg-accent/20 p-3 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Delivering to
                    </p>
                    <p className="font-medium text-sm">{activeAddress.recipientName} · {activeAddress.phone}</p>
                    {formatDeliveryAddressLines(activeAddress).map((line) => (
                      <p key={line} className="text-sm text-muted-foreground">{line}</p>
                    ))}
                  </div>
                )}

                {activeAddress && (
                  <div>
                    <Label htmlFor="deliveryNote">Delivery Note (optional)</Label>
                    <Textarea
                      id="deliveryNote"
                      name="deliveryNote"
                      value={deliveryNote}
                      onChange={(e) => setDeliveryNote(e.target.value)}
                      placeholder="Any special instructions for delivery..."
                      rows={2}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="shadow-card overflow-hidden">
              <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.finance}, ${MARKETPLACE_THEME.primary})` }} />
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display">
                  <CreditCard className="h-5 w-5" style={{ color: ICON_COLORS.finance }} />
                  Payment Method
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-3">
                  {paymentMethods.map((pm) => (
                    <label key={pm.id} className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-all ${paymentMethod === pm.id ? "border-2 bg-accent/30" : "border-border hover:bg-accent/10"}`} style={paymentMethod === pm.id ? { borderColor: MARKETPLACE_THEME.primary } : undefined}>
                      <RadioGroupItem value={pm.id} />
                      <pm.icon className="h-5 w-5 shrink-0" style={{ color: paymentMethod === pm.id ? MARKETPLACE_THEME.primary : undefined }} />
                      <div>
                        <p className="font-medium text-foreground">{pm.label}</p>
                        <p className="text-xs text-muted-foreground">{pm.desc}</p>
                      </div>
                    </label>
                  ))}
                </RadioGroup>
                <PaymentMethodStrip compact />
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <div className="space-y-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="shadow-card overflow-hidden sticky top-4">
              <div className="h-1" style={{ background: marketplaceGradient() }} />
              <CardHeader>
                <CardTitle className="font-display">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {pricedLines.length > 0
                  ? pricedLines.map((line) => (
                      <div key={`${line.productId}-${line.priceTier}`} className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-lg bg-accent/30 flex items-center justify-center shrink-0">
                          {line.image ? (
                            <img src={line.image} alt={line.name} className="h-8 w-8 object-contain opacity-50" />
                          ) : null}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{line.name}</p>
                          <p className="text-xs text-muted-foreground">
                            ×{line.qty} · {line.priceTier} · {formatBdt(line.unitPrice)}/{line.unit || "unit"}
                          </p>
                        </div>
                        <p className="text-sm font-medium text-foreground">{formatBdt(line.lineTotal)}</p>
                      </div>
                    ))
                  : selectedItems.map((item) => (
                      <div key={cartLineKey(item.product.id, item.priceTier)} className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-lg bg-accent/30 flex items-center justify-center shrink-0">
                          <img src={item.product.image} alt={item.product.name} className="h-8 w-8 object-contain opacity-50" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{item.product.name}</p>
                          <p className="text-xs text-muted-foreground">×{item.quantity}</p>
                        </div>
                        <p className="text-sm font-medium text-foreground">{formatBdt(item.product.price * item.quantity)}</p>
                      </div>
                    ))}

                {shopQuotes.map((shop) => (
                  <div key={shop.sellerId} className="rounded-md border bg-accent/10 p-3 space-y-2 text-xs">
                    <p className="font-medium text-foreground">{shop.sellerName} — delivery</p>
                    {(shop.quote.shippingBreakdown?.lanes || []).map((lane) => (
                      <div key={`${shop.sellerId}-${lane.lane}`} className="flex justify-between text-muted-foreground">
                        <span>{lane.lane === "other" ? "Other category" : laneLabel(lane.lane)}</span>
                        <span>{lane.fee === 0 ? "FREE" : formatBdt(lane.fee)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-medium text-foreground border-t pt-1">
                      <span>Shop delivery</span>
                      <span>{formatBdt(shop.quote.shippingFee || 0)}</span>
                    </div>
                  </div>
                ))}

                {previewError && (
                  <p className="text-xs text-destructive rounded-md bg-destructive/10 p-2">{previewError}</p>
                )}

                <div className="border-t pt-3 space-y-2 text-sm">
                  <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatBdt(checkoutSubtotal)}</span></div>
                  <div className="flex justify-between text-muted-foreground">
                    <span className="flex items-center gap-1"><Truck className="h-3.5 w-3.5" />Delivery</span>
                    <span style={{ color: shippingFee === 0 ? MARKETPLACE_THEME.trustIcon : undefined }}>
                      {!activeAddress ? "Select address" : shippingFee === 0 ? "FREE" : formatBdt(shippingFee)}
                    </span>
                  </div>
                  <div className="border-t pt-2 flex justify-between items-center">
                    <span className="font-display font-bold text-lg text-foreground">Total</span>
                    <span className="font-display font-bold text-2xl" style={{ color: MARKETPLACE_THEME.primary }}>{formatBdt(grandTotal)}</span>
                  </div>
                </div>

                <Button
                  className="w-full h-12 text-white text-base font-bold"
                  style={{ backgroundColor: MARKETPLACE_THEME.primary }}
                  onClick={handlePlaceOrder}
                  disabled={placing || previewLoading || Boolean(previewError) || !activeAddress || !user?.id}
                >
                  {placing || previewLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Placing Order...
                    </span>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4 mr-2" />
                      Place Order — {formatBdt(grandTotal)}
                    </>
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  By placing this order you agree to FarmBondhu&apos;s terms of service
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
