import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wheat, Package, Plus, AlertTriangle, Pencil, Trash2 } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import { motion } from "framer-motion";
import { ICON_COLORS } from "@/lib/iconColors";
import { toast } from "sonner";
import RelatedLinks from "@/components/dashboard/RelatedLinks";
import { api } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";

interface FeedRow { id: string; date: string; animal_label: string | null; feed_type: string; quantity: number; unit: string; cost: number; }
interface InvRow { id: string; name: string; category: string; stock: number; unit: string; reorder_level: number; }
interface AnimalOption { id: string; label: string; }

export default function Feed() {
  const { user } = useAuth();
  const [records, setRecords] = useState<FeedRow[]>([]);
  const [inventory, setInventory] = useState<InvRow[]>([]);
  const [animalOptions, setAnimalOptions] = useState<AnimalOption[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const emptyForm = { animal_id: "", date: "", feed_type: "", quantity: 0, unit: "kg", cost: 0 };
  const [form, setForm] = useState(emptyForm);

  const loadData = async () => {
    if (!user) return;
    const [fRes, iRes, aRes] = await Promise.all([
      api.from("feed_records").select("*").eq("user_id", user.id).order("date", { ascending: false }),
      api.from("feed_inventory").select("*").eq("user_id", user.id),
      api.from("animals").select("id, tracking_mode, name, batch_id").eq("user_id", user.id),
    ]);
    setRecords((fRes.data || []).map(r => ({ ...r, quantity: Number(r.quantity), cost: Number(r.cost) })) as FeedRow[]);
    setInventory((iRes.data || []).map(r => ({ ...r, stock: Number(r.stock), reorder_level: Number(r.reorder_level) })) as InvRow[]);
    setAnimalOptions((aRes.data || []).map((a: any) => ({ id: a.id, label: a.tracking_mode === "batch" ? `Batch ${a.batch_id}` : a.name || a.id })));
  };
  useEffect(() => { loadData(); }, [user]);

  const totalDailyFeed = records.slice(0, 5).reduce((s, r) => s + r.quantity, 0);
  const totalDailyCost = records.slice(0, 5).reduce((s, r) => s + r.cost, 0);
  const lowStock = inventory.filter(i => i.stock <= i.reorder_level);

  const handleAdd = async () => {
    if (!user || !form.feed_type || !form.date) { toast.error("Fill in required fields"); return; }
    const label = animalOptions.find(a => a.id === form.animal_id)?.label || "";
    await api.from("feed_records").insert({ user_id: user.id, animal_id: form.animal_id || null, animal_label: label, date: form.date, feed_type: form.feed_type, quantity: form.quantity, unit: form.unit, cost: form.cost });
    setForm(emptyForm); setAddOpen(false); toast.success("Feed record added"); loadData();
  };

  const handleEdit = async () => {
    if (!editId) return;
    const label = animalOptions.find(a => a.id === form.animal_id)?.label || "";
    await api.from("feed_records").update({ animal_label: label, date: form.date, feed_type: form.feed_type, quantity: form.quantity, unit: form.unit, cost: form.cost }).eq("id", editId);
    setEditOpen(false); setEditId(null); toast.success("Feed record updated"); loadData();
  };

  const openEdit = (r: FeedRow) => { setForm({ animal_id: "", date: r.date, feed_type: r.feed_type, quantity: r.quantity, unit: r.unit, cost: r.cost }); setEditId(r.id); setEditOpen(true); };

  const handleDelete = async () => {
    if (!deleteId) return;
    await api.from("feed_records").delete().eq("id", deleteId);
    setDeleteOpen(false); setDeleteId(null); toast.success("Feed record deleted"); loadData();
  };

  const formFields = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
        <div><Label>Animal/Batch</Label>
          <Select value={form.animal_id} onValueChange={v => setForm({ ...form, animal_id: v })}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>{animalOptions.map(a => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div><Label>Feed Type</Label><Input value={form.feed_type} onChange={e => setForm({ ...form, feed_type: e.target.value })} placeholder="e.g. Layer Feed Premium" /></div>
      <div className="grid grid-cols-3 gap-3">
        <div><Label>Quantity</Label><Input type="number" value={form.quantity || ""} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })} /></div>
        <div><Label>Unit</Label><Select value={form.unit} onValueChange={v => setForm({ ...form, unit: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="kg">kg</SelectItem><SelectItem value="bags">bags</SelectItem><SelectItem value="liters">liters</SelectItem></SelectContent></Select></div>
        <div><Label>Cost (৳)</Label><Input type="number" value={form.cost || ""} onChange={e => setForm({ ...form, cost: Number(e.target.value) })} /></div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Feed Management</h1>
        <p className="text-muted-foreground mt-1">Track feed consumption and inventory</p>
        <RelatedLinks links={[{ label: "Animals", url: "/dashboard/animals", color: ICON_COLORS.animals }, { label: "Finances", url: "/dashboard/finances", color: ICON_COLORS.wallet }]} />
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Recent Feed" value={`${totalDailyFeed} kg`} icon={<Wheat className="h-5 w-5" />} iconColor={ICON_COLORS.wheat} index={0} />
        <StatCard title="Recent Cost" value={`৳${totalDailyCost.toLocaleString()}`} icon={<Package className="h-5 w-5" />} iconColor={ICON_COLORS.finance} index={1} />
        <StatCard title="Inventory Items" value={inventory.length} icon={<Package className="h-5 w-5" />} iconColor={ICON_COLORS.marketplace} index={2} />
        <StatCard title="Low Stock Alerts" value={lowStock.length} icon={<AlertTriangle className="h-5 w-5" />} iconColor={ICON_COLORS.health} index={3} />
      </div>

      <Tabs defaultValue="logs" className="space-y-4">
        <TabsList><TabsTrigger value="logs">Feed Logs</TabsTrigger><TabsTrigger value="inventory">Inventory</TabsTrigger></TabsList>

        <TabsContent value="logs">
          <Card className="shadow-card overflow-hidden">
            <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.farmBrand}, ${ICON_COLORS.farm})` }} />
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-display">Feed Records</CardTitle>
              <Dialog open={addOpen} onOpenChange={setAddOpen}><DialogTrigger asChild><Button size="sm" className="text-white" style={{ backgroundColor: ICON_COLORS.farmBrand }}><Plus className="h-4 w-4 mr-1" />Add Entry</Button></DialogTrigger>
                <DialogContent><DialogHeader><DialogTitle>Add Feed Record</DialogTitle><DialogDescription className="sr-only">Enter feed record details, then add.</DialogDescription></DialogHeader>{formFields}<DialogFooter><Button className="text-white" style={{ backgroundColor: ICON_COLORS.farmBrand }} onClick={handleAdd}>Add Record</Button></DialogFooter></DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-0">
              <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Animal/Batch</TableHead><TableHead>Feed Type</TableHead><TableHead>Quantity</TableHead><TableHead>Cost</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>{records.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="text-muted-foreground">{r.date}</TableCell>
                    <TableCell className="font-medium text-foreground">{r.animal_label || "—"}</TableCell>
                    <TableCell className="text-foreground">{r.feed_type}</TableCell>
                    <TableCell className="text-foreground">{r.quantity} {r.unit}</TableCell>
                    <TableCell className="text-foreground">৳{r.cost.toLocaleString()}</TableCell>
                    <TableCell className="text-right"><div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" style={{ color: ICON_COLORS.farmBrand }} /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { setDeleteId(r.id); setDeleteOpen(true); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div></TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
              {records.length === 0 && <p className="text-center text-muted-foreground py-8">No feed records yet</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory">
          <Card className="shadow-card overflow-hidden">
            <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.farmBrand}, ${ICON_COLORS.farm})` }} />
            <CardHeader><CardTitle className="text-lg font-display">Feed Inventory</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table><TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Category</TableHead><TableHead>Stock</TableHead><TableHead>Reorder Level</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>{inventory.map(i => (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium text-foreground">{i.name}</TableCell>
                    <TableCell className="text-muted-foreground">{i.category}</TableCell>
                    <TableCell className="text-foreground">{i.stock} {i.unit}</TableCell>
                    <TableCell className="text-muted-foreground">{i.reorder_level} {i.unit}</TableCell>
                    <TableCell>{i.stock <= i.reorder_level ? <Badge style={{ backgroundColor: `${ICON_COLORS.health}1A`, color: ICON_COLORS.health }}>Low Stock</Badge> : <Badge style={{ backgroundColor: `${ICON_COLORS.farmBrand}1A`, color: ICON_COLORS.farmBrand }}>In Stock</Badge>}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
              {inventory.length === 0 && <p className="text-center text-muted-foreground py-8">No inventory items yet</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={editOpen} onOpenChange={setEditOpen}><DialogContent><DialogHeader><DialogTitle>Edit Feed Record</DialogTitle><DialogDescription className="sr-only">Update feed record fields, then save.</DialogDescription></DialogHeader>{formFields}<DialogFooter><Button className="text-white" style={{ backgroundColor: ICON_COLORS.farmBrand }} onClick={handleEdit}>Save Changes</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}><DialogContent><DialogHeader><DialogTitle>Delete Feed Record</DialogTitle><DialogDescription>Are you sure? This action cannot be undone.</DialogDescription></DialogHeader><DialogFooter className="gap-2"><Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button><Button variant="destructive" onClick={handleDelete}>Delete</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
