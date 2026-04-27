import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Filter, Pencil, Trash2, PawPrint } from "lucide-react";
import { motion } from "framer-motion";
import { ICON_COLORS } from "@/lib/iconColors";
import { toast } from "sonner";
import RelatedLinks from "@/components/dashboard/RelatedLinks";
import { api } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { moduleCachePolicy, queryKeys } from "@/lib/queryClient";

const animalEmoji: Record<string, string> = { chicken: "🐔", duck: "🦆", cow: "🐄", goat: "🐐", sheep: "🐑", turkey: "🦃", pigeon: "🕊️" };
const healthColors: Record<string, string> = { healthy: "bg-secondary/15 text-secondary", sick: "bg-destructive/15 text-destructive", treatment: "bg-primary/15 text-primary" };

interface FarmRow { id: string; name: string; }
interface AnimalRow { id: string; farm_id: string; type: string; tracking_mode: string; name: string | null; batch_id: string | null; batch_size: number | null; breed: string; age: string; health_status: string; last_vaccination: string | null; }

export default function Animals() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [farmFilter, setFarmFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [healthFilter, setHealthFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const emptyForm = { farm_id: "", type: "chicken", tracking_mode: "batch", breed: "", age: "", health_status: "healthy", batch_id: "", batch_size: 0, name: "", last_vaccination: "" };
  const [form, setForm] = useState(emptyForm);

  const { data: animals = [] } = useQuery({
    queryKey: queryKeys().animals(user?.id),
    enabled: Boolean(user?.id),
    staleTime: moduleCachePolicy.dashboard.staleTime,
    gcTime: moduleCachePolicy.dashboard.gcTime,
    queryFn: async () => {
      const aRes = await api.from("animals").select("*").eq("user_id", user!.id).order("created_at");
      return ((aRes.data || []) as AnimalRow[]);
    },
  });
  const { data: farms = [] } = useQuery({
    queryKey: queryKeys().farms(user?.id),
    enabled: Boolean(user?.id),
    staleTime: moduleCachePolicy.dashboard.staleTime,
    gcTime: moduleCachePolicy.dashboard.gcTime,
    queryFn: async () => {
      const fRes = await api.from("farms").select("id, name").eq("user_id", user!.id);
      return ((fRes.data || []) as FarmRow[]);
    },
  });

  useEffect(() => {
    if (!user?.id) return;
    const channels = ["animals", "farms"].map((table) =>
      api
        .channel(`animals-live-${table}-${user.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table }, () => {
          queryClient.invalidateQueries({ queryKey: table === "animals" ? queryKeys().animals(user.id) : queryKeys().farms(user.id) });
        })
        .subscribe()
    );
    return () => {
      channels.forEach((channel) => api.removeChannel(channel));
    };
  }, [queryClient, user?.id]);

  const filtered = animals.filter(a => {
    if (farmFilter !== "all" && a.farm_id !== farmFilter) return false;
    if (typeFilter !== "all" && a.type !== typeFilter) return false;
    if (healthFilter !== "all" && a.health_status !== healthFilter) return false;
    return true;
  });

  const farmName = (id: string) => farms.find(f => f.id === id)?.name || "—";

  const handleAdd = async () => {
    if (!user || !form.breed || !form.age || !form.farm_id) { toast.error("Fill in farm, breed and age"); return; }
    const { error } = await api.from("animals").insert({
      user_id: user.id, farm_id: form.farm_id, type: form.type, tracking_mode: form.tracking_mode,
      breed: form.breed, age: form.age, health_status: form.health_status,
      batch_id: form.batch_id || null, batch_size: form.batch_size || null,
      name: form.name || null, last_vaccination: form.last_vaccination || null,
    });
    if (error) { toast.error(error.message); return; }
    setForm(emptyForm); setAddOpen(false); toast.success("Animal added");
    queryClient.invalidateQueries({ queryKey: queryKeys().animals(user.id) });
  };

  const handleEdit = async () => {
    if (!editId) return;
    await api.from("animals").update({
      farm_id: form.farm_id, type: form.type, tracking_mode: form.tracking_mode,
      breed: form.breed, age: form.age, health_status: form.health_status,
      batch_id: form.batch_id || null, batch_size: form.batch_size || null,
      name: form.name || null, last_vaccination: form.last_vaccination || null,
    }).eq("id", editId);
    setEditOpen(false); setEditId(null); toast.success("Animal updated");
    queryClient.invalidateQueries({ queryKey: queryKeys().animals(user?.id) });
  };

  const openEdit = (a: AnimalRow) => {
    setForm({ farm_id: a.farm_id, type: a.type, tracking_mode: a.tracking_mode, breed: a.breed, age: a.age, health_status: a.health_status, batch_id: a.batch_id || "", batch_size: a.batch_size || 0, name: a.name || "", last_vaccination: a.last_vaccination || "" });
    setEditId(a.id); setEditOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await api.from("animals").delete().eq("id", deleteId);
    setDeleteOpen(false); setDeleteId(null); toast.success("Animal deleted");
    queryClient.invalidateQueries({ queryKey: queryKeys().animals(user?.id) });
  };

  const formFields = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Type</Label>
          <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{["chicken","duck","turkey","pigeon","cow","goat","sheep"].map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Farm</Label>
          <Select value={form.farm_id} onValueChange={v => setForm({ ...form, farm_id: v })}><SelectTrigger><SelectValue placeholder="Select farm" /></SelectTrigger>
            <SelectContent>{farms.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Breed</Label><Input value={form.breed} onChange={e => setForm({ ...form, breed: e.target.value })} /></div>
        <div><Label>Age</Label><Input value={form.age} onChange={e => setForm({ ...form, age: e.target.value })} placeholder="e.g. 12 weeks" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Tracking Mode</Label>
          <Select value={form.tracking_mode} onValueChange={v => setForm({ ...form, tracking_mode: v })}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="batch">Batch</SelectItem><SelectItem value="individual">Individual</SelectItem></SelectContent>
          </Select>
        </div>
        <div><Label>Health Status</Label>
          <Select value={form.health_status} onValueChange={v => setForm({ ...form, health_status: v })}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="healthy">Healthy</SelectItem><SelectItem value="sick">Sick</SelectItem><SelectItem value="treatment">Treatment</SelectItem></SelectContent>
          </Select>
        </div>
      </div>
      {form.tracking_mode === "batch" ? (
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Batch ID</Label><Input value={form.batch_id} onChange={e => setForm({ ...form, batch_id: e.target.value })} /></div>
          <div><Label>Batch Size</Label><Input type="number" value={form.batch_size || ""} onChange={e => setForm({ ...form, batch_size: Number(e.target.value) })} /></div>
        </div>
      ) : (
        <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
      )}
      <div><Label>Last Vaccination Date</Label><Input type="date" value={form.last_vaccination} onChange={e => setForm({ ...form, last_vaccination: e.target.value })} /></div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Animals</h1>
          <p className="text-muted-foreground mt-1">Track all your animals and batches</p>
          <RelatedLinks links={[{ label: "Health Records", url: "/dashboard/health", color: ICON_COLORS.health }, { label: "Farms", url: "/dashboard/farms", color: ICON_COLORS.farm }]} />
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}><DialogTrigger asChild><Button className="text-white" style={{ backgroundColor: ICON_COLORS.farmBrand }}><Plus className="h-4 w-4 mr-1" /> Add Animal</Button></DialogTrigger>
          <DialogContent><DialogHeader><DialogTitle className="font-display">Add Animal / Batch</DialogTitle><DialogDescription className="sr-only">Enter animal or batch details, then add.</DialogDescription></DialogHeader>{formFields}
            <DialogFooter><Button className="text-white" style={{ backgroundColor: ICON_COLORS.farmBrand }} onClick={handleAdd}>Add Animal</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>

      <Card className="shadow-card"><CardContent className="p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={farmFilter} onValueChange={setFarmFilter}><SelectTrigger className="w-[160px]"><SelectValue placeholder="All Farms" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Farms</SelectItem>{farms.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger className="w-[140px]"><SelectValue placeholder="All Types" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Types</SelectItem>{["chicken","duck","turkey","pigeon","cow","goat","sheep"].map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={healthFilter} onValueChange={setHealthFilter}><SelectTrigger className="w-[140px]"><SelectValue placeholder="All Status" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="healthy">Healthy</SelectItem><SelectItem value="sick">Sick</SelectItem><SelectItem value="treatment">Treatment</SelectItem></SelectContent>
          </Select>
        </div>
      </CardContent></Card>

      <Card className="shadow-card overflow-hidden">
        <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.farmBrand}, ${ICON_COLORS.farm})` }} />
        <CardContent className="p-0 overflow-x-auto">
          <Table><TableHeader><TableRow><TableHead>Animal</TableHead><TableHead>Farm</TableHead><TableHead>Breed</TableHead><TableHead>Age</TableHead><TableHead>Mode</TableHead><TableHead>Health</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>{filtered.map(a => (
              <TableRow key={a.id}>
                <TableCell><div className="flex items-center gap-2"><span className="text-lg">{animalEmoji[a.type]}</span><div><p className="font-medium text-foreground">{a.tracking_mode === "batch" ? `Batch ${a.batch_id}` : a.name}</p>{a.tracking_mode === "batch" && <p className="text-xs text-muted-foreground">{a.batch_size} birds</p>}</div></div></TableCell>
                <TableCell className="text-muted-foreground">{farmName(a.farm_id)}</TableCell>
                <TableCell className="text-foreground">{a.breed}</TableCell>
                <TableCell className="text-muted-foreground">{a.age}</TableCell>
                <TableCell><Badge variant="outline" className="capitalize">{a.tracking_mode}</Badge></TableCell>
                <TableCell><Badge className={healthColors[a.health_status]}>{a.health_status}</Badge></TableCell>
                <TableCell className="text-right"><div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(a)}><Pencil className="h-4 w-4" style={{ color: ICON_COLORS.farmBrand }} /></Button>
                  <Button variant="ghost" size="icon" onClick={() => { setDeleteId(a.id); setDeleteOpen(true); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div></TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
          {filtered.length === 0 && <div className="text-center py-12 space-y-3"><PawPrint className="h-12 w-12 mx-auto" style={{ color: `${ICON_COLORS.farmBrand}40` }} /><p className="text-muted-foreground">No animals yet — add your first animal above</p></div>}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}><DialogContent><DialogHeader><DialogTitle className="font-display">Edit Animal</DialogTitle><DialogDescription className="sr-only">Update animal fields, then save.</DialogDescription></DialogHeader>{formFields}<DialogFooter><Button className="text-white" style={{ backgroundColor: ICON_COLORS.farmBrand }} onClick={handleEdit}>Save Changes</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}><DialogContent><DialogHeader><DialogTitle className="font-display">Delete Animal</DialogTitle><DialogDescription>Are you sure? This action cannot be undone.</DialogDescription></DialogHeader><DialogFooter className="gap-2"><Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button><Button variant="destructive" onClick={handleDelete}>Delete</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
