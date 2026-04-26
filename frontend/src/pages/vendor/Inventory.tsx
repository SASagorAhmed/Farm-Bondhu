import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { Boxes, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { motion } from "framer-motion";
import { ICON_COLORS } from "@/lib/iconColors";
import StatCard from "@/components/dashboard/StatCard";

function stockLevel(stock: number): { label: string; color: string } {
  if (stock === 0) return { label: "Out of Stock", color: ICON_COLORS.health };
  if (stock <= 10) return { label: "Critical", color: ICON_COLORS.health };
  if (stock <= 50) return { label: "Low", color: ICON_COLORS.finance };
  return { label: "Healthy", color: ICON_COLORS.farm };
}

export default function Inventory() {
  const { user } = useAuth();
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    api.from("products").select("*").eq("seller_id", user.id).then(({ data }) => { if (data) setProducts(data); });
  }, [user]);

  const totalStock = products.reduce((s, p) => s + p.stock, 0);
  const lowStock = products.filter(p => p.stock > 0 && p.stock <= 50).length;
  const outOfStock = products.filter(p => p.stock === 0).length;
  const healthy = products.filter(p => p.stock > 50).length;
  const maxStock = Math.max(...products.map(p => p.stock), 1);

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Inventory</h1>
        <p className="text-muted-foreground mt-1">Track stock levels and manage inventory</p>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Stock Units" value={totalStock.toLocaleString()} icon={<Boxes className="h-5 w-5" />} iconColor={ICON_COLORS.marketplace} index={0} />
        <StatCard title="Healthy Stock" value={healthy} icon={<CheckCircle2 className="h-5 w-5" />} iconColor={ICON_COLORS.farm} index={1} />
        <StatCard title="Low Stock" value={lowStock} icon={<AlertTriangle className="h-5 w-5" />} iconColor={ICON_COLORS.finance} index={2} />
        <StatCard title="Out of Stock" value={outOfStock} icon={<XCircle className="h-5 w-5" />} iconColor={ICON_COLORS.health} index={3} />
      </div>

      {products.filter(p => p.stock <= 10 && p.stock > 0).length > 0 && (
        <Card className="shadow-card border-l-4" style={{ borderLeftColor: ICON_COLORS.finance }}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2"><AlertTriangle className="h-5 w-5" style={{ color: ICON_COLORS.finance }} /><h3 className="font-display font-semibold text-foreground">Stock Alerts</h3></div>
            <div className="space-y-1">{products.filter(p => p.stock <= 10 && p.stock > 0).map(p => <p key={p.id} className="text-sm text-muted-foreground"><span className="font-medium text-foreground">{p.name}</span> — only <span className="font-bold" style={{ color: ICON_COLORS.health }}>{p.stock}</span> units left</p>)}</div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-card overflow-hidden">
        <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.marketplace}, ${ICON_COLORS.vet})` }} />
        <CardHeader><CardTitle className="text-lg font-display">Stock Overview</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Stock</TableHead><TableHead className="w-[200px]">Level</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {products.sort((a, b) => a.stock - b.stock).map(p => {
                const level = stockLevel(p.stock);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium text-foreground">{p.name}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{p.category}</Badge></TableCell>
                    <TableCell className="text-right font-medium text-foreground">{p.stock} {p.unit}s</TableCell>
                    <TableCell><div className="flex items-center gap-2"><Progress value={(p.stock / maxStock) * 100} className="h-2 flex-1" /></div></TableCell>
                    <TableCell><Badge style={{ backgroundColor: `${level.color}1A`, color: level.color }}>{level.label}</Badge></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {products.length === 0 && <p className="text-center text-muted-foreground py-8">No products in inventory</p>}
        </CardContent>
      </Card>
    </div>
  );
}
