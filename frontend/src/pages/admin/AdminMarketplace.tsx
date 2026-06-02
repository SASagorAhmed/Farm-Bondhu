import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { api } from "@/api/client";
import { useAuth, isSuperAdmin } from "@/contexts/AuthContext";
import { CheckCircle, ShieldCheck, Store, Package, MapPin, Star, X, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ICON_COLORS } from "@/lib/iconColors";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { moduleCachePolicy, queryKeys } from "@/lib/queryClient";
import AdminMarketplaceBanners from "@/components/marketplace/AdminMarketplaceBanners";
import AdminFlashSaleManager from "@/components/admin/AdminFlashSaleManager";
import { useAdminFlashSalePendingCount } from "@/components/admin/AdminFlashSalePendingRequests";
import AdminMarketplaceChatSoundSettings from "@/components/marketplace/AdminMarketplaceChatSoundSettings";
import { adminListPendingProducts, adminModerateProductListing } from "@/lib/sellerOnboardingApi";
import {
  fetchAdminProducts,
  fetchAdminShopsList,
  adminSetShopVerified,
  adminVerifySellerProducts,
  type AdminSellerRow,
} from "@/lib/adminMarketplaceApi";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "react-router-dom";
import { Zap } from "lucide-react";

export default function AdminMarketplace() {
  const { user } = useAuth();
  const canDeleteProducts = isSuperAdmin(user);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [listingReviewTarget, setListingReviewTarget] = useState<any>(null);
  const [listingReviewAction, setListingReviewAction] = useState<"approve" | "reject">("approve");
  const [listingReviewNotes, setListingReviewNotes] = useState("");
  const [listingReviewSubmitting, setListingReviewSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const {
    data: products = [],
    isError: productsError,
    isLoading: productsLoading,
  } = useQuery({
    queryKey: queryKeys().adminMarketplaceProducts(),
    staleTime: moduleCachePolicy.admin.staleTime,
    gcTime: moduleCachePolicy.admin.gcTime,
    queryFn: async () => fetchAdminProducts({ limit: 500 }),
  });
  const {
    data: shops = [],
    isError: shopsError,
    isLoading: shopsLoading,
  } = useQuery({
    queryKey: queryKeys().adminMarketplaceShops(),
    staleTime: moduleCachePolicy.admin.staleTime,
    gcTime: moduleCachePolicy.admin.gcTime,
    queryFn: async () => fetchAdminShopsList({ limit: 500 }),
  });

  useEffect(() => {
    if (productsError) toast.error("Failed to load marketplace products");
  }, [productsError]);
  useEffect(() => {
    if (shopsError) toast.error("Failed to load marketplace shops");
  }, [shopsError]);
  const { data: pendingListings = [] } = useQuery({
    queryKey: ["admin-pending-listings"],
    staleTime: moduleCachePolicy.admin.staleTime,
    gcTime: moduleCachePolicy.admin.gcTime,
    queryFn: async () => {
      const { ok, data, error } = await adminListPendingProducts();
      if (!ok) {
        toast.error(error || "Failed to load listing queue");
        return [];
      }
      return data || [];
    },
  });

  // Open product detail modal from query param
  useEffect(() => {
    const productId = searchParams.get("product");
    if (productId && products.length > 0) {
      const found = products.find(p => p.id === productId);
      if (found) setSelectedProduct(found);
    }
  }, [searchParams, products]);

  const closeProductModal = () => {
    setSelectedProduct(null);
    searchParams.delete("product");
    setSearchParams(searchParams, { replace: true });
  };

  const deleteProduct = async (productId: string) => {
    const { error } = await api.from("products").delete().eq("id", productId);
    if (error) {
      toast.error(error.message || "Failed to delete product");
      return;
    }
    toast.success("Product deleted");
    if (selectedProduct?.id === productId) closeProductModal();
    queryClient.invalidateQueries({ queryKey: queryKeys().adminMarketplaceProducts() });
  };

  const submitListingReview = async () => {
    if (!listingReviewTarget?.id) return;
    setListingReviewSubmitting(true);
    const { ok, error } = await adminModerateProductListing(
      String(listingReviewTarget.id),
      listingReviewAction,
      listingReviewNotes.trim() || undefined
    );
    setListingReviewSubmitting(false);
    if (!ok) {
      toast.error(error || "Listing review failed");
      return;
    }
    toast.success(listingReviewAction === "approve" ? "Listing approved" : "Listing rejected");
    setListingReviewTarget(null);
    queryClient.invalidateQueries({ queryKey: ["admin-pending-listings"] });
    queryClient.invalidateQueries({ queryKey: queryKeys().adminMarketplaceProducts() });
  };

  const { data: pendingFlashCount = 0 } = useAdminFlashSalePendingCount();

  const toggleVerify = async (shop: AdminSellerRow) => {
    const newVal = !shop.is_verified;
    try {
      await adminSetShopVerified(shop.user_id, newVal, user?.id);
      await adminVerifySellerProducts(shop.user_id, newVal);
      toast.success(newVal ? "Shop verified!" : "Verification removed");
      queryClient.invalidateQueries({ queryKey: queryKeys().adminMarketplaceShops() });
      queryClient.invalidateQueries({ queryKey: queryKeys().adminMarketplaceProducts() });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verification update failed");
    }
  };

  const activeTab = searchParams.get("tab") || "products";
  const setActiveTab = (tab: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    if (tab !== "flash-sale") next.delete("shop");
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    const channels = [
      { name: "admin-marketplace-products-live", table: "products", key: queryKeys().adminMarketplaceProducts() },
      { name: "admin-marketplace-shops-live", table: "shops", key: queryKeys().adminMarketplaceShops() },
    ].map((entry) =>
      api
        .channel(entry.name)
        .on("postgres_changes", { event: "*", schema: "public", table: entry.table }, () => {
          queryClient.invalidateQueries({ queryKey: entry.key });
        })
        .subscribe()
    );
    return () => {
      channels.forEach((channel) => api.removeChannel(channel));
    };
  }, [queryClient]);

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Marketplace</h1>
        <p className="text-muted-foreground mt-1">Moderate products and verify shops</p>
      </motion.div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="products">Products ({products.length})</TabsTrigger>
          <TabsTrigger value="listing-review">Listing review ({pendingListings.length})</TabsTrigger>
          <TabsTrigger value="shops">Shops ({shops.length})</TabsTrigger>
          <TabsTrigger value="flash-sale" className="gap-1.5">
            Flash Sale
            {pendingFlashCount > 0 && (
              <Badge variant="secondary" className="h-5 min-w-5 px-1 text-[10px]">
                {pendingFlashCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="banners">Banners</TabsTrigger>
          <TabsTrigger value="sound">Sound settings</TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <Card className="shadow-card overflow-hidden">
            <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.marketplace}, ${ICON_COLORS.vet})` }} />
            <CardHeader><CardTitle className="text-lg font-display">All Products</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Seller</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Status</TableHead>
                    {canDeleteProducts && <TableHead className="w-[80px]">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map(p => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{p.name}</span>
                          {p.seller_name === "FarmBondhu" && <Badge className="text-[10px] gap-1" style={{ backgroundColor: ICON_COLORS.farm, color: "white" }}><ShieldCheck className="h-3 w-3" />Official</Badge>}
                          {p.is_verified_seller && p.seller_name !== "FarmBondhu" && <Badge className="text-[10px] gap-1" style={{ backgroundColor: ICON_COLORS.marketplace, color: "white" }}><CheckCircle className="h-3 w-3" />Verified</Badge>}
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{p.category}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{p.seller_name}</TableCell>
                      <TableCell className="text-foreground">৳{p.price}</TableCell>
                      <TableCell className="text-foreground">{p.stock}</TableCell>
                      <TableCell className="text-foreground">⭐ {p.rating}</TableCell>
                      <TableCell>
                        {(() => {
                          const ls = p.listing_status || "approved";
                          if (ls === "pending_review") {
                            return <Badge className="bg-yellow-100 text-yellow-800">Pending review</Badge>;
                          }
                          if (ls === "rejected") {
                            return <Badge className="bg-red-100 text-red-800">Rejected</Badge>;
                          }
                          return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
                        })()}
                      </TableCell>
                      {canDeleteProducts && (
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete this product?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently remove &ldquo;{p.name}&rdquo; from the marketplace.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteProduct(p.id)}
                                className="bg-destructive text-destructive-foreground"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {products.length === 0 && <p className="text-center text-muted-foreground py-8">No products yet</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="listing-review">
          <Card className="shadow-card overflow-hidden">
            <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.finance}, ${ICON_COLORS.marketplace})` }} />
            <CardHeader><CardTitle className="text-lg font-display">Pending product listings</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Seller</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingListings.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell><Badge variant="outline">{p.category}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{p.seller_name}</TableCell>
                      <TableCell>৳{p.price}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-700"
                          onClick={() => {
                            setListingReviewTarget(p);
                            setListingReviewAction("approve");
                            setListingReviewNotes("");
                          }}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive"
                          onClick={() => {
                            setListingReviewTarget(p);
                            setListingReviewAction("reject");
                            setListingReviewNotes("");
                          }}
                        >
                          <X className="h-4 w-4 mr-1" /> Reject
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {pendingListings.length === 0 && (
                <p className="text-center text-muted-foreground py-8">No products awaiting listing review</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shops">
          <Card className="shadow-card overflow-hidden">
            <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.store}, ${ICON_COLORS.farm})` }} />
            <CardHeader><CardTitle className="text-lg font-display flex items-center gap-2"><Store className="h-5 w-5" />Shop Verification</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Shop Name</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Products</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>FarmBondhu Verified</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shops.map(s => (
                    <TableRow key={s.user_id}>
                      <TableCell className="font-medium text-foreground">{s.shop_name}</TableCell>
                      <TableCell className="text-muted-foreground">{s.owner_name}</TableCell>
                      <TableCell className="text-muted-foreground">{s.location || "—"}</TableCell>
                      <TableCell className="text-foreground">{s.total_products}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{s.status}</Badge></TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          <Switch checked={s.is_verified} onCheckedChange={() => void toggleVerify(s)} />
                          {s.is_verified && <Badge className="text-[10px] gap-1" style={{ backgroundColor: ICON_COLORS.marketplace, color: "white" }}><ShieldCheck className="h-3 w-3" />Verified</Badge>}
                          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" asChild>
                            <Link to={`/admin/marketplace?tab=flash-sale&shop=${encodeURIComponent(s.user_id)}`}>
                              <Zap className="h-3 w-3" />
                              Flash sale
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {shopsLoading && shops.length === 0 && (
                <p className="text-center text-muted-foreground py-8">Loading shops…</p>
              )}
              {!shopsLoading && shopsError && (
                <p className="text-center text-destructive py-8">Could not load shops. Refresh the page.</p>
              )}
              {!shopsLoading && !shopsError && shops.length === 0 && (
                <p className="text-center text-muted-foreground py-8">No shops registered yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="flash-sale" className="mt-4">
          <AdminFlashSaleManager
            shops={shops}
            products={products}
            initialShopUserId={searchParams.get("shop")}
            shopsLoading={shopsLoading}
            shopsLoadError={shopsError}
            productsLoading={productsLoading}
            productsLoadError={productsError}
            onProductsChange={() => {
              queryClient.invalidateQueries({ queryKey: queryKeys().adminMarketplaceProducts() });
              queryClient.invalidateQueries({ queryKey: queryKeys().products() });
              queryClient.invalidateQueries({ queryKey: ["admin-flash-sale-requests", "pending"] });
            }}
          />
        </TabsContent>

        <TabsContent value="banners">
          <AdminMarketplaceBanners />
        </TabsContent>

        <TabsContent value="sound">
          <AdminMarketplaceChatSoundSettings />
        </TabsContent>
      </Tabs>

      {/* Product Detail Modal */}
      <Dialog open={!!selectedProduct} onOpenChange={(open) => { if (!open) closeProductModal(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <Package className="h-5 w-5" style={{ color: ICON_COLORS.marketplace }} />
              Product Details
            </DialogTitle>
            <DialogDescription>Overview of this listing, seller, and stock.</DialogDescription>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <img src={selectedProduct.image} alt={selectedProduct.name} className="h-24 w-24 rounded-xl object-cover bg-accent shrink-0 border" />
                <div className="min-w-0 space-y-1">
                  <h3 className="font-semibold text-foreground text-lg leading-tight">{selectedProduct.name}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold" style={{ color: ICON_COLORS.health }}>৳{selectedProduct.price}</span>
                    {selectedProduct.original_price && <span className="text-sm text-muted-foreground line-through">৳{selectedProduct.original_price}</span>}
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                    {selectedProduct.rating} ({selectedProduct.review_count} reviews)
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <p className="text-muted-foreground text-xs">Seller</p>
                  <p className="font-medium text-foreground">{selectedProduct.seller_name}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <p className="text-muted-foreground text-xs">Category</p>
                  <Badge variant="outline" className="capitalize mt-0.5">{selectedProduct.category}</Badge>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <p className="text-muted-foreground text-xs">Stock</p>
                  <p className="font-medium text-foreground">{selectedProduct.stock} {selectedProduct.unit}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <p className="text-muted-foreground text-xs">Listing</p>
                  <Badge variant="outline" className="mt-0.5 capitalize">{selectedProduct.listing_status || "approved"}</Badge>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5 col-span-2">
                  <p className="text-muted-foreground text-xs flex items-center gap-1"><MapPin className="h-3 w-3" />Location</p>
                  <p className="font-medium text-foreground">{selectedProduct.location}</p>
                </div>
              </div>

              {selectedProduct.description && (
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-muted-foreground text-xs mb-1">Description</p>
                  <p className="text-sm text-foreground">{selectedProduct.description}</p>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                {selectedProduct.is_verified_seller && <Badge className="text-[10px] gap-1" style={{ backgroundColor: ICON_COLORS.marketplace, color: "white" }}><ShieldCheck className="h-3 w-3" />Verified Seller</Badge>}
                {selectedProduct.free_delivery && <Badge variant="outline" className="text-[10px]">FREE DELIVERY</Badge>}
                {selectedProduct.seller_name === "FarmBondhu" && <Badge className="text-[10px] gap-1" style={{ backgroundColor: ICON_COLORS.farm, color: "white" }}><ShieldCheck className="h-3 w-3" />Official</Badge>}
                {canDeleteProducts && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="ml-auto">
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this product?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently remove this listing from the marketplace.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteProduct(selectedProduct.id)}
                        className="bg-destructive text-destructive-foreground"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(listingReviewTarget)} onOpenChange={(open) => !open && setListingReviewTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{listingReviewAction === "approve" ? "Approve listing" : "Reject listing"}</DialogTitle>
            <DialogDescription>{listingReviewTarget?.name}</DialogDescription>
          </DialogHeader>
          <Textarea
            value={listingReviewNotes}
            onChange={(e) => setListingReviewNotes(e.target.value)}
            placeholder={listingReviewAction === "reject" ? "Tell the seller what to fix…" : "Optional note"}
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setListingReviewTarget(null)}>Cancel</Button>
            <Button
              onClick={() => void submitListingReview()}
              disabled={listingReviewSubmitting || (listingReviewAction === "reject" && !listingReviewNotes.trim())}
            >
              {listingReviewSubmitting ? "Saving…" : listingReviewAction === "approve" ? "Approve" : "Reject"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
