import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, ShieldCheck, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ICON_COLORS } from "@/lib/iconColors";
import AdminChatInbox from "@/components/marketplace/AdminChatInbox";
import ProductFormDialog from "@/components/marketplace/ProductFormDialog";
import {
  ProductFormValues,
  fromDbRow,
  resolveProductImageUrl,
  toApiPayload,
} from "@/lib/marketplaceProductForm";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { moduleCachePolicy, queryKeys } from "@/lib/queryClient";

interface FBProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  original_price: number | null;
  stock: number;
  unit: string;
  description: string;
  image: string;
  free_delivery: boolean;
  is_verified_seller: boolean;
  is_flash_sale?: boolean;
  wholesale_price?: number | null;
  wholesale_min_qty?: number | null;
}

export default function FarmBondhuShop() {
  const { user } = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [initialForm, setInitialForm] = useState<ProductFormValues | undefined>();
  const queryClient = useQueryClient();

  const { data: products = [] } = useQuery({
    queryKey: queryKeys().officialShopProducts(),
    staleTime: moduleCachePolicy.admin.staleTime,
    gcTime: moduleCachePolicy.admin.gcTime,
    queryFn: async () => {
      const { data } = await api.from("products").select("*").eq("seller_name", "FarmBondhu").order("created_at", { ascending: false });
      return (data || []) as FBProduct[];
    },
  });

  useEffect(() => {
    const channel = api
      .channel("official-shop-products-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
        queryClient.invalidateQueries({ queryKey: queryKeys().officialShopProducts() });
      })
      .subscribe();
    return () => {
      api.removeChannel(channel);
    };
  }, [queryClient]);

  const openCreate = () => {
    setFormMode("create");
    setEditingId(null);
    setInitialForm(undefined);
    setFormOpen(true);
  };

  const handleEdit = (p: FBProduct) => {
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
      seller_id: user.id,
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
    queryClient.invalidateQueries({ queryKey: queryKeys().officialShopProducts() });
    queryClient.invalidateQueries({ queryKey: queryKeys().products() });
  };

  const handleDelete = async (id: string) => {
    const { error } = await api.from("products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Product deleted");
    queryClient.invalidateQueries({ queryKey: queryKeys().officialShopProducts() });
    queryClient.invalidateQueries({ queryKey: queryKeys().products() });
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-7 w-7" style={{ color: ICON_COLORS.farm }} />
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">FarmBondhu Official Shop</h1>
            <p className="text-muted-foreground mt-1">Manage official platform products</p>
          </div>
        </div>
        <Button style={{ backgroundColor: ICON_COLORS.farm }} className="text-white" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />Add Product
        </Button>
      </motion.div>

      <ProductFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        initialValues={initialForm}
        title={formMode === "edit" ? "Edit FarmBondhu Product" : "Add FarmBondhu Product"}
        description="Set pricing, photo, stock, and listing details for the official shop."
        accentColor={ICON_COLORS.farm}
        onSubmit={handleSubmit}
      />

      <Tabs defaultValue="products" className="space-y-4">
        <TabsList><TabsTrigger value="products">Products</TabsTrigger><TabsTrigger value="messages"><MessageCircle className="h-4 w-4 mr-1" />Messages</TabsTrigger></TabsList>
        <TabsContent value="products">
          <Card className="shadow-card overflow-hidden">
            <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.farm}, ${ICON_COLORS.marketplace})` }} />
            <CardHeader><CardTitle className="text-lg font-display">Official Products ({products.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map(p => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {p.image && (
                            <img src={p.image} alt={p.name} className="h-8 w-8 rounded object-cover" />
                          )}
                          <span className="font-medium text-foreground">{p.name}</span>
                          <Badge className="text-[10px] gap-1" style={{ backgroundColor: ICON_COLORS.farm, color: "white" }}><ShieldCheck className="h-3 w-3" />Official</Badge>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{p.category}</Badge></TableCell>
                      <TableCell className="text-foreground">৳{p.price}</TableCell>
                      <TableCell className="text-foreground">{p.stock}</TableCell>
                      <TableCell><Badge className="bg-secondary/15 text-secondary">Active</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => handleEdit(p)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {products.length === 0 && <p className="text-center text-muted-foreground py-8">No official products yet. Add your first product above.</p>}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="messages">
          <AdminChatInbox />
        </TabsContent>
      </Tabs>
    </div>
  );
}
