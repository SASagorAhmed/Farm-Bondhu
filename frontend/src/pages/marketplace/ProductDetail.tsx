import { useParams, useNavigate, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { API_BASE, api } from "@/api/client";
import { Product } from "@/data/mockData";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  ShoppingCart,
  Star,
  MapPin,
  ArrowLeft,
  Package,
  Truck,
  Zap,
  ShieldCheck,
  CheckCircle,
  CalendarDays,
  ShoppingBag,
  BarChart3,
  Tag,
  Trash2,
  Store,
} from "lucide-react";
import TalkToSellerButton from "@/components/marketplace/TalkToSellerButton";
import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAdminPreviewMode } from "@/hooks/useAdminPreviewMode";
import { ICON_COLORS } from "@/lib/iconColors";
import {
  MARKETPLACE_THEME,
  marketplaceGradient,
  marketplaceProductTabClass,
  marketplaceStarStyle,
  DEFAULT_DELIVERY_DHAKA,
  DEFAULT_DELIVERY_OUTSIDE,
  formatBdt,
} from "@/lib/marketplaceTheme";
import { getSellerDisplayName } from "@/lib/marketplaceProduct";
import { shopPath } from "@/lib/marketplaceShopApi";
import {
  suggestedWholesaleQty,
  wholesaleRuleLabel,
  wholesaleThresholdStatus,
  normalizeWholesaleRule,
} from "@/lib/wholesalePricing";
import { useQuery } from "@tanstack/react-query";
import { moduleCachePolicy } from "@/lib/queryClient";
import ProductReviewsList from "@/components/marketplace/ProductReviewsList";
import ProductCommentsSection from "@/components/marketplace/ProductCommentsSection";
import { fetchProductReviews } from "@/lib/marketplaceReviewsApi";
import { fetchSellerProduct } from "@/lib/sellerProductApi";

interface ExtendedProduct extends Product {
  shopName?: string;
  is_verified_seller?: boolean;
  wholesale_price?: number | null;
  wholesale_min_qty?: number | null;
  wholesale_min_order_bdt?: number | null;
  wholesale_rule?: string | null;
}

