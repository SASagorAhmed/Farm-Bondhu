import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCart } from "@/contexts/CartContext";
import { api } from "@/api/client";
import { Product } from "@/data/mockData";
import { ShoppingCart, Star, Search, MapPin, Truck, Zap, ArrowLeft, ShieldCheck, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ICON_COLORS } from "@/lib/iconColors";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { moduleCachePolicy, queryKeys } from "@/lib/queryClient";

const categories = ["all", "feed", "medicine", "vaccines", "equipment", "livestock", "eggs", "meat", "milk", "produce"] as const;
const catLabels: Record<string, string> = { all: "All", feed: "Feed", medicine: "Medicine", vaccines: "Vaccines", equipment: "Equipment", livestock: "Livestock", eggs: "Eggs", meat: "Meat", milk: "Milk", produce: "Produce" };

function dbToProduct(row: any): Product & { is_verified_seller?: boolean } {
  return { id: row.id, name: row.name, category: row.category, price: Number(row.price), originalPrice: row.original_price ? Number(row.original_price) : undefined, unit: row.unit, image: row.image, seller: row.seller_name, sellerId: row.seller_id, rating: Number(row.rating), reviewCount: row.review_count, stock: row.stock, description: row.description, location: row.location, freeDelivery: row.free_delivery, is_verified_seller: row.is_verified_seller };
}

export default function Marketplace() {
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const queryClient = useQueryClient();
  const { addItem, itemCount } = useCart();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: cachedProducts = [] } = useQuery({
    queryKey: queryKeys().products(),
    staleTime: moduleCachePolicy.marketplace.staleTime,
    gcTime: moduleCachePolicy.marketplace.gcTime,
    queryFn: async () => {
      const { data } = await api.from("products").select("*").order("created_at", { ascending: false });
      return (data || []).map(dbToProduct);
    },
  });
  useEffect(() => {
    setProducts(cachedProducts);
  }, [cachedProducts]);

  useEffect(() => {
    const channel = api
      .channel("marketplace-products-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
        queryClient.invalidateQueries({ queryKey: queryKeys().products() });
      })
      .subscribe();
    return () => {
      api.removeChannel(channel);
    };
  }, [queryClient]);

  const filtered = products.filter(p => {
    if (category !== "all" && p.category !== category) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {user?.primaryRole !== "buyer" && (
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0"><ArrowLeft className="h-5 w-5" /></Button>
          )}
          <div><h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Marketplace</h1><p className="text-muted-foreground mt-1">Buy farm supplies, medicine and livestock</p></div>
        </div>
        <Button variant="outline" className="relative" onClick={() => navigate("/cart")}>
          <ShoppingCart className="h-4 w-4 mr-2" style={{ color: ICON_COLORS.cart }} /> Cart
          {itemCount > 0 && <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs" style={{ backgroundColor: ICON_COLORS.health, color: "white" }}>{itemCount}</Badge>}
        </Button>
      </motion.div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
        <Tabs value={category} onValueChange={setCategory}><TabsList className="flex-wrap">{categories.map(c => <TabsTrigger key={c} value={c} className="text-xs">{catLabels[c]}</TabsTrigger>)}</TabsList></Tabs>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((p, i) => {
          const discount = p.originalPrice ? Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100) : 0;
          return (
            <motion.div key={p.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="shadow-card hover:shadow-elevated transition-all duration-300 overflow-hidden group cursor-pointer" onClick={() => navigate(`/marketplace/${p.id}`)}>
                <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.marketplace}, ${ICON_COLORS.vet})` }} />
                <div className="relative h-44 bg-accent/30 flex items-center justify-center">
                  <img src={p.image} alt={p.name} className="h-28 w-28 object-contain opacity-50 group-hover:scale-110 transition-transform duration-300" />
                  {discount > 0 && <Badge className="absolute top-2 left-2 text-xs font-bold" style={{ backgroundColor: ICON_COLORS.health, color: "white" }}>-{discount}%</Badge>}
                  {p.freeDelivery && <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold" style={{ backgroundColor: ICON_COLORS.marketplace, color: "white" }}><Truck className="h-3 w-3" /> FREE DELIVERY</div>}
                </div>
                <CardContent className="p-4 space-y-2">
                  <Badge variant="outline" className="text-xs mb-1">{catLabels[p.category] || p.category}</Badge>
                  <h3 className="font-display font-bold text-foreground leading-tight line-clamp-2 text-sm">{p.name}</h3>
                  <div className="flex items-baseline gap-2">
                    <p className="text-lg font-bold" style={{ color: ICON_COLORS.health }}>৳{p.price}</p>
                    {p.originalPrice && <p className="text-sm text-muted-foreground line-through">৳{p.originalPrice}</p>}
                    <span className="text-xs text-muted-foreground">/{p.unit}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-0.5">{[1,2,3,4,5].map(star => <Star key={star} className="h-3 w-3" style={{ color: star <= Math.floor(p.rating) ? ICON_COLORS.finance : "#D1D5DB", fill: star <= Math.floor(p.rating) ? ICON_COLORS.finance : "none" }} />)}</div>
                    <span className="text-xs">{p.rating} ({p.reviewCount || 0})</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
                    <MapPin className="h-3 w-3" />{p.location} • {p.seller}
                    {(p as any).seller === "FarmBondhu" && <Badge className="text-[9px] gap-0.5 px-1.5 py-0" style={{ backgroundColor: ICON_COLORS.farm, color: "white" }}><ShieldCheck className="h-2.5 w-2.5" />Official</Badge>}
                    {(p as any).is_verified_seller && (p as any).seller !== "FarmBondhu" && <Badge className="text-[9px] gap-0.5 px-1.5 py-0" style={{ backgroundColor: ICON_COLORS.marketplace, color: "white" }}><CheckCircle className="h-2.5 w-2.5" />Verified</Badge>}
                  </div>
                  <div className="flex gap-2 mt-1">
                    <Button size="sm" variant="outline" className="flex-1" style={{ borderColor: ICON_COLORS.marketplace, color: ICON_COLORS.marketplace }} onClick={(e) => { e.stopPropagation(); addItem(p); toast.success(`${p.name} added to cart`); }}><ShoppingCart className="h-3.5 w-3.5 mr-1" /> Cart</Button>
                    <Button size="sm" className="flex-1 text-white" style={{ backgroundColor: ICON_COLORS.learning }} onClick={(e) => { e.stopPropagation(); addItem(p); navigate("/checkout"); }}><Zap className="h-3.5 w-3.5 mr-1" /> Buy Now</Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
      {filtered.length === 0 && <p className="text-center text-muted-foreground py-12">No products found</p>}
    </div>
  );
}
