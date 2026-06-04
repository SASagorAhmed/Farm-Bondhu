import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CheckCircle, Loader2, Shield, Snowflake, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { API_BASE, readSession } from "@/api/client";
import { ICON_COLORS } from "@/lib/iconColors";

type SubjectType = "vet" | "patient";
type RestrictionStatus = "active" | "frozen" | "suspended" | "deleted";
type AdminAction = "freeze" | "suspend" | "delete" | "restore";

type VetBondhuAdminUser = {
  user_id: string;
  name?: string | null;
  email?: string | null;
  primary_role?: string | null;
  signup_module?: string | null;
  specialization?: string | null;
  verification_status?: string | null;
  vetbondhu_status?: string | null;
  available?: boolean | null;
  can_consult_as_vet?: boolean | null;
  can_book_vet?: boolean | null;
  restriction_status?: RestrictionStatus | string | null;
  restriction_reason?: string | null;
  restriction_acted_at?: string | null;
  bookings_count?: number | null;
};

type ActionTarget = {
  row: VetBondhuAdminUser;
  subjectType: SubjectType;
  action: AdminAction;
};

const VB = ICON_COLORS.vetbondhu;

function statusBadgeClass(status: string) {
  if (status === "active") return "bg-emerald-100 text-emerald-700";
  if (status === "frozen") return "bg-sky-100 text-sky-700";
  if (status === "suspended") return "bg-red-100 text-red-700";
  if (status === "deleted") return "bg-muted text-muted-foreground";
  return "bg-muted text-muted-foreground";
}

async function apiRequest<T>(path: string, init: RequestInit = {}) {
  const token = readSession()?.access_token;
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error || res.statusText || "Request failed");
  return body;
}

