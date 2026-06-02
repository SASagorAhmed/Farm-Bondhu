import { useEffect, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Store } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import SellerStorefrontLayout from "@/components/marketplace/storefront/SellerStorefrontLayout";
import { fetchPublicShop, fetchShopProducts } from "@/lib/marketplaceShopApi";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function SellerShopPage() {
  const { sellerId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addItem } = useCart();

  const isOwner = Boolean(user?.id && sellerId && user.id === sellerId);
  const isPreview = searchParams.get("preview") === "1";
  const showOwnerPreviewBanner = isOwner && isPreview;

  const { data: shop, isLoading: shopLoading, isError: shopError } = useQuery({
    queryKey: ["public-shop", sellerId],
    enabled: UUID_RE.test(sellerId),
    queryFn: () => fetchPublicShop(sellerId),
  });

  const { data: productResult, isLoading: productsLoading, refetch } = useQuery({
    queryKey: ["shop-products", sellerId],
    enabled: UUID_RE.test(sellerId),
    queryFn: () => fetchShopProducts(sellerId, { sort: "storefront" }),
  });

  const products = productResult?.products ?? [];
  const productsError = productResult?.error;

  const editMode = useMemo(() => isOwner && !isPreview, [isOwner, isPreview]);

  const shouldRedirectOwner =
    UUID_RE.test(sellerId) &&
    !shopLoading &&
    !productsLoading &&
    !shopError &&
    Boolean(shop) &&
    isOwner &&
    !isPreview;

  useEffect(() => {
    if (shouldRedirectOwner) {
      navigate("/seller/my-shop", { replace: true });
    }
  }, [shouldRedirectOwner, navigate]);

  if (!UUID_RE.test(sellerId)) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>Invalid shop link.</p>
        <Button variant="link" onClick={() => navigate("/marketplace")}>Back to marketplace</Button>
      </div>
    );
  }

  if (shopLoading || productsLoading) {
    return <p className="text-center py-16 text-muted-foreground">Loading shop…</p>;
  }

  if (shopError || !shop) {
    return (
      <div className="text-center py-16 space-y-3">
        <Store className="h-12 w-12 mx-auto text-muted-foreground/40" />
        <p className="text-muted-foreground">This shop is not available.</p>
        <Button variant="outline" onClick={() => navigate("/marketplace")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to marketplace
        </Button>
      </div>
    );
  }

  if (shouldRedirectOwner) {
    return <p className="text-center py-16 text-muted-foreground">Redirecting…</p>;
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1 -ml-2">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>
      {productsError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive">
          Could not load shop products: {productsError}
        </div>
      )}
      <SellerStorefrontLayout
        shop={shop}
        sellerId={sellerId}
        products={products}
        editMode={editMode}
        showOwnerPreviewBanner={showOwnerPreviewBanner}
        onNavigateProduct={(p) => navigate(`/marketplace/${p.id}`)}
        onAddToCart={(p) => addItem(p)}
        onBuyNow={(p) => {
          addItem(p);
          navigate("/checkout");
        }}
        onProductsChange={() => refetch()}
      />
    </div>
  );
}
