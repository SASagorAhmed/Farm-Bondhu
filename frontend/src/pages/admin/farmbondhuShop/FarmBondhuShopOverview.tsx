import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { moduleCachePolicy, queryKeys } from "@/lib/queryClient";
import { fetchOfficialShopProducts } from "@/lib/adminFarmBondhuShopApi";
import { OFFICIAL_SHOP_ADMIN_NAV } from "@/lib/officialShopAdminNav";
import OfficialShopPageHeader from "./OfficialShopPageHeader";
import { useOfficialShop } from "./OfficialShopProvider";

export default function FarmBondhuShopOverview() {
  const { sellerId } = useOfficialShop();

  const { data: productCount = 0 } = useQuery({
    queryKey: queryKeys().officialShopProductCount(),
    staleTime: moduleCachePolicy.admin.staleTime,
    queryFn: async () => {
      const products = await fetchOfficialShopProducts();
      return Array.isArray(products) ? products.length : 0;
    },
  });

  const toolLinks = OFFICIAL_SHOP_ADMIN_NAV.filter((item) => item.url !== "/admin/farmbondhu-shop");

  return (
    <div className="space-y-6">
      <OfficialShopPageHeader
        title="FarmBondhu Official Shop"
        description="Manage the platform-owned shop without leaving admin."
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Official products</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-display font-bold">{productCount}</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Shop seller ID</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs font-mono text-muted-foreground break-all">{sellerId}</p>
          </CardContent>
        </Card>
      </div>

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
