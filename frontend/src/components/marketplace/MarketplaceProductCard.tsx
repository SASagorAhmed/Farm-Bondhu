import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingCart, Star, MapPin, Truck, Zap, ShieldCheck, CheckCircle, Pill } from "lucide-react";
import { toast } from "sonner";
import { ICON_COLORS } from "@/lib/iconColors";
import { MARKETPLACE_THEME, formatBdt } from "@/lib/marketplaceTheme";
import { getCategoryLabel, getLaneForProductCategory } from "@/lib/marketplaceCategories";
import { Link } from "react-router-dom";
import TalkToSellerButton from "@/components/marketplace/TalkToSellerButton";
import { MarketplaceProduct, getSellerDisplayName, productDiscountPercent } from "@/lib/marketplaceProduct";
import { shopPath } from "@/lib/marketplaceShopApi";

interface Props {
  product: MarketplaceProduct;
  compact?: boolean;
  showPharmacyBadge?: boolean;
  /** Seller shop editor: hide cart/buy; card still opens product for review management */
  displayOnly?: boolean;
  onOpen: () => void;
  onAddToCart: () => void;
  onBuyNow: () => void;
}

export default function MarketplaceProductCard({
  product: p,
  compact = false,
  showPharmacyBadge = true,
  displayOnly = false,
  onOpen,
  onAddToCart,
  onBuyNow,
}: Props) {
  const discount = productDiscountPercent(p);
  const sellerDisplayName = getSellerDisplayName(p);
  const isFarmBondhuOfficial = sellerDisplayName === "FarmBondhu" || p.seller === "FarmBondhu";
  const productLane = getLaneForProductCategory(p.category);
  const isMedibondhu = showPharmacyBadge && productLane === "medibondhu";
  const isVetbondhu = showPharmacyBadge && productLane === "vetbondhu";
  const stockLabel =
    p.stock <= 0 ? "Stock Out!" : p.stock <= 5 ? "Limited Stock!" : null;
  const stockLeftLabel = p.stock > 0 && p.stock <= 20 ? `${p.stock} left` : null;

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
      className={`shadow-card transition-all duration-300 overflow-hidden group border-border/50 ${
        compact ? "h-full" : ""
      } cursor-pointer hover:shadow-elevated`}
      onClick={onOpen}
    >
      <div className="h-1" style={{ background: MARKETPLACE_THEME.primary }} />
      <div
        className={`relative w-full overflow-hidden bg-muted/30 aspect-[4/3] ${
          !p.image ? "flex items-center justify-center" : ""
        }`}
      >
        {p.image ? (
          <img
            src={p.image}
            alt={p.name}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform"
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
        {!stockLabel && stockLeftLabel && (
          <Badge variant="secondary" className="absolute top-2 right-2 text-[10px]">
            {stockLeftLabel}
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
          {isMedibondhu && (
            <Badge className="text-[10px] gap-0.5" style={{ backgroundColor: ICON_COLORS.medibondhu, color: "white" }}>
              <Pill className="h-2.5 w-2.5" /> MediBondhu
            </Badge>
          )}
          {isVetbondhu && (
            <Badge className="text-[10px] gap-0.5" style={{ backgroundColor: ICON_COLORS.vetbondhu, color: "white" }}>
              <Pill className="h-2.5 w-2.5" /> VetBondhu
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
            {!displayOnly && (
              <>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground flex-wrap">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{p.location}</span>
                  {isFarmBondhuOfficial && (
                    <Badge className="text-[9px] px-1" style={{ backgroundColor: ICON_COLORS.farm, color: "white" }}>
                      <ShieldCheck className="h-2.5 w-2.5 mr-0.5" />Official
                    </Badge>
                  )}
                  {p.is_verified_seller && !isFarmBondhuOfficial && (
                    <Badge className="text-[9px] px-1" style={{ backgroundColor: MARKETPLACE_THEME.primary, color: "white" }}>
                      <CheckCircle className="h-2.5 w-2.5 mr-0.5" />Verified
                    </Badge>
                  )}
                </div>
                <div
                  className="flex items-center justify-between gap-2 pt-0.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-[10px] text-muted-foreground truncate">
                    Sold by{" "}
                    {p.sellerId && !isFarmBondhuOfficial ? (
                      <Link
                        to={shopPath(p.sellerId)}
                        className="font-medium text-foreground hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {sellerDisplayName}
                      </Link>
                    ) : (
                      <span className="font-medium text-foreground">{sellerDisplayName}</span>
                    )}
                  </p>
                  <TalkToSellerButton
                    sellerId={p.sellerId}
                    productId={p.id}
                    variant="compact"
                    stopPropagation
                  />
                </div>
              </>
            )}
          </>
        )}
        {compact && p.sellerId && !displayOnly && (
          <div
            className="flex items-center justify-between gap-1 pt-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[9px] text-muted-foreground truncate flex-1 min-w-0">
              Sold by{" "}
              {p.sellerId && !isFarmBondhuOfficial ? (
                <Link
                  to={shopPath(p.sellerId)}
                  className="font-medium text-foreground hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {sellerDisplayName}
                </Link>
              ) : (
                <span className="font-medium text-foreground">{sellerDisplayName}</span>
              )}
            </p>
            <TalkToSellerButton
              sellerId={p.sellerId}
              productId={p.id}
              variant="compact"
              stopPropagation
              className="h-7 px-2 text-[10px]"
            />
          </div>
        )}
        {!compact && !displayOnly && (
          <div className="flex gap-2 pt-1 items-center">
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
              style={{ backgroundColor: MARKETPLACE_THEME.primary }}
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
