import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Bell, Send, Loader2, Pencil, Trash2, History } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ICON_COLORS } from "@/lib/iconColors";
import { api } from "@/api/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";

const TARGETS = [
  { value: "all", label: "All Users" },
  { value: "buyer", label: "All Buyers" },
  { value: "farmer", label: "All Farmers" },
  { value: "vendor", label: "All Vendors" },
  { value: "vet", label: "All Vets" },
  { value: "email", label: "Specific User (by email)" },
];

const DESTINATIONS = [
  { value: "none", label: "None (no link)" },
  { value: "/admin", label: "Admin Dashboard" },
  { value: "/admin/approvals", label: "Admin Approvals" },
  { value: "/admin/marketplace", label: "Admin Marketplace" },
  { value: "/admin/learning", label: "Admin Learning" },
  { value: "/admin/medibondhu-overview", label: "Admin MediBondhu" },
  { value: "/admin/farms", label: "Admin Farms" },
  { value: "/admin/orders", label: "Admin Orders" },
  { value: "/marketplace", label: "Marketplace (user)" },
  { value: "/learning", label: "Learning Center (user)" },
  { value: "/dashboard", label: "Farm Dashboard (user)" },
  { value: "/medibondhu", label: "MediBondhu (user)" },
  { value: "custom", label: "Custom URL" },
];

type Broadcast = {
  id: string;
  title: string;
  message: string;
  target: string;
  target_email: string | null;
  action_url: string | null;
  recipient_count: number;
  created_at: string;
};

