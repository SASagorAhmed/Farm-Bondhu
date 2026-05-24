import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { Package, Plus, Search, Edit, Trash2, Eye, Zap, Truck } from "lucide-react";
import { motion } from "framer-motion";
import { ICON_COLORS } from "@/lib/iconColors";
import { MARKETPLACE_CATEGORIES } from "@/lib/marketplaceCategories";
import { productDiscountPercent } from "@/lib/marketplaceProduct";
import { queryKeys } from "@/lib/queryClient";
import { toast } from "sonner";
import StatCard from "@/components/dashboard/StatCard";
import ProductFormDialog from "@/components/marketplace/ProductFormDialog";
import {
  ProductFormValues,
  fromDbRow,
  resolveProductImageUrl,
  toApiPayload,
} from "@/lib/marketplaceProductForm";

export default function Products() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [initialForm, setInitialForm] = useState<ProductFormValues | undefined>();

  const loadProducts = useCallback(() => {
    if (!user) return;
    api.from("products").select("*").eq("seller_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setProducts(data); });
  }, [user]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === "all" || p.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const inStock = products.filter(p => p.stock > 0).length;
  const outOfStock = products.filter(p => p.stock === 0).length;
  const avgRating = products.length > 0
    ? (products.reduce((s: number, p: any) => s + Number(p.rating), 0) / products.length).toFixed(1)
    : "0";

  const openCreate = () => {
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
    void queryClient.invalidateQueries({ queryKey: queryKeys().products() });
  };

  const handleSubmit = async (values: ProductFormValues) => {
    if (!user) return;
    const imageUrl = await resolveProductImageUrl(values);
    const payload = {
      ...toApiPayload(values, imageUrl),
      seller_id: user.id,
      seller_name: user.name,
    };

    if (formMode === "edit" && editingId) {
      const { error } = await api.from("products").update(payload).eq("id", editingId);
      if (error) throw new Error(error.message);
      invalidateMarketplaceProducts();
      toast.success("Product updated!");
    } else {
      const { data, error } = await api.from("products").insert(payload);
      if (error) throw new Error(error.message);
      invalidateMarketplaceProducts();
      const productId = data && typeof data === "object" && "id" in data ? String((data as { id: string }).id) : null;
      toast.success("Product is live on the marketplace", {
        action: {
          label: "View on Marketplace",
          onClick: () => navigate(productId ? `/marketplace/${productId}` : "/marketplace"),
        },
      });
    }
    loadProducts();
  };

  const handleDelete = async (id: string) => {
    await api.from("products").delete().eq("id", id);
    setProducts(products.filter(p => p.id !== id));
    invalidateMarketplaceProducts();
    toast.success("Product deleted");
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Products</h1>
          <p className="text-muted-foreground mt-1">Manage your product listings</p>
        </div>
        <Button className="text-white" style={{ backgroundColor: ICON_COLORS.marketplace }} onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> Add Product
        </Button>
      </motion.div>

      <ProductFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        initialValues={initialForm}
        onSubmit={handleSubmit}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Products" value={products.length} icon={<Package className="h-5 w-5" />} iconColor={ICON_COLORS.package} index={0} />
        <StatCard title="In Stock" value={inStock} icon={<Package className="h-5 w-5" />} iconColor={ICON_COLORS.farm} index={1} />
        <StatCard title="Out of Stock" value={outOfStock} icon={<Package className="h-5 w-5" />} iconColor={ICON_COLORS.health} index={2} />
        <StatCard title="Avg Rating" value={`⭐ ${avgRating}`} icon={<Eye className="h-5 w-5" />} iconColor={ICON_COLORS.finance} index={3} />
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {MARKETPLACE_CATEGORIES.map(c => (
              <SelectItem key={c.slug} value={c.slug}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="shadow-card overflow-hidden">
        <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.marketplace}, ${ICON_COLORS.vet})` }} />
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Rating</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(p => {
                const discount = p.original_price && p.price
                  ? productDiscountPercent({ price: Number(p.price), originalPrice: Number(p.original_price) })
                  : 0;
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-accent/50 flex items-center justify-center shrink-0 overflow-hidden">
                          {p.image ? (
                            <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                          ) : (
                            <Package className="h-5 w-5" style={{ color: ICON_COLORS.package }} />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-medium text-foreground">{p.name}</p>
                            {p.wholesale_price && p.wholesale_min_qty && (
                              <Badge className="text-[10px] px-1.5 py-0" style={{ backgroundColor: ICON_COLORS.finance, color: "white" }}>Wholesale</Badge>
                            )}
                            {p.free_delivery && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5">
                                <Truck className="h-2.5 w-2.5" /> Free delivery
                              </Badge>
                            )}
                            {p.is_flash_sale && (
                              <Badge className="text-[10px] px-1.5 py-0 gap-0.5" style={{ backgroundColor: ICON_COLORS.health, color: "white" }}>
                                <Zap className="h-2.5 w-2.5" /> Flash
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{p.seller_name}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{p.category}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div>
                        <p className="font-medium text-foreground">৳{p.price}/{p.unit}</p>
                        {discount > 0 && (
                          <p className="text-[10px] text-muted-foreground line-through">৳{p.original_price}</p>
                        )}
                        {p.wholesale_price && (
                          <p className="text-[10px] text-muted-foreground">Wholesale: ৳{p.wholesale_price}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" style={{
                        borderColor: p.stock > 10 ? ICON_COLORS.farm : p.stock > 0 ? ICON_COLORS.finance : ICON_COLORS.health,
                        color: p.stock > 10 ? ICON_COLORS.farm : p.stock > 0 ? ICON_COLORS.finance : ICON_COLORS.health,
                      }}>
                        {p.stock > 0 ? p.stock : "Out"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-foreground">⭐ {p.rating}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(p.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">No products found</p>}
        </CardContent>
      </Card>
    </div>
  );
}
