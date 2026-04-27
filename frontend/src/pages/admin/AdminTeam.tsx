import { useState, useEffect, useCallback } from "react";
import { api } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Shield, ShieldCheck, ShieldAlert, UserPlus, Crown } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { moduleCachePolicy, queryKeys } from "@/lib/queryClient";

interface TeamMember {
  id: string;
  user_id: string;
  admin_level: string;
  added_by: string | null;
  permissions: Record<string, boolean>;
  created_at: string;
  profile?: { name: string; email: string };
  added_by_profile?: { name: string } | null;
}

const LEVEL_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  super_admin: { label: "Super Admin", color: "bg-amber-100 text-amber-800", icon: Crown },
  co_admin: { label: "Co-Admin", color: "bg-blue-100 text-blue-800", icon: ShieldCheck },
  moderator: { label: "Moderator", color: "bg-purple-100 text-purple-800", icon: Shield },
};

const PERMISSION_LABELS: Record<string, string> = {
  can_approve: "Approve Requests",
  can_reject: "Reject Requests",
  can_manage_users: "Manage Users",
  can_broadcast: "Send Broadcasts",
  can_view_reports: "View Reports",
};

const DEFAULT_PERMISSIONS: Record<string, Record<string, boolean>> = {
  super_admin: { can_approve: true, can_reject: true, can_manage_users: true, can_broadcast: true, can_view_reports: true },
  co_admin: { can_approve: true, can_reject: true, can_manage_users: true, can_broadcast: true, can_view_reports: true },
  moderator: { can_approve: true, can_reject: true, can_manage_users: false, can_broadcast: false, can_view_reports: true },
};

