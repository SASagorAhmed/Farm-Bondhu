import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import SellerStorefrontLayout from "@/components/marketplace/storefront/SellerStorefrontLayout";
import ProductFormDialog from "@/components/marketplace/ProductFormDialog";
import { fetchPublicShop, fetchShopProducts } from "@/lib/marketplaceShopApi";
import { usePhotoEditorShopSessionExports } from "@/features/photoEditor/hooks/usePhotoEditorShopSessionExports";
import { OFFICIAL_SHOP_ADMIN_PATHS } from "@/lib/officialShopStorefrontPaths";
import {
  officialShopProductsQueryKey,
  officialShopStorefrontActions,
} from "@/lib/adminFarmBondhuShopApi";
import { ALL_MARKETPLACE_LANES } from "@/lib/marketplaceLaneLabels";
import {
  fromDbRow,
  resolveProductImageUrl,
  toApiPayload,
  type ProductFormValues,
} from "@/lib/marketplaceProductForm";
import { type MarketplaceProduct } from "@/lib/marketplaceProduct";
import { ICON_COLORS } from "@/lib/iconColors";
import { toast } from "sonner";
import OfficialShopPageHeader from "./OfficialShopPageHeader";
import { useOfficialShop } from "./OfficialShopProvider";

const SHOP_COVER_REQUIREMENT = "Cover 1000x200 (5:1)";
const SHOP_LOGO_REQUIREMENT = "Profile 512x512";

export default function OfficialShopMyShop() {
  const { sellerId } = useOfficialShop();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [initialForm, setInitialForm] = useState<ProductFormValues | undefined>();

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

  const refreshProducts = () => {
    queryClient.invalidateQueries({ queryKey: ["official-shop-products-storefront", sellerId] });
    queryClient.invalidateQueries({ queryKey: officialShopProductsQueryKey() });
    void refetch();
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
    if (!user || !sellerId) return;
    const imageUrl = await resolveProductImageUrl(values);
    const payload = {
      ...toApiPayload(values, imageUrl),
      seller_id: sellerId,
      seller_name: "FarmBondhu",
      is_verified_seller: true,
    };

    if (formMode === "edit" && editingId) {
      const { error } = await api.from("products").update(payload).eq("id", editingId);
      if (error) throw new Error(error.message);
      toast.success("Product updated");
    } else {
      const { error } = await api.from("products").insert(payload);
      if (error) throw new Error(error.message);
      toast.success("Product added");
    }
    refreshProducts();
  };

  const handleDelete = async (product: MarketplaceProduct) => {
    if (!window.confirm(`Delete "${product.name}" from the official shop?`)) return;
    const { error } = await api.from("products").delete().eq("id", product.id);
    if (error) {
      toast.error(error.message || "Could not delete product");
      return;
    }
    refreshProducts();
    toast.success("Product deleted");
  };

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
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-dashed bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        <p className="min-w-0 flex-1">
          Click any product to open its detail page. Use{" "}
          <button
            type="button"
            className="font-medium underline text-foreground"
            onClick={() => navigate("/admin/farmbondhu-shop/reviews")}
          >
            Reviews
          </button>{" "}
          for the full feedback inbox.
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
        variant="admin"
        shopEditorPath={OFFICIAL_SHOP_ADMIN_PATHS.shop}
        shopActions={officialShopStorefrontActions}
        onAddProduct={openCreate}
        onEditProduct={openEdit}
        onDeleteProduct={handleDelete}
        onNavigateProduct={(p) => navigate(`/admin/farmbondhu-shop/products/${p.id}`)}
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
        accentColor={ICON_COLORS.farm}
        allowedLanes={ALL_MARKETPLACE_LANES}
        defaultPickerLane={ALL_MARKETPLACE_LANES[0]}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
