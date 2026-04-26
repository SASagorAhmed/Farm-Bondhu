import { useState, useEffect } from "react";
import { api } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, BookOpen, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

interface Guide {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  animal_type: string;
  is_published: boolean;
  author_id: string;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  { value: "disease", label: "Disease" },
  { value: "medicine", label: "Medicine" },
  { value: "vaccination", label: "Vaccination" },
  { value: "feeding", label: "Feeding" },
];

const ANIMAL_TYPES = [
  { value: "chicken", label: "🐔 Chicken" },
  { value: "duck", label: "🦆 Duck" },
  { value: "turkey", label: "🦃 Turkey" },
  { value: "cow", label: "🐄 Cow" },
  { value: "goat", label: "🐐 Goat" },
  { value: "pigeon", label: "🕊️ Pigeon" },
  { value: "sheep", label: "🐑 Sheep" },
  { value: "fish", label: "🐟 Fish" },
];

const EMPTY_FORM = {
  title: "",
  summary: "",
  content: "",
  category: "disease",
  animal_type: "chicken",
  is_published: true,
};

const CATEGORY_COLORS: Record<string, string> = {
  disease: "#F43F5E",
  medicine: "#0EA5E9",
  vaccination: "#F43F5E",
  feeding: "#10B981",
};

export default function AdminLearning() {
  const { user } = useAuth();
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const fetchGuides = async () => {
    setLoading(true);
    const { data } = await api
      .from("learning_guides")
      .select("*")
      .order("created_at", { ascending: false });
    setGuides((data as Guide[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchGuides(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (g: Guide) => {
    setEditingId(g.id);
    setForm({
      title: g.title,
      summary: g.summary,
      content: g.content,
      category: g.category,
      animal_type: g.animal_type,
      is_published: g.is_published,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    if (editingId) {
      const { error } = await api
        .from("learning_guides")
        .update({ ...form })
        .eq("id", editingId);
      if (error) toast({ title: "Update failed", description: error.message, variant: "destructive" });
      else toast({ title: "Guide updated successfully" });
    } else {
      const { error } = await api
        .from("learning_guides")
        .insert({ ...form, author_id: user?.id });
      if (error) toast({ title: "Create failed", description: error.message, variant: "destructive" });
      else toast({ title: "Guide published!", description: "All users have been notified." });
    }
    setSaving(false);
    setDialogOpen(false);
    fetchGuides();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await api.from("learning_guides").delete().eq("id", deleteId);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else toast({ title: "Guide deleted" });
    setDeleteId(null);
    fetchGuides();
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground flex items-center gap-2">
            <BookOpen className="h-7 w-7" style={{ color: "#F97316" }} />
            Learning Posts
          </h1>
          <p className="text-muted-foreground mt-1">Create & manage guides visible to all users</p>
        </div>
        <Button onClick={openCreate} className="gap-2" style={{ backgroundColor: "#F97316" }}>
          <Plus className="h-4 w-4" /> New Post
        </Button>
      </motion.div>

      <Card className="shadow-card">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : guides.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No learning posts yet. Create your first one!</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Animal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {guides.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium max-w-[200px] truncate">{g.title}</TableCell>
                    <TableCell>
                      <Badge className="border-0 capitalize" style={{ backgroundColor: (CATEGORY_COLORS[g.category] || "#888") + "1A", color: CATEGORY_COLORS[g.category] || "#888" }}>
                        {g.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize">{g.animal_type}</TableCell>
                    <TableCell>
                      {g.is_published ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 border-0">Published</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">Draft</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(g.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(g)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(g.id)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Guide" : "New Learning Post"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Update the learning content and publishing options." : "Fill in the guide fields, then publish or save as draft."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Title</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Newcastle Disease Guide" />
            </div>
            <div>
              <Label>Summary</Label>
              <Textarea value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))} placeholder="Short description..." rows={2} />
            </div>
            <div>
              <Label>Content</Label>
              <Textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="Full guide content..." rows={6} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Animal Type</Label>
                <Select value={form.animal_type} onValueChange={v => setForm(f => ({ ...f, animal_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ANIMAL_TYPES.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.is_published} onCheckedChange={v => setForm(f => ({ ...f, is_published: v }))} />
              <Label>Publish immediately {form.is_published && "(users will be notified)"}</Label>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleSave} disabled={saving} style={{ backgroundColor: "#F97316" }}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingId ? "Update" : "Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this guide?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. The guide will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