function UserTable({
  rows,
  subjectType,
  onAction,
}: {
  rows: VetBondhuAdminUser[];
  subjectType: SubjectType;
  onAction: (target: ActionTarget) => void;
}) {
  return (
    <Card className="rounded-xl border-border overflow-hidden">
      <div className="h-1 w-full" style={{ backgroundColor: VB }} />
      <CardHeader>
        <CardTitle className="text-lg">{subjectType === "vet" ? "Vet List" : "VetBondhu Patient List"}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">No VetBondhu {subjectType === "vet" ? "vets" : "patients"} found.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>{subjectType === "vet" ? "Specialization" : "Module"}</TableHead>
                <TableHead>Bookings</TableHead>
                <TableHead>Capability</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const status = String(row.restriction_status || row.vetbondhu_status || "active").toLowerCase();
                const capabilityEnabled = subjectType === "vet" ? Boolean(row.can_consult_as_vet) : Boolean(row.can_book_vet);
                return (
                  <TableRow key={`${subjectType}-${row.user_id}`}>
                    <TableCell>
                      <div className="font-medium">{row.name || "User"}</div>
                      <div className="text-xs text-muted-foreground">{row.email || row.user_id}</div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge className={`capitalize ${statusBadgeClass(status)}`}>{status}</Badge>
                        {row.restriction_reason && <p className="max-w-[220px] text-xs text-muted-foreground">{row.restriction_reason}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {subjectType === "vet" ? (
                        <div>
                          <p>{row.specialization || "-"}</p>
                          <p className="text-xs text-muted-foreground capitalize">{row.verification_status || "pending"}</p>
                        </div>
                      ) : (
                        row.signup_module || "vetbondhu"
                      )}
                    </TableCell>
                    <TableCell>{Number(row.bookings_count || 0)}</TableCell>
                    <TableCell>
                      <Badge variant={capabilityEnabled ? "default" : "secondary"}>{capabilityEnabled ? "Enabled" : "Disabled"}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap justify-end gap-2">
                        {status !== "active" ? (
                          <Button size="sm" variant="outline" onClick={() => onAction({ row, subjectType, action: "restore" })}>
                            <CheckCircle className="mr-1 h-4 w-4" /> Restore
                          </Button>
                        ) : (
                          <>
                            <Button size="sm" variant="outline" onClick={() => onAction({ row, subjectType, action: "freeze" })}>
                              <Snowflake className="mr-1 h-4 w-4" /> Freeze
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => onAction({ row, subjectType, action: "suspend" })}>
                              <Ban className="mr-1 h-4 w-4" /> Suspend
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => onAction({ row, subjectType, action: "delete" })}>
                              <Trash2 className="mr-1 h-4 w-4" /> Delete access
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminVetBondhuAccess() {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<ActionTarget | null>(null);
  const [reason, setReason] = useState("");

  const vetsQuery = useQuery({
    queryKey: ["admin-vetbondhu-access", "vet"],
    queryFn: async () => {
      const body = await apiRequest<{ data?: VetBondhuAdminUser[] }>("/v1/vetbondhu/admin/users?type=vet");
      return body.data || [];
    },
  });

  const patientsQuery = useQuery({
    queryKey: ["admin-vetbondhu-access", "patient"],
    queryFn: async () => {
      const body = await apiRequest<{ data?: VetBondhuAdminUser[] }>("/v1/vetbondhu/admin/users?type=patient");
      return body.data || [];
    },
  });

  const actionMutation = useMutation({
    mutationFn: async (payload: ActionTarget & { reason?: string }) => {
      return apiRequest(`/v1/vetbondhu/admin/users/${payload.row.user_id}/${payload.action}`, {
        method: "POST",
        body: JSON.stringify({
          subject_type: payload.subjectType,
          reason: payload.action === "restore" ? null : payload.reason,
        }),
      });
    },
    onSuccess: async () => {
      toast.success("VetBondhu access updated");
      setTarget(null);
      setReason("");
      await queryClient.invalidateQueries({ queryKey: ["admin-vetbondhu-access"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to update VetBondhu access"),
  });

  const submitAction = () => {
    if (!target) return;
    if (target.action !== "restore" && !reason.trim()) {
      toast.error("Reason is required");
      return;
    }
    actionMutation.mutate({ ...target, reason: reason.trim() });
  };

  const loading = vetsQuery.isLoading || patientsQuery.isLoading;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">VetBondhu admin</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-display font-bold md:text-3xl">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${VB}18` }}>
              <Shield className="h-5 w-5" style={{ color: VB }} />
            </span>
            VetBondhu Access Controls
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Manage VetBondhu-only vet and patient access. These actions do not change MediBondhu access or global account status.
          </p>
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <Tabs defaultValue="vets" className="space-y-4">
          <TabsList>
            <TabsTrigger value="vets">Vet List ({vetsQuery.data?.length || 0})</TabsTrigger>
            <TabsTrigger value="patients">VetBondhu Patients ({patientsQuery.data?.length || 0})</TabsTrigger>
          </TabsList>
          <TabsContent value="vets">
            <UserTable rows={vetsQuery.data || []} subjectType="vet" onAction={(next) => { setTarget(next); setReason(""); }} />
          </TabsContent>
          <TabsContent value="patients">
            <UserTable rows={patientsQuery.data || []} subjectType="patient" onAction={(next) => { setTarget(next); setReason(""); }} />
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={Boolean(target)} onOpenChange={(open) => { if (!open) setTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">{target?.action} VetBondhu access</DialogTitle>
            <DialogDescription>
              {target?.action === "restore"
                ? "Restore this user's VetBondhu access only."
                : "Add a reason. This action affects VetBondhu only and will not change MediBondhu access."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <div className="flex items-center gap-2 font-medium">
                <UserRound className="h-4 w-4" />
                {target?.row.name || "User"}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{target?.row.email || target?.row.user_id}</p>
            </div>
            {target?.action !== "restore" && (
              <Textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Reason for this VetBondhu action"
                rows={4}
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={actionMutation.isPending}>Cancel</Button>
            <Button
              className="text-white"
              style={{ backgroundColor: target?.action === "delete" ? undefined : VB }}
              variant={target?.action === "delete" ? "destructive" : "default"}
              onClick={submitAction}
              disabled={actionMutation.isPending}
            >
              {actionMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
