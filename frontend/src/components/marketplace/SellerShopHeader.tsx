import { Badge } from "@/components/ui/badge";
import { CalendarDays, CheckCircle, MapPin, Package, ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";
import { MARKETPLACE_THEME, marketplaceGradient } from "@/lib/marketplaceTheme";
import type { PublicShop } from "@/lib/marketplaceShopApi";
import TalkToSellerButton from "@/components/marketplace/TalkToSellerButton";

interface Props {
  shop: PublicShop;
  sellerId: string;
  productCount?: number;
  isOwnerPreview?: boolean;
  compact?: boolean;
  sampleProductId?: string | null;
}

export default function SellerShopHeader({
  shop,
  sellerId,
  productCount = 0,
  isOwnerPreview = false,
  compact = false,
  sampleProductId,
}: Props) {
  const shopName = shop.shop_name?.trim() || "Marketplace Shop";
  const initial = shopName.charAt(0).toUpperCase();

  return (
    <div className="space-y-4">
      {isOwnerPreview && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-sm text-foreground">
          You are viewing your shop as customers see it.{" "}
          <Link to="/seller/my-shop" className="font-medium text-primary underline">
            Back to shop hub
          </Link>
        </div>
      )}

      <div className="rounded-2xl overflow-hidden border shadow-card">
        <div
          className={`relative ${compact ? "h-24" : "h-36 md:h-44"}`}
          style={{
            background: shop.banner_url
              ? undefined
              : marketplaceGradient(),
          }}
        >
          {shop.banner_url && (
            <img src={shop.banner_url} alt="" className="h-full w-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        </div>
        <div className={`px-4 md:px-6 pb-5 ${compact ? "-mt-8" : "-mt-10"}`}>
          <div className="flex flex-wrap items-end gap-4">
            <div
              className={`rounded-xl border-4 border-background flex items-center justify-center text-white font-bold shrink-0 overflow-hidden ${
                compact ? "h-14 w-14 text-xl" : "h-20 w-20 text-2xl"
              }`}
              style={{ backgroundColor: MARKETPLACE_THEME.primary }}
            >
              {shop.logo_url ? (
                <img src={shop.logo_url} alt={shopName} className="h-full w-full object-cover" />
              ) : (
                initial
              )}
            </div>
            <div className="flex-1 min-w-0 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className={`font-display font-bold text-foreground ${compact ? "text-lg" : "text-2xl md:text-3xl"}`}>
                  {shopName}
                </h1>
                {shop.is_verified && (
                  <Badge className="gap-1 text-white" style={{ backgroundColor: MARKETPLACE_THEME.primary }}>
                    <CheckCircle className="h-3 w-3" /> Verified
                  </Badge>
                )}
              </div>
              {shop.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2 max-w-2xl">{shop.description}</p>
              )}
            </div>
            {!compact && sampleProductId && !isOwnerPreview && (
              <TalkToSellerButton sellerId={sellerId} productId={sampleProductId} variant="chatNow" />
            )}
          </div>

          {!compact && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-sm text-muted-foreground">
              {shop.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span className="truncate">{shop.location}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 shrink-0" />
                <span>{productCount || shop.total_products || 0} products</span>
              </div>
              {shop.total_sales != null && Number(shop.total_sales) > 0 && (
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 shrink-0" />
                  <span>৳{Number(shop.total_sales).toLocaleString()} sales</span>
                </div>
              )}
              {shop.created_date && (
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 shrink-0" />
                  <span>
                    Since {new Date(shop.created_date).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
