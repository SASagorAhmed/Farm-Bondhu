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

type SubjectType = "doctor" | "patient";
type RestrictionStatus = "active" | "frozen" | "suspended" | "deleted";
type AdminAction = "freeze" | "suspend" | "delete" | "restore";

type MediBondhuAdminUser = {
  user_id: string;
  name?: string | null;
  email?: string | null;
  primary_role?: string | null;
  signup_module?: string | null;
  specialty_name?: string | null;
  approval_status?: string | null;
  is_available?: boolean | null;
  online_consultation?: boolean | null;
  chamber_consultation?: boolean | null;
  can_practice_human?: boolean | null;
  can_book_human?: boolean | null;
  restriction_status?: RestrictionStatus | string | null;
  restriction_reason?: string | null;
  restriction_acted_at?: string | null;
  appointments_count?: number | null;
};

type ActionTarget = {
  row: MediBondhuAdminUser;
  subjectType: SubjectType;
  action: AdminAction;
};

const MB = ICON_COLORS.medibondhu;

function statusBadgeClass(status: string) {
  if (status === "active") return "bg-cyan-100 text-cyan-700";
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
  rows: MediBondhuAdminUser[];
  subjectType: SubjectType;
  onAction: (target: ActionTarget) => void;
}) {
  return (
    <Card className="rounded-xl border-border overflow-hidden">
      <div className="h-1 w-full" style={{ backgroundColor: MB }} />
      <CardHeader>
        <CardTitle className="text-lg">{subjectType === "doctor" ? "Doctor List" : "MediBondhu Patient List"}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">No MediBondhu {subjectType === "doctor" ? "doctors" : "patients"} found.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>{subjectType === "doctor" ? "Specialty" : "Module"}</TableHead>
                <TableHead>Appointments</TableHead>
                <TableHead>Capability</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const status = String(row.restriction_status || "active").toLowerCase();
                const capabilityEnabled = subjectType === "doctor" ? Boolean(row.can_practice_human) : Boolean(row.can_book_human);
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
                      {subjectType === "doctor" ? (
                        <div>
                          <p>{row.specialty_name || "-"}</p>
                          <p className="text-xs text-muted-foreground capitalize">{row.approval_status || "pending"}</p>
                        </div>
                      ) : (
                        row.signup_module || "medibondhu"
                      )}
                    </TableCell>
                    <TableCell>{Number(row.appointments_count || 0)}</TableCell>
                    <TableCell>
                      <Badge className={capabilityEnabled ? "bg-cyan-100 text-cyan-700" : "bg-muted text-muted-foreground"}>
                        {capabilityEnabled ? "Enabled" : "Disabled"}
                      </Badge>
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

export default function AdminMediBondhuAccess() {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<ActionTarget | null>(null);
  const [reason, setReason] = useState("");

  const doctorsQuery = useQuery({
    queryKey: ["admin-medibondhu-access", "doctor"],
    queryFn: async () => {
      const body = await apiRequest<{ data?: MediBondhuAdminUser[] }>("/v1/medibondhu/admin/users?type=doctor");
      return body.data || [];
    },
  });

  const patientsQuery = useQuery({
    queryKey: ["admin-medibondhu-access", "patient"],
    queryFn: async () => {
      const body = await apiRequest<{ data?: MediBondhuAdminUser[] }>("/v1/medibondhu/admin/users?type=patient");
      return body.data || [];
    },
  });

  const actionMutation = useMutation({
    mutationFn: async (payload: ActionTarget & { reason?: string }) => {
      return apiRequest(`/v1/medibondhu/admin/users/${payload.row.user_id}/${payload.action}`, {
        method: "POST",
        body: JSON.stringify({
          subject_type: payload.subjectType,
          reason: payload.action === "restore" ? null : payload.reason,
        }),
      });
    },
    onSuccess: async () => {
      toast.success("MediBondhu access updated");
      setTarget(null);
      setReason("");
      await queryClient.invalidateQueries({ queryKey: ["admin-medibondhu-access"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to update MediBondhu access"),
  });

  const submitAction = () => {
    if (!target) return;
    if (target.action !== "restore" && !reason.trim()) {
      toast.error("Reason is required");
      return;
    }
    actionMutation.mutate({ ...target, reason: reason.trim() });
  };

  const loading = doctorsQuery.isLoading || patientsQuery.isLoading;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">MediBondhu admin</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-display font-bold md:text-3xl">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${MB}18` }}>
              <Shield className="h-5 w-5" style={{ color: MB }} />
            </span>
            MediBondhu Access Controls
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Manage MediBondhu-only doctor and patient access. These actions do not change VetBondhu access or global account status.
          </p>
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <Tabs defaultValue="doctors" className="space-y-4">
          <TabsList>
            <TabsTrigger value="doctors">Doctor List ({doctorsQuery.data?.length || 0})</TabsTrigger>
            <TabsTrigger value="patients">MediBondhu Patients ({patientsQuery.data?.length || 0})</TabsTrigger>
          </TabsList>
          <TabsContent value="doctors">
            <UserTable rows={doctorsQuery.data || []} subjectType="doctor" onAction={(next) => { setTarget(next); setReason(""); }} />
          </TabsContent>
          <TabsContent value="patients">
            <UserTable rows={patientsQuery.data || []} subjectType="patient" onAction={(next) => { setTarget(next); setReason(""); }} />
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={Boolean(target)} onOpenChange={(open) => { if (!open) setTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">{target?.action} MediBondhu access</DialogTitle>
            <DialogDescription>
              {target?.action === "restore"
                ? "Restore this user's MediBondhu access only."
                : "Add a reason. This action affects MediBondhu only and will not change VetBondhu access."}
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
                placeholder="Reason visible in admin records"
                className="min-h-24"
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={actionMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={submitAction} disabled={actionMutation.isPending} className="text-white" style={{ backgroundColor: MB }}>
              {actionMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
