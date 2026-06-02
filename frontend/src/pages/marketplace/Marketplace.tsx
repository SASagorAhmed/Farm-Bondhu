import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useCart } from "@/contexts/CartContext";
import { api } from "@/api/client";
import { ShoppingCart, Search, ArrowLeft } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { MARKETPLACE_THEME } from "@/lib/marketplaceTheme";
import {
  marketplaceFilterTabsListClass,
  marketplaceFilterTabsListStyle,
  marketplaceFilterTabsTriggerClass,
  marketplaceCategoryFilterTabsTriggerClass,
} from "@/components/marketplace/marketplaceCalloutStyles";
import {
  MarketplaceLane,
  getCategoriesForLane,
  normalizeLaneSlug,
  resolveCategorySlug,
  productMatchesLane,
  sortProducts,
  SortOption,
} from "@/lib/marketplaceCategories";
import { dbToProduct, isFlashSaleActive, MarketplaceProduct } from "@/lib/marketplaceProduct";
import MarketplaceProductCard from "@/components/marketplace/MarketplaceProductCard";
import MarketplaceBrowseBannerCarousel from "@/components/marketplace/MarketplaceBrowseBannerCarousel";
import FlashSaleSection from "@/components/marketplace/FlashSaleSection";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { moduleCachePolicy, queryKeys } from "@/lib/queryClient";

const LANE_TABS: { value: MarketplaceLane; label: string }[] = [
  { value: "all", label: "All" },
  { value: "medibondhu", label: "MediBondhu Pharmacy" },
  { value: "vetbondhu", label: "VetBondhu Pharmacy" },
  { value: "farm", label: "Farm Supplies" },
  { value: "pet", label: "Pet Supplies" },
  { value: "livestock_dairy", label: "Livestock & Dairy" },
  { value: "farm_machinery", label: "Farm Machinery" },
];

const SUBCATEGORY_VISIBLE_LIMIT = 8;

