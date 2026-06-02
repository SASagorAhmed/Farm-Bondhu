import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import SellerStorefrontLayout from "@/components/marketplace/storefront/SellerStorefrontLayout";
import { fetchPublicShop, fetchShopProducts } from "@/lib/marketplaceShopApi";
import { usePhotoEditorShopSessionExports } from "@/features/photoEditor/hooks/usePhotoEditorShopSessionExports";

export default function SellerShopEditor() {
  const { user, hasCapability } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sellerId = user?.id || "";

  const { data: shop, isLoading: shopLoading } = useQuery({
    queryKey: ["my-shop", sellerId],
    enabled: Boolean(sellerId),
    queryFn: () => fetchPublicShop(sellerId),
  });

  const { data: productResult, isLoading: productsLoading, refetch } = useQuery({
    queryKey: ["shop-products", sellerId],
    enabled: Boolean(sellerId),
    queryFn: () => fetchShopProducts(sellerId, { sort: "storefront" }),
  });

  const products = productResult?.products ?? [];
  const productsError = productResult?.error;

  usePhotoEditorShopSessionExports(sellerId, () => {
    queryClient.invalidateQueries({ queryKey: ["my-shop", sellerId] });
    queryClient.invalidateQueries({ queryKey: ["public-shop", sellerId] });
    void refetch();
  });

  useEffect(() => {
    if (!hasCapability("can_sell")) {
      navigate("/seller/onboarding", { replace: true });
      return;
    }
    if (!shopLoading && !shop) {
      navigate("/seller/onboarding", { replace: true });
    }
  }, [hasCapability, shopLoading, shop, navigate]);

  if (shopLoading || productsLoading || !shop || !user) {
    return <p className="text-center py-16 text-muted-foreground">Loading storefront editor…</p>;
  }

  return (
    <>
      {productsError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive mb-4">
          Could not load shop products: {productsError}
        </div>
      )}
      <p className="text-sm text-muted-foreground mb-4 rounded-lg border border-dashed px-4 py-3 bg-muted/20">
        Click any product to manage reviews and customer questions. Use{" "}
        <button
          type="button"
          className="font-medium underline text-foreground"
          onClick={() => navigate("/seller/reviews")}
        >
          Reviews
        </button>{" "}
        in the sidebar for your full feedback inbox.
      </p>
      <SellerStorefrontLayout
        shop={shop}
        sellerId={sellerId}
        products={products}
        editMode
        onNavigateProduct={(p) => navigate(`/seller/products/${p.id}`)}
        onAddToCart={() => {}}
        onBuyNow={() => {}}
        onProductsChange={() => refetch()}
      />
    </>
  );
}
