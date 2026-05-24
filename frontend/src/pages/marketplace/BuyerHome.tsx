import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { api } from "@/api/client";
import { ArrowRight, Pill, Wheat } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { moduleCachePolicy, queryKeys } from "@/lib/queryClient";
import { MARKETPLACE_THEME } from "@/lib/marketplaceTheme";
import {
  BUYER_HOME_CATEGORIES,
  getLaneForProductCategory,
  resolveCategorySlug,
} from "@/lib/marketplaceCategories";
import { dbToProduct, MarketplaceProduct } from "@/lib/marketplaceProduct";
import MarketplaceHeroCarousel from "@/components/marketplace/MarketplaceHeroCarousel";
import TrustBadgesRow from "@/components/marketplace/TrustBadgesRow";
import FlashSaleSection from "@/components/marketplace/FlashSaleSection";
import MarketplaceProductCard from "@/components/marketplace/MarketplaceProductCard";

function ProductRail({
  title,
  icon: Icon,
  iconColor,
  products,
  viewAllHref,
  onNavigate,
  onAddToCart,
  onBuyNow,
}: {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  products: MarketplaceProduct[];
  viewAllHref: string;
  onNavigate: (path: string) => void;
  onAddToCart: (p: MarketplaceProduct) => void;
  onBuyNow: (p: MarketplaceProduct) => void;
}) {
  if (products.length === 0) return null;
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5" style={{ color: iconColor }} />
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        </div>
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => onNavigate(viewAllHref)}>
          View All <ArrowRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {products.slice(0, 8).map((p) => (
          <MarketplaceProductCard
            key={p.id}
            product={p}
            onOpen={() => onNavigate(`/marketplace/${p.id}`)}
            onAddToCart={() => onAddToCart(p)}
            onBuyNow={() => onNavigate("/checkout")}
          />
        ))}
      </div>
    </section>
  );
}

export default function BuyerHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addItem } = useCart();

  const { data: products = [] } = useQuery({
    queryKey: queryKeys().products(),
    staleTime: moduleCachePolicy.marketplace.staleTime,
    gcTime: moduleCachePolicy.marketplace.gcTime,
    refetchOnMount: true,
    queryFn: async () => {
      const { data } = await api.from("products").select("*").order("created_at", { ascending: false });
      return (data || []).map(dbToProduct);
    },
  });

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of products) {
      const slug = resolveCategorySlug(p.category) || String(p.category);
      counts[slug] = (counts[slug] || 0) + 1;
    }
    return counts;
  }, [products]);

  const pharmacyProducts = useMemo(
    () => products.filter((p) => getLaneForProductCategory(p.category) === "pharmacy"),
    [products]
  );
  const farmProducts = useMemo(
    () => products.filter((p) => getLaneForProductCategory(p.category) === "farm"),
    [products]
  );

  return (
    <div className="space-y-8 max-w-6xl mx-auto max-w-full overflow-hidden">
      <MarketplaceHeroCarousel onNavigate={navigate} />
      <TrustBadgesRow />

      <FlashSaleSection
        products={products}
        onNavigate={navigate}
        onAddToCart={(p) => addItem(p)}
        onBuyNow={() => navigate("/checkout")}
      />

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Shop by Category</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate("/buyer/categories")} className="text-muted-foreground">
            View All <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {BUYER_HOME_CATEGORIES.map((cat) => (
            <Card
              key={cat.slug}
              className="cursor-pointer hover:shadow-md transition-all group border-border/50"
              onClick={() => navigate(`/marketplace?lane=${cat.lane}&category=${cat.slug}`)}
            >
              <CardContent className="p-4 text-center">
                <div
                  className="h-12 w-12 rounded-xl flex items-center justify-center mx-auto mb-2 transition-transform group-hover:scale-110"
                  style={{ backgroundColor: `${cat.color}15` }}
                >
                  <cat.icon className="h-5 w-5" style={{ color: cat.color }} />
                </div>
                <p className="text-sm font-medium text-foreground">{cat.label}</p>
                {categoryCounts[cat.slug] != null && (
                  <p className="text-xs text-muted-foreground mt-0.5">{categoryCounts[cat.slug]} products</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <ProductRail
        title="Pharmacy"
        icon={Pill}
        iconColor={MARKETPLACE_THEME.accent}
        products={pharmacyProducts}
        viewAllHref="/marketplace?lane=pharmacy"
        onNavigate={navigate}
        onAddToCart={(p) => addItem(p)}
        onBuyNow={() => navigate("/checkout")}
      />

      <ProductRail
        title="Farm Supplies"
        icon={Wheat}
        iconColor={MARKETPLACE_THEME.trustIcon}
        products={farmProducts}
        viewAllHref="/marketplace?lane=farm"
        onNavigate={navigate}
        onAddToCart={(p) => addItem(p)}
        onBuyNow={() => navigate("/checkout")}
      />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl p-4 border border-border/50 bg-muted/20 text-center text-sm text-muted-foreground"
      >
        Welcome back, {user?.name?.split(" ")[0] || "Buyer"} — everything for your farm and animal health in one place.
      </motion.div>
    </div>
  );
}