export default function Marketplace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [lane, setLane] = useState<MarketplaceLane>(() => normalizeLaneSlug(searchParams.get("lane")));
  const [category, setCategory] = useState(() => {
    const fromUrl = resolveCategorySlug(searchParams.get("category"));
    return fromUrl || "all";
  });
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>(() => {
    const s = searchParams.get("sort");
    if (s === "price_asc" || s === "price_desc" || s === "rating" || s === "newest") return s;
    return "newest";
  });
  const [inStockOnly, setInStockOnly] = useState(false);
  const [freeDeliveryOnly, setFreeDeliveryOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);

  const queryClient = useQueryClient();
  const { addItem, itemCount } = useCart();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: products = [] } = useQuery({
    queryKey: queryKeys().products(),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    gcTime: moduleCachePolicy.marketplace.gcTime,
    refetchOnMount: true,
    queryFn: async () => {
      const { data } = await api.from("products").select("*").order("created_at", { ascending: false });
      return (data || []).map(dbToProduct);
    },
  });

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

  useEffect(() => {
    const urlLane = searchParams.get("lane");
    const urlCat = resolveCategorySlug(searchParams.get("category"));
    setLane(normalizeLaneSlug(urlLane));
    if (urlCat) setCategory(urlCat);
  }, [searchParams]);

  const laneCategories = useMemo(() => getCategoriesForLane(lane), [lane]);

  useEffect(() => {
    setShowAllCategories(false);
  }, [lane]);

  const visibleLaneCategories = useMemo(() => {
    if (showAllCategories || laneCategories.length <= SUBCATEGORY_VISIBLE_LIMIT) {
      return laneCategories;
    }

    const firstCategories = laneCategories.slice(0, SUBCATEGORY_VISIBLE_LIMIT);
    const selectedCategory = laneCategories.find((c) => c.slug === category);
    if (!selectedCategory || firstCategories.some((c) => c.slug === selectedCategory.slug)) {
      return firstCategories;
    }

    return [...firstCategories.slice(0, SUBCATEGORY_VISIBLE_LIMIT - 1), selectedCategory];
  }, [category, laneCategories, showAllCategories]);

  const hiddenCategoryCount = Math.max(laneCategories.length - visibleLaneCategories.length, 0);

  const filtered = useMemo(() => {
    let list = products.filter((p) => {
      if (!productMatchesLane(p.category, lane)) return false;
      if (category !== "all") {
        const slug = resolveCategorySlug(p.category);
        if (slug !== category && p.category !== category) return false;
      }
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (inStockOnly && p.stock <= 0) return false;
      if (freeDeliveryOnly && !p.freeDelivery) return false;
      if (verifiedOnly && !p.is_verified_seller && p.seller !== "FarmBondhu") return false;
      return true;
    });
    return sortProducts(list, sort);
  }, [products, lane, category, search, sort, inStockOnly, freeDeliveryOnly, verifiedOnly]);

  const hasActiveFlashDeals = useMemo(
    () => filtered.some((p) => isFlashSaleActive(p)),
    [filtered]
  );

  const updateLane = (next: MarketplaceLane) => {
    setLane(next);
    setCategory("all");
    setShowAllCategories(false);
    const params = new URLSearchParams(searchParams);
    if (next === "all") params.delete("lane");
    else params.set("lane", next);
    params.delete("category");
    setSearchParams(params, { replace: true });
  };

  const updateCategory = (next: string) => {
    setCategory(next);
    const params = new URLSearchParams(searchParams);
    if (next === "all") params.delete("category");
    else params.set("category", next);
    setSearchParams(params, { replace: true });
  };

  const hasActiveFilters =
    lane !== "all" ||
    category !== "all" ||
    Boolean(search) ||
    inStockOnly ||
    freeDeliveryOnly ||
    verifiedOnly;

  const clearFilters = () => {
    setLane("all");
    setCategory("all");
    setSearch("");
    setInStockOnly(false);
    setFreeDeliveryOnly(false);
    setVerifiedOnly(false);
    setShowAllCategories(false);
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {user?.primaryRole !== "buyer" && (
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Marketplace</h1>
            <p className="text-muted-foreground mt-1">Pharmacy, farm, pet, livestock & machinery — all in one place</p>
          </div>
        </div>
        <Button variant="outline" className="relative" onClick={() => navigate("/cart")}>
          <ShoppingCart className="h-4 w-4 mr-2" style={{ color: MARKETPLACE_THEME.primary }} /> Cart
          {itemCount > 0 && (
            <Badge
              className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
              style={{ backgroundColor: MARKETPLACE_THEME.accent, color: "white" }}
            >
              {itemCount}
            </Badge>
          )}
        </Button>
      </motion.div>

      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="marketplaceSearch"
            name="marketplaceSearch"
            placeholder="Search in marketplace..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
          <SelectTrigger className="w-full lg:w-[180px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="price_asc">Price: Low to High</SelectItem>
            <SelectItem value="price_desc">Price: High to Low</SelectItem>
            <SelectItem value="rating">Top Rated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <MarketplaceBrowseBannerCarousel onNavigate={(href) => navigate(href)} />

      <Tabs value={lane} onValueChange={(v) => updateLane(v as MarketplaceLane)}>
        <TabsList className={`${marketplaceFilterTabsListClass} flex-wrap h-auto`} style={marketplaceFilterTabsListStyle}>
          {LANE_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className={marketplaceFilterTabsTriggerClass}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap gap-4 items-center">
        <Tabs value={category} onValueChange={updateCategory}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="all" className={`${marketplaceCategoryFilterTabsTriggerClass} text-xs`}>
              All
            </TabsTrigger>
            {visibleLaneCategories.map((c) => (
              <TabsTrigger key={c.slug} value={c.slug} className={`${marketplaceCategoryFilterTabsTriggerClass} text-xs`}>
                {c.label}
              </TabsTrigger>
            ))}
            {hiddenCategoryCount > 0 && (
              <button
                type="button"
                className={`${marketplaceCategoryFilterTabsTriggerClass} border border-[#E91E8C]/30 bg-background/80 text-xs`}
                onClick={() => setShowAllCategories(true)}
                aria-expanded={showAllCategories}
              >
                +{hiddenCategoryCount} more
              </button>
            )}
            {showAllCategories && laneCategories.length > SUBCATEGORY_VISIBLE_LIMIT && (
              <button
                type="button"
                className={`${marketplaceCategoryFilterTabsTriggerClass} border border-[#E91E8C]/30 bg-background/80 text-xs`}
                onClick={() => setShowAllCategories(false)}
                aria-expanded={showAllCategories}
              >
                Less
              </button>
            )}
          </TabsList>
        </Tabs>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <Checkbox id="inStock" checked={inStockOnly} onCheckedChange={(v) => setInStockOnly(Boolean(v))} />
          <Label htmlFor="inStock" className="cursor-pointer">In stock</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="freeDel" checked={freeDeliveryOnly} onCheckedChange={(v) => setFreeDeliveryOnly(Boolean(v))} />
          <Label htmlFor="freeDel" className="cursor-pointer">Free delivery</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="verified" checked={verifiedOnly} onCheckedChange={(v) => setVerifiedOnly(Boolean(v))} />
          <Label htmlFor="verified" className="cursor-pointer">Verified seller</Label>
        </div>
      </div>

      <FlashSaleSection
        products={filtered}
        maxItems={12}
        showViewAll={false}
        onNavigate={navigate}
        onAddToCart={(p) => addItem(p)}
        onBuyNow={() => navigate("/checkout")}
      />

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">All Products</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length > 0
              ? hasActiveFlashDeals
                ? `${filtered.length} listings — includes flash deals and regular products`
                : `${filtered.length} listings`
              : "Browse the full marketplace catalog"}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3) }}
            >
              <MarketplaceProductCard
                product={p}
                onOpen={() => navigate(`/marketplace/${p.id}`)}
                onAddToCart={() => addItem(p)}
                onBuyNow={() => navigate("/checkout")}
              />
            </motion.div>
          ))}
        </div>
      </section>

      {filtered.length === 0 && (
        <div className="text-center py-12 space-y-3">
          <p className="text-muted-foreground">
            {products.length === 0 ? "No products found" : "No products match your filters"}
          </p>
          {products.length > 0 && hasActiveFilters && (
            <Button variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
