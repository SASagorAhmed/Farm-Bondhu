import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { api } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { CheckCircle, ShieldCheck, Store, Package, MapPin, Star, X } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ICON_COLORS } from "@/lib/iconColors";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { moduleCachePolicy, queryKeys } from "@/lib/queryClient";

export default function AdminMarketplace() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: products = [] } = useQuery({
    queryKey: queryKeys().adminMarketplaceProducts(),
    staleTime: moduleCachePolicy.admin.staleTime,
    gcTime: moduleCachePolicy.admin.gcTime,
    queryFn: async () => {
      const { data } = await api.from("products").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });
  const { data: shops = [] } = useQuery({
    queryKey: queryKeys().adminMarketplaceShops(),
    staleTime: moduleCachePolicy.admin.staleTime,
    gcTime: moduleCachePolicy.admin.gcTime,
    queryFn: async () => {
      const { data } = await api.from("shops").select("*").order("created_at", { ascending: false });
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

  const toggleVerify = async (shop: any) => {
    const newVal = !shop.is_verified;
    const { error } = await api.from("shops").update({
      is_verified: newVal,
      verified_at: newVal ? new Date().toISOString() : null,
      verified_by: newVal ? user?.id : null,
    }).eq("id", shop.id);
    if (error) return toast.error(error.message);

    // Also update all products from this seller
    await api.from("products").update({ is_verified_seller: newVal }).eq("seller_id", shop.user_id);

    toast.success(newVal ? "Shop verified!" : "Verification removed");
    queryClient.invalidateQueries({ queryKey: queryKeys().adminMarketplaceShops() });
    queryClient.invalidateQueries({ queryKey: queryKeys().adminMarketplaceProducts() });
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

      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">Products ({products.length})</TabsTrigger>
          <TabsTrigger value="shops">Shops ({shops.length})</TabsTrigger>
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
                      <TableCell><Badge className="bg-secondary/15 text-secondary"><CheckCircle className="h-3 w-3 mr-1" />{p.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {products.length === 0 && <p className="text-center text-muted-foreground py-8">No products yet</p>}
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
                    <TableRow key={s.id}>
                      <TableCell className="font-medium text-foreground">{s.shop_name}</TableCell>
                      <TableCell className="text-muted-foreground">{s.user_name}</TableCell>
                      <TableCell className="text-muted-foreground">{s.location}</TableCell>
                      <TableCell className="text-foreground">{s.total_products}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{s.status}</Badge></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch checked={s.is_verified} onCheckedChange={() => toggleVerify(s)} />
                          {s.is_verified && <Badge className="text-[10px] gap-1" style={{ backgroundColor: ICON_COLORS.marketplace, color: "white" }}><ShieldCheck className="h-3 w-3" />Verified</Badge>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {shops.length === 0 && <p className="text-center text-muted-foreground py-8">No shops registered yet</p>}
            </CardContent>
          </Card>
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
                  <p className="text-muted-foreground text-xs">Status</p>
                  <Badge className="bg-secondary/15 text-secondary mt-0.5"><CheckCircle className="h-3 w-3 mr-1" />{selectedProduct.status}</Badge>
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
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
