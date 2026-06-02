import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { Package, Plus, Search, Edit, Trash2, Eye, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ICON_COLORS } from "@/lib/iconColors";
import {
  displayProductCategory,
  getLaneForProductCategory,
  productMatchesLane,
  productMatchesSubcategoryFilter,
  type MarketplaceLane,
} from "@/lib/marketplaceCategories";
import SubcategoryFilterSelect from "@/components/marketplace/SubcategoryFilterSelect";
import { productDiscountPercent } from "@/lib/marketplaceProduct";
import StatCard from "@/components/dashboard/StatCard";
import ProductFormDialog from "@/components/marketplace/ProductFormDialog";
import {
  ProductFormValues,
  fromDbRow,
  resolveProductImageUrl,
  toApiPayload,
} from "@/lib/marketplaceProductForm";
import { moduleCachePolicy, queryKeys } from "@/lib/queryClient";
import {
  fetchOfficialShopProducts,
  officialShopProductsQueryKey,
  type OfficialShopProductRow,
} from "@/lib/adminFarmBondhuShopApi";
import { useOfficialShop } from "./OfficialShopProvider";
import { ALL_MARKETPLACE_LANES, laneLabel } from "@/lib/marketplaceLaneLabels";
import {
  ADMIN_PHOTO_EDITOR_BASE,
  productPhotoEditorNewUrl,
} from "@/features/photoEditor/lib/photoEditorPaths";
import SellerFlashSaleActions from "@/components/vendor/SellerFlashSaleActions";

const ADMIN_PRODUCTS_RETURN = "/admin/farmbondhu-shop/products";
const adminPhotoEditorCreateUrl = productPhotoEditorNewUrl(
  ADMIN_PRODUCTS_RETURN,
  ADMIN_PHOTO_EDITOR_BASE,
);

function listingStatusBadge(status?: string | null) {
  const s = status || "approved";
  if (s === "pending_review") {
    return (
      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
        Pending review
      </Badge>
    );
  }
  if (s === "rejected") {
    return (
      <Badge variant="secondary" className="bg-red-100 text-red-800">
        Rejected
      </Badge>
    );
  }
  if (s === "draft") {
    return <Badge variant="outline">Draft</Badge>;
  }
  return (
    <Badge variant="secondary" className="bg-green-100 text-green-800">
      Live
    </Badge>
  );
}

