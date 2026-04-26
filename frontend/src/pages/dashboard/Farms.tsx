import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Warehouse, MapPin, PawPrint, Plus, Home, Trash2, Edit2, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { ICON_COLORS } from "@/lib/iconColors";
import { toast } from "sonner";
import RelatedLinks from "@/components/dashboard/RelatedLinks";
import { api } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";

const BRAND = ICON_COLORS.farmBrand;
const typeLabels: Record<string, string> = { poultry: "Poultry", dairy: "Dairy", mixed: "Mixed" };
const typeColors: Record<string, string> = { poultry: "bg-destructive/15 text-destructive", dairy: "bg-secondary/15 text-secondary", mixed: "bg-primary/15 text-primary" };

interface FarmRow { id: string; name: string; location: string; type: string; total_animals: number; sheds: number; }
interface ShedRow { id: string; farm_id: string; name: string; capacity: number; animal_type: string; current_count: number; status: string; }
interface AnimalRow { id: string; farm_id: string; type: string; tracking_mode: string; name: string | null; batch_id: string | null; batch_size: number | null; breed: string; age: string; health_status: string; }

export default function Farms() {
  const { user } = useAuth();
  const [farms, setFarms] = useState<FarmRow[]>([]);
  const [sheds, setSheds] = useState<ShedRow[]>([]);
  const [animals, setAnimals] = useState<AnimalRow[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<FarmRow | null>(null);
  const [form, setForm] = useState({ name: "", location: "", type: "poultry", sheds: 1 });
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", location: "", type: "poultry" });
  const [editFarmId, setEditFarmId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteFarmId, setDeleteFarmId] = useState<string | null>(null);
  const [shedOpen, setShedOpen] = useState(false);
  const [shedForm, setShedForm] = useState({ name: "", capacity: 100, animalType: "chicken", status: "active" });
  const [editShedOpen, setEditShedOpen] = useState(false);
  const [editShedForm, setEditShedForm] = useState({ name: "", capacity: 100, animalType: "chicken", status: "active" });
  const [editShedId, setEditShedId] = useState<string | null>(null);
  const [deleteShedOpen, setDeleteShedOpen] = useState(false);
  const [deleteShedId, setDeleteShedId] = useState<string | null>(null);

  const loadData = async () => {
    if (!user) return;
    const [farmsRes, shedsRes, animalsRes] = await Promise.all([
      api.from("farms").select("*").eq("user_id", user.id).order("created_at"),
      api.from("sheds").select("*").eq("user_id", user.id),
      api.from("animals").select("*").eq("user_id", user.id),
    ]);
    setFarms((farmsRes.data || []) as FarmRow[]);
    setSheds((shedsRes.data || []) as ShedRow[]);
    setAnimals((animalsRes.data || []) as AnimalRow[]);
  };

  useEffect(() => { loadData(); }, [user]);

  const handleAdd = async () => {
    if (!user) return;
    const { error } = await api.from("farms").insert({ user_id: user.id, name: form.name, location: form.location, type: form.type, sheds: form.sheds });
    if (error) { toast.error(error.message); return; }
    setForm({ name: "", location: "", type: "poultry", sheds: 1 }); setOpen(false);
    toast.success("Farm added"); loadData();
  };

  const handleEditFarm = async () => {
    if (!editFarmId) return;
    await api.from("farms").update(editForm).eq("id", editFarmId);
    setEditOpen(false); toast.success("Farm updated"); loadData();
    if (selected?.id === editFarmId) setSelected({ ...selected, ...editForm } as FarmRow);
  };

  const handleDeleteFarm = async () => {
    if (!deleteFarmId) return;
    await api.from("farms").delete().eq("id", deleteFarmId);
    if (selected?.id === deleteFarmId) setSelected(null);
    setDeleteOpen(false); toast.success("Farm deleted"); loadData();
  };

  const handleAddShed = async () => {
    if (!selected || !user) return;
    await api.from("sheds").insert({ farm_id: selected.id, user_id: user.id, name: shedForm.name, capacity: shedForm.capacity, animal_type: shedForm.animalType, status: shedForm.status });
    setShedForm({ name: "", capacity: 100, animalType: "chicken", status: "active" }); setShedOpen(false);
    toast.success("Shed added"); loadData();
  };

  const handleEditShed = async () => {
    if (!editShedId) return;
    await api.from("sheds").update({ name: editShedForm.name, capacity: editShedForm.capacity, animal_type: editShedForm.animalType, status: editShedForm.status }).eq("id", editShedId);
    setEditShedOpen(false); toast.success("Shed updated"); loadData();
  };

  const handleDeleteShed = async () => {
    if (!deleteShedId) return;
    await api.from("sheds").delete().eq("id", deleteShedId);
    setDeleteShedOpen(false); toast.success("Shed deleted"); loadData();
  };

  const statusColors: Record<string, string> = { active: "bg-secondary/15 text-secondary", maintenance: "bg-primary/15 text-primary", empty: "bg-muted text-muted-foreground" };

  if (selected) {
    const farmAnimals = animals.filter(a => a.farm_id === selected.id);
    const farmSheds = sheds.filter(s => s.farm_id === selected.id);
    return (
      <div className="space-y-6 max-w-full overflow-hidden">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>← Back</Button>
          <h1 className="text-2xl font-display font-bold text-foreground">{selected.name}</h1>
          <Badge className={typeColors[selected.type]}>{typeLabels[selected.type]}</Badge>
        </div>
        <RelatedLinks links={[
          { label: "Health Records", url: "/dashboard/health", color: ICON_COLORS.health },
          { label: "Production", url: "/dashboard/production", color: ICON_COLORS.egg },
          { label: "Feed Management", url: "/dashboard/feed", color: ICON_COLORS.wheat },
        ]} />
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="shadow-card"><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Location</p><p className="font-bold text-foreground">{selected.location}</p></CardContent></Card>
          <Card className="shadow-card"><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Total Animals</p><p className="font-bold text-foreground">{selected.total_animals}</p></CardContent></Card>
          <Card className="shadow-card"><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Sheds</p><p className="font-bold text-foreground">{farmSheds.length}</p></CardContent></Card>
          <Card className="shadow-card"><CardContent className="p-4 text-center"><p className="text-sm text-muted-foreground">Batches/Animals</p><p className="font-bold text-foreground">{farmAnimals.length}</p></CardContent></Card>
        </div>

        <Card className="shadow-card overflow-hidden">
          <div className="h-1" style={{ backgroundColor: BRAND }} />
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-display">Sheds / Pens</CardTitle>
            <Dialog open={shedOpen} onOpenChange={setShedOpen}>
              <DialogTrigger asChild><Button size="sm" className="text-white" style={{ backgroundColor: BRAND }}><Plus className="h-3 w-3 mr-1" /> Add Shed</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Shed</DialogTitle>
                  <DialogDescription>Name, capacity, and animal type for this pen or shed.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div><Label>Shed Name</Label><Input value={shedForm.name} onChange={e => setShedForm({ ...shedForm, name: e.target.value })} placeholder="e.g. Shed A1" /></div>
                  <div><Label>Capacity</Label><Input type="number" min={1} value={shedForm.capacity} onChange={e => setShedForm({ ...shedForm, capacity: Number(e.target.value) })} /></div>
                  <div><Label>Animal Type</Label>
                    <Select value={shedForm.animalType} onValueChange={v => setShedForm({ ...shedForm, animalType: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{["chicken","duck","cow","goat","sheep","turkey","pigeon"].map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleAddShed} className="w-full text-white" style={{ backgroundColor: BRAND }} disabled={!shedForm.name}>Add Shed</Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {farmSheds.length === 0 ? <p className="text-muted-foreground text-center py-6">No sheds configured yet</p> : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {farmSheds.map(shed => (
                  <div key={shed.id} className="p-4 rounded-lg border border-border bg-accent/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-foreground">{shed.name}</p>
                      <div className="flex items-center gap-1">
                        <Badge className={statusColors[shed.status]}>{shed.status}</Badge>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditShedId(shed.id); setEditShedForm({ name: shed.name, capacity: shed.capacity, animalType: shed.animal_type, status: shed.status }); setEditShedOpen(true); }}><Edit2 className="h-3.5 w-3.5 text-muted-foreground" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setDeleteShedId(shed.id); setDeleteShedOpen(true); }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>Type: <span className="capitalize text-foreground">{shed.animal_type}</span></p>
                      <p>Capacity: <span className="text-foreground">{shed.capacity}</span></p>
                      <p>Current: <span className="text-foreground">{shed.current_count}</span></p>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min((shed.current_count / shed.capacity) * 100, 100)}%`, backgroundColor: BRAND }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-lg font-display">Animals in this Farm</CardTitle></CardHeader>
          <CardContent>
            {farmAnimals.length === 0 ? <p className="text-muted-foreground text-center py-8">No animals registered yet</p> : (
              <div className="space-y-3">
                {farmAnimals.map(a => (
                  <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-accent/50">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full flex items-center justify-center text-white text-lg" style={{ backgroundColor: BRAND }}>
                        {a.type === "chicken" ? "🐔" : a.type === "cow" ? "🐄" : a.type === "goat" ? "🐐" : a.type === "duck" ? "🦆" : a.type === "turkey" ? "🦃" : a.type === "pigeon" ? "🕊️" : "🐑"}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{a.tracking_mode === "batch" ? `Batch ${a.batch_id}` : a.name}</p>
                        <p className="text-xs text-muted-foreground">{a.breed} • {a.age} {a.tracking_mode === "batch" ? `• ${a.batch_size} birds` : ""}</p>
                      </div>
                    </div>
                    <Badge variant={a.health_status === "healthy" ? "default" : "destructive"} className={a.health_status === "healthy" ? "bg-secondary/15 text-secondary" : ""}>{a.health_status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={editShedOpen} onOpenChange={setEditShedOpen}><DialogContent><DialogHeader><DialogTitle>Edit Shed</DialogTitle><DialogDescription>Update shed name and capacity.</DialogDescription></DialogHeader>
          <div className="space-y-4 pt-2">
            <div><Label>Shed Name</Label><Input value={editShedForm.name} onChange={e => setEditShedForm({ ...editShedForm, name: e.target.value })} /></div>
            <div><Label>Capacity</Label><Input type="number" min={1} value={editShedForm.capacity} onChange={e => setEditShedForm({ ...editShedForm, capacity: Number(e.target.value) })} /></div>
            <Button onClick={handleEditShed} className="w-full text-white" style={{ backgroundColor: BRAND }}>Save Changes</Button>
          </div>
        </DialogContent></Dialog>

        <Dialog open={deleteShedOpen} onOpenChange={setDeleteShedOpen}><DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" /> Delete Shed</DialogTitle></DialogHeader>
          <DialogDescription>Are you sure? This action cannot be undone.</DialogDescription>
          <DialogFooter><Button variant="outline" onClick={() => setDeleteShedOpen(false)}>Cancel</Button><Button variant="destructive" onClick={handleDeleteShed}>Delete</Button></DialogFooter>
        </DialogContent></Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div><h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Farms</h1><p className="text-muted-foreground mt-1">Manage your farms and facilities</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="text-white" style={{ backgroundColor: BRAND }}><Plus className="h-4 w-4 mr-1" /> Add Farm</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">Add New Farm</DialogTitle>
              <DialogDescription>Register a farm with name, location, and type.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div><Label>Farm Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Green Poultry Farm" /></div>
              <div><Label>Location</Label><Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="e.g. Mymensingh" /></div>
              <div><Label>Farm Type</Label>
                <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="poultry">Poultry</SelectItem><SelectItem value="dairy">Dairy</SelectItem><SelectItem value="mixed">Mixed</SelectItem></SelectContent>
                </Select>
              </div>
              <Button onClick={handleAdd} className="w-full text-white" style={{ backgroundColor: BRAND }} disabled={!form.name || !form.location}>Add Farm</Button>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>

      {farms.length === 0 ? (
        <div className="text-center py-20 space-y-4">
          <Warehouse className="h-16 w-16 mx-auto" style={{ color: `${BRAND}40` }} />
          <h2 className="text-xl font-display font-bold text-foreground">No farms yet</h2>
          <p className="text-muted-foreground">Add your first farm to get started</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {farms.map((farm, i) => (
            <motion.div key={farm.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card className="shadow-card hover:shadow-elevated transition-all duration-300 cursor-pointer group overflow-hidden" onClick={() => setSelected(farm)}>
                <div className="h-1" style={{ backgroundColor: BRAND }} />
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: BRAND }}><Home className="h-5 w-5" /></div>
                      <div><h3 className="font-display font-bold text-foreground">{farm.name}</h3><p className="text-sm text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{farm.location}</p></div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => { e.stopPropagation(); setEditFarmId(farm.id); setEditForm({ name: farm.name, location: farm.location, type: farm.type }); setEditOpen(true); }}><Edit2 className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => { e.stopPropagation(); setDeleteFarmId(farm.id); setDeleteOpen(true); }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </div>
                  </div>
                  <Badge className={typeColors[farm.type]}>{typeLabels[farm.type]}</Badge>
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="p-2 rounded-lg bg-accent/50"><p className="text-xs text-muted-foreground">Animals</p><p className="font-bold text-foreground">{farm.total_animals}</p></div>
                    <div className="p-2 rounded-lg bg-accent/50"><p className="text-xs text-muted-foreground">Sheds</p><p className="font-bold text-foreground">{farm.sheds}</p></div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}><DialogContent><DialogHeader><DialogTitle>Edit Farm</DialogTitle><DialogDescription>Update farm name and location.</DialogDescription></DialogHeader>
        <div className="space-y-4 pt-2">
          <div><Label>Farm Name</Label><Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} /></div>
          <div><Label>Location</Label><Input value={editForm.location} onChange={e => setEditForm({ ...editForm, location: e.target.value })} /></div>
          <Button onClick={handleEditFarm} className="w-full text-white" style={{ backgroundColor: BRAND }}>Save Changes</Button>
        </div>
      </DialogContent></Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}><DialogContent>
        <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" /> Delete Farm</DialogTitle></DialogHeader>
        <DialogDescription>This will delete the farm and all associated sheds. This cannot be undone.</DialogDescription>
        <DialogFooter><Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button><Button variant="destructive" onClick={handleDeleteFarm}>Delete</Button></DialogFooter>
      </DialogContent></Dialog>
    </div>
  );
}
