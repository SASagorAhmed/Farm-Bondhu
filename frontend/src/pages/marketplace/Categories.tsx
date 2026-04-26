import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Wheat, Pill, Heart, Wrench, Bug, Egg, Milk,
  Truck, Scissors, Syringe, Leaf, Package, ArrowLeft,
} from "lucide-react";
import { ICON_COLORS } from "@/lib/iconColors";

const CATEGORIES = [
  { name: "Poultry Feed", icon: Wheat, color: ICON_COLORS.farm, count: 32 },
  { name: "Cattle Feed", icon: Wheat, color: ICON_COLORS.farm, count: 18 },
  { name: "Medicine", icon: Pill, color: ICON_COLORS.health, count: 24 },
  { name: "Vaccines", icon: Syringe, color: ICON_COLORS.health, count: 14 },
  { name: "Supplements", icon: Heart, color: ICON_COLORS.stethoscope, count: 16 },
  { name: "Equipment", icon: Wrench, color: ICON_COLORS.finance, count: 22 },
  { name: "Pest Control", icon: Bug, color: ICON_COLORS.learning, count: 10 },
  { name: "Eggs", icon: Egg, color: ICON_COLORS.egg, count: 8 },
  { name: "Dairy", icon: Milk, color: ICON_COLORS.milk, count: 6 },
  { name: "Grooming", icon: Scissors, color: ICON_COLORS.profile, count: 5 },
  { name: "Organic", icon: Leaf, color: ICON_COLORS.farm, count: 12 },
  { name: "Packaging", icon: Package, color: ICON_COLORS.cart, count: 9 },
];

export default function Categories() {
  const navigate = useNavigate();

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
        {CATEGORIES.map((cat, i) => (
          <motion.div
            key={cat.name}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
          >
            <Card
              className="cursor-pointer hover:shadow-lg transition-all group border-border/50"
              onClick={() => navigate(`/marketplace?category=${cat.name}`)}
            >
              <CardContent className="p-5 text-center">
                <div
                  className="h-14 w-14 rounded-2xl flex items-center justify-center mx-auto mb-3 transition-transform group-hover:scale-110"
                  style={{ backgroundColor: `${cat.color}15` }}
                >
                  <cat.icon className="h-6 w-6" style={{ color: cat.color }} />
                </div>
                <p className="font-medium text-foreground text-sm">{cat.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{cat.count} products</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