export default function AdminBroadcast() {
  const { user } = useAuth();
  const [target, setTarget] = useState("all");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [destination, setDestination] = useState("none");
  const [customUrl, setCustomUrl] = useState("");
  const [sending, setSending] = useState(false);

  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editBroadcast, setEditBroadcast] = useState<Broadcast | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBroadcast, setDeleteBroadcast] = useState<Broadcast | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchBroadcasts = async () => {
    const { data } = await api
      .from("broadcasts")
      .select("*")
      .order("created_at", { ascending: false });
    setBroadcasts((data as Broadcast[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchBroadcasts(); }, []);

  const getActionUrl = (): string | null => {
    if (destination === "none") return null;
    if (destination === "custom") return customUrl.trim() || null;
    return destination;
  };

  const getTargetLabel = (t: string) => TARGETS.find(x => x.value === t)?.label || t;

  const send = async () => {
    if (!title.trim() || !message.trim()) { toast.error("Title and message are required"); return; }
    if (!user) { toast.error("Not authenticated"); return; }

    setSending(true);
    try {
      let userIds: string[] = [];

      if (target === "email") {
        if (!email.trim()) { toast.error("Email is required"); setSending(false); return; }
        const { data } = await api.from("profiles").select("id").eq("email", email.trim());
        if (!data || data.length === 0) { toast.error("User not found"); setSending(false); return; }
        userIds = data.map((u: any) => u.id);
      } else if (target === "all") {
        const { data } = await api.from("profiles").select("id");
        userIds = (data || []).map((u: any) => u.id);
      } else {
        const { data } = await api.from("user_roles").select("user_id").eq("role", target as any);
        userIds = [...new Set((data || []).map((r: any) => r.user_id))];
      }

      if (userIds.length === 0) { toast.error("No users found for this target"); setSending(false); return; }

      const actionUrl = getActionUrl();

      // Create broadcast record first
      const { data: broadcastRow, error: bErr } = await api.from("broadcasts").insert({
        admin_id: user.id,
        title: title.trim(),
        message: message.trim(),
        target,
        target_email: target === "email" ? email.trim() : null,
        action_url: actionUrl,
        recipient_count: userIds.length,
      } as any).select().single();

      if (bErr || !broadcastRow) { toast.error("Failed to create broadcast: " + (bErr?.message || "Unknown error")); setSending(false); return; }

      const broadcastId = (broadcastRow as any).id;

      const notifications = userIds.map(uid => ({
        user_id: uid,
        title: title.trim(),
        message: message.trim(),
        type: "system" as const,
        context: "admin" as const,
        priority: "medium" as const,
        action_url: actionUrl,
        broadcast_id: broadcastId,
      }));

      for (let i = 0; i < notifications.length; i += 100) {
        const batch = notifications.slice(i, i + 100);
        const { error } = await api.from("notifications").insert(batch as any);
        if (error) { toast.error("Failed to send: " + error.message); setSending(false); return; }
      }

      toast.success(`Notification sent to ${userIds.length} user(s)`);
      setTitle(""); setMessage(""); setEmail(""); setDestination("none"); setCustomUrl("");
      fetchBroadcasts();
    } catch (e: any) {
      toast.error(e.message);
    }
    setSending(false);
  };

  const openEdit = (b: Broadcast) => {
    setEditBroadcast(b);
    setEditTitle(b.title);
    setEditMessage(b.message);
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editBroadcast || !editTitle.trim() || !editMessage.trim()) return;
    setSaving(true);
    // Update broadcast record
    await api.from("broadcasts").update({ title: editTitle.trim(), message: editMessage.trim() } as any).eq("id", editBroadcast.id);
    // Update all linked notifications
    await (api.from("notifications").update({ title: editTitle.trim(), message: editMessage.trim() }) as any).eq("broadcast_id", editBroadcast.id);
    toast.success("Broadcast updated");
    setEditOpen(false);
    setSaving(false);
    fetchBroadcasts();
  };

  const confirmDelete = async () => {
    if (!deleteBroadcast) return;
    setDeleting(true);
    // Delete linked notifications first (cascade should handle it, but be explicit)
    await (api.from("notifications").delete() as any).eq("broadcast_id", deleteBroadcast.id);
    await api.from("broadcasts").delete().eq("id", deleteBroadcast.id);
    toast.success("Broadcast deleted");
    setDeleteOpen(false);
    setDeleting(false);
    setDeleteBroadcast(null);
    fetchBroadcasts();
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Broadcast Notifications</h1>
        <p className="text-muted-foreground mt-1">Send announcements to users across the platform</p>
      </motion.div>

      {/* Send Form */}
      <Card className="shadow-card overflow-hidden max-w-2xl">
        <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.admin}, ${ICON_COLORS.dashboard})` }} />
        <CardHeader>
          <CardTitle className="text-lg font-display flex items-center gap-2"><Bell className="h-5 w-5" /> New Broadcast</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Target Audience</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TARGETS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {target === "email" && (
            <div>
              <Label>User Email</Label>
              <Input placeholder="user@example.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
          )}

          <div>
            <Label>Notification Title</Label>
            <Input placeholder="Important announcement..." value={title} onChange={e => setTitle(e.target.value)} />
          </div>

          <div>
            <Label>Message</Label>
            <Textarea placeholder="Write your message..." rows={4} value={message} onChange={e => setMessage(e.target.value)} />
          </div>

          <div>
            <Label>Destination Screen</Label>
            <Select value={destination} onValueChange={setDestination}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DESTINATIONS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">Where the user will be taken when they click this notification</p>
          </div>

          {destination === "custom" && (
            <div>
              <Label>Custom URL</Label>
              <Input placeholder="/marketplace/product/..." value={customUrl} onChange={e => setCustomUrl(e.target.value)} />
            </div>
          )}

          <Button onClick={send} disabled={sending} className="w-full">
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Send Notification
          </Button>
        </CardContent>
      </Card>

      {/* Broadcast History */}
      <Card className="shadow-card overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg font-display flex items-center gap-2"><History className="h-5 w-5" /> Broadcast History</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : broadcasts.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No broadcasts sent yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead className="text-center">Recipients</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {broadcasts.map(b => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium max-w-[200px] truncate">{b.title}</TableCell>
                    <TableCell>{b.target === "email" ? b.target_email : getTargetLabel(b.target)}</TableCell>
                    <TableCell className="text-center">{b.recipient_count}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{b.action_url || "—"}</TableCell>
                    <TableCell className="text-sm">{new Date(b.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(b)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { setDeleteBroadcast(b); setDeleteOpen(true); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Broadcast</DialogTitle>
            <DialogDescription>Update the title and message shown to recipients.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} />
            </div>
            <div>
              <Label>Message</Label>
              <Textarea rows={4} value={editMessage} onChange={e => setEditMessage(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Broadcast?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this broadcast and remove the notification from all {deleteBroadcast?.recipient_count} recipient(s)' inboxes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
