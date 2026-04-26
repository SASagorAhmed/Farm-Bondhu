import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HeartPulse, Syringe, Stethoscope, Plus, AlertCircle, Calendar, Pencil, Trash2 } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import { motion } from "framer-motion";
import { ICON_COLORS } from "@/lib/iconColors";
import { toast } from "sonner";
import RelatedLinks from "@/components/dashboard/RelatedLinks";
import { api } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";

const typeIcons: Record<string, React.ReactNode> = { vaccination: <Syringe className="h-4 w-4" />, treatment: <HeartPulse className="h-4 w-4" />, checkup: <Stethoscope className="h-4 w-4" /> };
const typeColors: Record<string, { bg: string; color: string }> = { vaccination: { bg: `${ICON_COLORS.farm}1A`, color: ICON_COLORS.farm }, treatment: { bg: `${ICON_COLORS.health}1A`, color: ICON_COLORS.health }, checkup: { bg: `${ICON_COLORS.vet}1A`, color: ICON_COLORS.vet } };

interface HealthRow { id: string; animal_id: string | null; animal_label: string | null; date: string; type: string; description: string; vet_name: string | null; cost: number; }
interface AnimalOption { id: string; label: string; }

export default function Health() {
  const { user } = useAuth();
  const [records, setRecords] = useState<HealthRow[]>([]);
  const [animalOptions, setAnimalOptions] = useState<AnimalOption[]>([]);
  const [filter, setFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const emptyForm = { animal_id: "", animal_label: "", date: "", type: "vaccination", description: "", vet_name: "", cost: 0 };
  const [form, setForm] = useState(emptyForm);

  const loadData = async () => {
    if (!user) return;
    const [hRes, aRes] = await Promise.all([
      api.from("health_records").select("*").eq("user_id", user.id).order("date", { ascending: false }),
      api.from("animals").select("id, tracking_mode, name, batch_id").eq("user_id", user.id),
    ]);
    setRecords((hRes.data || []) as HealthRow[]);
    setAnimalOptions((aRes.data || []).map((a: any) => ({ id: a.id, label: a.tracking_mode === "batch" ? `Batch ${a.batch_id}` : a.name || a.id })));
  };
  useEffect(() => { loadData(); }, [user]);

  const filtered = filter === "all" ? records : records.filter(r => r.type === filter);
  const vaccinations = records.filter(r => r.type === "vaccination").length;
  const treatments = records.filter(r => r.type === "treatment").length;
  const totalCost = records.reduce((s, r) => s + Number(r.cost), 0);

  const handleAdd = async () => {
    if (!user || !form.description || !form.date) { toast.error("Fill in required fields"); return; }
    const label = animalOptions.find(a => a.id === form.animal_id)?.label || form.animal_label || "";
    await api.from("health_records").insert({ user_id: user.id, animal_id: form.animal_id || null, animal_label: label, date: form.date, type: form.type, description: form.description, vet_name: form.vet_name || null, cost: form.cost });
    setForm(emptyForm); setAddOpen(false); toast.success("Health record added"); loadData();
  };

  const handleEdit = async () => {
    if (!editId) return;
    const label = animalOptions.find(a => a.id === form.animal_id)?.label || form.animal_label || "";
    await api.from("health_records").update({ animal_id: form.animal_id || null, animal_label: label, date: form.date, type: form.type, description: form.description, vet_name: form.vet_name || null, cost: form.cost }).eq("id", editId);
    setEditOpen(false); setEditId(null); toast.success("Health record updated"); loadData();
  };

  const openEdit = (r: HealthRow) => { setForm({ animal_id: r.animal_id || "", animal_label: r.animal_label || "", date: r.date, type: r.type, description: r.description, vet_name: r.vet_name || "", cost: Number(r.cost) }); setEditId(r.id); setEditOpen(true); };

  const handleDelete = async () => {
    if (!deleteId) return;
    await api.from("health_records").delete().eq("id", deleteId);
    setDeleteOpen(false); setDeleteId(null); toast.success("Health record deleted"); loadData();
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
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Type</Label><Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="vaccination">Vaccination</SelectItem><SelectItem value="treatment">Treatment</SelectItem><SelectItem value="checkup">Checkup</SelectItem></SelectContent></Select></div>
        <div><Label>Vet Name</Label><Input value={form.vet_name} onChange={e => setForm({ ...form, vet_name: e.target.value })} /></div>
      </div>
      <div><Label>Description</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
      <div><Label>Cost (৳)</Label><Input type="number" value={form.cost || ""} onChange={e => setForm({ ...form, cost: Number(e.target.value) })} /></div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Health Records</h1>
          <p className="text-muted-foreground mt-1">Vaccination, treatment and health tracking</p>
          <RelatedLinks links={[{ label: "Animals", url: "/dashboard/animals", color: ICON_COLORS.animals }, { label: "Mortality", url: "/dashboard/mortality", color: ICON_COLORS.mortality }]} />
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}><DialogTrigger asChild><Button className="text-white" style={{ backgroundColor: ICON_COLORS.farmBrand }}><Plus className="h-4 w-4 mr-1" />Add Record</Button></DialogTrigger>
          <DialogContent><DialogHeader><DialogTitle>Add Health Record</DialogTitle><DialogDescription className="sr-only">Enter health record details, then add.</DialogDescription></DialogHeader>{formFields}<DialogFooter><Button className="text-white" style={{ backgroundColor: ICON_COLORS.farmBrand }} onClick={handleAdd}>Add Record</Button></DialogFooter></DialogContent>
        </Dialog>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Vaccinations" value={vaccinations} icon={<Syringe className="h-5 w-5" />} iconColor={ICON_COLORS.syringe} index={0} />
        <StatCard title="Treatments" value={treatments} icon={<HeartPulse className="h-5 w-5" />} iconColor={ICON_COLORS.heartPulse} index={1} />
        <StatCard title="Total Records" value={records.length} icon={<Calendar className="h-5 w-5" />} iconColor={ICON_COLORS.calendar} index={2} />
        <StatCard title="Health Cost" value={`৳${totalCost.toLocaleString()}`} icon={<AlertCircle className="h-5 w-5" />} iconColor={ICON_COLORS.finance} index={3} />
      </div>

      <div className="flex items-center gap-3">
        <Select value={filter} onValueChange={setFilter}><SelectTrigger className="w-[160px]"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Types</SelectItem><SelectItem value="vaccination">Vaccination</SelectItem><SelectItem value="treatment">Treatment</SelectItem><SelectItem value="checkup">Checkup</SelectItem></SelectContent>
        </Select>
      </div>

      <Card className="shadow-card overflow-hidden">
        <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.farmBrand}, ${ICON_COLORS.vet})` }} />
        <CardHeader><CardTitle className="text-lg font-display">Health Timeline</CardTitle></CardHeader>
        <CardContent>
          {filtered.length === 0 ? <p className="text-muted-foreground text-center py-8">No health records yet</p> : (
            <div className="space-y-4">
              {filtered.map((r, i) => {
                const tc = typeColors[r.type] || typeColors.checkup;
                return (
                  <motion.div key={r.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex gap-4 items-start">
                    <div className="flex flex-col items-center">
                      <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ backgroundColor: tc.bg, color: tc.color }}>{typeIcons[r.type]}</div>
                      {i < filtered.length - 1 && <div className="w-0.5 h-8 bg-border mt-1" />}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <p className="font-medium text-foreground">{r.description}</p>
                        <div className="flex items-center gap-1">
                          <Badge style={{ backgroundColor: tc.bg, color: tc.color }}>{r.type}</Badge>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" style={{ color: ICON_COLORS.farmBrand }} /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setDeleteId(r.id); setDeleteOpen(true); }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{r.animal_label || "—"} • {r.date} {r.vet_name ? `• ${r.vet_name}` : ""}</p>
                      <p className="text-sm font-medium mt-1" style={{ color: ICON_COLORS.dashboard }}>৳{Number(r.cost).toLocaleString()}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}><DialogContent><DialogHeader><DialogTitle>Edit Health Record</DialogTitle><DialogDescription className="sr-only">Update health fields, then save.</DialogDescription></DialogHeader>{formFields}<DialogFooter><Button className="text-white" style={{ backgroundColor: ICON_COLORS.farmBrand }} onClick={handleEdit}>Save Changes</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}><DialogContent><DialogHeader><DialogTitle>Delete Health Record</DialogTitle><DialogDescription>Are you sure? This action cannot be undone.</DialogDescription></DialogHeader><DialogFooter className="gap-2"><Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button><Button variant="destructive" onClick={handleDelete}>Delete</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
