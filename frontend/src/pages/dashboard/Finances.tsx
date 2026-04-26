import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { Wallet, TrendingUp, TrendingDown, Plus, Pencil, Trash2 } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import { motion } from "framer-motion";
import { ICON_COLORS } from "@/lib/iconColors";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import RelatedLinks from "@/components/dashboard/RelatedLinks";
import { api } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";

const COLORS = [ICON_COLORS.farm, ICON_COLORS.marketplace, ICON_COLORS.vet, ICON_COLORS.finance, ICON_COLORS.egg, ICON_COLORS.milk];

interface FinRow { id: string; date: string; type: string; category: string; amount: number; description: string; }

export default function Finances() {
  const { user } = useAuth();
  const [records, setRecords] = useState<FinRow[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const emptyForm = { date: "", type: "income", category: "", amount: 0, description: "" };
  const [form, setForm] = useState(emptyForm);

  const loadData = async () => {
    if (!user) return;
    const { data } = await api.from("financial_records").select("*").eq("user_id", user.id).order("date", { ascending: false });
    setRecords((data || []).map(r => ({ ...r, amount: Number(r.amount) })) as FinRow[]);
  };
  useEffect(() => { loadData(); }, [user]);

  const totalRevenue = records.filter(r => r.type === "income").reduce((s, r) => s + r.amount, 0);
  const totalExpenses = records.filter(r => r.type === "expense").reduce((s, r) => s + r.amount, 0);
  const profit = totalRevenue - totalExpenses;

  // Build breakdowns
  const revBreakdown = Object.entries(records.filter(r => r.type === "income").reduce((acc, r) => { acc[r.category] = (acc[r.category] || 0) + r.amount; return acc; }, {} as Record<string, number>)).map(([category, amount]) => ({ category, amount }));
  const expBreakdown = Object.entries(records.filter(r => r.type === "expense").reduce((acc, r) => { acc[r.category] = (acc[r.category] || 0) + r.amount; return acc; }, {} as Record<string, number>)).map(([category, amount]) => ({ category, amount }));

  const handleAdd = async () => {
    if (!user || !form.category || !form.date || !form.amount) { toast.error("Fill in required fields"); return; }
    await api.from("financial_records").insert({ user_id: user.id, date: form.date, type: form.type, category: form.category, amount: form.amount, description: form.description });
    setForm(emptyForm); setAddOpen(false); toast.success("Financial entry added"); loadData();
  };

  const handleEdit = async () => {
    if (!editId) return;
    await api.from("financial_records").update({ date: form.date, type: form.type, category: form.category, amount: form.amount, description: form.description }).eq("id", editId);
    setEditOpen(false); setEditId(null); toast.success("Entry updated"); loadData();
  };

  const openEdit = (r: FinRow) => { setForm({ date: r.date, type: r.type, category: r.category, amount: r.amount, description: r.description }); setEditId(r.id); setEditOpen(true); };

  const handleDelete = async () => {
    if (!deleteId) return;
    await api.from("financial_records").delete().eq("id", deleteId);
    setDeleteOpen(false); setDeleteId(null); toast.success("Entry deleted"); loadData();
  };

  const formFields = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
        <div><Label>Type</Label><Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="income">Revenue</SelectItem><SelectItem value="expense">Expense</SelectItem></SelectContent></Select></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Category</Label><Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="e.g. Feed, Eggs, Labor" /></div>
        <div><Label>Amount (৳)</Label><Input type="number" value={form.amount || ""} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} /></div>
      </div>
      <div><Label>Description</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Finances</h1>
          <p className="text-muted-foreground mt-1">Revenue, expenses and profit tracking</p>
          <RelatedLinks links={[{ label: "Sales", url: "/dashboard/sales", color: ICON_COLORS.finance }, { label: "Production", url: "/dashboard/production", color: ICON_COLORS.egg }]} />
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}><DialogTrigger asChild><Button className="text-white" style={{ backgroundColor: ICON_COLORS.farmBrand }}><Plus className="h-4 w-4 mr-1" />Add Entry</Button></DialogTrigger>
          <DialogContent><DialogHeader><DialogTitle>Add Financial Entry</DialogTitle><DialogDescription className="sr-only">Enter transaction details, then add.</DialogDescription></DialogHeader>{formFields}<DialogFooter><Button className="text-white" style={{ backgroundColor: ICON_COLORS.farmBrand }} onClick={handleAdd}>Add Entry</Button></DialogFooter></DialogContent>
        </Dialog>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Revenue" value={`৳${totalRevenue > 1000 ? (totalRevenue / 1000).toFixed(0) + "K" : totalRevenue}`} icon={<TrendingUp className="h-5 w-5" />} iconColor={ICON_COLORS.farm} index={0} />
        <StatCard title="Total Expenses" value={`৳${totalExpenses > 1000 ? (totalExpenses / 1000).toFixed(0) + "K" : totalExpenses}`} icon={<TrendingDown className="h-5 w-5" />} iconColor={ICON_COLORS.health} index={1} />
        <StatCard title="Net Profit" value={`৳${profit > 1000 ? (profit / 1000).toFixed(0) + "K" : profit}`} icon={<Wallet className="h-5 w-5" />} iconColor={ICON_COLORS.wallet} index={2} />
        <StatCard title="Profit Margin" value={totalRevenue > 0 ? `${((profit / totalRevenue) * 100).toFixed(1)}%` : "0%"} icon={<TrendingUp className="h-5 w-5" />} iconColor={ICON_COLORS.dashboard} index={3} />
      </div>

      {(revBreakdown.length > 0 || expBreakdown.length > 0) && (
        <div className="grid md:grid-cols-2 gap-4">
          {revBreakdown.length > 0 && (
            <Card className="shadow-card overflow-hidden">
              <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.farmBrand}, ${ICON_COLORS.marketplace})` }} />
              <CardHeader><CardTitle className="text-lg font-display">Revenue Breakdown</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart><Pie data={revBreakdown} dataKey="amount" nameKey="category" cx="50%" cy="50%" outerRadius={90} label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}>{revBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip formatter={(v: number) => `৳${v.toLocaleString()}`} /></PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
          {expBreakdown.length > 0 && (
            <Card className="shadow-card overflow-hidden">
              <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.farmBrand}, ${ICON_COLORS.health})` }} />
              <CardHeader><CardTitle className="text-lg font-display">Expense Breakdown</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={expBreakdown} layout="vertical"><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis type="number" tickFormatter={v => `৳${(v / 1000).toFixed(0)}K`} /><YAxis dataKey="category" type="category" width={100} className="text-xs" /><Tooltip formatter={(v: number) => `৳${v.toLocaleString()}`} /><Bar dataKey="amount" fill={ICON_COLORS.farmBrand} radius={[0, 6, 6, 0]} /></BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Card className="shadow-card overflow-hidden">
        <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.farmBrand}, ${ICON_COLORS.dashboard})` }} />
        <CardHeader><CardTitle className="text-lg font-display">Financial Records</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Category</TableHead><TableHead>Amount</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>{records.map(r => (
              <TableRow key={r.id}>
                <TableCell className="text-muted-foreground">{r.date}</TableCell>
                <TableCell><Badge style={{ backgroundColor: r.type === "income" ? `${ICON_COLORS.farmBrand}1A` : `${ICON_COLORS.health}1A`, color: r.type === "income" ? ICON_COLORS.farmBrand : ICON_COLORS.health }}>{r.type === "income" ? "Revenue" : "Expense"}</Badge></TableCell>
                <TableCell className="text-foreground">{r.category}</TableCell>
                <TableCell className="font-bold" style={{ color: r.type === "income" ? ICON_COLORS.farmBrand : ICON_COLORS.health }}>{r.type === "income" ? "+" : "-"}৳{r.amount.toLocaleString()}</TableCell>
                <TableCell className="text-muted-foreground">{r.description}</TableCell>
                <TableCell className="text-right"><div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" style={{ color: ICON_COLORS.farmBrand }} /></Button>
                  <Button variant="ghost" size="icon" onClick={() => { setDeleteId(r.id); setDeleteOpen(true); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div></TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
          {records.length === 0 && <p className="text-center text-muted-foreground py-8">No financial records yet</p>}
        </CardContent>
      </Card>

      <Card className="shadow-card overflow-hidden">
        <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.farmBrand}, ${ICON_COLORS.dashboard})` }} />
        <CardHeader><CardTitle className="text-lg font-display">Profit & Loss Summary</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-4 rounded-lg" style={{ backgroundColor: `${ICON_COLORS.farmBrand}1A` }}><p className="text-sm text-muted-foreground">Revenue</p><p className="text-xl font-bold" style={{ color: ICON_COLORS.farmBrand }}>৳{totalRevenue.toLocaleString()}</p></div>
            <div className="p-4 rounded-lg" style={{ backgroundColor: `${ICON_COLORS.health}1A` }}><p className="text-sm text-muted-foreground">Expenses</p><p className="text-xl font-bold" style={{ color: ICON_COLORS.health }}>৳{totalExpenses.toLocaleString()}</p></div>
            <div className="p-4 rounded-lg" style={{ backgroundColor: `${ICON_COLORS.dashboard}1A` }}><p className="text-sm text-muted-foreground">Net Profit</p><p className="text-xl font-bold" style={{ color: ICON_COLORS.dashboard }}>৳{profit.toLocaleString()}</p></div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}><DialogContent><DialogHeader><DialogTitle>Edit Financial Entry</DialogTitle><DialogDescription className="sr-only">Update fields, then save.</DialogDescription></DialogHeader>{formFields}<DialogFooter><Button className="text-white" style={{ backgroundColor: ICON_COLORS.farmBrand }} onClick={handleEdit}>Save Changes</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}><DialogContent><DialogHeader><DialogTitle>Delete Entry</DialogTitle><DialogDescription>Are you sure? This action cannot be undone.</DialogDescription></DialogHeader><DialogFooter className="gap-2"><Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button><Button variant="destructive" onClick={handleDelete}>Delete</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