function dbToProduct(row: any): ExtendedProduct {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    price: Number(row.price),
    originalPrice: row.original_price ? Number(row.original_price) : undefined,
    unit: row.unit,
    image: row.image,
    seller: row.seller_name,
    sellerId: row.seller_id,
    shopName: row.shop_name != null ? String(row.shop_name) : undefined,
    rating: Number(row.rating),
    reviewCount: row.review_count,
    stock: row.stock,
    description: row.description,
    location: row.location,
    freeDelivery: row.free_delivery,
    deliveryChargeDhaka:
      row.delivery_charge_dhaka != null
        ? Number(row.delivery_charge_dhaka)
        : null,
    deliveryChargeOutside:
      row.delivery_charge_outside != null
        ? Number(row.delivery_charge_outside)
        : null,
    is_verified_seller: row.is_verified_seller,
    wholesale_price: row.wholesale_price ? Number(row.wholesale_price) : null,
    wholesale_min_qty: row.wholesale_min_qty,
    wholesale_min_order_bdt: row.wholesale_min_order_bdt
      ? Number(row.wholesale_min_order_bdt)
      : null,
    wholesale_rule: row.wholesale_rule,
  };
}

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { user } = useAuth();
  const { canModerate } = useAdminPreviewMode();
  const [qty, setQty] = useState(1);
  const [deleting, setDeleting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["product-detail", id, user?.id],
    enabled: Boolean(id),
    staleTime: 0,
    refetchOnWindowFocus: true,
    gcTime: moduleCachePolicy.marketplace.gcTime,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const detailRes = await fetch(
        `${API_BASE}/v1/marketplace/products/${id}/details`,
        {
          cache: "no-store",
        },
      );
      if (detailRes.ok) {
        const body = (await detailRes.json()) as {
          data?: { product?: any; shop?: any };
        };
        const productRow = body.data?.product;
        if (!productRow)
          return {
            product: null as ExtendedProduct | null,
            shop: null as any,
            ownerPreview: false,
            previewListingStatus: null as string | null,
          };
        return {
          product: dbToProduct(productRow),
          shop: body.data?.shop || null,
          ownerPreview: false,
          previewListingStatus: null,
        };
      }

      if (user?.id && id) {
        const sellerResult = await fetchSellerProduct(id);
        if (sellerResult.ok) {
          const productRow = sellerResult.data.product;
          if (String(productRow.seller_id) === user.id) {
            const listingStatus = String(
              productRow.listing_status || "approved",
            );
            return {
              product: dbToProduct(productRow),
              shop: sellerResult.data.shop || null,
              ownerPreview: listingStatus !== "approved",
              previewListingStatus: listingStatus,
            };
          }
        }
      }

      const { data: productRow } = await api
        .from("products")
        .select("*")
        .eq("id", id)
        .single();
      if (!productRow)
        return {
          product: null as ExtendedProduct | null,
          shop: null as any,
          ownerPreview: false,
          previewListingStatus: null as string | null,
        };
      const product = dbToProduct(productRow);
      const { data: shop } = await api
        .from("shops")
        .select("*")
        .eq("user_id", product.sellerId)
        .single();
      return {
        product,
        shop: shop || null,
        ownerPreview: false,
        previewListingStatus: null,
      };
    },
  });

  const { data: reviewsSummary } = useQuery({
    queryKey: ["product-reviews", id, 1],
    enabled: Boolean(id),
    queryFn: () => fetchProductReviews(id!),
  });

  const product = data?.product || null;
  const shop = data?.shop || null;
  const ownerPreview = data?.ownerPreview ?? false;
  const previewListingStatus = data?.previewListingStatus ?? null;
  const displayReviewCount = reviewsSummary?.ok
    ? reviewsSummary.total
    : (product?.reviewCount ?? 0);
  const displayRating = reviewsSummary?.ok
    ? reviewsSummary.averageRating
    : (product?.rating ?? 0);

  if (isLoading && !product)
    return (
      <div className="text-center py-12 text-muted-foreground">Loading...</div>
    );
  if (!product)
    return (
      <div className="text-center py-12 text-muted-foreground">
        Product not found
      </div>
    );

  const discount = product.originalPrice
    ? Math.round(
        ((product.originalPrice - product.price) / product.originalPrice) * 100,
      )
    : 0;
  const hasWholesale = Boolean(
    product.wholesale_price && product.wholesale_price < product.price,
  );
  const wholesaleSavings = hasWholesale
    ? Math.round(
        ((product.price - product.wholesale_price!) / product.price) * 100,
      )
    : 0;
  const wholesaleQty = hasWholesale ? suggestedWholesaleQty(product) : 1;
  const wholesaleThreshold = hasWholesale
    ? wholesaleThresholdStatus(product, wholesaleQty)
    : null;
  const sellerDisplayName = getSellerDisplayName(product, shop);
  const isFarmBondhuOfficial =
    sellerDisplayName === "FarmBondhu" || product.seller === "FarmBondhu";
  const isProductOwner = Boolean(
    user?.id && product.sellerId && user.id === product.sellerId,
  );

  const deleteProduct = async () => {
    if (!product?.id || deleting) return;
    setDeleting(true);
    const { error } = await api.from("products").delete().eq("id", product.id);
    setDeleting(false);
    if (error) {
      toast.error(error.message || "Failed to delete product");
      return;
    }
    toast.success("Product deleted");
    navigate("/marketplace");
  };

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      <Button variant="ghost" onClick={() => navigate(-1)}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>
      {ownerPreview && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50/80 dark:bg-yellow-950/30 px-4 py-3 text-sm text-foreground">
          <strong>Preview</strong> — this listing is not live on the marketplace
          yet
          {previewListingStatus === "rejected"
            ? " (rejected — edit and resubmit for review)"
            : " (pending admin review)"}
          . Only you can see this page until it is approved.
        </div>
      )}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="shadow-card overflow-hidden">
          <div className="h-1" style={{ background: marketplaceGradient() }} />
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="relative min-h-[280px] md:min-h-[360px] bg-accent/20 flex items-center justify-center p-6">
              {product.image ? (
                <img
                  src={product.image}
                  alt={product.name}
                  className="max-h-[320px] w-full max-w-full object-contain"
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
              {product.freeDelivery && (
                <div
                  className="absolute bottom-3 left-3 flex items-center gap-1 px-2 py-1 rounded text-xs font-bold"
                  style={{
                    backgroundColor: MARKETPLACE_THEME.primary,
                    color: "white",
                  }}
                >
                  <Truck className="h-3.5 w-3.5" /> FREE DELIVERY
                </div>
              )}
            </div>
            <CardContent className="p-6 space-y-4">
              <Badge variant="outline">{product.category}</Badge>
              <h1 className="text-2xl font-display font-bold text-foreground">
                {product.name}
              </h1>
              <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <Star
                    className="h-4 w-4"
                    style={marketplaceStarStyle(true)}
                  />
                  {Number(displayRating).toFixed(1)} ({displayReviewCount})
                </span>
                {product.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {product.location}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Package className="h-4 w-4" />
                  {product.stock} available
                </span>
              </div>
              <p className="text-muted-foreground">{product.description}</p>
              <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold shrink-0"
                  style={{ backgroundColor: MARKETPLACE_THEME.primary }}
                >
                  {sellerDisplayName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Sold by</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground">
                      {sellerDisplayName}
                    </span>
                    {isFarmBondhuOfficial && (
                      <Badge
                        className="text-[10px] gap-1"
                        style={{
                          backgroundColor: ICON_COLORS.farm,
                          color: "white",
                        }}
                      >
                        <ShieldCheck className="h-3 w-3" />
                        FarmBondhu Official
                      </Badge>
                    )}
                    {product.is_verified_seller && !isFarmBondhuOfficial && (
                      <Badge
                        className="text-[10px] gap-1"
                        style={{
                          backgroundColor: MARKETPLACE_THEME.primary,
                          color: "white",
                        }}
                      >
                        <CheckCircle className="h-3 w-3" />
                        FarmBondhu Verified
                      </Badge>
                    )}
                  </div>
                </div>
                <TalkToSellerButton
                  sellerId={product.sellerId}
                  productId={product.id}
                  variant="chatNow"
                />
              </div>
              <div className="flex items-baseline gap-3">
                <p
                  className="text-3xl font-bold"
                  style={{ color: ICON_COLORS.health }}
                >
                  ৳{product.price}
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
              <div className="flex items-center border rounded-md w-fit">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setQty(Math.max(1, qty - 1))}
                >
                  -
                </Button>
                <span className="px-4 font-medium text-foreground">{qty}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setQty(qty + 1)}
                >
                  +
                </Button>
              </div>
              <div className="flex gap-3 flex-wrap">
                <Button
                  variant="outline"
                  className="flex-1"
                  style={{
                    borderColor: MARKETPLACE_THEME.primary,
                    color: MARKETPLACE_THEME.primary,
                  }}
                  onClick={() => {
                    addItem(product, qty);
                    toast.success(`${product.name} added to cart`);
                  }}
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Add to Cart
                </Button>
                <Button
                  className="flex-1 text-white"
                  style={{ backgroundColor: MARKETPLACE_THEME.primary }}
                  onClick={() => {
                    addItem(product, qty);
                    navigate("/checkout");
                  }}
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Buy Now — ৳{(product.price * qty).toLocaleString()}
                </Button>
              </div>
              {canModerate && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      className="w-full"
                      disabled={deleting}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete product
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this product?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently remove this listing from the
                        marketplace. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={deleteProduct}
                        className="bg-destructive text-destructive-foreground"
                      >
                        Delete as Super Admin
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              {/* Wholesale pricing — applies when seller thresholds are met at checkout */}
              {hasWholesale && (
                <div
                  className="rounded-lg border-2 p-4 space-y-2"
                  style={{
                    borderColor: ICON_COLORS.finance,
                    backgroundColor: `${ICON_COLORS.finance}08`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Tag
                      className="h-4 w-4"
                      style={{ color: ICON_COLORS.finance }}
                    />
                    <span className="font-semibold text-sm text-foreground">
                      Wholesale Price Available
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {wholesaleRuleLabel(
                        normalizeWholesaleRule(product.wholesale_rule),
                      )}
                    </Badge>
                  </div>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span
                      className="text-2xl font-bold"
                      style={{ color: ICON_COLORS.finance }}
                    >
                      ৳{product.wholesale_price}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      /{product.unit}
                    </span>
                  </div>
                  {product.wholesale_min_qty &&
                    (product.wholesale_rule === "quantity" ||
                      product.wholesale_rule === "quantity_and_value" ||
                      !product.wholesale_rule) && (
                      <p className="text-xs text-muted-foreground">
                        Minimum {product.wholesale_min_qty} units
                      </p>
                    )}
                  {product.wholesale_min_order_bdt &&
                    (product.wholesale_rule === "order_value" ||
                      product.wholesale_rule === "quantity_and_value") && (
                      <p className="text-xs text-muted-foreground">
                        Minimum ৳{product.wholesale_min_order_bdt} on this line
                        (retail value)
                      </p>
                    )}
                  {wholesaleSavings > 0 && (
                    <p
                      className="text-xs font-medium"
                      style={{ color: ICON_COLORS.farm }}
                    >
                      You save up to {wholesaleSavings}% vs retail price
                    </p>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      className="flex-1"
                      style={{
                        borderColor: ICON_COLORS.finance,
                        color: ICON_COLORS.finance,
                      }}
                      disabled={product.stock < wholesaleQty}
                      onClick={() => {
                        if (product.stock < wholesaleQty) {
                          toast.error(`Only ${product.stock} in stock`);
                          return;
                        }
                        addItem(product, wholesaleQty, "wholesale");
                        toast.success(
                          `${product.name} added to cart (wholesale)`,
                        );
                      }}
                    >
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Add Wholesale ({wholesaleQty} {product.unit})
                    </Button>
                    <Button
                      className="flex-1 text-white"
                      style={{ backgroundColor: ICON_COLORS.finance }}
                      disabled={product.stock < wholesaleQty}
                      onClick={() => {
                        if (product.stock < wholesaleQty) {
                          toast.error(`Only ${product.stock} in stock`);
                          return;
                        }
                        addItem(product, wholesaleQty, "wholesale");
                        navigate("/checkout");
                      }}
                    >
                      <ShoppingBag className="h-4 w-4 mr-2" />
                      Buy Wholesale
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </div>
        </Card>
      </motion.div>

      {/* Product Description Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="shadow-card">
          <Tabs defaultValue="description">
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0 flex-wrap h-auto">
              <TabsTrigger
                value="description"
                className={marketplaceProductTabClass}
              >
                Description
              </TabsTrigger>
              <TabsTrigger
                value="specifications"
                className={marketplaceProductTabClass}
              >
                Specifications
              </TabsTrigger>
              <TabsTrigger
                value="reviews"
                className={marketplaceProductTabClass}
              >
                Reviews ({displayReviewCount})
              </TabsTrigger>
              <TabsTrigger
                value="comments"
                className={marketplaceProductTabClass}
              >
                Comments
              </TabsTrigger>
            </TabsList>
            <TabsContent value="description" className="p-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">
                  About this product
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {product.description ||
                    "No description available for this product."}
                </p>
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
              <div className="space-y-3">
                {[
                  ["Category", product.category],
                  ["Unit", product.unit],
                  ["Stock", `${product.stock} available`],
                  ["Rating", `${Number(displayRating).toFixed(1)} / 5`],
                  ["Reviews", `${displayReviewCount} reviews`],
                  ["Location", product.location],
                  ["Free Delivery", product.freeDelivery ? "Yes" : "No"],
                  ...(product.freeDelivery
                    ? []
                    : [
                        [
                          "Dhaka metro delivery",
                          formatBdt(
                            product.deliveryChargeDhaka ??
                              DEFAULT_DELIVERY_DHAKA,
                          ),
                        ],
                        [
                          "Outside Dhaka delivery",
                          formatBdt(
                            product.deliveryChargeOutside ??
                              DEFAULT_DELIVERY_OUTSIDE,
                          ),
                        ],
                      ]),
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex justify-between py-2 border-b border-border last:border-0"
                  >
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium text-foreground">{value}</span>
                  </div>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="reviews" className="p-6">
              <ProductReviewsList
                productId={product.id}
                averageRating={displayRating}
                reviewCount={displayReviewCount}
                isProductOwner={isProductOwner}
              />
            </TabsContent>
            <TabsContent value="comments" className="p-6">
              <ProductCommentsSection
                productId={product.id}
                isProductOwner={isProductOwner}
              />
            </TabsContent>
          </Tabs>
        </Card>
      </motion.div>

      {/* Seller Info Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="shadow-card p-6">
          <div className="flex items-start gap-4 flex-wrap">
            <div
              className="h-12 w-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
              style={{ backgroundColor: MARKETPLACE_THEME.primary }}
            >
              {sellerDisplayName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-start gap-2 flex-wrap justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-semibold text-foreground">
                    {sellerDisplayName}
                  </h3>
                  {shop?.is_verified && (
                    <Badge
                      className="text-[10px] gap-1"
                      style={{
                        backgroundColor: MARKETPLACE_THEME.primary,
                        color: "white",
                      }}
                    >
                      <CheckCircle className="h-3 w-3" />
                      Verified
                    </Badge>
                  )}
                  {!shop &&
                    product.is_verified_seller &&
                    !isFarmBondhuOfficial && (
                      <Badge
                        className="text-[10px] gap-1"
                        style={{
                          backgroundColor: MARKETPLACE_THEME.primary,
                          color: "white",
                        }}
                      >
                        <CheckCircle className="h-3 w-3" />
                        FarmBondhu Verified
                      </Badge>
                    )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {!isFarmBondhuOfficial && product.sellerId && (
                    <Button variant="outline" size="sm" asChild>
                      <Link to={shopPath(product.sellerId)}>
                        <Store className="h-4 w-4 mr-1" />
                        Visit Shop
                      </Link>
                    </Button>
                  )}
                  <TalkToSellerButton
                    sellerId={product.sellerId}
                    productId={product.id}
                    variant="chatNow"
                  />
                </div>
              </div>
              {shop?.description ? (
                <p className="text-sm text-muted-foreground">
                  {shop.description}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Questions about this product? Message the seller directly.
                </p>
              )}
            </div>
          </div>
          {shop && (
            <>
              <Separator className="my-4" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span>{shop.location || "N/A"}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ShoppingBag className="h-4 w-4 shrink-0" />
                  <span>{shop.total_products} products</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <BarChart3 className="h-4 w-4 shrink-0" />
                  <span>
                    {Number(shop.total_units_sold ?? 0).toLocaleString()} sold
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CalendarDays className="h-4 w-4 shrink-0" />
                  <span>
                    Since{" "}
                    {new Date(shop.created_date).toLocaleDateString("en-GB", {
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </div>
            </>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
