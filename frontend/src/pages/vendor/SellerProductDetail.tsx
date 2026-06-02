import { useEffect, useMemo, useState } from "react";

import { useParams, useNavigate, Link } from "react-router-dom";

import { Card, CardContent } from "@/components/ui/card";

import { Button } from "@/components/ui/button";

import { Badge } from "@/components/ui/badge";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Textarea } from "@/components/ui/textarea";

import { Separator } from "@/components/ui/separator";

import { API_BASE, api } from "@/api/client";

import { Product } from "@/data/mockData";

import { useAuth } from "@/contexts/AuthContext";

import {
  ArrowLeft,
  Loader2,
  Package,
  Pencil,
  Star,
} from "lucide-react";

import { motion } from "framer-motion";

import { toast } from "sonner";

import { useQuery } from "@tanstack/react-query";

import { moduleCachePolicy } from "@/lib/queryClient";

import ProductReviewsList from "@/components/marketplace/ProductReviewsList";

import ProductCommentsSection from "@/components/marketplace/ProductCommentsSection";

import ProductFormDialog from "@/components/marketplace/ProductFormDialog";

import { fetchProductReviews } from "@/lib/marketplaceReviewsApi";

import { ICON_COLORS } from "@/lib/iconColors";

import {
  DEFAULT_DELIVERY_DHAKA,
  DEFAULT_DELIVERY_OUTSIDE,
  formatBdt,
  marketplaceStarStyle,
} from "@/lib/marketplaceTheme";

import { VENDOR_THEME, vendorGradient } from "@/lib/vendorTheme";

import {
  getLaneForProductCategory,
  type MarketplaceLane,
} from "@/lib/marketplaceCategories";

import { fromDbRow } from "@/lib/marketplaceProductForm";

import { useSellerProductUpdate } from "@/hooks/useSellerProductUpdate";

import { fetchSellerProduct } from "@/lib/sellerProductApi";
import SellerFlashSaleActions from "@/components/vendor/SellerFlashSaleActions";

interface ExtendedProduct extends Product {
  deliveryChargeDhaka?: number | null;

  deliveryChargeOutside?: number | null;
}

function dbToProduct(row: Record<string, unknown>): ExtendedProduct {
  return {
    id: String(row.id),

    name: String(row.name),

    category: String(row.category),

    price: Number(row.price),

    originalPrice: row.original_price ? Number(row.original_price) : undefined,

    unit: String(row.unit),

    image: String(row.image || ""),

    seller: String(row.seller_name || ""),

    sellerId: String(row.seller_id),

    rating: Number(row.rating),

    reviewCount: Number(row.review_count ?? 0),

    stock: Number(row.stock),

    description: String(row.description || ""),

    location: String(row.location || ""),

    freeDelivery: Boolean(row.free_delivery),

    deliveryChargeDhaka:
      row.delivery_charge_dhaka != null
        ? Number(row.delivery_charge_dhaka)
        : null,

    deliveryChargeOutside:
      row.delivery_charge_outside != null
        ? Number(row.delivery_charge_outside)
        : null,
  };
}

function listingStatusLabel(status: string): string {
  if (status === "pending_review") return "Pending review";
  if (status === "rejected") return "Rejected";
  if (status === "draft") return "Draft";
  return "Live";
}

function listingStatusBadgeClass(status: string): string {
  if (status === "pending_review")
    return "bg-yellow-100 text-yellow-800 border-yellow-200";
  if (status === "rejected") return "bg-red-100 text-red-800 border-red-200";
  if (status === "draft") return "bg-muted text-muted-foreground";
  return "bg-green-100 text-green-800 border-green-200";
}

