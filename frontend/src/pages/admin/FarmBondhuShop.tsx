import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { api } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, ShieldCheck, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ICON_COLORS } from "@/lib/iconColors";
import AdminChatInbox from "@/components/marketplace/AdminChatInbox";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { moduleCachePolicy, queryKeys } from "@/lib/queryClient";

const categories = ["feed", "medicine", "vaccines", "equipment", "livestock", "eggs", "meat", "milk", "produce"];

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
}

const emptyForm = { name: "", category: "feed", price: "", original_price: "", stock: "", unit: "kg", description: "", image: "/placeholder.svg", free_delivery: true };

export default function FarmBondhuShop() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
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

  const handleSave = async () => {
    if (!form.name || !form.price || !user) return toast.error("Name and price required");
    const payload = {
      name: form.name,
      category: form.category,
      price: Number(form.price),
      original_price: form.original_price ? Number(form.original_price) : null,
      stock: Number(form.stock) || 0,
      unit: form.unit,
      description: form.description,
      image: form.image || "/placeholder.svg",
      free_delivery: form.free_delivery,
      seller_id: user.id,
      seller_name: "FarmBondhu",
      is_verified_seller: true,
      status: "active",
    };
    if (editing) {
      const { error } = await api.from("products").update(payload).eq("id", editing);
      if (error) return toast.error(error.message);
      toast.success("Product updated");
    } else {
      const { error } = await api.from("products").insert(payload);
      if (error) return toast.error(error.message);
      toast.success("Product added");
    }
    setOpen(false);
    setEditing(null);
    setForm(emptyForm);
    queryClient.invalidateQueries({ queryKey: queryKeys().officialShopProducts() });
  };

  const handleEdit = (p: FBProduct) => {
    setEditing(p.id);
    setForm({ name: p.name, category: p.category, price: String(p.price), original_price: p.original_price ? String(p.original_price) : "", stock: String(p.stock), unit: p.unit, description: p.description, image: p.image, free_delivery: p.free_delivery });
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await api.from("products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Product deleted");
    queryClient.invalidateQueries({ queryKey: queryKeys().officialShopProducts() });
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
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm(emptyForm); } }}>
          <DialogTrigger asChild>
            <Button style={{ backgroundColor: ICON_COLORS.farm }} className="text-white"><Plus className="h-4 w-4 mr-2" />Add Product</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit" : "Add"} FarmBondhu Product</DialogTitle>
              <DialogDescription>Set pricing, stock, and listing details for the official shop.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>Category</Label>
                  <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{categories.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Price (৳)</Label><Input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></div>
                <div><Label>Original Price</Label><Input type="number" value={form.original_price} onChange={e => setForm({ ...form, original_price: e.target.value })} /></div>
                <div><Label>Stock</Label><Input type="number" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Unit</Label><Input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} /></div>
                <div><Label>Image URL</Label><Input value={form.image} onChange={e => setForm({ ...form, image: e.target.value })} /></div>
              </div>
              <div><Label>Description</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              <Button onClick={handleSave} style={{ backgroundColor: ICON_COLORS.farm }} className="text-white">{editing ? "Update" : "Add"} Product</Button>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>

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
