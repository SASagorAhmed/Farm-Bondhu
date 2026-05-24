import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { moduleCachePolicy, queryKeys } from "@/lib/queryClient";
import { MARKETPLACE_CATEGORIES, resolveCategorySlug } from "@/lib/marketplaceCategories";
import { dbToProduct } from "@/lib/marketplaceProduct";

export default function Categories() {
  const navigate = useNavigate();

  const { data: products = [] } = useQuery({
    queryKey: queryKeys().products(),
    staleTime: moduleCachePolicy.marketplace.staleTime,
    gcTime: moduleCachePolicy.marketplace.gcTime,
    refetchOnMount: true,
    queryFn: async () => {
      const { data } = await api.from("products").select("*");
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

  return (
    <div className="space-y-6 max-w-5xl mx-auto overflow-hidden">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Categories</h1>
          <p className="text-muted-foreground mt-1">Browse products by category</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {MARKETPLACE_CATEGORIES.map((cat, i) => (
          <motion.div
            key={cat.slug}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
          >
            <Card
              className="cursor-pointer hover:shadow-lg transition-all group border-border/50"
              onClick={() => navigate(`/marketplace?lane=${cat.lane}&category=${cat.slug}`)}
            >
              <CardContent className="p-5 text-center">
                <div
                  className="h-14 w-14 rounded-2xl flex items-center justify-center mx-auto mb-3 transition-transform group-hover:scale-110"
                  style={{ backgroundColor: `${cat.color}15` }}
                >
                  <cat.icon className="h-6 w-6" style={{ color: cat.color }} />
                </div>
                <p className="font-medium text-foreground text-sm">{cat.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {categoryCounts[cat.slug] ?? 0} products
                </p>
                {cat.lane === "pharmacy" && (
                  <p className="text-[10px] mt-1 font-medium text-rose-500">Pharmacy</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
