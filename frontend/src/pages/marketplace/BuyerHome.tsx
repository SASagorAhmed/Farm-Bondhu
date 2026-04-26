import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { api } from "@/api/client";
import { Product } from "@/data/mockData";
import {
  ShoppingBag, Wheat, Pill, Bug, Wrench, Heart,
  ArrowRight, Shield, Zap, Star, TrendingUp, ShieldCheck, CheckCircle,
} from "lucide-react";
import { motion } from "framer-motion";
import { ICON_COLORS } from "@/lib/iconColors";

const CATEGORIES = [
  { name: "Feed", icon: Wheat, color: ICON_COLORS.farm, count: 0 },
  { name: "Medicine", icon: Pill, color: ICON_COLORS.health, count: 0 },
  { name: "Supplements", icon: Heart, color: ICON_COLORS.stethoscope, count: 0 },
  { name: "Equipment", icon: Wrench, color: ICON_COLORS.finance, count: 0 },
  { name: "Pest Control", icon: Bug, color: ICON_COLORS.learning, count: 0 },
];

function dbToProduct(row: any): Product & { is_verified_seller?: boolean } {
  return { id: row.id, name: row.name, category: row.category, price: Number(row.price), originalPrice: row.original_price ? Number(row.original_price) : undefined, unit: row.unit, image: row.image, seller: row.seller_name, sellerId: row.seller_id, rating: Number(row.rating), reviewCount: row.review_count, stock: row.stock, description: row.description, location: row.location, freeDelivery: row.free_delivery, is_verified_seller: row.is_verified_seller };
}

export default function BuyerHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addItem } = useCart();
  const [featured, setFeatured] = useState<Product[]>([]);

  useEffect(() => {
    api.from("products").select("*").order("rating", { ascending: false }).limit(4).then(({ data }) => {
      if (data) setFeatured(data.map(dbToProduct));
    });
  }, []);

  return (
    <div className="space-y-8 max-w-6xl mx-auto max-w-full overflow-hidden">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl p-6 md:p-8" style={{ background: `linear-gradient(135deg, ${ICON_COLORS.cart}18, ${ICON_COLORS.cart}08)` }}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Welcome back, {user?.name?.split(" ")[0] || "Buyer"} 👋</h1>
            <p className="text-muted-foreground mt-1">Find everything your farm needs — feed, medicine, equipment & more.</p>
          </div>
          <Button onClick={() => navigate("/marketplace")} className="shrink-0" style={{ backgroundColor: ICON_COLORS.cart }}><ShoppingBag className="h-4 w-4 mr-2" /> Browse Marketplace</Button>
        </div>
      </motion.div>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Shop by Category</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate("/buyer/categories")} className="text-muted-foreground">View All <ArrowRight className="h-3.5 w-3.5 ml-1" /></Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {CATEGORIES.map((cat) => (
            <Card key={cat.name} className="cursor-pointer hover:shadow-md transition-all group border-border/50" onClick={() => navigate(`/marketplace?category=${cat.name}`)}>
              <CardContent className="p-4 text-center">
                <div className="h-12 w-12 rounded-xl flex items-center justify-center mx-auto mb-2 transition-transform group-hover:scale-110" style={{ backgroundColor: `${cat.color}15` }}>
                  <cat.icon className="h-5 w-5" style={{ color: cat.color }} />
                </div>
                <p className="text-sm font-medium text-foreground">{cat.name}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2"><TrendingUp className="h-5 w-5" style={{ color: ICON_COLORS.cart }} /><h2 className="text-lg font-semibold text-foreground">Featured Products</h2></div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/marketplace")} className="text-muted-foreground">See All <ArrowRight className="h-3.5 w-3.5 ml-1" /></Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {featured.map((p) => (
            <Card key={p.id} className="overflow-hidden cursor-pointer hover:shadow-md transition-all border-border/50" onClick={() => navigate(`/marketplace/${p.id}`)}>
              <div className="h-36 bg-muted flex items-center justify-center"><ShoppingBag className="h-10 w-10 text-muted-foreground/30" /></div>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center gap-1 flex-wrap">
                  <p className="text-sm font-medium text-foreground line-clamp-1">{p.name}</p>
                  {p.seller === "FarmBondhu" && <ShieldCheck className="h-3.5 w-3.5 shrink-0" style={{ color: ICON_COLORS.farm }} />}
                  {(p as any).is_verified_seller && p.seller !== "FarmBondhu" && <CheckCircle className="h-3.5 w-3.5 shrink-0" style={{ color: ICON_COLORS.marketplace }} />}
                </div>
                <div className="flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /><span className="text-xs text-muted-foreground">{p.rating}</span></div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground">৳{p.price}</span>
                  {p.originalPrice && <span className="text-xs text-muted-foreground line-through">৳{p.originalPrice}</span>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 text-xs h-8" onClick={(e) => { e.stopPropagation(); addItem(p); }}>Add to Cart</Button>
                  <Button size="sm" className="flex-1 text-xs h-8" style={{ backgroundColor: ICON_COLORS.learning }} onClick={(e) => { e.stopPropagation(); addItem(p); navigate("/checkout"); }}><Zap className="h-3 w-3 mr-1" /> Buy</Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {featured.length === 0 && <p className="text-muted-foreground col-span-full text-center py-8">No products available yet</p>}
        </div>
      </section>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="border-border/50 overflow-hidden">
          <CardContent className="p-6 flex flex-col md:flex-row items-center gap-4">
            <div className="h-14 w-14 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: `hsl(262, 83%, 58%, 0.12)` }}><Shield className="h-7 w-7" style={{ color: "hsl(262, 83%, 58%)" }} /></div>
            <div className="flex-1 text-center md:text-left"><h3 className="font-semibold text-foreground">Need more features?</h3><p className="text-sm text-muted-foreground">Unlock Farm Management, Vet Services, or become a Seller through the Access Center.</p></div>
            <Button variant="outline" onClick={() => navigate("/access-center")} className="shrink-0">Open Access Center <ArrowRight className="h-4 w-4 ml-1" /></Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
