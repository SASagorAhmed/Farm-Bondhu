import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, ShoppingBag, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ICON_COLORS } from "@/lib/iconColors";

export default function Wishlist() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 max-w-3xl mx-auto overflow-hidden">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">My Wishlist</h1>
          <p className="text-muted-foreground mt-1">Save products you love for later</p>
        </div>
      </motion.div>

      <Card className="border-border/50">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div
            className="h-20 w-20 rounded-full flex items-center justify-center mb-4"
            style={{ backgroundColor: `${ICON_COLORS.health}12` }}
          >
            <Heart className="h-10 w-10" style={{ color: ICON_COLORS.health }} />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">Your wishlist is empty</h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">
            Wishlist feature is coming soon! You'll be able to save your favorite products and get notified about price drops.
          </p>
          <Button onClick={() => navigate("/marketplace")} style={{ backgroundColor: ICON_COLORS.cart }}>
            <ShoppingBag className="h-4 w-4 mr-2" /> Browse Products
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
