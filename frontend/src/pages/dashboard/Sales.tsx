import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, Plus, TrendingUp, ShoppingBag, Pencil, Trash2, FileText } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import StatCard from "@/components/dashboard/StatCard";
import SalesMemo from "@/components/dashboard/SalesMemo";
import { motion } from "framer-motion";
import { ICON_COLORS } from "@/lib/iconColors";
import { toast } from "sonner";
import RelatedLinks from "@/components/dashboard/RelatedLinks";
import { api } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";

const catLabels: Record<string, string> = { eggs: "Eggs", milk: "Milk", meat: "Meat", live_animals: "Live Animals" };
const catColors: Record<string, { bg: string; color: string }> = { eggs: { bg: `${ICON_COLORS.egg}1A`, color: ICON_COLORS.egg }, milk: { bg: `${ICON_COLORS.milk}1A`, color: ICON_COLORS.milk }, meat: { bg: `${ICON_COLORS.health}1A`, color: ICON_COLORS.health }, live_animals: { bg: `${ICON_COLORS.farm}1A`, color: ICON_COLORS.farm } };

interface SaleRow { id: string; date: string; product: string; category: string; quantity: number; unit: string; unit_price: number; total: number; buyer: string; }

export default function Sales() {
  const { user } = useAuth();
  const [records, setRecords] = useState<SaleRow[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [memoOpen, setMemoOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const emptyForm = { date: "", product: "", category: "eggs", quantity: 0, unit: "pieces", unitPrice: 0, buyer: "" };
  const [form, setForm] = useState(emptyForm);

  const loadData = async () => {
    if (!user) return;
    const { data } = await api.from("sale_records").select("*").eq("user_id", user.id).order("date", { ascending: false });
    setRecords((data || []).map(r => ({ ...r, quantity: Number(r.quantity), unit_price: Number(r.unit_price), total: Number(r.total) })) as SaleRow[]);
  };
  useEffect(() => { loadData(); }, [user]);

  const totalRevenue = records.reduce((sum, r) => sum + r.total, 0);
  const totalQty = records.length;
  const avgSale = totalQty ? Math.round(totalRevenue / totalQty) : 0;

  const chartData = Object.values(records.reduce((acc, r) => { acc[r.date] = acc[r.date] || { date: r.date, revenue: 0 }; acc[r.date].revenue += r.total; return acc; }, {} as Record<string, { date: string; revenue: number }>)).sort((a, b) => a.date.localeCompare(b.date)).slice(-7);

  const syncToFinances = async (date: string, product: string, total: number) => {
    if (!user) return;
    await api.from("financial_records").insert({
      user_id: user.id,
      date,
      type: "income",
      category: "Sales",
      amount: total,
      description: `Sale: ${product}`,
    });
  };

  const handleAdd = async () => {
    if (!user || !form.product || !form.date || !form.buyer) { toast.error("Fill in required fields"); return; }
    const total = form.quantity * form.unitPrice;
    const { error } = await api.from("sale_records").insert({ user_id: user.id, date: form.date, product: form.product, category: form.category, quantity: form.quantity, unit: form.unit, unit_price: form.unitPrice, total, buyer: form.buyer });
    if (!error) {
      await syncToFinances(form.date, form.product, total);
      toast.success("Sale recorded & synced to Finances");
    } else {
      toast.error("Failed to record sale");
    }
    setForm(emptyForm); setAddOpen(false); loadData();
  };

  const handleEdit = async () => {
    if (!editId) return;
    const total = form.quantity * form.unitPrice;
    await api.from("sale_records").update({ date: form.date, product: form.product, category: form.category, quantity: form.quantity, unit: form.unit, unit_price: form.unitPrice, total, buyer: form.buyer }).eq("id", editId);
    setEditOpen(false); setEditId(null); toast.success("Sale updated"); loadData();
  };

  const openEdit = (r: SaleRow) => { setForm({ date: r.date, product: r.product, category: r.category, quantity: r.quantity, unit: r.unit, unitPrice: r.unit_price, buyer: r.buyer }); setEditId(r.id); setEditOpen(true); };

  const handleDelete = async () => {
    if (!deleteId) return;
    await api.from("sale_records").delete().eq("id", deleteId);
    setDeleteOpen(false); setDeleteId(null); toast.success("Sale deleted"); loadData();
  };

  const formFields = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
        <div><Label>Category</Label><Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="eggs">Eggs</SelectItem><SelectItem value="milk">Milk</SelectItem><SelectItem value="meat">Meat</SelectItem><SelectItem value="live_animals">Live Animals</SelectItem></SelectContent></Select></div>
      </div>
      <div><Label>Product Name</Label><Input value={form.product} onChange={e => setForm({ ...form, product: e.target.value })} /></div>
      <div className="grid grid-cols-3 gap-3">
        <div><Label>Quantity</Label><Input type="number" value={form.quantity || ""} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })} /></div>
        <div><Label>Unit</Label><Input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} /></div>
        <div><Label>Unit Price (৳)</Label><Input type="number" value={form.unitPrice || ""} onChange={e => setForm({ ...form, unitPrice: Number(e.target.value) })} /></div>
      </div>
      <div><Label>Buyer</Label><Input value={form.buyer} onChange={e => setForm({ ...form, buyer: e.target.value })} /></div>
      {form.quantity > 0 && form.unitPrice > 0 && <p className="text-sm font-medium" style={{ color: ICON_COLORS.farmBrand }}>Total: ৳{(form.quantity * form.unitPrice).toLocaleString()}</p>}
    </div>
  );

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Sales Tracking</h1>
          <p className="text-muted-foreground mt-1">Track your farm product sales</p>
          <RelatedLinks links={[{ label: "Finances", url: "/dashboard/finances", color: ICON_COLORS.wallet }, { label: "Production", url: "/dashboard/production", color: ICON_COLORS.egg }]} />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setMemoOpen(true)} disabled={records.length === 0}>
            <FileText className="h-4 w-4 mr-1" style={{ color: ICON_COLORS.farmBrand }} /> Generate Memo
          </Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}><DialogTrigger asChild><Button className="text-white" style={{ backgroundColor: ICON_COLORS.farmBrand }}><Plus className="h-4 w-4 mr-1" /> Record Sale</Button></DialogTrigger>
            <DialogContent><DialogHeader><DialogTitle className="font-display">Record Sale</DialogTitle><DialogDescription className="sr-only">Enter sale details, then record.</DialogDescription></DialogHeader>{formFields}<DialogFooter><Button className="text-white" style={{ backgroundColor: ICON_COLORS.farmBrand }} onClick={handleAdd}>Record Sale</Button></DialogFooter></DialogContent>
          </Dialog>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Revenue" value={`৳${totalRevenue > 1000 ? (totalRevenue / 1000).toFixed(0) + "K" : totalRevenue}`} icon={<DollarSign className="h-5 w-5" />} iconColor={ICON_COLORS.dollar} index={0} />
        <StatCard title="Total Sales" value={totalQty.toString()} icon={<ShoppingBag className="h-5 w-5" />} iconColor={ICON_COLORS.marketplace} index={1} />
        <StatCard title="Avg Sale Value" value={`৳${avgSale.toLocaleString()}`} icon={<TrendingUp className="h-5 w-5" />} iconColor={ICON_COLORS.dashboard} index={2} />
        <StatCard title="Categories" value={[...new Set(records.map(r => r.category))].length.toString()} icon={<ShoppingBag className="h-5 w-5" />} iconColor={ICON_COLORS.egg} index={3} />
      </div>

      {chartData.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="shadow-card overflow-hidden">
            <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.farmBrand}, ${ICON_COLORS.vet})` }} />
            <CardHeader><CardTitle className="text-lg font-display">Sales Revenue</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <defs><linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={ICON_COLORS.farmBrand} /><stop offset="100%" stopColor={ICON_COLORS.vet} stopOpacity={0.6} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="date" className="text-xs" /><YAxis tickFormatter={v => `৳${(v / 1000).toFixed(0)}K`} className="text-xs" /><Tooltip formatter={(v: number) => `৳${v.toLocaleString()}`} />
                  <Bar dataKey="revenue" fill="url(#salesGrad)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <Card className="shadow-card overflow-hidden">
          <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.farmBrand}, ${ICON_COLORS.farm})` }} />
          <CardContent className="p-0 overflow-x-auto">
            <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Product</TableHead><TableHead>Category</TableHead><TableHead>Qty</TableHead><TableHead>Unit Price</TableHead><TableHead>Total</TableHead><TableHead>Buyer</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>{records.map(r => {
                const cc = catColors[r.category] || catColors.eggs;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-muted-foreground">{r.date}</TableCell>
                    <TableCell className="font-medium text-foreground">{r.product}</TableCell>
                    <TableCell><Badge style={{ backgroundColor: cc.bg, color: cc.color }}>{catLabels[r.category] || r.category}</Badge></TableCell>
                    <TableCell className="text-foreground">{r.quantity} {r.unit}</TableCell>
                    <TableCell className="text-muted-foreground">৳{r.unit_price}</TableCell>
                    <TableCell className="font-bold" style={{ color: ICON_COLORS.farmBrand }}>৳{r.total.toLocaleString()}</TableCell>
                    <TableCell className="text-muted-foreground">{r.buyer}</TableCell>
                    <TableCell className="text-right"><div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" style={{ color: ICON_COLORS.farmBrand }} /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { setDeleteId(r.id); setDeleteOpen(true); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div></TableCell>
                  </TableRow>
                );
              })}</TableBody>
            </Table>
            {records.length === 0 && <p className="text-center text-muted-foreground py-8">No sales yet — record your first sale</p>}
          </CardContent>
        </Card>
      </motion.div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}><DialogContent><DialogHeader><DialogTitle className="font-display">Edit Sale</DialogTitle><DialogDescription className="sr-only">Update sale fields, then save.</DialogDescription></DialogHeader>{formFields}<DialogFooter><Button className="text-white" style={{ backgroundColor: ICON_COLORS.farmBrand }} onClick={handleEdit}>Save Changes</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}><DialogContent><DialogHeader><DialogTitle className="font-display">Delete Sale</DialogTitle><DialogDescription>Are you sure? This action cannot be undone.</DialogDescription></DialogHeader><DialogFooter className="gap-2"><Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button><Button variant="destructive" onClick={handleDelete}>Delete</Button></DialogFooter></DialogContent></Dialog>

      <SalesMemo open={memoOpen} onOpenChange={setMemoOpen} records={records} />
    </div>
  );
}
