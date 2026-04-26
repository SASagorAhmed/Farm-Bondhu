import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { api } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { Star, MessageSquare, ThumbsUp, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { ICON_COLORS } from "@/lib/iconColors";
import StatCard from "@/components/dashboard/StatCard";

export default function Reviews() {
  const { user } = useAuth();
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    api.from("products").select("*").eq("seller_id", user.id).then(({ data }) => { if (data) setProducts(data); });
  }, [user]);

  const totalReviews = products.reduce((s, p) => s + (p.review_count || 0), 0);
  const avgRating = products.length > 0 ? (products.reduce((s: number, p: any) => s + Number(p.rating), 0) / products.length).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Reviews</h1>
        <p className="text-muted-foreground mt-1">Customer feedback and ratings for your products</p>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Average Rating" value={`⭐ ${avgRating}`} icon={<Star className="h-5 w-5" />} iconColor={ICON_COLORS.finance} index={0} />
        <StatCard title="Total Reviews" value={totalReviews} icon={<MessageSquare className="h-5 w-5" />} iconColor={ICON_COLORS.marketplace} index={1} />
        <StatCard title="Products" value={products.length} icon={<ThumbsUp className="h-5 w-5" />} iconColor={ICON_COLORS.farm} index={2} />
        <StatCard title="Response Rate" value="—" icon={<TrendingUp className="h-5 w-5" />} iconColor={ICON_COLORS.vet} index={3} />
      </div>

      <Card className="shadow-card overflow-hidden">
        <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.finance}, ${ICON_COLORS.marketplace})` }} />
        <CardHeader><CardTitle className="text-lg font-display">Product Ratings</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {products.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No products yet. Add products to see reviews.</p>
          ) : (
            products.map(p => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg bg-accent/30">
                <div className="flex-1"><p className="font-medium text-foreground">{p.name}</p><p className="text-xs text-muted-foreground">{p.review_count || 0} reviews</p></div>
                <div className="flex items-center gap-1">
                  {[1,2,3,4,5].map(s => <Star key={s} className="h-3.5 w-3.5" fill={s <= Math.round(Number(p.rating)) ? ICON_COLORS.finance : "transparent"} style={{ color: ICON_COLORS.finance }} />)}
                  <span className="text-sm font-medium text-foreground ml-1">{Number(p.rating).toFixed(1)}</span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
