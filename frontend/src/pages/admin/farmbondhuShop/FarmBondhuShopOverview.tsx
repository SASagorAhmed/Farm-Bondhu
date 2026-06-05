import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { Package, ShoppingBag, TrendingUp, Clock, Palette } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import { ICON_COLORS } from "@/lib/iconColors";
import {
  fetchOfficialShopOrders,
  fetchOfficialShopProducts,
  officialShopOrdersQueryKey,
  officialShopProductsQueryKey,
} from "@/lib/adminFarmBondhuShopApi";
import { OFFICIAL_SHOP_ADMIN_NAV } from "@/lib/officialShopAdminNav";
import OfficialShopPageHeader from "./OfficialShopPageHeader";
import { useOfficialShop } from "./OfficialShopProvider";
import SellerChatInbox from "@/components/marketplace/SellerChatInbox";

export default function FarmBondhuShopOverview() {
  const { sellerId } = useOfficialShop();

  const { data: products = [] } = useQuery({
    queryKey: officialShopProductsQueryKey(),
    queryFn: fetchOfficialShopProducts,
  });

  const { data: orders = [] } = useQuery({
    queryKey: officialShopOrdersQueryKey(),
    queryFn: fetchOfficialShopOrders,
  });

  const pendingOrders = orders.filter((o) => o.status === "pending").length;
  const activeOrders = orders.filter((o) =>
    ["confirmed", "packed", "shipped", "out_for_delivery"].includes(o.status),
  ).length;
  const deliveredRevenue = orders
    .filter((o) => o.paymentStatus === "paid" || o.status === "delivered")
    .reduce((sum, o) => sum + o.total, 0);

  const toolLinks = OFFICIAL_SHOP_ADMIN_NAV.filter((item) => item.url !== "/admin/farmbondhu-shop");
  const recentProducts = products.slice(0, 5);
  const recentOrders = orders.slice(0, 5);

  return (
    <div className="space-y-6">
      <OfficialShopPageHeader
        title="FarmBondhu Official Shop"
        description="Seller-style dashboard for the platform-owned shop."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Products" value={products.length} icon={<Package className="h-5 w-5" />} iconColor={ICON_COLORS.package} index={0} />
        <StatCard title="Total orders" value={orders.length} icon={<ShoppingBag className="h-5 w-5" />} iconColor={ICON_COLORS.shopping} index={1} />
        <StatCard title="Paid revenue" value={`৳${deliveredRevenue.toLocaleString()}`} icon={<TrendingUp className="h-5 w-5" />} iconColor={ICON_COLORS.finance} index={2} />
        <StatCard title="Pending orders" value={pendingOrders} icon={<Clock className="h-5 w-5" />} iconColor={ICON_COLORS.health} index={3} />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active fulfillment</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-display font-bold">{activeOrders}</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Official seller ID</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs font-mono text-muted-foreground break-all">{sellerId}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card border-dashed">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-foreground flex items-center gap-2">
              <Palette className="h-4 w-4" style={{ color: ICON_COLORS.marketplace }} />
              Create promotional poster
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Design shop banners and product visuals for the official FarmBondhu storefront.
            </p>
          </div>
          <Button asChild className="text-white" style={{ backgroundColor: ICON_COLORS.farm }}>
            <Link to="/admin/farmbondhu-shop/photo-editor">Open photo editor</Link>
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="products">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="products">Recent products</TabsTrigger>
          <TabsTrigger value="orders">Incoming orders</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
        </TabsList>
        <TabsContent value="products" className="mt-4">
          <Card className="shadow-card">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentProducts.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Link to={`/admin/farmbondhu-shop/products/${p.id}`} className="font-medium hover:underline">
                          {p.name}
                        </Link>
                      </TableCell>
                      <TableCell>{p.stock}</TableCell>
                      <TableCell className="text-right">৳{p.price}</TableCell>
                    </TableRow>
                  ))}
                  {recentProducts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                        No products yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="orders" className="mt-4">
          <Card className="shadow-card">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Buyer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentOrders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell>
                        <Link to={`/admin/farmbondhu-shop/orders/${o.id}`} className="font-medium hover:underline">
                          #{o.id.slice(0, 8)}
                        </Link>
                      </TableCell>
                      <TableCell>{o.buyerName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{o.status.replace(/_/g, " ")}</Badge>
                      </TableCell>
                      <TableCell className="text-right">৳{o.total}</TableCell>
                    </TableRow>
                  ))}
                  {recentOrders.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No orders yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="messages" className="mt-4">
          {sellerId ? <SellerChatInbox sellerId={sellerId} /> : null}
        </TabsContent>
      </Tabs>

      <div>
        <h2 className="text-lg font-display font-semibold mb-3">Shop tools</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {toolLinks.map((item) => (
            <Link
              key={item.url}
              to={item.url}
              className="flex items-center gap-3 rounded-lg border bg-card p-4 shadow-sm hover:bg-accent/40 transition-colors"
            >
              <item.icon className="h-5 w-5 shrink-0" style={{ color: item.iconColor }} />
              <span className="font-medium text-foreground">{item.title}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
