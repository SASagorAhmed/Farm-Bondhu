import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { Package, Plus, ShoppingBag, TrendingUp, ArrowLeft, MessageCircle, Store, ExternalLink, Palette } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import StatCard from "@/components/dashboard/StatCard";
import { motion } from "framer-motion";
import { ICON_COLORS } from "@/lib/iconColors";
import SellerChatInbox from "@/components/marketplace/SellerChatInbox";
import { fetchSellerOnboardingMe } from "@/lib/sellerOnboardingApi";
import { fetchPublicShop, sellerShopEditorPath } from "@/lib/marketplaceShopApi";
import { laneLabel } from "@/lib/marketplaceLaneLabels";
import { productMatchesLane, type MarketplaceLane } from "@/lib/marketplaceCategories";
import { useSellerInventory } from "@/lib/sellerInventoryApi";

export default function SellerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "messages" ? "messages" : searchParams.get("tab") === "orders" ? "orders" : "products";
  const { data: inventoryProducts = [] } = useSellerInventory();
  const products = inventoryProducts;
  const [orders, setOrders] = useState<any[]>([]);
  const [activeLane, setActiveLane] = useState<string>("all");

  const { data: onboarding } = useQuery({
    queryKey: ["seller-onboarding-me", user?.id],
    enabled: Boolean(user?.id),
    queryFn: fetchSellerOnboardingMe,
  });
  const { data: shop } = useQuery({
    queryKey: ["my-shop", user?.id],
    enabled: Boolean(user?.id),
    queryFn: () => fetchPublicShop(user!.id),
  });
  const approvedLanes = onboarding?.approved_lanes || [];

  useEffect(() => {
    if (!user) return;
    api.from("orders").select("*").eq("seller_id", user.id).order("created_at", { ascending: false }).then(({ data }) => { if (data) setOrders(data); });
  }, [user]);

  const laneProducts = activeLane === "all"
    ? products
    : products.filter((p) => productMatchesLane(p.category, activeLane as MarketplaceLane));

  const totalSales = orders.reduce((s, o) => s + Number(o.total), 0);

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0"><ArrowLeft className="h-5 w-5" /></Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Seller Dashboard</h1>
            <p className="text-muted-foreground mt-1">Manage your products and orders</p>
            {shop && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge variant="outline" className="gap-1">
                  <Store className="h-3 w-3" />
                  {shop.shop_name || "My Shop"}
                </Badge>
                <Button variant="link" size="sm" className="h-auto p-0 gap-1" asChild>
                  <Link to={sellerShopEditorPath()}>
                    <ExternalLink className="h-3 w-3" />My Shop
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>
        <Button className="text-white" style={{ backgroundColor: ICON_COLORS.marketplace }} asChild>
          <Link to="/seller/products"><Plus className="h-4 w-4 mr-1" />Add Product</Link>
        </Button>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="My Products" value={products.length} icon={<Package className="h-5 w-5" />} iconColor={ICON_COLORS.package} index={0} />
        <StatCard title="Total Orders" value={orders.length} icon={<ShoppingBag className="h-5 w-5" />} iconColor={ICON_COLORS.shopping} index={1} />
        <StatCard title="Total Sales" value={`৳${totalSales.toLocaleString()}`} icon={<TrendingUp className="h-5 w-5" />} iconColor={ICON_COLORS.finance} index={2} />
        <StatCard title="Pending Orders" value={orders.filter(o => o.status === "pending").length} icon={<Package className="h-5 w-5" />} iconColor={ICON_COLORS.health} index={3} />
      </div>

      <Card className="shadow-card border-dashed">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-foreground flex items-center gap-2">
              <Palette className="h-4 w-4" style={{ color: ICON_COLORS.marketplace }} />
              Create promotional poster
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Design product banners and social posts, then use them on your listings.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/seller/photo-editor">Open Photo Editor</Link>
          </Button>
        </CardContent>
      </Card>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setSearchParams(value === "products" ? {} : { tab: value })}
        className="space-y-4"
      >
        <TabsList><TabsTrigger value="products">My Products</TabsTrigger><TabsTrigger value="orders">Incoming Orders</TabsTrigger><TabsTrigger value="messages"><MessageCircle className="h-4 w-4 mr-1" />Messages</TabsTrigger></TabsList>
        <TabsContent value="products">
          {approvedLanes.length > 0 && (
            <Tabs value={activeLane} onValueChange={setActiveLane} className="mb-4">
              <TabsList className="flex flex-wrap h-auto gap-1">
                <TabsTrigger value="all">All lanes</TabsTrigger>
                {approvedLanes.map((lane) => (
                  <TabsTrigger key={lane} value={lane}>{laneLabel(lane)}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}
          <Card className="shadow-card overflow-hidden">
            <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.marketplace}, ${ICON_COLORS.vet})` }} />
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Category</TableHead><TableHead>Listing</TableHead><TableHead>Price</TableHead><TableHead>Available</TableHead><TableHead>Sold</TableHead><TableHead>Rating</TableHead></TableRow></TableHeader>
                <TableBody>
                  {laneProducts.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium text-foreground">{p.name}</TableCell>
                      <TableCell><Badge variant="outline">{p.category}</Badge></TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{p.listing_status || "approved"}</Badge>
                      </TableCell>
                      <TableCell className="text-foreground">৳{p.price}/{p.unit}</TableCell>
                      <TableCell className="text-foreground">{p.stock}</TableCell>
                      <TableCell className="text-muted-foreground">{p.units_sold ?? 0}</TableCell>
                      <TableCell className="text-foreground">⭐ {Number((p as { rating?: number }).rating || 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {laneProducts.length === 0 && <p className="text-center text-muted-foreground py-8">No products listed yet</p>}
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
