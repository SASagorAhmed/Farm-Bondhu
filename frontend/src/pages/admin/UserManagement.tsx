import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Users, Search, Ban, CheckCircle, Eye, ShieldPlus, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ICON_COLORS } from "@/lib/iconColors";
import { API_BASE, api, readSession } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { moduleCachePolicy, queryKeys } from "@/lib/queryClient";

const ALL_ROLES = ["buyer", "farmer", "vendor", "vet", "admin"] as const;
type AppRole = (typeof ALL_ROLES)[number];

interface UserRow {
  id: string;
  name: string;
  email: string;
  primary_role: AppRole;
  status: string;
  location: string | null;
  created_at: string;
  roles: AppRole[];
  capabilities: { code: string; enabled: boolean }[];
  vet_profile?: {
    specialization?: string | null;
    experience_years?: number | null;
    consultation_fee?: number | null;
    verification_status?: "pending" | "approved" | "rejected" | null;
    profile_image_url?: string | null;
    verification_document_url?: string | null;
    rejection_reason?: string | null;
    verified_at?: string | null;
  } | null;
}

const statusColors: Record<string, string> = {
  active: "bg-secondary/15 text-secondary",
  suspended: "bg-destructive/15 text-destructive",
};

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [allPermissions, setAllPermissions] = useState<{ code: string; description: string | null }[]>([]);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const messageFromError = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message) return error.message;
    return fallback;
  };

  const fetchUsers = async () => {
    try {
      const [profilesRes, rolesRes, capsRes, permsRes] = await Promise.all([
        api.from("profiles").select("*").order("created_at", { ascending: false }),
        api.from("user_roles").select("*"),
        api.from("user_capabilities").select("*"),
        api.from("permissions").select("code, description"),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;
      if (capsRes.error) throw capsRes.error;
      if (permsRes.error) throw permsRes.error;

      const rolesMap: Record<string, AppRole[]> = {};
      (rolesRes.data || []).forEach((r: any) => {
        if (!rolesMap[r.user_id]) rolesMap[r.user_id] = [];
        rolesMap[r.user_id].push(r.role);
      });

      const capsMap: Record<string, { code: string; enabled: boolean }[]> = {};
      (capsRes.data || []).forEach((c: any) => {
        if (!capsMap[c.user_id]) capsMap[c.user_id] = [];
        capsMap[c.user_id].push({ code: c.capability_code, enabled: c.is_enabled });
      });

      const token = readSession()?.access_token;
      const vetProfilesRes = await fetch(`${API_BASE}/v1/medibondhu/admin/vet-profiles`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const vetProfilesBody = (await vetProfilesRes.json().catch(() => ({}))) as {
        data?: Array<Record<string, unknown>>;
      };
      const vetMap: Record<string, UserRow["vet_profile"]> = {};
      for (const vp of vetProfilesBody.data || []) {
        const uid = String(vp.user_id || vp.id || "");
        if (!uid) continue;
        vetMap[uid] = {
          specialization: typeof vp.specialization === "string" ? vp.specialization : null,
          experience_years: Number.isFinite(Number(vp.experience_years)) ? Number(vp.experience_years) : null,
          consultation_fee: Number.isFinite(Number(vp.consultation_fee)) ? Number(vp.consultation_fee) : null,
          verification_status:
            vp.verification_status === "approved" || vp.verification_status === "pending" || vp.verification_status === "rejected"
              ? (vp.verification_status as "approved" | "pending" | "rejected")
              : null,
          profile_image_url: typeof vp.profile_image_url === "string" ? vp.profile_image_url : null,
          verification_document_url: typeof vp.verification_document_url === "string" ? vp.verification_document_url : null,
          rejection_reason: typeof vp.rejection_reason === "string" ? vp.rejection_reason : null,
          verified_at: typeof vp.verified_at === "string" ? vp.verified_at : null,
        };
      }

      const mapped: UserRow[] = (profilesRes.data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        primary_role: p.primary_role,
        status: p.status || "active",
        location: p.location,
        created_at: p.created_at,
        roles: rolesMap[p.id] || [p.primary_role],
        capabilities: capsMap[p.id] || [],
        vet_profile: vetMap[p.id] || null,
      }));

      return {
        users: mapped,
        permissions: (permsRes.data || []) as { code: string; description: string | null }[],
      };
    } catch (error) {
      toast.error(messageFromError(error, "Failed to load admin users"));
      return { users: [] as UserRow[], permissions: [] as { code: string; description: string | null }[] };
    }
  };

  const { data: userData } = useQuery({
    queryKey: queryKeys().adminUserManagement(),
    staleTime: moduleCachePolicy.admin.staleTime,
    gcTime: moduleCachePolicy.admin.gcTime,
    queryFn: fetchUsers,
  });

  useEffect(() => {
    if (!userData) return;
    setUsers(userData.users);
    setAllPermissions(userData.permissions);
    setLoading(false);
  }, [userData]);

  useEffect(() => {
    const channels = ["profiles", "user_roles", "user_capabilities"].map((table) =>
      api
        .channel(`admin-user-management-live-${table}`)
        .on("postgres_changes", { event: "*", schema: "public", table }, () => {
          queryClient.invalidateQueries({ queryKey: queryKeys().adminUserManagement() });
        })
        .subscribe()
    );
    return () => {
      channels.forEach((channel) => api.removeChannel(channel));
    };
  }, [queryClient]);

  const filtered = users.filter(u => {
    if (roleFilter !== "all" && !u.roles.includes(roleFilter as AppRole)) return false;
    if (search && !u.name.toLowerCase().includes(search.toLowerCase()) && !u.email.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const toggleStatus = async (u: UserRow) => {
    const newStatus = u.status === "active" ? "suspended" : "active";
    const { error } = await api.from("profiles").update({ status: newStatus }).eq("id", u.id);
    if (error) { toast.error("Failed to update status"); return; }
    setUsers(prev => prev.map(x => x.id === u.id ? { ...x, status: newStatus } : x));
    if (selected?.id === u.id) setSelected(prev => prev ? { ...prev, status: newStatus } : null);
    toast.success(`User ${newStatus === "active" ? "activated" : "suspended"}`);
  };

  const toggleRole = async (userId: string, role: AppRole, hasRole: boolean) => {
    setSaving(true);
    try {
      if (hasRole) {
        const { error } = await api.from("user_roles").delete().eq("user_id", userId).eq("role", role);
        if (error) throw error;
      } else {
        const { error } = await api.from("user_roles").insert({ user_id: userId, role });
        if (error) throw error;
      }
      const { data, error } = await api.from("user_roles").select("role").eq("user_id", userId);
      if (error) throw error;
      const newRoles = (data || []).map((r: any) => r.role as AppRole);
      setUsers(prev => prev.map(x => x.id === userId ? { ...x, roles: newRoles } : x));
      if (selected?.id === userId) setSelected(prev => prev ? { ...prev, roles: newRoles } : null);
      toast.success("Roles updated");
    } catch (error) {
      toast.error(messageFromError(error, "Failed to update roles"));
    } finally {
      setSaving(false);
    }
  };

  const toggleCapability = async (userId: string, code: string, currentlyEnabled: boolean) => {
    setSaving(true);
    try {
      const existing = selected?.capabilities.find(c => c.code === code);
      if (existing) {
        const { error } = await api.from("user_capabilities").update({ is_enabled: !currentlyEnabled }).eq("user_id", userId).eq("capability_code", code);
        if (error) throw error;
      } else {
        const { error } = await api.from("user_capabilities").insert({ user_id: userId, capability_code: code, is_enabled: !currentlyEnabled, granted_by: currentUser?.id });
        if (error) throw error;
      }
      const { data, error } = await api.from("user_capabilities").select("capability_code, is_enabled").eq("user_id", userId);
      if (error) throw error;
      const newCaps = (data || []).map((c: any) => ({ code: c.capability_code, enabled: c.is_enabled }));
      setUsers(prev => prev.map(x => x.id === userId ? { ...x, capabilities: newCaps } : x));
      if (selected?.id === userId) setSelected(prev => prev ? { ...prev, capabilities: newCaps } : null);
      toast.success("Capability updated");
    } catch (error) {
      toast.error(messageFromError(error, "Failed to update capability"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">User Management</h1>
        <p className="text-muted-foreground mt-1">Manage all platform users, roles & capabilities</p>
      </motion.div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="All Roles" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {ALL_ROLES.map(r => <SelectItem key={r} value={r} className="capitalize">{r.charAt(0).toUpperCase() + r.slice(1)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="shadow-card overflow-hidden">
        <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.admin}, ${ICON_COLORS.users})` }} />
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(u => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: ICON_COLORS.profile }}>{u.name.charAt(0).toUpperCase()}</div>
                        <span className="font-medium text-foreground">{u.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{u.primary_role}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{format(new Date(u.created_at), "MMM d, yyyy")}</TableCell>
                    <TableCell><Badge className={statusColors[u.status] || "bg-muted text-muted-foreground"}>{u.status}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setSelected(u)} title="View details"><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => toggleStatus(u)} disabled={u.id === currentUser?.id} title={u.status === "active" ? "Suspend" : "Activate"}>
                          {u.status === "active" ? <Ban className="h-4 w-4 text-destructive" /> : <CheckCircle className="h-4 w-4 text-secondary" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No users found</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* User Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selected ? (
                <>
                  <div className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: ICON_COLORS.profile }}>{selected.name.charAt(0).toUpperCase()}</div>
                  <div>
                    <div>{selected.name}</div>
                    <div className="text-sm text-muted-foreground font-normal">{selected.email}</div>
                  </div>
                </>
              ) : (
                <span className="sr-only">User details</span>
              )}
            </DialogTitle>
            <DialogDescription className={selected ? undefined : "sr-only"}>
              {selected ? "View profile, adjust roles, and toggle capability overrides." : "User management panel."}
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
                {/* Info */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Primary Role:</span> <Badge variant="outline" className="capitalize ml-1">{selected.primary_role}</Badge></div>
                  <div><span className="text-muted-foreground">Status:</span> <Badge className={`ml-1 ${statusColors[selected.status] || ""}`}>{selected.status}</Badge></div>
                  <div><span className="text-muted-foreground">Location:</span> {selected.location || "—"}</div>
                  <div><span className="text-muted-foreground">Joined:</span> {format(new Date(selected.created_at), "MMM d, yyyy")}</div>
                </div>

                <Separator />

                {/* Vet Profile */}
                {selected.vet_profile && (
                  <>
                    <div>
                      <h4 className="font-semibold text-sm mb-2">Vet Profile</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        <div><span className="text-muted-foreground">Specialization:</span> {selected.vet_profile.specialization || "—"}</div>
                        <div><span className="text-muted-foreground">Experience:</span> {selected.vet_profile.experience_years ?? "—"} yrs</div>
                        <div><span className="text-muted-foreground">Consultation Fee:</span> {selected.vet_profile.consultation_fee != null ? `৳${selected.vet_profile.consultation_fee}` : "—"}</div>
                        <div><span className="text-muted-foreground">Verification:</span> {selected.vet_profile.verification_status || "—"}</div>
                        <div><span className="text-muted-foreground">Verified At:</span> {selected.vet_profile.verified_at ? format(new Date(selected.vet_profile.verified_at), "MMM d, yyyy") : "—"}</div>
                        <div><span className="text-muted-foreground">Rejection Reason:</span> {selected.vet_profile.rejection_reason || "—"}</div>
                      </div>
                      <div className="flex flex-wrap gap-3 mt-2">
                        {selected.vet_profile.profile_image_url && (
                          <a href={selected.vet_profile.profile_image_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                            Profile image
                          </a>
                        )}
                        {selected.vet_profile.verification_document_url && (
                          <a href={selected.vet_profile.verification_document_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                            Verification document
                          </a>
                        )}
                      </div>
                    </div>
                    <Separator />
                  </>
                )}

                {/* Roles */}
                <div>
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-1"><ShieldPlus className="h-4 w-4" /> Roles</h4>
                  <div className="space-y-2">
                    {ALL_ROLES.map(role => {
                      const has = selected.roles.includes(role);
                      return (
                        <div key={role} className="flex items-center gap-2">
                          <Checkbox checked={has} onCheckedChange={() => toggleRole(selected.id, role, has)} disabled={saving || (role === "admin" && selected.id === currentUser?.id)} />
                          <Label className="capitalize">{role}</Label>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Separator />

                {/* Capabilities */}
                <div>
                  <h4 className="font-semibold text-sm mb-2">Capability Overrides</h4>
                  {allPermissions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No permissions configured</p>
                  ) : (
                    <div className="space-y-2">
                      {allPermissions.map(p => {
                        const override = selected.capabilities.find(c => c.code === p.code);
                        const isEnabled = override ? override.enabled : false;
                        return (
                          <div key={p.code} className="flex items-center justify-between">
                            <div>
                              <span className="text-sm font-medium">{p.code.replace(/_/g, " ")}</span>
                              {override && <Badge variant="outline" className="ml-2 text-xs">override</Badge>}
                            </div>
                            <Switch checked={isEnabled} onCheckedChange={() => toggleCapability(selected.id, p.code, isEnabled)} disabled={saving} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
