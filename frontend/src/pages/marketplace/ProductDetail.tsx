import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/api/client";
import { Product } from "@/data/mockData";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ShoppingCart, Star, MapPin, ArrowLeft, Package, Store, Truck, Zap, ShieldCheck, CheckCircle, CalendarDays, ShoppingBag, BarChart3, MessageCircle, Tag } from "lucide-react";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ICON_COLORS } from "@/lib/iconColors";

interface ExtendedProduct extends Product {
  is_verified_seller?: boolean;
  wholesale_price?: number | null;
  wholesale_min_qty?: number | null;
}

function dbToProduct(row: any): ExtendedProduct {
  return { id: row.id, name: row.name, category: row.category, price: Number(row.price), originalPrice: row.original_price ? Number(row.original_price) : undefined, unit: row.unit, image: row.image, seller: row.seller_name, sellerId: row.seller_id, rating: Number(row.rating), reviewCount: row.review_count, stock: row.stock, description: row.description, location: row.location, freeDelivery: row.free_delivery, is_verified_seller: row.is_verified_seller, wholesale_price: row.wholesale_price ? Number(row.wholesale_price) : null, wholesale_min_qty: row.wholesale_min_qty };
}

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { user, isAuthenticated, hasCapability } = useAuth();
  const [qty, setQty] = useState(1);
  const [product, setProduct] = useState<ExtendedProduct | null>(null);
  const [shop, setShop] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const isWholesaler = hasCapability("is_wholesaler");

  useEffect(() => {
    if (!id) return;
    api.from("products").select("*").eq("id", id).single().then(({ data }) => {
      if (data) {
        const p = dbToProduct(data);
        setProduct(p);
        api.from("shops").select("*").eq("user_id", p.sellerId).single().then(({ data: shopData }) => {
          if (shopData) setShop(shopData);
        });
      }
      setLoading(false);
    });
  }, [id]);

  const isSeller = user?.id === product?.sellerId;

  if (loading) return <div className="text-center py-12 text-muted-foreground">Loading...</div>;
  if (!product) return <div className="text-center py-12 text-muted-foreground">Product not found</div>;

  const discount = product.originalPrice ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100) : 0;
  const hasWholesale = product.wholesale_price && product.wholesale_min_qty;
  const wholesaleSavings = hasWholesale ? Math.round(((product.price - product.wholesale_price!) / product.price) * 100) : 0;

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      <Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="shadow-card overflow-hidden">
          <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.marketplace}, ${ICON_COLORS.vet})` }} />
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="relative h-64 md:h-full bg-accent/30 flex items-center justify-center">
              <img src={product.image} alt={product.name} className="h-32 w-32 object-contain opacity-50" />
              {discount > 0 && <Badge className="absolute top-3 left-3 text-sm font-bold" style={{ backgroundColor: ICON_COLORS.health, color: "white" }}>-{discount}% OFF</Badge>}
              {product.freeDelivery && <div className="absolute bottom-3 left-3 flex items-center gap-1 px-2 py-1 rounded text-xs font-bold" style={{ backgroundColor: ICON_COLORS.marketplace, color: "white" }}><Truck className="h-3.5 w-3.5" /> FREE DELIVERY</div>}
            </div>
            <CardContent className="p-6 space-y-4">
              <Badge variant="outline">{product.category}</Badge>
              <h1 className="text-2xl font-display font-bold text-foreground">{product.name}</h1>
              <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1"><Star className="h-4 w-4" style={{ color: ICON_COLORS.finance, fill: ICON_COLORS.finance }} />{product.rating} ({product.reviewCount || 0})</span>
                <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{product.location}</span>
                <span className="flex items-center gap-1"><Package className="h-4 w-4" />{product.stock} in stock</span>
              </div>
              <p className="text-muted-foreground">{product.description}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                <Store className="h-4 w-4" />Sold by <span className="font-medium text-foreground">{product.seller}</span>
                {product.seller === "FarmBondhu" && <Badge className="text-[10px] gap-1" style={{ backgroundColor: ICON_COLORS.farm, color: "white" }}><ShieldCheck className="h-3 w-3" />FarmBondhu Official</Badge>}
                {product.is_verified_seller && product.seller !== "FarmBondhu" && <Badge className="text-[10px] gap-1" style={{ backgroundColor: ICON_COLORS.marketplace, color: "white" }}><CheckCircle className="h-3 w-3" />FarmBondhu Verified</Badge>}
              </div>
              <div className="flex items-baseline gap-3">
                <p className="text-3xl font-bold" style={{ color: ICON_COLORS.health }}>৳{product.price}</p>
                {product.originalPrice && <p className="text-lg text-muted-foreground line-through">৳{product.originalPrice}</p>}
                <span className="text-sm text-muted-foreground">/{product.unit}</span>
              </div>
              <div className="flex items-center border rounded-md w-fit">
                <Button variant="ghost" size="sm" onClick={() => setQty(Math.max(1, qty - 1))}>-</Button>
                <span className="px-4 font-medium text-foreground">{qty}</span>
                <Button variant="ghost" size="sm" onClick={() => setQty(qty + 1)}>+</Button>
              </div>
              <div className="flex gap-3 flex-wrap">
                <Button variant="outline" className="flex-1" style={{ borderColor: ICON_COLORS.marketplace, color: ICON_COLORS.marketplace }} onClick={() => { addItem(product, qty); toast.success(`${product.name} added to cart`); }}><ShoppingCart className="h-4 w-4 mr-2" />Add to Cart</Button>
                <Button className="flex-1 text-white" style={{ backgroundColor: ICON_COLORS.learning }} onClick={() => { addItem(product, qty); navigate("/checkout"); }}><Zap className="h-4 w-4 mr-2" />Buy Now — ৳{(product.price * qty).toLocaleString()}</Button>
              </div>

              {/* Wholesale Pricing — only visible to wholesalers */}
              {isWholesaler && hasWholesale && (
                <div className="rounded-lg border-2 p-4 space-y-2" style={{ borderColor: ICON_COLORS.finance, backgroundColor: `${ICON_COLORS.finance}08` }}>
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4" style={{ color: ICON_COLORS.finance }} />
                    <span className="font-semibold text-sm text-foreground">Wholesale Price Available</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold" style={{ color: ICON_COLORS.finance }}>৳{product.wholesale_price}</span>
                    <span className="text-sm text-muted-foreground">/{product.unit}</span>
                    <span className="text-xs text-muted-foreground">(min {product.wholesale_min_qty} units)</span>
                  </div>
                  {wholesaleSavings > 0 && (
                    <p className="text-xs font-medium" style={{ color: ICON_COLORS.farm }}>You save {wholesaleSavings}% vs retail price</p>
                  )}
                  <Button
                    className="w-full text-white mt-1"
                    style={{ backgroundColor: ICON_COLORS.finance }}
                    onClick={() => {
                      const wQty = product.wholesale_min_qty!;
                      addItem({ ...product, price: product.wholesale_price! }, wQty);
                      navigate("/checkout");
                    }}
                  >
                    <ShoppingBag className="h-4 w-4 mr-2" />
                    Buy Wholesale — ৳{(product.wholesale_price! * product.wholesale_min_qty!).toLocaleString()}
                  </Button>
                </div>
              )}

              {!isSeller && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    if (!isAuthenticated) { toast.error("Please login to chat with seller"); return; }
                    navigate(`/marketplace/chat/new?seller=${product.sellerId}&product=${product.id}`);
                  }}
                >
                  <MessageCircle className="h-4 w-4 mr-2" />Chat with Seller
                </Button>
              )}
            </CardContent>
          </div>
        </Card>
      </motion.div>

      {/* Product Description Tabs */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="shadow-card">
          <Tabs defaultValue="description">
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
              <TabsTrigger value="description" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-6 py-3">Description</TabsTrigger>
              <TabsTrigger value="specifications" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-6 py-3">Specifications</TabsTrigger>
            </TabsList>
            <TabsContent value="description" className="p-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">About this product</h3>
                <p className="text-muted-foreground leading-relaxed">{product.description || "No description available for this product."}</p>
                <Separator />
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Category</p>
                    <p className="font-medium text-foreground">{product.category}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Availability</p>
                    <p className="font-medium" style={{ color: product.stock > 0 ? ICON_COLORS.farm : ICON_COLORS.health }}>{product.stock > 0 ? "In Stock" : "Out of Stock"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Delivery</p>
                    <p className="font-medium text-foreground">{product.freeDelivery ? "Free Delivery" : "Standard Shipping"}</p>
                  </div>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="specifications" className="p-6">
              <div className="space-y-3">
                {[
                  ["Category", product.category],
                  ["Unit", product.unit],
                  ["Stock", `${product.stock} available`],
                  ["Rating", `${product.rating} / 5`],
                  ["Reviews", `${product.reviewCount || 0} reviews`],
                  ["Location", product.location],
                  ["Free Delivery", product.freeDelivery ? "Yes" : "No"],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between py-2 border-b border-border last:border-0">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium text-foreground">{value}</span>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </Card>
      </motion.div>

      {/* Seller Info Card */}
      {shop && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="shadow-card p-6">
            <div className="flex items-start gap-4 flex-wrap">
              <div className="h-12 w-12 rounded-full flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: ICON_COLORS.marketplace }}>
                {shop.shop_name?.charAt(0)?.toUpperCase() || "S"}
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-semibold text-foreground">{shop.shop_name}</h3>
                  {shop.is_verified && (
                    <Badge className="text-[10px] gap-1" style={{ backgroundColor: ICON_COLORS.marketplace, color: "white" }}>
                      <CheckCircle className="h-3 w-3" />Verified
                    </Badge>
                  )}
                </div>
                {shop.description && <p className="text-sm text-muted-foreground">{shop.description}</p>}
              </div>
            </div>
            <Separator className="my-4" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" />
                <span>{shop.location || "N/A"}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <ShoppingBag className="h-4 w-4 shrink-0" />
                <span>{shop.total_products} products</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <BarChart3 className="h-4 w-4 shrink-0" />
                <span>৳{Number(shop.total_sales).toLocaleString()} sales</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <CalendarDays className="h-4 w-4 shrink-0" />
                <span>Since {new Date(shop.created_date).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}</span>
              </div>
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