export default function OfficialShopProducts() {
  const { user } = useAuth();
  const { sellerId } = useOfficialShop();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [initialForm, setInitialForm] = useState<ProductFormValues | undefined>();
  const [activeLane, setActiveLane] = useState<string>("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: officialShopProductsQueryKey(),
    staleTime: moduleCachePolicy.admin.staleTime,
    queryFn: fetchOfficialShopProducts,
  });

  const products: OfficialShopProductRow[] = Array.isArray(data) ? data : [];

  useEffect(() => {
    if (!activeLane && ALL_MARKETPLACE_LANES.length) {
      setActiveLane(ALL_MARKETPLACE_LANES[0]);
    }
  }, [activeLane]);

  useEffect(() => {
    if (sessionStorage.getItem("photoEditorOpenForm") !== "1") return;
    sessionStorage.removeItem("photoEditorOpenForm");
    const lane = activeLane || ALL_MARKETPLACE_LANES[0];
    if (!activeLane) setActiveLane(lane);
    setFormMode("create");
    setEditingId(null);
    setInitialForm(undefined);
    setFormOpen(true);
  }, [activeLane]);

  const laneKey = activeLane as Exclude<MarketplaceLane, "all">;

  const laneProducts = products.filter(
    (p) => !activeLane || productMatchesLane(p.category, laneKey),
  );

  const filtered = laneProducts.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = productMatchesSubcategoryFilter(p.category, categoryFilter);
    return matchSearch && matchCat;
  });

  const inStock = laneProducts.filter((p) => p.stock > 0).length;
  const outOfStock = laneProducts.filter((p) => p.stock === 0).length;
  const avgRating =
    laneProducts.length > 0
      ? (
          laneProducts.reduce((s, p) => s + Number((p as { rating?: number }).rating ?? 0), 0) /
          laneProducts.length
        ).toFixed(1)
      : "0";

  const openCreate = () => {
    if (!activeLane) {
      toast.error("Select a marketplace category first");
      return;
    }
    setFormMode("create");
    setEditingId(null);
    setInitialForm(undefined);
    setFormOpen(true);
  };

  const openEdit = (p: OfficialShopProductRow) => {
    const lane = getLaneForProductCategory(p.category);
    if (lane !== "all") setActiveLane(lane);
    setFormMode("edit");
    setEditingId(p.id);
    setInitialForm(fromDbRow(p as Record<string, unknown>));
    setFormOpen(true);
  };

  const handleSubmit = async (values: ProductFormValues) => {
    if (!user) return;
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
    void queryClient.invalidateQueries({ queryKey: officialShopProductsQueryKey() });
    void queryClient.invalidateQueries({ queryKey: queryKeys().officialShopProductCount() });
    void queryClient.invalidateQueries({ queryKey: queryKeys().products() });
    void refetch();
  };

  const handleDelete = async (id: string) => {
    const { error } = await api.from("products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Product deleted");
    void queryClient.invalidateQueries({ queryKey: officialShopProductsQueryKey() });
    void queryClient.invalidateQueries({ queryKey: queryKeys().officialShopProductCount() });
    void queryClient.invalidateQueries({ queryKey: queryKeys().products() });
    void refetch();
  };

  const invalidateAfterFlash = () => {
    void queryClient.invalidateQueries({ queryKey: officialShopProductsQueryKey() });
    void refetch();
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between flex-wrap gap-3"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">
            Products
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage official FarmBondhu listings by marketplace category
          </p>
        </div>
        <Button
          className="text-white"
          style={{ backgroundColor: ICON_COLORS.marketplace }}
          onClick={openCreate}
        >
          <Plus className="h-4 w-4 mr-1" /> Add Product
        </Button>
      </motion.div>

      {isError && (
        <p className="text-sm text-destructive">
          Could not load products.{" "}
          <button type="button" className="underline" onClick={() => void refetch()}>
            Retry
          </button>
        </p>
      )}

      <ProductFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        initialValues={initialForm}
        title={formMode === "edit" ? "Edit FarmBondhu Product" : "Add FarmBondhu Product"}
        description="Set pricing, photo, stock, delivery, and listing details for the official shop."
        accentColor={ICON_COLORS.farm}
        allowedLanes={ALL_MARKETPLACE_LANES}
        defaultPickerLane={
          formMode === "create" && activeLane
            ? (activeLane as Exclude<MarketplaceLane, "all">)
            : undefined
        }
        photoEditorCreateUrl={adminPhotoEditorCreateUrl}
        onSubmit={handleSubmit}
      />

      <Tabs
        value={activeLane}
        onValueChange={(lane) => {
          setActiveLane(lane);
          setCategoryFilter("all");
        }}
      >
        <TabsList className="flex flex-wrap h-auto gap-1">
          {ALL_MARKETPLACE_LANES.map((lane) => (
            <TabsTrigger key={lane} value={lane}>
              {laneLabel(lane)}
            </TabsTrigger>
          ))}
        </TabsList>
        {ALL_MARKETPLACE_LANES.map((lane) => (
          <TabsContent key={lane} value={lane} className="space-y-6 mt-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Products in lane"
                value={laneProducts.length}
                icon={<Package className="h-5 w-5" />}
                iconColor={ICON_COLORS.package}
                index={0}
              />
              <StatCard
                title="In Stock"
                value={inStock}
                icon={<Package className="h-5 w-5" />}
                iconColor={ICON_COLORS.farm}
                index={1}
              />
              <StatCard
                title="Out of Stock"
                value={outOfStock}
                icon={<Package className="h-5 w-5" />}
                iconColor={ICON_COLORS.health}
                index={2}
              />
              <StatCard
                title="Avg Rating"
                value={`⭐ ${avgRating}`}
                icon={<Eye className="h-5 w-5" />}
                iconColor={ICON_COLORS.finance}
                index={3}
              />
            </div>

            <div className="flex gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              {laneKey && (
                <SubcategoryFilterSelect
                  lane={laneKey}
                  value={categoryFilter}
                  onValueChange={setCategoryFilter}
                />
              )}
            </div>

            <Card className="shadow-card overflow-hidden">
              <div
                className="h-1"
                style={{
                  background: `linear-gradient(to right, ${ICON_COLORS.marketplace}, ${ICON_COLORS.vet})`,
                }}
              />
              <CardContent className="p-0">
                {isLoading ? (
                  <p className="text-center text-muted-foreground py-8">Loading products…</p>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Listing</TableHead>
                          <TableHead className="text-right">Price</TableHead>
                          <TableHead className="text-right">Stock</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((p) => {
                          const row = p as Record<string, unknown>;
                          const unit = row.unit != null ? String(row.unit) : "unit";
                          const originalPrice = row.original_price;
                          const discount =
                            originalPrice && p.price
                              ? productDiscountPercent({
                                  price: Number(p.price),
                                  originalPrice: Number(originalPrice),
                                })
                              : 0;
                          return (
                            <TableRow key={p.id}>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <div className="h-10 w-10 rounded-lg bg-accent/50 flex items-center justify-center shrink-0 overflow-hidden">
                                    {p.image ? (
                                      <img
                                        src={String(p.image)}
                                        alt={p.name}
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      <Package
                                        className="h-5 w-5"
                                        style={{ color: ICON_COLORS.package }}
                                      />
                                    )}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <p className="font-medium text-foreground">{p.name}</p>
                                      <Badge
                                        className="text-[10px] gap-1"
                                        style={{ backgroundColor: ICON_COLORS.farm, color: "white" }}
                                      >
                                        <ShieldCheck className="h-3 w-3" />
                                        Official
                                      </Badge>
                                      <SellerFlashSaleActions
                                        product={{
                                          id: p.id,
                                          price: Number(p.price),
                                          listing_status:
                                            p.listing_status != null
                                              ? String(p.listing_status)
                                              : undefined,
                                          is_flash_sale: Boolean(row.is_flash_sale),
                                          flash_sale_request_status:
                                            row.flash_sale_request_status != null
                                              ? String(row.flash_sale_request_status)
                                              : null,
                                          flash_sale_review_notes:
                                            row.flash_sale_review_notes != null
                                              ? String(row.flash_sale_review_notes)
                                              : null,
                                        }}
                                        compact
                                        onChanged={invalidateAfterFlash}
                                      />
                                    </div>
                                    {p.listing_status === "rejected" &&
                                      row.listing_review_notes != null && (
                                        <p className="text-xs text-destructive mt-0.5">
                                          {String(row.listing_review_notes)}
                                        </p>
                                      )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {displayProductCategory(p.category)}
                                </Badge>
                              </TableCell>
                              <TableCell>{listingStatusBadge(p.listing_status)}</TableCell>
                              <TableCell className="text-right">
                                <div>
                                  <p className="font-medium text-foreground">
                                    ৳{p.price}/{unit}
                                  </p>
                                  {discount > 0 && (
                                    <p className="text-[10px] text-muted-foreground line-through">
                                      ৳{originalPrice}
                                    </p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge
                                  variant="outline"
                                  style={{
                                    borderColor:
                                      p.stock > 10
                                        ? ICON_COLORS.farm
                                        : p.stock > 0
                                          ? ICON_COLORS.finance
                                          : ICON_COLORS.health,
                                    color:
                                      p.stock > 10
                                        ? ICON_COLORS.farm
                                        : p.stock > 0
                                          ? ICON_COLORS.finance
                                          : ICON_COLORS.health,
                                  }}
                                >
                                  {p.stock > 0 ? `${p.stock} left` : "Out"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => openEdit(p)}
                                  >
                                    <Edit className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive"
                                    onClick={() => void handleDelete(p.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    {filtered.length === 0 && (
                      <p className="text-center text-muted-foreground py-8">
                        No products in this category yet
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