export default function AdminTeam() {
  const { user } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [myLevel, setMyLevel] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [searchEmail, setSearchEmail] = useState("");
  const [searchResult, setSearchResult] = useState<{ id: string; name: string; email: string } | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [newLevel, setNewLevel] = useState("co_admin");
  const [newPermissions, setNewPermissions] = useState(DEFAULT_PERMISSIONS.co_admin);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isSuperAdmin = myLevel === "super_admin";

  const fetchTeam = useCallback(async () => {
    const { data, error } = await api
      .from("admin_team")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      toast({ title: "Error loading team", description: error.message, variant: "destructive" });
      return [];
    }

    // Fetch profiles for each member
    const userIds = (data || []).map((m: any) => m.user_id);
    const addedByIds = (data || []).filter((m: any) => m.added_by).map((m: any) => m.added_by);
    const allIds = [...new Set([...userIds, ...addedByIds])];

    let profiles: Record<string, { name: string; email: string }> = {};
    if (allIds.length > 0) {
      const { data: profileData } = await api
        .from("profiles")
        .select("id, name, email")
        .in("id", allIds);
      (profileData || []).forEach((p: any) => { profiles[p.id] = { name: p.name, email: p.email }; });
    }

    const enriched: TeamMember[] = (data || []).map((m: any) => ({
      ...m,
      admin_level: m.admin_level || m.admin_role || "",
      permissions: typeof m.permissions === "object" ? m.permissions : {},
      profile: profiles[m.user_id],
      added_by_profile: m.added_by ? profiles[m.added_by] || null : null,
    }));

    return enriched;
  }, [toast, user?.id]);

  const { data: cachedMembers = [], isLoading: loading } = useQuery({
    queryKey: queryKeys().adminTeam(),
    staleTime: moduleCachePolicy.admin.staleTime,
    gcTime: moduleCachePolicy.admin.gcTime,
    queryFn: fetchTeam,
  });

  useEffect(() => {
    setMembers(cachedMembers);
    const myEntry = cachedMembers.find((m) => m.user_id === user?.id);
    const level = myEntry?.admin_level || (myEntry as { admin_role?: string })?.admin_role;
    setMyLevel(level && ["super_admin", "co_admin", "moderator"].includes(String(level)) ? String(level) : null);
  }, [cachedMembers, user?.id]);

  useEffect(() => {
    const channels = ["admin_team", "profiles"].map((table) =>
      api
        .channel(`admin-team-live-${table}`)
        .on("postgres_changes", { event: "*", schema: "public", table }, () => {
          queryClient.invalidateQueries({ queryKey: queryKeys().adminTeam() });
        })
        .subscribe()
    );
    return () => {
      channels.forEach((channel) => api.removeChannel(channel));
    };
  }, [queryClient]);

  const searchUser = async () => {
    if (!searchEmail.trim()) return;
    setSearchLoading(true);
    setSearchResult(null);
    const { data, error } = await api
      .from("profiles")
      .select("id, name, email")
      .eq("email", searchEmail.trim())
      .single();

    if (error || !data) {
      toast({ title: "User not found", description: "No user with that email.", variant: "destructive" });
    } else {
      const existing = members.find((m) => m.user_id === data.id);
      if (existing) {
        toast({ title: "Already a team member", description: `${data.name} is already on the admin team.`, variant: "destructive" });
      } else {
        setSearchResult(data);
      }
    }
    setSearchLoading(false);
  };

  const addMember = async () => {
    if (!searchResult || !user) return;
    setSaving(true);

    // Ensure user has admin role
    await api.from("user_roles").upsert(
      { user_id: searchResult.id, role: "admin" as any },
      { onConflict: "user_id,role" }
    );

    const { error } = await api.from("admin_team").insert({
      user_id: searchResult.id,
      admin_level: newLevel as any,
      added_by: user.id,
      permissions: newPermissions,
    } as any);

    if (error) {
      toast({ title: "Error adding member", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Team member added", description: `${searchResult.name} added as ${LEVEL_CONFIG[newLevel]?.label}.` });
      setAddOpen(false);
      setSearchEmail("");
      setSearchResult(null);
      queryClient.invalidateQueries({ queryKey: queryKeys().adminTeam() });
    }
    setSaving(false);
  };

  const removeMember = async (memberId: string) => {
    const { error } = await api.from("admin_team").delete().eq("id", memberId);
    if (error) {
      toast({ title: "Error removing member", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Member removed" });
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: queryKeys().adminTeam() });
    }
  };

  const updatePermission = async (memberId: string, currentPerms: Record<string, boolean>, key: string, value: boolean) => {
    const updated = { ...currentPerms, [key]: value };
    const { error } = await api
      .from("admin_team")
      .update({ permissions: updated } as any)
      .eq("id", memberId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setMembers((prev) => prev.map((m) => m.id === memberId ? { ...m, permissions: updated } : m));
    }
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Admin Team</h1>
          <p className="text-muted-foreground mt-1">Manage platform administrators and their permissions.</p>
        </div>
        {isSuperAdmin && (
          <Button onClick={() => { setAddOpen(true); setNewLevel("co_admin"); setNewPermissions(DEFAULT_PERMISSIONS.co_admin); }}>
            <UserPlus className="h-4 w-4 mr-2" /> Add Member
          </Button>
        )}
      </motion.div>

      {!isSuperAdmin && myLevel === null && !loading && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 text-sm text-amber-800">
            <ShieldAlert className="h-4 w-4 inline mr-2" />
            You are not in the admin team yet. Ask a Super Admin to add you for granular permissions.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Team Members ({members.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : members.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No admin team members yet. Add the first one.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Added By</TableHead>
                  <TableHead>Date</TableHead>
                  {isSuperAdmin && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => {
                  const config = LEVEL_CONFIG[m.admin_level] || LEVEL_CONFIG.moderator;
                  const Icon = config.icon;
                  return (
                    <TableRow key={m.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{m.profile?.name || "Unknown"}</p>
                          <p className="text-xs text-muted-foreground">{m.profile?.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={config.color}>
                          <Icon className="h-3 w-3 mr-1" /> {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(m.permissions).filter(([, v]) => v).map(([k]) => (
                            <Badge key={k} variant="outline" className="text-[10px] px-1.5 py-0.5">
                              {PERMISSION_LABELS[k] || k}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {m.added_by_profile?.name || (m.added_by ? "System" : "—")}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(m.created_at).toLocaleDateString()}
                      </TableCell>
                      {isSuperAdmin && (
                        <TableCell>
                          {m.admin_level !== "super_admin" ? (
                            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(m.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">Owner</span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Permission Detail Cards */}
      {isSuperAdmin && members.filter((m) => m.admin_level !== "super_admin").length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {members.filter((m) => m.admin_level !== "super_admin").map((m) => (
            <Card key={m.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  {m.profile?.name}
                  <Badge className={LEVEL_CONFIG[m.admin_level]?.color || ""} variant="outline">
                    {LEVEL_CONFIG[m.admin_level]?.label}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between">
                    <Label className="text-sm">{label}</Label>
                    <Switch
                      checked={!!m.permissions[key]}
                      onCheckedChange={(val) => updatePermission(m.id, m.permissions, key, val)}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Member Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Admin Team Member</DialogTitle>
            <DialogDescription>Search by email to add a user to the admin team.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">User Email</Label>
              <div className="flex gap-2">
                <Input
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  placeholder="user@example.com"
                  onKeyDown={(e) => e.key === "Enter" && searchUser()}
                />
                <Button onClick={searchUser} disabled={searchLoading} variant="outline">
                  {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
                </Button>
              </div>
            </div>

            {searchResult && (
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <p className="font-medium text-sm">{searchResult.name}</p>
                <p className="text-xs text-muted-foreground">{searchResult.email}</p>
              </div>
            )}

            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Admin Level</Label>
              <Select value={newLevel} onValueChange={(v) => { setNewLevel(v); setNewPermissions(DEFAULT_PERMISSIONS[v] || DEFAULT_PERMISSIONS.moderator); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="co_admin">Co-Admin</SelectItem>
                  <SelectItem value="moderator">Moderator</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Permissions</Label>
              {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm">{label}</span>
                  <Switch
                    checked={!!newPermissions[key]}
                    onCheckedChange={(val) => setNewPermissions((p) => ({ ...p, [key]: val }))}
                  />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={addMember} disabled={!searchResult || saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Add to Team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Team Member</DialogTitle>
            <DialogDescription>This will remove them from the admin team. They will lose admin access.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && removeMember(deleteId)}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
