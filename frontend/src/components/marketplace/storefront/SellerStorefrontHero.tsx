import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  Camera,
  CheckCircle,
  MapPin,
  Package,
  Palette,
  Pencil,
  ShoppingBag,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { MARKETPLACE_THEME, marketplaceGradient } from "@/lib/marketplaceTheme";
import type { PublicShop } from "@/lib/marketplaceShopApi";
import { officialShopPhotoEditorNewUrl } from "@/lib/officialShopStorefrontPaths";

interface Props {
  shop: PublicShop;
  productCount?: number;
  editMode?: boolean;
  variant?: "seller" | "admin";
  shopReturnPath?: string;
  onEditInfo?: () => void;
  onUploadBanner?: (file: File) => void;
  onUploadLogo?: (file: File) => void;
  uploadingBanner?: boolean;
  uploadingLogo?: boolean;
}

export default function SellerStorefrontHero({
  shop,
  productCount = 0,
  editMode = false,
  variant = "seller",
  shopReturnPath = "/seller/my-shop",
  onEditInfo,
  onUploadBanner,
  onUploadLogo,
  uploadingBanner = false,
  uploadingLogo = false,
}: Props) {
  const isAdmin = variant === "admin";
  const photoCoverUrl = isAdmin
    ? officialShopPhotoEditorNewUrl("shop_cover", "shop_banner", shopReturnPath)
    : "/seller/photo-editor/edit/new?preset=shop_cover&target=shop_banner&returnTo=/seller/my-shop";
  const photoLogoUrl = isAdmin
    ? officialShopPhotoEditorNewUrl("shop_logo", "shop_logo", shopReturnPath)
    : "/seller/photo-editor/edit/new?preset=shop_logo&target=shop_logo&returnTo=/seller/my-shop";
  const navigate = useNavigate();
  const { t } = useLanguage();
  const shopName = shop.shop_name?.trim() || "Marketplace Shop";
  const initial = shopName.charAt(0).toUpperCase();
  const bannerRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  const pickFile = (ref: React.RefObject<HTMLInputElement>, handler?: (f: File) => void) => {
    if (!handler) return;
    ref.current?.click();
    const input = ref.current;
    if (!input) return;
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) handler(file);
      input.value = "";
    };
  };

  return (
    <div className="rounded-2xl overflow-hidden border bg-card shadow-sm">
      <div
        className="relative h-48 md:h-56 group"
        style={{ background: shop.banner_url ? undefined : marketplaceGradient() }}
      >
        {shop.banner_url && (
          <img src={shop.banner_url} alt="" className="h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        {editMode && onUploadBanner && (
          <>
            <input ref={bannerRef} type="file" accept="image/*" className="hidden" />
            <div className="absolute top-4 right-4 flex flex-wrap gap-2 justify-end">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="gap-1 opacity-90"
                onClick={() => navigate(photoCoverUrl)}
              >
                <Palette className="h-4 w-4" />
                {t("seller.photoEditor.editInPhotoEditor")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="gap-1 opacity-90"
                disabled={uploadingBanner}
                onClick={() => pickFile(bannerRef, onUploadBanner)}
              >
                <Camera className="h-4 w-4" />
                {uploadingBanner ? "Uploading…" : "Change banner"}
              </Button>
            </div>
          </>
        )}
      </div>

      <div className="px-4 md:px-8 pb-6 -mt-12 md:-mt-14 relative">
        <div className="flex flex-wrap items-end gap-4 md:gap-6">
          <div className="relative shrink-0">
            <div
              className="h-24 w-24 md:h-28 md:w-28 rounded-2xl border-4 border-background shadow-lg flex items-center justify-center text-white font-bold text-3xl overflow-hidden"
              style={{ backgroundColor: MARKETPLACE_THEME.primary }}
            >
              {shop.logo_url ? (
                <img src={shop.logo_url} alt={shopName} className="h-full w-full object-cover" />
              ) : (
                initial
              )}
            </div>
            {editMode && onUploadLogo && (
              <>
                <input ref={logoRef} type="file" accept="image/*" className="hidden" />
                <button
                  type="button"
                  className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-background border shadow flex items-center justify-center hover:bg-muted"
                  disabled={uploadingLogo}
                  onClick={() => pickFile(logoRef, onUploadLogo)}
                  aria-label="Change logo"
                >
                  <Camera className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="absolute -bottom-1 -left-1 h-8 w-8 rounded-full bg-background border shadow flex items-center justify-center hover:bg-muted"
                  onClick={() => navigate(photoLogoUrl)}
                  aria-label={t("seller.photoEditor.editInPhotoEditor")}
                  title={t("seller.photoEditor.editInPhotoEditor")}
                >
                  <Palette className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>

          <div className="flex-1 min-w-0 pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">{shopName}</h1>
              {shop.is_verified && (
                <Badge className="gap-1 text-white" style={{ backgroundColor: MARKETPLACE_THEME.primary }}>
                  <CheckCircle className="h-3 w-3" /> Verified
                </Badge>
              )}
              {editMode && onEditInfo && (
                <Button type="button" variant="ghost" size="sm" className="h-8 gap-1" onClick={onEditInfo}>
                  <Pencil className="h-3.5 w-3.5" /> Edit info
                </Button>
              )}
            </div>
            {shop.description ? (
              <p className="text-sm text-muted-foreground mt-2 max-w-2xl line-clamp-3">{shop.description}</p>
            ) : editMode ? (
              <p className="text-sm text-muted-foreground mt-2 italic">Add a shop description to build buyer trust.</p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mt-5">
          {shop.location && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> {shop.location}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
            <Package className="h-3.5 w-3.5" /> {productCount || shop.total_products || 0} products
          </span>
          {shop.total_sales != null && Number(shop.total_sales) > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
              <ShoppingBag className="h-3.5 w-3.5" /> ৳{Number(shop.total_sales).toLocaleString()} sales
            </span>
          )}
          {shop.created_date && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              Since {new Date(shop.created_date).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
