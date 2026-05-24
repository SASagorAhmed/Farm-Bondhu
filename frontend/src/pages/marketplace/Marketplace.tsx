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
  MarketplaceLane,
  getCategoriesForLane,
  resolveCategorySlug,
  productMatchesLane,
  sortProducts,
  SortOption,
} from "@/lib/marketplaceCategories";
import { dbToProduct, MarketplaceProduct } from "@/lib/marketplaceProduct";
import MarketplaceProductCard from "@/components/marketplace/MarketplaceProductCard";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { moduleCachePolicy, queryKeys } from "@/lib/queryClient";

const LANE_TABS: { value: MarketplaceLane; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pharmacy", label: "Pharmacy" },
  { value: "farm", label: "Farm Supplies" },
];

export default function Marketplace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [lane, setLane] = useState<MarketplaceLane>(() => {
    const l = searchParams.get("lane");
    return l === "pharmacy" || l === "farm" ? l : "all";
  });
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

  const queryClient = useQueryClient();
  const { addItem, itemCount } = useCart();
  const navigate = useNavigate();
  const { user } = useAuth();

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
    if (urlLane === "pharmacy" || urlLane === "farm" || urlLane === "all") setLane(urlLane);
    if (urlCat) setCategory(urlCat);
  }, [searchParams]);

  const laneCategories = useMemo(() => getCategoriesForLane(lane), [lane]);

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

  const updateLane = (next: MarketplaceLane) => {
    setLane(next);
    setCategory("all");
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
            <p className="text-muted-foreground mt-1">Farm supplies, pharmacy & livestock</p>
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

      <Tabs value={lane} onValueChange={(v) => updateLane(v as MarketplaceLane)}>
        <TabsList>
          {LANE_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

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

      <div className="flex flex-wrap gap-4 items-center">
        <Tabs value={category} onValueChange={updateCategory}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="all" className="text-xs">
              All
            </TabsTrigger>
            {laneCategories.map((c) => (
              <TabsTrigger key={c.slug} value={c.slug} className="text-xs">
                {c.label}
              </TabsTrigger>
            ))}
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

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((p, i) => (
          <motion.div key={p.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}>
            <MarketplaceProductCard
              product={p}
              onOpen={() => navigate(`/marketplace/${p.id}`)}
              onAddToCart={() => addItem(p)}
              onBuyNow={() => navigate("/checkout")}
            />
          </motion.div>
        ))}
      </div>
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
