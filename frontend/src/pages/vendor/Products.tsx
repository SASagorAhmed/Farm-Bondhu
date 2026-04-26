import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { api } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { Package, Plus, Search, Edit, Trash2, Eye, Tag } from "lucide-react";
import { motion } from "framer-motion";
import { ICON_COLORS } from "@/lib/iconColors";
import { toast } from "sonner";
import StatCard from "@/components/dashboard/StatCard";

const CATEGORIES = ["feed", "vaccines", "equipment", "medicine", "livestock", "eggs", "milk", "meat"];

export default function Products() {
  const { user } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [wholesaleEnabled, setWholesaleEnabled] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: "", category: "", unit: "piece", price: 0, stock: 0, description: "",
    wholesale_price: 0, wholesale_min_qty: 0,
  });

  useEffect(() => {
    if (!user) return;
    api.from("products").select("*").eq("seller_id", user.id).order("created_at", { ascending: false }).then(({ data }) => { if (data) setProducts(data); });
  }, [user]);

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === "all" || p.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const inStock = products.filter(p => p.stock > 0).length;
  const outOfStock = products.filter(p => p.stock === 0).length;
  const avgRating = products.length > 0 ? (products.reduce((s: number, p: any) => s + Number(p.rating), 0) / products.length).toFixed(1) : "0";

  const handleAdd = async () => {
    if (!user || !newProduct.name || !newProduct.category) { toast.error("Fill required fields"); return; }
    const insertData: any = {
      seller_id: user.id, seller_name: user.name, name: newProduct.name, category: newProduct.category,
      unit: newProduct.unit, price: newProduct.price, stock: newProduct.stock, description: newProduct.description,
    };
    if (wholesaleEnabled && newProduct.wholesale_price > 0 && newProduct.wholesale_min_qty > 0) {
      insertData.wholesale_price = newProduct.wholesale_price;
      insertData.wholesale_min_qty = newProduct.wholesale_min_qty;
    }
    const { error } = await api.from("products").insert(insertData);
    if (error) { toast.error("Failed to add product"); return; }
    toast.success("Product added!");
    setAddOpen(false);
    setNewProduct({ name: "", category: "", unit: "piece", price: 0, stock: 0, description: "", wholesale_price: 0, wholesale_min_qty: 0 });
    setWholesaleEnabled(false);
    api.from("products").select("*").eq("seller_id", user.id).order("created_at", { ascending: false }).then(({ data }) => { if (data) setProducts(data); });
  };

  const handleDelete = async (id: string) => {
    await api.from("products").delete().eq("id", id);
    setProducts(products.filter(p => p.id !== id));
    toast.success("Product deleted");
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Products</h1><p className="text-muted-foreground mt-1">Manage your product listings</p></div>
        <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) { setWholesaleEnabled(false); setNewProduct({ name: "", category: "", unit: "piece", price: 0, stock: 0, description: "", wholesale_price: 0, wholesale_min_qty: 0 }); } }}>
          <DialogTrigger asChild><Button className="text-white" style={{ backgroundColor: ICON_COLORS.marketplace }}><Plus className="h-4 w-4 mr-1" /> Add Product</Button></DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display">Add New Product</DialogTitle>
              <DialogDescription>Enter product details, optional wholesale pricing, then add to your catalog.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2 max-h-[70vh] overflow-y-auto">
              <div><Label>Product Name</Label><Input value={newProduct.name} onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} placeholder="e.g. Layer Feed Premium (50kg)" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Category</Label><Select value={newProduct.category} onValueChange={v => setNewProduct({ ...newProduct, category: v })}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>Unit</Label><Input value={newProduct.unit} onChange={e => setNewProduct({ ...newProduct, unit: e.target.value })} placeholder="e.g. bag, kg, piece" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Price (৳)</Label><Input type="number" value={newProduct.price} onChange={e => setNewProduct({ ...newProduct, price: Number(e.target.value) })} /></div>
                <div><Label>Stock Quantity</Label><Input type="number" value={newProduct.stock} onChange={e => setNewProduct({ ...newProduct, stock: Number(e.target.value) })} /></div>
              </div>
              <div><Label>Description</Label><Textarea value={newProduct.description} onChange={e => setNewProduct({ ...newProduct, description: e.target.value })} placeholder="Describe your product..." rows={3} /></div>

              {/* Wholesale Pricing Section */}
              <div className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4" style={{ color: ICON_COLORS.finance }} />
                    <Label className="text-sm font-semibold">Wholesale Pricing</Label>
                  </div>
                  <Switch checked={wholesaleEnabled} onCheckedChange={setWholesaleEnabled} />
                </div>
                {wholesaleEnabled && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <Label className="text-xs text-muted-foreground">Min Order Qty</Label>
                      <Input type="number" value={newProduct.wholesale_min_qty} onChange={e => setNewProduct({ ...newProduct, wholesale_min_qty: Number(e.target.value) })} placeholder="e.g. 50" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Wholesale Price (৳)</Label>
                      <Input type="number" value={newProduct.wholesale_price} onChange={e => setNewProduct({ ...newProduct, wholesale_price: Number(e.target.value) })} placeholder="e.g. 350" />
                    </div>
                  </div>
                )}
              </div>

              <Button className="w-full text-white" style={{ backgroundColor: ICON_COLORS.marketplace }} onClick={handleAdd}>Add Product</Button>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Products" value={products.length} icon={<Package className="h-5 w-5" />} iconColor={ICON_COLORS.package} index={0} />
        <StatCard title="In Stock" value={inStock} icon={<Package className="h-5 w-5" />} iconColor={ICON_COLORS.farm} index={1} />
        <StatCard title="Out of Stock" value={outOfStock} icon={<Package className="h-5 w-5" />} iconColor={ICON_COLORS.health} index={2} />
        <StatCard title="Avg Rating" value={`⭐ ${avgRating}`} icon={<Eye className="h-5 w-5" />} iconColor={ICON_COLORS.finance} index={3} />
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Categories</SelectItem>{CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent></Select>
      </div>

      <Card className="shadow-card overflow-hidden">
        <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.marketplace}, ${ICON_COLORS.vet})` }} />
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Price</TableHead><TableHead className="text-right">Stock</TableHead><TableHead className="text-right">Rating</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.map(p => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-accent/50 flex items-center justify-center shrink-0"><Package className="h-5 w-5" style={{ color: ICON_COLORS.package }} /></div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-foreground">{p.name}</p>
                          {p.wholesale_price && p.wholesale_min_qty && (
                            <Badge className="text-[10px] px-1.5 py-0" style={{ backgroundColor: ICON_COLORS.finance, color: "white" }}>Wholesale</Badge>
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
                      {p.wholesale_price && <p className="text-[10px] text-muted-foreground">Wholesale: ৳{p.wholesale_price}</p>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right"><Badge variant="outline" style={{ borderColor: p.stock > 10 ? ICON_COLORS.farm : p.stock > 0 ? ICON_COLORS.finance : ICON_COLORS.health, color: p.stock > 10 ? ICON_COLORS.farm : p.stock > 0 ? ICON_COLORS.finance : ICON_COLORS.health }}>{p.stock > 0 ? p.stock : "Out"}</Badge></TableCell>
                  <TableCell className="text-right text-foreground">⭐ {p.rating}</TableCell>
                  <TableCell className="text-right"><div className="flex items-center justify-end gap-1"><Button variant="ghost" size="icon" className="h-8 w-8"><Edit className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button></div></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">No products found</p>}
        </CardContent>
      </Card>
    </div>
  );
}
