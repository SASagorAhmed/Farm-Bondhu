import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingCart, Star, MapPin, Truck, Zap, ShieldCheck, CheckCircle, Pill } from "lucide-react";
import { toast } from "sonner";
import { ICON_COLORS } from "@/lib/iconColors";
import { MARKETPLACE_THEME, formatBdt } from "@/lib/marketplaceTheme";
import { getCategoryLabel, getLaneForProductCategory } from "@/lib/marketplaceCategories";
import { MarketplaceProduct, productDiscountPercent } from "@/lib/marketplaceProduct";

interface Props {
  product: MarketplaceProduct;
  compact?: boolean;
  showPharmacyBadge?: boolean;
  onOpen: () => void;
  onAddToCart: () => void;
  onBuyNow: () => void;
}

export default function MarketplaceProductCard({
  product: p,
  compact = false,
  showPharmacyBadge = true,
  onOpen,
  onAddToCart,
  onBuyNow,
}: Props) {
  const discount = productDiscountPercent(p);
  const isPharmacy = showPharmacyBadge && getLaneForProductCategory(p.category) === "pharmacy";
  const stockLabel =
    p.stock <= 0 ? "Stock Out!" : p.stock <= 5 ? "Limited Stock!" : null;

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddToCart();
    toast.success(`${p.name} added to cart`);
  };

  const handleBuy = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddToCart();
    onBuyNow();
  };

  return (
    <Card
      className={`shadow-card hover:shadow-elevated transition-all duration-300 overflow-hidden group cursor-pointer border-border/50 ${
        compact ? "h-full" : ""
      }`}
      onClick={onOpen}
    >
      <div className="h-1" style={{ background: MARKETPLACE_THEME.primary }} />
      <div className={`relative bg-accent/20 flex items-center justify-center ${compact ? "h-32" : "h-44"}`}>
        {p.image ? (
          <img
            src={p.image}
            alt={p.name}
            className={`object-contain group-hover:scale-105 transition-transform ${compact ? "h-20 w-20" : "h-28 w-28"}`}
          />
        ) : (
          <ShoppingCart className="h-10 w-10 text-muted-foreground/30" />
        )}
        {discount > 0 && (
          <Badge
            className="absolute top-2 left-2 text-[10px] font-bold"
            style={{ backgroundColor: MARKETPLACE_THEME.accent, color: "white" }}
          >
            -{discount}%
          </Badge>
        )}
        {stockLabel && (
          <Badge variant="secondary" className="absolute top-2 right-2 text-[10px]">
            {stockLabel}
          </Badge>
        )}
        {p.freeDelivery && (
          <div
            className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold text-white"
            style={{ backgroundColor: MARKETPLACE_THEME.primary }}
          >
            <Truck className="h-3 w-3" /> FREE
          </div>
        )}
      </div>
      <CardContent className={`space-y-1.5 ${compact ? "p-2.5" : "p-4"}`}>
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline" className="text-[10px]">
            {getCategoryLabel(String(p.category))}
          </Badge>
          {isPharmacy && (
            <Badge className="text-[10px] gap-0.5" style={{ backgroundColor: ICON_COLORS.health, color: "white" }}>
              <Pill className="h-2.5 w-2.5" /> Pharmacy
            </Badge>
          )}
        </div>
        <h3 className={`font-semibold text-foreground leading-tight line-clamp-2 ${compact ? "text-xs" : "text-sm"}`}>
          {p.name}
        </h3>
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className={`font-bold ${compact ? "text-sm" : "text-lg"}`} style={{ color: MARKETPLACE_THEME.accent }}>
            {formatBdt(p.price)}
          </span>
          {p.originalPrice && (
            <span className="text-xs text-muted-foreground line-through">{formatBdt(p.originalPrice)}</span>
          )}
          {!compact && p.unit && <span className="text-xs text-muted-foreground">/{p.unit}</span>}
        </div>
        {!compact && (
          <>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {p.rating} ({p.reviewCount || 0})
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground flex-wrap">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{p.location}</span>
              {p.seller === "FarmBondhu" && (
                <Badge className="text-[9px] px-1" style={{ backgroundColor: ICON_COLORS.farm, color: "white" }}>
                  <ShieldCheck className="h-2.5 w-2.5 mr-0.5" />Official
                </Badge>
              )}
              {p.is_verified_seller && p.seller !== "FarmBondhu" && (
                <Badge className="text-[9px] px-1" style={{ backgroundColor: MARKETPLACE_THEME.primary, color: "white" }}>
                  <CheckCircle className="h-2.5 w-2.5 mr-0.5" />Verified
                </Badge>
              )}
            </div>
          </>
        )}
        {!compact && (
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-xs"
              style={{ borderColor: MARKETPLACE_THEME.primary, color: MARKETPLACE_THEME.primary }}
              onClick={handleAdd}
              disabled={p.stock <= 0}
            >
              <ShoppingCart className="h-3.5 w-3.5 mr-1" /> Cart
            </Button>
            <Button
              size="sm"
              className="flex-1 text-xs text-white"
              style={{ backgroundColor: MARKETPLACE_THEME.primaryDark }}
              onClick={handleBuy}
              disabled={p.stock <= 0}
            >
              <Zap className="h-3.5 w-3.5 mr-1" /> Buy
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
