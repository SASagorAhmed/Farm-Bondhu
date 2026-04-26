import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { Egg, Milk, Plus, TrendingUp, Pencil, Trash2 } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import { motion } from "framer-motion";
import { ICON_COLORS } from "@/lib/iconColors";
import { toast } from "sonner";
import RelatedLinks from "@/components/dashboard/RelatedLinks";
import { api } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";

interface ProdRow { id: string; date: string; eggs: number; milk: number; }

export default function Production() {
  const { user } = useAuth();
  const [records, setRecords] = useState<ProdRow[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [form, setForm] = useState({ date: "", eggs: 0, milk: 0 });
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loadData = async () => {
    if (!user) return;
    const { data } = await api.from("production_records").select("*").eq("user_id", user.id).order("date", { ascending: true });
    setRecords((data || []).map(r => ({ id: r.id, date: r.date, eggs: r.eggs, milk: Number(r.milk) })));
  };
  useEffect(() => { loadData(); }, [user]);

  const latestEggs = records[records.length - 1]?.eggs || 0;
  const latestMilk = records[records.length - 1]?.milk || 0;
  const avgEggs = records.length ? Math.round(records.reduce((s, d) => s + d.eggs, 0) / records.length) : 0;
  const avgMilk = records.length ? Math.round(records.reduce((s, d) => s + d.milk, 0) / records.length) : 0;
  const totalEggs = records.reduce((s, d) => s + d.eggs, 0);

  const handleAdd = async () => {
    if (!user || !form.date) { toast.error("Select a date"); return; }
    await api.from("production_records").insert({ user_id: user.id, date: form.date, eggs: form.eggs, milk: form.milk });
    setForm({ date: "", eggs: 0, milk: 0 }); setAddOpen(false); toast.success("Production entry added"); loadData();
  };

  const handleEdit = async () => {
    if (!editId) return;
    await api.from("production_records").update({ date: form.date, eggs: form.eggs, milk: form.milk }).eq("id", editId);
    setEditOpen(false); setEditId(null); toast.success("Entry updated"); loadData();
  };

  const openEdit = (r: ProdRow) => { setForm({ date: r.date, eggs: r.eggs, milk: r.milk }); setEditId(r.id); setEditOpen(true); };

  const handleDelete = async () => {
    if (!deleteId) return;
    await api.from("production_records").delete().eq("id", deleteId);
    setDeleteOpen(false); setDeleteId(null); toast.success("Entry deleted"); loadData();
  };

  const formFields = (
    <div className="space-y-4">
      <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Eggs Count</Label><Input type="number" value={form.eggs || ""} onChange={e => setForm({ ...form, eggs: Number(e.target.value) })} /></div>
        <div><Label>Milk (Liters)</Label><Input type="number" value={form.milk || ""} onChange={e => setForm({ ...form, milk: Number(e.target.value) })} /></div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Production</h1>
          <p className="text-muted-foreground mt-1">Track egg collection and milk production</p>
          <RelatedLinks links={[{ label: "Sales", url: "/dashboard/sales", color: ICON_COLORS.finance }, { label: "Finances", url: "/dashboard/finances", color: ICON_COLORS.wallet }]} />
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}><DialogTrigger asChild><Button className="text-white" style={{ backgroundColor: ICON_COLORS.farmBrand }}><Plus className="h-4 w-4 mr-1" />Add Entry</Button></DialogTrigger>
          <DialogContent><DialogHeader><DialogTitle>Add Production Record</DialogTitle><DialogDescription className="sr-only">Enter production details, then add.</DialogDescription></DialogHeader>{formFields}<DialogFooter><Button className="text-white" style={{ backgroundColor: ICON_COLORS.farmBrand }} onClick={handleAdd}>Add Entry</Button></DialogFooter></DialogContent>
        </Dialog>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Latest Eggs" value={latestEggs.toLocaleString()} icon={<Egg className="h-5 w-5" />} iconColor={ICON_COLORS.egg} index={0} />
        <StatCard title="Latest Milk" value={`${latestMilk}L`} icon={<Milk className="h-5 w-5" />} iconColor={ICON_COLORS.milk} index={1} />
        <StatCard title="Total Eggs" value={totalEggs.toLocaleString()} icon={<TrendingUp className="h-5 w-5" />} iconColor={ICON_COLORS.dashboard} index={2} />
        <StatCard title="Avg Daily Milk" value={`${avgMilk}L`} icon={<Milk className="h-5 w-5" />} iconColor={ICON_COLORS.vet} index={3} />
      </div>

      <Tabs defaultValue="eggs" className="space-y-4">
        <TabsList><TabsTrigger value="eggs">Egg Production</TabsTrigger><TabsTrigger value="milk">Milk Production</TabsTrigger><TabsTrigger value="records">Records Table</TabsTrigger></TabsList>

        <TabsContent value="eggs">
          <Card className="shadow-card overflow-hidden">
            <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.egg}, ${ICON_COLORS.finance})` }} />
            <CardHeader><CardTitle className="text-lg font-display flex items-center gap-2"><Egg className="h-5 w-5" style={{ color: ICON_COLORS.egg }} />Daily Egg Collection</CardTitle></CardHeader>
            <CardContent>
              {records.length === 0 ? <p className="text-center text-muted-foreground py-8">No production data yet</p> : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={records}><defs><linearGradient id="eggGrad2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={ICON_COLORS.egg} /><stop offset="100%" stopColor={ICON_COLORS.egg} stopOpacity={0.3} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="date" /><YAxis /><Tooltip /><Bar dataKey="eggs" fill="url(#eggGrad2)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="milk">
          <Card className="shadow-card overflow-hidden">
            <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.milk}, ${ICON_COLORS.vet})` }} />
            <CardHeader><CardTitle className="text-lg font-display flex items-center gap-2"><Milk className="h-5 w-5" style={{ color: ICON_COLORS.milk }} />Daily Milk Production</CardTitle></CardHeader>
            <CardContent>
              {records.length === 0 ? <p className="text-center text-muted-foreground py-8">No production data yet</p> : (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={records}><defs><linearGradient id="milkGrad2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={ICON_COLORS.milk} stopOpacity={0.4} /><stop offset="100%" stopColor={ICON_COLORS.milk} stopOpacity={0.05} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="date" /><YAxis /><Tooltip />
                    <Area type="monotone" dataKey="milk" stroke={ICON_COLORS.milk} strokeWidth={2} fill="url(#milkGrad2)" dot={{ r: 4, fill: ICON_COLORS.milk }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="records">
          <Card className="shadow-card overflow-hidden">
            <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.farmBrand}, ${ICON_COLORS.farm})` }} />
            <CardHeader><CardTitle className="text-lg font-display">Production Records</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Eggs</TableHead><TableHead>Milk (L)</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>{records.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="text-muted-foreground">{r.date}</TableCell>
                    <TableCell className="font-medium text-foreground">{r.eggs.toLocaleString()}</TableCell>
                    <TableCell className="text-foreground">{r.milk}L</TableCell>
                    <TableCell className="text-right"><div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" style={{ color: ICON_COLORS.farmBrand }} /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { setDeleteId(r.id); setDeleteOpen(true); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div></TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
              {records.length === 0 && <p className="text-center text-muted-foreground py-8">No production records yet</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={editOpen} onOpenChange={setEditOpen}><DialogContent><DialogHeader><DialogTitle>Edit Production Entry</DialogTitle><DialogDescription className="sr-only">Update production fields, then save.</DialogDescription></DialogHeader>{formFields}<DialogFooter><Button className="text-white" style={{ backgroundColor: ICON_COLORS.farmBrand }} onClick={handleEdit}>Save Changes</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}><DialogContent><DialogHeader><DialogTitle>Delete Entry</DialogTitle><DialogDescription>Are you sure? This action cannot be undone.</DialogDescription></DialogHeader><DialogFooter className="gap-2"><Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button><Button variant="destructive" onClick={handleDelete}>Delete</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
