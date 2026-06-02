import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
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
import {
  Package,
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  Truck,
  MessageSquare,
} from "lucide-react";
import { motion } from "framer-motion";
import { ICON_COLORS } from "@/lib/iconColors";
import {
  displayProductCategory,
  productMatchesLane,
  productMatchesSubcategoryFilter,
  type MarketplaceLane,
} from "@/lib/marketplaceCategories";
import SubcategoryFilterSelect from "@/components/marketplace/SubcategoryFilterSelect";
import { productDiscountPercent } from "@/lib/marketplaceProduct";
import { toast } from "sonner";
import StatCard from "@/components/dashboard/StatCard";
import ProductFormDialog from "@/components/marketplace/ProductFormDialog";
import { fetchSellerOnboardingMe } from "@/lib/sellerOnboardingApi";
import { laneLabel } from "@/lib/marketplaceLaneLabels";
import { ProductFormValues, fromDbRow } from "@/lib/marketplaceProductForm";
import { useSellerInventory } from "@/lib/sellerInventoryApi";
import { useSellerProductUpdate } from "@/hooks/useSellerProductUpdate";
import { invalidateMarketplaceStockQueries } from "@/lib/marketplaceStockQueries";
import SellerFlashSaleActions from "@/components/vendor/SellerFlashSaleActions";

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