export default function SellerProductDetail() {
  const { productId } = useParams();

  const navigate = useNavigate();

  const { user } = useAuth();

  const { submitProduct, updateDescription } = useSellerProductUpdate();

  const [formOpen, setFormOpen] = useState(false);

  const [activeTab, setActiveTab] = useState("description");

  const [editingDescription, setEditingDescription] = useState(false);

  const [draftDescription, setDraftDescription] = useState("");

  const [savingDescription, setSavingDescription] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["product-detail", productId],

    enabled: Boolean(productId),

    staleTime: 0,

    refetchOnWindowFocus: true,

    gcTime: moduleCachePolicy.marketplace.gcTime,

    queryFn: async () => {
      if (productId) {
        const sellerResult = await fetchSellerProduct(productId);
        if (sellerResult.ok) {
          const productRow = sellerResult.data.product;
          return { product: dbToProduct(productRow), rawRow: productRow };
        }
      }

      const detailRes = await fetch(
        `${API_BASE}/v1/marketplace/products/${productId}/details`,
        {
          cache: "no-store",
        },
      );

      if (detailRes.ok) {
        const body = (await detailRes.json()) as {
          data?: { product?: Record<string, unknown> };
        };

        const productRow = body.data?.product;

        if (!productRow)
          return {
            product: null as ExtendedProduct | null,
            rawRow: null as Record<string, unknown> | null,
          };

        return { product: dbToProduct(productRow), rawRow: productRow };
      }

      const { data: productRow } = await api
        .from("products")
        .select("*")
        .eq("id", productId)
        .single();

      if (!productRow)
        return {
          product: null as ExtendedProduct | null,
          rawRow: null as Record<string, unknown> | null,
        };

      const row = productRow as Record<string, unknown>;

      return { product: dbToProduct(row), rawRow: row };
    },
  });

  const { data: reviewsSummary } = useQuery({
    queryKey: ["product-reviews", productId, 1],

    enabled: Boolean(productId),

    queryFn: () => fetchProductReviews(productId!),
  });

  const product = data?.product || null;

  const rawRow = data?.rawRow || null;

  const displayReviewCount = reviewsSummary?.ok
    ? reviewsSummary.total
    : (product?.reviewCount ?? 0);

  const displayRating = reviewsSummary?.ok
    ? reviewsSummary.averageRating
    : (product?.rating ?? 0);

  const productLane = useMemo(():
    | Exclude<MarketplaceLane, "all">
    | undefined => {
    if (!product) return undefined;

    const lane = getLaneForProductCategory(product.category);

    return lane === "all" ? undefined : lane;
  }, [product]);

  const formInitialValues = useMemo(
    () => (rawRow ? fromDbRow(rawRow) : undefined),

    [rawRow],
  );

  useEffect(() => {
    if (isLoading || !product || !user?.id) return;

    if (product.sellerId !== user.id) {
      toast.error("You can only manage your own products");

      navigate("/seller/my-shop", { replace: true });
    }
  }, [isLoading, product, user?.id, navigate]);

  const openEditProduct = () => setFormOpen(true);

  const listingStatus = String(rawRow?.listing_status || "approved");
  const isLiveListing = listingStatus === "approved";

  const startEditDescription = () => {
    setDraftDescription(product?.description || "");

    setEditingDescription(true);
  };

  const cancelEditDescription = () => {
    setEditingDescription(false);

    setDraftDescription("");
  };

  const saveDescription = async () => {
    if (!productId) return;

    setSavingDescription(true);

    try {
      await updateDescription(productId, draftDescription);

      setEditingDescription(false);

      void refetch();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to save description",
      );
    } finally {
      setSavingDescription(false);
    }
  };

  const handleFormSubmit = async (
    values: Parameters<typeof submitProduct>[1],
  ) => {
    if (!productId) return;

    await submitProduct("edit", values, {
      editingId: productId,

      listingStatus:
        rawRow?.listing_status != null ? String(rawRow.listing_status) : null,

      onSuccess: () => void refetch(),
    });
  };

  if (isLoading && !product) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Loading product…
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-muted-foreground">Product not found</p>

        <Button variant="outline" onClick={() => navigate("/seller/my-shop")}>
          Back to My Shop
        </Button>
      </div>
    );
  }

  if (user?.id && product.sellerId !== user.id) {
    return (
      <p className="text-center py-12 text-muted-foreground">Redirecting…</p>
    );
  }

  const discount = product.originalPrice
    ? Math.round(
        ((product.originalPrice - product.price) / product.originalPrice) * 100,
      )
    : 0;

  const specRows: [string, string][] = [
    ["Category", product.category],

    ["Unit", product.unit],

    ["Stock", `${product.stock} available`],

    ["Rating", `${Number(displayRating).toFixed(1)} / 5`],

    ["Reviews", `${displayReviewCount} verified reviews`],

    ["Location", product.location || "—"],

    ["Free delivery", product.freeDelivery ? "Yes" : "No"],

    ...(product.freeDelivery
      ? []
      : [
          [
            "Dhaka metro delivery",
            formatBdt(product.deliveryChargeDhaka ?? DEFAULT_DELIVERY_DHAKA),
          ],

          [
            "Outside Dhaka delivery",
            formatBdt(
              product.deliveryChargeOutside ?? DEFAULT_DELIVERY_OUTSIDE,
            ),
          ],
        ]),
  ];

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      {formInitialValues && (
        <ProductFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          mode="edit"
          initialValues={formInitialValues}
          allowedLane={productLane}
          onSubmit={handleFormSubmit}
        />
      )}

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/seller/my-shop")}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            My Shop
          </Button>

          <Badge variant="secondary" className="text-xs">
            Seller view
          </Badge>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" asChild>
            <Link to="/seller/reviews">
              <Star className="h-3.5 w-3.5 mr-1" />
              All reviews
            </Link>
          </Button>

          <Button
            size="sm"
            className="text-white"
            style={{ backgroundColor: VENDOR_THEME.primary }}
            onClick={openEditProduct}
          >
            <Pencil className="h-3.5 w-3.5 mr-1" />
            Edit product
          </Button>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="shadow-card overflow-hidden">
          <div className="h-1" style={{ background: vendorGradient() }} />

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="relative min-h-[240px] md:min-h-[320px] bg-accent/20 flex items-center justify-center p-6">
              {product.image ? (
                <img
                  src={product.image}
                  alt={product.name}
                  className="max-h-[280px] w-full max-w-full object-contain"
                />
              ) : (
                <Package className="h-20 w-20 text-muted-foreground/30" />
              )}

              {discount > 0 && (
                <Badge
                  className="absolute top-3 left-3 text-sm font-bold"
                  style={{
                    backgroundColor: ICON_COLORS.health,
                    color: "white",
                  }}
                >
                  -{discount}% OFF
                </Badge>
              )}
            </div>

            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">{product.category}</Badge>
                <Badge
                  variant="outline"
                  className={listingStatusBadgeClass(listingStatus)}
                >
                  {listingStatusLabel(listingStatus)}
                </Badge>
              </div>

              {isLiveListing && rawRow && (
                <SellerFlashSaleActions
                  product={{
                    id: product.id,
                    price: product.price,
                    listing_status: listingStatus,
                    is_flash_sale: Boolean(rawRow.is_flash_sale),
                    flash_sale_request_status:
                      rawRow.flash_sale_request_status != null
                        ? String(rawRow.flash_sale_request_status)
                        : null,
                    flash_sale_review_notes:
                      rawRow.flash_sale_review_notes != null
                        ? String(rawRow.flash_sale_review_notes)
                        : null,
                  }}
                  onChanged={() => void refetch()}
                />
              )}

              <h1 className="text-2xl font-display font-bold text-foreground">
                {product.name}
              </h1>

              {!isLiveListing && (
                <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-yellow-300 bg-yellow-50/50 dark:bg-yellow-950/20 px-3 py-2">
                  This listing is not live on the marketplace yet. It will appear for
                  buyers after admin approval.
                </p>
              )}

              <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <Star
                    className="h-4 w-4"
                    style={marketplaceStarStyle(true)}
                  />
                  {Number(displayRating).toFixed(1)} ({displayReviewCount}{" "}
                  reviews)
                </span>

                <span className="flex items-center gap-1">
                  <Package className="h-4 w-4" />
                  {product.stock} in stock
                </span>
              </div>

              <p className="text-sm text-muted-foreground">
                {product.description
                  ? product.description.length > 120
                    ? `${product.description.slice(0, 120)}…`
                    : product.description
                  : "No description yet."}{" "}
                <button
                  type="button"
                  className="text-primary underline-offset-2 hover:underline font-medium"
                  onClick={() => setActiveTab("description")}
                >
                  Edit in Description tab
                </button>
              </p>

              <div className="flex items-baseline gap-3">
                <p
                  className="text-3xl font-bold"
                  style={{ color: VENDOR_THEME.primaryDark }}
                >
                  ৳{product.price.toLocaleString()}
                </p>

                {product.originalPrice && (
                  <p className="text-lg text-muted-foreground line-through">
                    ৳{product.originalPrice}
                  </p>
                )}

                <span className="text-sm text-muted-foreground">
                  /{product.unit}
                </span>
              </div>

              <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-3 bg-muted/20">
                Edit description and specifications in the tabs below. Reply to
                reviews and questions on the Reviews and Questions tabs — your
                responses appear on the public product page.
              </p>
            </CardContent>
          </div>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="shadow-card">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0 flex-wrap h-auto">
              <TabsTrigger
                value="description"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
              >
                Description
              </TabsTrigger>

              <TabsTrigger
                value="specifications"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
              >
                Specifications
              </TabsTrigger>

              <TabsTrigger
                value="reviews"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
              >
                Reviews ({displayReviewCount})
              </TabsTrigger>

              <TabsTrigger
                value="comments"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
              >
                Questions
              </TabsTrigger>
            </TabsList>

            <TabsContent value="description" className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <h3 className="text-lg font-semibold text-foreground">
                    About this product
                  </h3>

                  {!editingDescription && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={startEditDescription}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      Edit description
                    </Button>
                  )}
                </div>

                {editingDescription ? (
                  <div className="space-y-3">
                    <Textarea
                      value={draftDescription}
                      onChange={(e) => setDraftDescription(e.target.value)}
                      rows={8}
                      placeholder="Describe your product — ingredients, size, usage, benefits…"
                      className="resize-y min-h-[160px]"
                    />

                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        size="sm"
                        className="text-white"
                        style={{ backgroundColor: VENDOR_THEME.primary }}
                        onClick={() => void saveDescription()}
                        disabled={savingDescription}
                      >
                        {savingDescription && (
                          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                        )}
                        Save description
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={cancelEditDescription}
                        disabled={savingDescription}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground leading-relaxed">
                    {product.description ||
                      "No description available for this product."}
                  </p>
                )}

                <Separator />

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Category</p>

                    <p className="font-medium text-foreground">
                      {product.category}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-muted-foreground">Availability</p>

                    <p
                      className="font-medium"
                      style={{
                        color:
                          product.stock > 0
                            ? ICON_COLORS.farm
                            : ICON_COLORS.health,
                      }}
                    >
                      {product.stock > 0 ? "In Stock" : "Out of Stock"}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-muted-foreground">Delivery</p>

                    <p className="font-medium text-foreground">
                      {product.freeDelivery
                        ? "Free Delivery"
                        : `${formatBdt(product.deliveryChargeDhaka ?? DEFAULT_DELIVERY_DHAKA)} (Dhaka) / ${formatBdt(product.deliveryChargeOutside ?? DEFAULT_DELIVERY_OUTSIDE)} (outside)`}
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="specifications" className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <h3 className="text-lg font-semibold text-foreground">
                    Product specifications
                  </h3>

                  <Button variant="outline" size="sm" onClick={openEditProduct}>
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    Edit specifications
                  </Button>
                </div>

                <div className="space-y-3">
                  {specRows.map(([label, value]) => (
                    <div
                      key={label}
                      className="flex justify-between py-2 border-b border-border last:border-0"
                    >
                      <span className="text-muted-foreground">{label}</span>

                      <span className="font-medium text-foreground">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="reviews" className="p-6">
              <ProductReviewsList
                productId={product.id}
                averageRating={displayRating}
                reviewCount={displayReviewCount}
                isProductOwner
              />
            </TabsContent>

            <TabsContent value="comments" className="p-6">
              <ProductCommentsSection productId={product.id} isProductOwner />
            </TabsContent>
          </Tabs>
        </Card>
      </motion.div>
    </div>
  );
}
