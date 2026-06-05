import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Package, Pencil } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import ProductFormDialog from "@/components/marketplace/ProductFormDialog";
import ProductReviewsList from "@/components/marketplace/ProductReviewsList";
import ProductCommentsSection from "@/components/marketplace/ProductCommentsSection";
import SellerFlashSaleActions from "@/components/vendor/SellerFlashSaleActions";
import { ICON_COLORS } from "@/lib/iconColors";
import { formatBdt } from "@/lib/marketplaceTheme";
import { displayProductCategory } from "@/lib/marketplaceCategories";
import {
  fromDbRow,
  resolveProductImageUrl,
  toApiPayload,
  type ProductFormValues,
} from "@/lib/marketplaceProductForm";
import { ALL_MARKETPLACE_LANES } from "@/lib/marketplaceLaneLabels";
import {
  fetchOfficialShopProduct,
  officialShopProductQueryKey,
  officialShopProductsQueryKey,
} from "@/lib/adminFarmBondhuShopApi";
import OfficialShopPageHeader from "./OfficialShopPageHeader";
import { useOfficialShop } from "./OfficialShopProvider";

export default function OfficialShopProductDetail() {
  const { productId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { sellerId } = useOfficialShop();
  const [formOpen, setFormOpen] = useState(false);

  const { data: product, isLoading, isError } = useQuery({
    queryKey: officialShopProductQueryKey(productId),
    enabled: Boolean(productId),
    queryFn: () => fetchOfficialShopProduct(productId),
  });

  const handleSubmit = async (values: ProductFormValues) => {
    if (!user || !sellerId || !productId) return;
    const imageUrl = await resolveProductImageUrl(values);
    const payload = {
      ...toApiPayload(values, imageUrl),
      seller_id: sellerId,
      seller_name: "FarmBondhu",
      is_verified_seller: true,
    };
    const { error } = await api.from("products").update(payload).eq("id", productId);
    if (error) throw new Error(error.message);
    toast.success("Product updated");
    void queryClient.invalidateQueries({ queryKey: officialShopProductQueryKey(productId) });
    void queryClient.invalidateQueries({ queryKey: officialShopProductsQueryKey() });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading product…
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="text-center py-20 space-y-4">
        <Package className="h-16 w-16 mx-auto text-muted-foreground/40" />
        <h2 className="text-xl font-display font-bold text-foreground">Product not found</h2>
        <Button onClick={() => navigate("/admin/farmbondhu-shop/products")}>Back to products</Button>
      </div>
    );
  }

  const name = String(product.name || "");
  const price = Number(product.price || 0);
  const stock = Number(product.stock || 0);
  const image = String(product.image || "");
  const category = String(product.category || "");
  const description = String(product.description || "");
  const listingStatus = String(product.listing_status || "approved");

  return (
    <div className="space-y-6 max-w-4xl">
      <OfficialShopPageHeader title={name} />
      <Button variant="ghost" onClick={() => navigate("/admin/farmbondhu-shop/products")}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to products
      </Button>

      <Card className="shadow-card overflow-hidden">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="h-48 w-full md:w-56 rounded-lg border bg-muted/20 flex items-center justify-center overflow-hidden shrink-0">
              {image ? <img src={image} alt={name} className="h-full w-full object-contain" /> : <Package className="h-12 w-12 text-muted-foreground/40" />}
            </div>
            <div className="flex-1 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-2xl font-display font-bold text-foreground">{name}</h2>
                  <p className="text-muted-foreground">{displayProductCategory(category)}</p>
                </div>
                <Badge variant="secondary" className="capitalize">{listingStatus.replace(/_/g, " ")}</Badge>
              </div>
              <p className="text-2xl font-bold" style={{ color: ICON_COLORS.farm }}>{formatBdt(price)}</p>
              <p className="text-sm text-muted-foreground">Stock: {stock}</p>
              {description && <p className="text-sm text-foreground leading-relaxed">{description}</p>}
              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  className="text-white"
                  style={{ backgroundColor: ICON_COLORS.farm }}
                  onClick={() => setFormOpen(true)}
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit product
                </Button>
                <SellerFlashSaleActions
                  product={{
                    id: productId,
                    price,
                    listing_status: listingStatus,
                    is_flash_sale: Boolean(product.is_flash_sale),
                    flash_sale_request_status:
                      product.flash_sale_request_status != null
                        ? String(product.flash_sale_request_status)
                        : null,
                    flash_sale_review_notes:
                      product.flash_sale_review_notes != null
                        ? String(product.flash_sale_review_notes)
                        : null,
                  }}
                  onChanged={() => {
                    void queryClient.invalidateQueries({ queryKey: officialShopProductQueryKey(productId) });
                    void queryClient.invalidateQueries({ queryKey: officialShopProductsQueryKey() });
                  }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-display">Verified reviews</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductReviewsList productId={productId} />
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-display">Customer questions</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductCommentsSection productId={productId} />
        </CardContent>
      </Card>

      <ProductFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode="edit"
        initialValues={fromDbRow(product)}
        title="Edit Product"
        submitLabel="Save Product"
        accentColor={ICON_COLORS.farm}
        allowedLanes={ALL_MARKETPLACE_LANES}
        defaultPickerLane={ALL_MARKETPLACE_LANES[0]}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
