import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Skull, Plus, TrendingDown, AlertTriangle, Pencil, Trash2 } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import { motion } from "framer-motion";
import { ICON_COLORS } from "@/lib/iconColors";
import { toast } from "sonner";
import RelatedLinks from "@/components/dashboard/RelatedLinks";
import { api } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";

interface MortRow { id: string; farm_id: string | null; date: string; cause: string; animal_type: string | null; batch_id: string | null; count: number; }
interface FarmRow { id: string; name: string; total_animals: number; }

export default function Mortality() {
  const { user } = useAuth();
  const [records, setRecords] = useState<MortRow[]>([]);
  const [farms, setFarms] = useState<FarmRow[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const emptyForm = { farm_id: "", date: "", cause: "", animal_type: "chicken", batch_id: "", count: 0 };
  const [form, setForm] = useState(emptyForm);

  const loadData = async () => {
    if (!user) return;
    const [mRes, fRes] = await Promise.all([
      api.from("mortality_records").select("*").eq("user_id", user.id).order("date", { ascending: false }),
      api.from("farms").select("id, name, total_animals").eq("user_id", user.id),
    ]);
    setRecords((mRes.data || []) as MortRow[]);
    setFarms((fRes.data || []) as FarmRow[]);
  };
  useEffect(() => { loadData(); }, [user]);

  const totalDeaths = records.reduce((sum, r) => sum + r.count, 0);
  const totalAnimals = farms.reduce((sum, f) => sum + f.total_animals, 0);
  const mortalityRate = totalAnimals > 0 ? ((totalDeaths / totalAnimals) * 100).toFixed(2) : "0";
  const topCause = records.reduce((acc, r) => { acc[r.cause] = (acc[r.cause] || 0) + r.count; return acc; }, {} as Record<string, number>);
  const topCauseEntry = Object.entries(topCause).sort((a, b) => b[1] - a[1])[0];
  const farmName = (id: string | null) => farms.find(f => f.id === id)?.name || "—";

  // Chart data
  const chartData = Object.values(records.reduce((acc, r) => { acc[r.date] = acc[r.date] || { date: r.date, deaths: 0 }; acc[r.date].deaths += r.count; return acc; }, {} as Record<string, { date: string; deaths: number }>)).sort((a, b) => a.date.localeCompare(b.date)).slice(-7);

  const handleAdd = async () => {
    if (!user || !form.cause || !form.date) { toast.error("Fill in required fields"); return; }
    await api.from("mortality_records").insert({ user_id: user.id, farm_id: form.farm_id || null, date: form.date, cause: form.cause, animal_type: form.animal_type, batch_id: form.batch_id || null, count: form.count });
    setForm(emptyForm); setAddOpen(false); toast.success("Mortality logged"); loadData();
  };

  const handleEdit = async () => {
    if (!editId) return;
    await api.from("mortality_records").update({ farm_id: form.farm_id || null, date: form.date, cause: form.cause, animal_type: form.animal_type, batch_id: form.batch_id || null, count: form.count }).eq("id", editId);
    setEditOpen(false); setEditId(null); toast.success("Record updated"); loadData();
  };

  const openEdit = (r: MortRow) => { setForm({ farm_id: r.farm_id || "", date: r.date, cause: r.cause, animal_type: r.animal_type || "chicken", batch_id: r.batch_id || "", count: r.count }); setEditId(r.id); setEditOpen(true); };

  const handleDelete = async () => {
    if (!deleteId) return;
    await api.from("mortality_records").delete().eq("id", deleteId);
    setDeleteOpen(false); setDeleteId(null); toast.success("Record deleted"); loadData();
  };

  const formFields = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
        <div><Label>Farm</Label><Select value={form.farm_id} onValueChange={v => setForm({ ...form, farm_id: v })}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{farms.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent></Select></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Animal Type</Label><Select value={form.animal_type} onValueChange={v => setForm({ ...form, animal_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["chicken","duck","turkey","pigeon","cow","goat","sheep"].map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Batch ID</Label><Input value={form.batch_id} onChange={e => setForm({ ...form, batch_id: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Count</Label><Input type="number" value={form.count || ""} onChange={e => setForm({ ...form, count: Number(e.target.value) })} /></div>
        <div><Label>Cause</Label><Input value={form.cause} onChange={e => setForm({ ...form, cause: e.target.value })} placeholder="e.g. Heat stress" /></div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Mortality Tracking</h1>
          <p className="text-muted-foreground mt-1">Monitor animal deaths and identify causes</p>
          <RelatedLinks links={[{ label: "Health Records", url: "/dashboard/health", color: ICON_COLORS.health }, { label: "Animals", url: "/dashboard/animals", color: ICON_COLORS.animals }]} />
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}><DialogTrigger asChild><Button className="text-white" style={{ backgroundColor: ICON_COLORS.farmBrand }}><Plus className="h-4 w-4 mr-1" /> Log Death</Button></DialogTrigger>
          <DialogContent><DialogHeader><DialogTitle className="font-display">Log Mortality</DialogTitle><DialogDescription className="sr-only">Enter mortality details, then submit.</DialogDescription></DialogHeader>{formFields}<DialogFooter><Button className="text-white" style={{ backgroundColor: ICON_COLORS.farmBrand }} onClick={handleAdd}>Log Death</Button></DialogFooter></DialogContent>
        </Dialog>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Deaths" value={totalDeaths.toString()} icon={<Skull className="h-5 w-5" />} iconColor={ICON_COLORS.mortality} index={0} />
        <StatCard title="Mortality Rate" value={`${mortalityRate}%`} icon={<TrendingDown className="h-5 w-5" />} iconColor={ICON_COLORS.finance} index={1} />
        <StatCard title="Records" value={records.length.toString()} icon={<AlertTriangle className="h-5 w-5" />} iconColor={ICON_COLORS.alert} index={2} />
        <StatCard title="Top Cause" value={topCauseEntry?.[0] || "—"} icon={<Skull className="h-5 w-5" />} iconColor={ICON_COLORS.health} index={3} />
      </div>

      {chartData.length > 0 && (
        <Card className="shadow-card overflow-hidden">
          <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.health}, ${ICON_COLORS.mortality})` }} />
          <CardHeader><CardTitle className="text-lg font-display">Mortality Trend</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={chartData}><defs><linearGradient id="mortGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={ICON_COLORS.health} stopOpacity={0.4} /><stop offset="100%" stopColor={ICON_COLORS.health} stopOpacity={0.05} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="date" className="text-xs" /><YAxis className="text-xs" /><Tooltip />
                <Area type="monotone" dataKey="deaths" stroke={ICON_COLORS.health} strokeWidth={2} fill="url(#mortGrad)" dot={{ r: 4, fill: ICON_COLORS.health }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-card overflow-hidden">
        <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.farmBrand}, ${ICON_COLORS.mortality})` }} />
        <CardContent className="p-0">
          <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Farm</TableHead><TableHead>Animal</TableHead><TableHead>Batch</TableHead><TableHead>Count</TableHead><TableHead>Cause</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>{records.map(r => (
              <TableRow key={r.id}>
                <TableCell className="text-muted-foreground">{r.date}</TableCell>
                <TableCell className="text-foreground">{farmName(r.farm_id)}</TableCell>
                <TableCell className="capitalize text-foreground">{r.animal_type}</TableCell>
                <TableCell className="text-muted-foreground">{r.batch_id || "—"}</TableCell>
                <TableCell><Badge variant="destructive">{r.count}</Badge></TableCell>
                <TableCell className="text-foreground">{r.cause}</TableCell>
                <TableCell className="text-right"><div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" style={{ color: ICON_COLORS.farmBrand }} /></Button>
                  <Button variant="ghost" size="icon" onClick={() => { setDeleteId(r.id); setDeleteOpen(true); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div></TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
          {records.length === 0 && <p className="text-center text-muted-foreground py-8">No mortality records</p>}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}><DialogContent><DialogHeader><DialogTitle className="font-display">Edit Mortality Record</DialogTitle><DialogDescription className="sr-only">Update mortality fields, then save.</DialogDescription></DialogHeader>{formFields}<DialogFooter><Button className="text-white" style={{ backgroundColor: ICON_COLORS.farmBrand }} onClick={handleEdit}>Save Changes</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}><DialogContent><DialogHeader><DialogTitle className="font-display">Delete Record</DialogTitle><DialogDescription>Are you sure? This action cannot be undone.</DialogDescription></DialogHeader><DialogFooter className="gap-2"><Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button><Button variant="destructive" onClick={handleDelete}>Delete</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
