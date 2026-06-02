import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import SellerStorefrontLayout from "@/components/marketplace/storefront/SellerStorefrontLayout";
import { fetchPublicShop, fetchShopProducts } from "@/lib/marketplaceShopApi";
import { usePhotoEditorShopSessionExports } from "@/features/photoEditor/hooks/usePhotoEditorShopSessionExports";
import { OFFICIAL_SHOP_ADMIN_PATHS } from "@/lib/officialShopStorefrontPaths";
import OfficialShopPageHeader from "./OfficialShopPageHeader";
import { useOfficialShop } from "./OfficialShopProvider";

export default function OfficialShopMyShop() {
  const { sellerId } = useOfficialShop();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: shop, isLoading: shopLoading } = useQuery({
    queryKey: ["official-shop-public", sellerId],
    enabled: Boolean(sellerId),
    queryFn: () => fetchPublicShop(sellerId),
  });

  const { data: productResult, isLoading: productsLoading, refetch } = useQuery({
    queryKey: ["official-shop-products-storefront", sellerId],
    enabled: Boolean(sellerId),
    queryFn: () => fetchShopProducts(sellerId, { sort: "storefront" }),
  });

  const products = productResult?.products ?? [];

  usePhotoEditorShopSessionExports(sellerId, () => {
    queryClient.invalidateQueries({ queryKey: ["official-shop-public", sellerId] });
    void refetch();
  });

  if (shopLoading || productsLoading) {
    return <p className="text-center py-16 text-muted-foreground">Loading storefront…</p>;
  }

  if (!shop) {
    return (
      <div className="space-y-6">
        <OfficialShopPageHeader title="Official shop" />
        <p className="text-center text-muted-foreground py-12">Shop profile could not be loaded.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <OfficialShopPageHeader
        title="Official shop"
        description="Edit storefront layout, pinned products, and shop branding for FarmBondhu"
      />
      {productResult?.error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive">
          Could not load shop products: {productResult.error}
        </div>
      )}
      <SellerStorefrontLayout
        shop={shop}
        sellerId={sellerId}
        products={products}
        editMode
        variant="admin"
        shopEditorPath={OFFICIAL_SHOP_ADMIN_PATHS.shop}
        onNavigateProduct={() => navigate(OFFICIAL_SHOP_ADMIN_PATHS.products)}
        onAddToCart={() => {}}
        onBuyNow={() => {}}
        onProductsChange={() => refetch()}
      />
    </div>
  );
}
