import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { Package, Plus, ShoppingBag, TrendingUp, ArrowLeft, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import StatCard from "@/components/dashboard/StatCard";
import { motion } from "framer-motion";
import { ICON_COLORS } from "@/lib/iconColors";
import SellerChatInbox from "@/components/marketplace/SellerChatInbox";

export default function SellerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    api.from("products").select("*").eq("seller_id", user.id).then(({ data }) => { if (data) setProducts(data); });
    api.from("orders").select("*").eq("seller_id", user.id).order("created_at", { ascending: false }).then(({ data }) => { if (data) setOrders(data); });
  }, [user]);

  const totalSales = orders.reduce((s, o) => s + Number(o.total), 0);

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0"><ArrowLeft className="h-5 w-5" /></Button>
          <div><h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Seller Dashboard</h1><p className="text-muted-foreground mt-1">Manage your products and orders</p></div>
        </div>
        <Dialog><DialogTrigger asChild><Button className="text-white" style={{ backgroundColor: ICON_COLORS.marketplace }}><Plus className="h-4 w-4 mr-1" />Add Product</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Product</DialogTitle>
              <DialogDescription className="py-1">Use the Products page to add new products.</DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="My Products" value={products.length} icon={<Package className="h-5 w-5" />} iconColor={ICON_COLORS.package} index={0} />
        <StatCard title="Total Orders" value={orders.length} icon={<ShoppingBag className="h-5 w-5" />} iconColor={ICON_COLORS.shopping} index={1} />
        <StatCard title="Total Sales" value={`৳${totalSales.toLocaleString()}`} icon={<TrendingUp className="h-5 w-5" />} iconColor={ICON_COLORS.finance} index={2} />
        <StatCard title="Pending Orders" value={orders.filter(o => o.status === "pending").length} icon={<Package className="h-5 w-5" />} iconColor={ICON_COLORS.health} index={3} />
      </div>

      <Tabs defaultValue="products" className="space-y-4">
        <TabsList><TabsTrigger value="products">My Products</TabsTrigger><TabsTrigger value="orders">Incoming Orders</TabsTrigger><TabsTrigger value="messages"><MessageCircle className="h-4 w-4 mr-1" />Messages</TabsTrigger></TabsList>
        <TabsContent value="products">
          <Card className="shadow-card overflow-hidden">
            <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.marketplace}, ${ICON_COLORS.vet})` }} />
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Category</TableHead><TableHead>Price</TableHead><TableHead>Stock</TableHead><TableHead>Rating</TableHead></TableRow></TableHeader>
                <TableBody>
                  {products.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium text-foreground">{p.name}</TableCell>
                      <TableCell><Badge variant="outline">{p.category}</Badge></TableCell>
                      <TableCell className="text-foreground">৳{p.price}/{p.unit}</TableCell>
                      <TableCell className="text-foreground">{p.stock}</TableCell>
                      <TableCell className="text-foreground">⭐ {p.rating}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {products.length === 0 && <p className="text-center text-muted-foreground py-8">No products listed yet</p>}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="orders">
          <Card className="shadow-card overflow-hidden">
            <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.marketplace}, ${ICON_COLORS.vet})` }} />
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Order ID</TableHead><TableHead>Date</TableHead><TableHead>Items</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {orders.map(o => (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium text-foreground">#{o.id.slice(0, 8).toUpperCase()}</TableCell>
                      <TableCell className="text-muted-foreground">{o.date}</TableCell>
                      <TableCell className="text-foreground">{((o.items as any[]) || []).map((i: any) => i.name).join(", ")}</TableCell>
                      <TableCell className="font-medium text-foreground">৳{Number(o.total).toLocaleString()}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{o.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {orders.length === 0 && <p className="text-center text-muted-foreground py-8">No incoming orders</p>}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="messages">
          {user && <SellerChatInbox sellerId={user.id} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