export default function Products() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { submitProduct } = useSellerProductUpdate();
  const { data: inventoryProducts = [], refetch: refetchInventory } =
    useSellerInventory();
  const products = inventoryProducts;
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [initialForm, setInitialForm] = useState<
    ProductFormValues | undefined
  >();
  const [activeLane, setActiveLane] = useState<string>("");

  const { data: onboarding } = useQuery({
    queryKey: ["seller-onboarding-me", user?.id],
    enabled: Boolean(user?.id),
    queryFn: fetchSellerOnboardingMe,
  });

  const approvedLanes = onboarding?.approved_lanes || [];
  const pendingLanes = (onboarding?.grants || [])
    .filter((g) => g.status === "pending")
    .map((g) => g.lane);
  const rejectedLanes = (onboarding?.grants || [])
    .filter((g) => g.status === "rejected")
    .map((g) => g.lane);

  useEffect(() => {
    if (approvedLanes.length && !activeLane) {
      setActiveLane(approvedLanes[0]);
    }
  }, [approvedLanes, activeLane]);

  const laneKey = activeLane as Exclude<MarketplaceLane, "all">;

  const loadProducts = useCallback(() => {
    void refetchInventory();
  }, [refetchInventory]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    if (sessionStorage.getItem("photoEditorOpenForm") !== "1") return;
    if (onboarding === undefined) return;
    sessionStorage.removeItem("photoEditorOpenForm");
    if (!approvedLanes.length) {
      toast.error("Complete seller category approval before adding products.");
      return;
    }
    const lane = activeLane || approvedLanes[0];
    if (!activeLane) setActiveLane(lane);
    setFormMode("create");
    setEditingId(null);
    setInitialForm(undefined);
    setFormOpen(true);
  }, [onboarding, approvedLanes, activeLane]);

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
          laneProducts.reduce((s: number, p: any) => s + Number(p.rating), 0) /
          laneProducts.length
        ).toFixed(1)
      : "0";

  const openCreate = () => {
    if (!activeLane) {
      toast.error("Select an approved category first");
      return;
    }
    setFormMode("create");
    setEditingId(null);
    setInitialForm(undefined);
    setFormOpen(true);
  };

  const openEdit = (p: any) => {
    setFormMode("edit");
    setEditingId(p.id);
    setInitialForm(fromDbRow(p));
    setFormOpen(true);
  };

  const invalidateMarketplaceProducts = () => {
    invalidateMarketplaceStockQueries(queryClient, { userId: user?.id });
  };

  const handleSubmit = async (values: ProductFormValues) => {
    const existing = editingId
      ? products.find((p) => p.id === editingId)
      : undefined;
    await submitProduct(formMode, values, {
      editingId,
      listingStatus: existing?.listing_status,
      onSuccess: loadProducts,
    });
  };

  const handleDelete = async (id: string) => {
    await api.from("products").delete().eq("id", id);
    invalidateMarketplaceProducts();
    loadProducts();
    toast.success("Product deleted");
  };

  if (!approvedLanes.length) {
    return (
      <div className="space-y-4 text-center py-16">
        <h1 className="text-2xl font-display font-bold">
          Seller onboarding required
        </h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Complete seller onboarding and get at least one marketplace category
          approved before listing products.
        </p>
        <Button asChild>
          <Link to="/seller/onboarding">Go to seller onboarding</Link>
        </Button>
      </div>
    );
  }

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
            Manage listings by approved marketplace category
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

      {(pendingLanes.length > 0 || rejectedLanes.length > 0) && (
        <div className="rounded-lg border p-3 text-sm space-y-1">
          {pendingLanes.map((lane) => (
            <p key={`p-${lane}`} className="text-muted-foreground">
              <span className="font-medium text-foreground">
                {laneLabel(lane)}
              </span>{" "}
              — pending admin approval
            </p>
          ))}
          {rejectedLanes.map((lane) => {
            const notes = onboarding?.grants?.find(
              (g) => g.lane === lane,
            )?.review_notes;
            return (
              <p key={`r-${lane}`} className="text-muted-foreground">
                <span className="font-medium text-foreground">
                  {laneLabel(lane)}
                </span>{" "}
                — rejected
                {notes ? `: ${notes}` : ""}{" "}
                <Link
                  to="/seller/onboarding"
                  className="text-primary underline"
                >
                  Resubmit
                </Link>
              </p>
            );
          })}
        </div>
      )}

      <ProductFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        initialValues={initialForm}
        allowedLanes={approvedLanes as Exclude<MarketplaceLane, "all">[]}
        defaultPickerLane={
          formMode === "create" && activeLane
            ? (activeLane as Exclude<MarketplaceLane, "all">)
            : undefined
        }
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
          {approvedLanes.map((lane) => (
            <TabsTrigger key={lane} value={lane}>
              {laneLabel(lane)}
            </TabsTrigger>
          ))}
        </TabsList>
        {approvedLanes.map((lane) => (
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
                      const discount =
                        p.original_price && p.price
                          ? productDiscountPercent({
                              price: Number(p.price),
                              originalPrice: Number(p.original_price),
                            })
                          : 0;
                      return (
                        <TableRow key={p.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg bg-accent/50 flex items-center justify-center shrink-0 overflow-hidden">
                                {p.image ? (
                                  <img
                                    src={p.image}
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
                                  <p className="font-medium text-foreground">
                                    {p.name}
                                  </p>
                                  <SellerFlashSaleActions
                                    product={{
                                      id: p.id,
                                      price: Number(p.price),
                                      listing_status: p.listing_status,
                                      is_flash_sale: Boolean(p.is_flash_sale),
                                      flash_sale_request_status:
                                        p.flash_sale_request_status != null
                                          ? String(p.flash_sale_request_status)
                                          : null,
                                      flash_sale_review_notes:
                                        p.flash_sale_review_notes != null
                                          ? String(p.flash_sale_review_notes)
                                          : null,
                                    }}
                                    compact
                                    onChanged={() => {
                                      void refetchInventory();
                                      invalidateMarketplaceProducts();
                                    }}
                                  />
                                </div>
                                {p.listing_status === "rejected" &&
                                  p.listing_review_notes && (
                                    <p className="text-xs text-destructive mt-0.5">
                                      {p.listing_review_notes}
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
                          <TableCell>
                            {listingStatusBadge(p.listing_status)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div>
                              <p className="font-medium text-foreground">
                                ৳{p.price}/{p.unit}
                              </p>
                              {discount > 0 && (
                                <p className="text-[10px] text-muted-foreground line-through">
                                  ৳{p.original_price}
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
                                asChild
                                title="Reviews & questions"
                              >
                                <Link to={`/seller/products/${p.id}`}>
                                  <MessageSquare className="h-3.5 w-3.5" />
                                </Link>
                              </Button>
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
                                onClick={() => handleDelete(p.id)}
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
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
