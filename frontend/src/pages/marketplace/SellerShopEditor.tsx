import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/api/client";
import SellerStorefrontLayout from "@/components/marketplace/storefront/SellerStorefrontLayout";
import ProductFormDialog from "@/components/marketplace/ProductFormDialog";
import { fetchPublicShop } from "@/lib/marketplaceShopApi";
import { fetchSellerOnboardingMe } from "@/lib/sellerOnboardingApi";
import type { MarketplaceLane } from "@/lib/marketplaceCategories";
import { fromDbRow, type ProductFormValues } from "@/lib/marketplaceProductForm";
import { dbToProduct, type MarketplaceProduct } from "@/lib/marketplaceProduct";
import { invalidateMarketplaceStockQueries } from "@/lib/marketplaceStockQueries";
import { useSellerProductUpdate } from "@/hooks/useSellerProductUpdate";
import { useSellerInventory } from "@/lib/sellerInventoryApi";
import { usePhotoEditorShopSessionExports } from "@/features/photoEditor/hooks/usePhotoEditorShopSessionExports";
import { VENDOR_THEME } from "@/lib/vendorTheme";
import { toast } from "sonner";

const SHOP_COVER_REQUIREMENT = "Cover 1000x200 (5:1)";
const SHOP_LOGO_REQUIREMENT = "Profile 512x512";

export default function SellerShopEditor() {
  const { user, hasCapability } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { submitProduct } = useSellerProductUpdate();
  const sellerId = user?.id || "";
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [initialForm, setInitialForm] = useState<ProductFormValues | undefined>();

  const { data: shop, isLoading: shopLoading } = useQuery({
    queryKey: ["my-shop", sellerId],
    enabled: Boolean(sellerId),
    queryFn: () => fetchPublicShop(sellerId),
  });

  const {
    data: inventoryProducts = [],
    isLoading: productsLoading,
    error: productsError,
    refetch: refetchInventory,
  } = useSellerInventory();

  const products = useMemo(
    () =>
      inventoryProducts
        .map((row) => dbToProduct(row as Record<string, unknown>))
        .sort((a, b) => {
          const sortDelta = (a.shop_sort_order ?? 0) - (b.shop_sort_order ?? 0);
          if (sortDelta !== 0) return sortDelta;
          return String(b.created_at || "").localeCompare(String(a.created_at || ""));
        }),
    [inventoryProducts],
  );

  const { data: onboarding } = useQuery({
    queryKey: ["seller-onboarding-me", user?.id],
    enabled: Boolean(user?.id),
    queryFn: fetchSellerOnboardingMe,
  });

  const approvedLanes = (onboarding?.approved_lanes || []) as Exclude<MarketplaceLane, "all">[];

  usePhotoEditorShopSessionExports(sellerId, () => {
    queryClient.invalidateQueries({ queryKey: ["my-shop", sellerId] });
    queryClient.invalidateQueries({ queryKey: ["public-shop", sellerId] });
    queryClient.invalidateQueries({ queryKey: ["shop-products", sellerId] });
    void refetchInventory();
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

  const refreshProducts = () => {
    invalidateMarketplaceStockQueries(queryClient, { userId: user?.id });
    queryClient.invalidateQueries({ queryKey: ["shop-products", sellerId] });
    void refetchInventory();
  };

  const productToFormValues = (product: MarketplaceProduct): ProductFormValues =>
    fromDbRow({
      ...product,
      original_price: product.originalPrice,
      free_delivery: product.freeDelivery,
      delivery_charge_dhaka: product.deliveryChargeDhaka,
      delivery_charge_outside: product.deliveryChargeOutside,
    });

  const openCreate = () => {
    if (!approvedLanes.length) {
      toast.error("Complete seller category approval before adding products.");
      return;
    }
    setFormMode("create");
    setEditingId(null);
    setInitialForm(undefined);
    setFormOpen(true);
  };

  const openEdit = (product: MarketplaceProduct) => {
    setFormMode("edit");
    setEditingId(product.id);
    setInitialForm(productToFormValues(product));
    setFormOpen(true);
  };

  const handleSubmit = async (values: ProductFormValues) => {
    const existing = editingId ? products.find((p) => p.id === editingId) : undefined;
    await submitProduct(formMode, values, {
      editingId,
      listingStatus: existing?.listing_status,
      onSuccess: refreshProducts,
    });
  };

  const handleDelete = async (product: MarketplaceProduct) => {
    if (!window.confirm(`Delete "${product.name}" from your shop?`)) return;
    const { error } = await api.from("products").delete().eq("id", product.id);
    if (error) {
      toast.error(error.message || "Could not delete product");
      return;
    }
    refreshProducts();
    toast.success("Product deleted");
  };

  if (shopLoading || productsLoading || !shop || !user) {
    return <p className="text-center py-16 text-muted-foreground">Loading storefront editor…</p>;
  }

  return (
    <>
      {productsError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive mb-4">
          Could not load shop products: {productsError instanceof Error ? productsError.message : "Please try again."}
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-dashed bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        <p className="min-w-0 flex-1">
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
        <div className="inline-flex w-fit max-w-full flex-wrap items-center gap-1.5 rounded-lg border border-border bg-background/70 px-3 py-1.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{SHOP_COVER_REQUIREMENT}</span>
          <span className="text-muted-foreground/60">•</span>
          <span className="font-medium text-foreground">{SHOP_LOGO_REQUIREMENT}</span>
        </div>
      </div>
      <SellerStorefrontLayout
        shop={shop}
        sellerId={sellerId}
        products={products}
        editMode
        onAddProduct={openCreate}
        onEditProduct={openEdit}
        onDeleteProduct={handleDelete}
        onNavigateProduct={(p) => navigate(`/seller/products/${p.id}`)}
        onAddToCart={() => {}}
        onBuyNow={() => {}}
        onProductsChange={refreshProducts}
      />
      <ProductFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        initialValues={initialForm}
        title={formMode === "edit" ? "Edit Product" : "Add Product"}
        submitLabel={formMode === "edit" ? "Save Product" : "Submit Product"}
        accentColor={VENDOR_THEME.primary}
        allowedLanes={approvedLanes}
        defaultPickerLane={approvedLanes[0]}
        onSubmit={handleSubmit}
      />
    </>
  );
}
