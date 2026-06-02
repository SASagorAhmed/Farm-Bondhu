import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Boxes, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { ICON_COLORS } from "@/lib/iconColors";
import StatCard from "@/components/dashboard/StatCard";
import {
  fetchOfficialShopInventory,
  officialShopInventoryQueryKey,
} from "@/lib/adminFarmBondhuShopApi";
import OfficialShopPageHeader from "./OfficialShopPageHeader";

function stockLevel(stock: number): { label: string; color: string } {
  if (stock === 0) return { label: "Out of Stock", color: ICON_COLORS.health };
  if (stock <= 10) return { label: "Critical", color: ICON_COLORS.health };
  if (stock <= 50) return { label: "Low", color: ICON_COLORS.finance };
  return { label: "Healthy", color: ICON_COLORS.farm };
}

export default function OfficialShopInventory() {
  const { data: products = [], isLoading } = useQuery({
    queryKey: officialShopInventoryQueryKey(),
    queryFn: fetchOfficialShopInventory,
  });

  const totalStock = products.reduce((s, p) => s + Number(p.stock || 0), 0);
  const totalSold = products.reduce((s, p) => s + Number(p.units_sold || 0), 0);
  const lowStock = products.filter((p) => p.stock > 0 && p.stock <= 50).length;
  const outOfStock = products.filter((p) => p.stock === 0).length;
  const maxStock = Math.max(...products.map((p) => Number(p.stock || 0)), 1);

  return (
    <div className="space-y-6">
      <OfficialShopPageHeader title="Inventory" description="Live stock for official shop products" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Available Units" value={totalStock.toLocaleString()} icon={<Boxes className="h-5 w-5" />} iconColor={ICON_COLORS.marketplace} index={0} />
        <StatCard title="Units Sold" value={totalSold.toLocaleString()} icon={<CheckCircle2 className="h-5 w-5" />} iconColor={ICON_COLORS.farm} index={1} />
        <StatCard title="Low Stock" value={lowStock} icon={<AlertTriangle className="h-5 w-5" />} iconColor={ICON_COLORS.finance} index={2} />
        <StatCard title="Out of Stock" value={outOfStock} icon={<XCircle className="h-5 w-5" />} iconColor={ICON_COLORS.health} index={3} />
      </div>

      <Card className="shadow-card overflow-hidden">
        <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.marketplace}, ${ICON_COLORS.vet})` }} />
        <CardHeader>
          <CardTitle className="text-lg font-display">Stock overview</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && <p className="text-center text-muted-foreground py-8">Loading inventory…</p>}
          {!isLoading && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Sold</TableHead>
                  <TableHead className="w-[200px]">Level</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...products].sort((a, b) => a.stock - b.stock).map((p) => {
                  const level = stockLevel(p.stock);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium text-foreground">{p.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {p.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium text-foreground">
                        {p.stock} {p.unit}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{p.units_sold}</TableCell>
                      <TableCell>
                        <Progress value={(p.stock / maxStock) * 100} className="h-2" />
                      </TableCell>
                      <TableCell>
                        <Badge style={{ backgroundColor: `${level.color}1A`, color: level.color }}>{level.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          {!isLoading && products.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No products in inventory</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
