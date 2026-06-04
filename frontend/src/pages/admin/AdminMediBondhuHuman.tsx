import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mediHumanJson } from "@/lib/medibondhuHuman";
import { toast } from "sonner";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router-dom";

const MB = "#12C2D6";

export default function AdminMediBondhuHuman() {
  const qc = useQueryClient();
  const [hName, setHName] = useState("");
  const [hAddr, setHAddr] = useState("");
  const [spName, setSpName] = useState("");

  const hospitals = useQuery({
    queryKey: ["admin", "medibondhu-human", "hospitals"],
    queryFn: async () => {
      const { res, body } = await mediHumanJson<{ data?: unknown[] }>("/admin/hospitals");
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
      return body.data || [];
    },
  });

  const specialties = useQuery({
    queryKey: ["admin", "medibondhu-human", "specialties"],
    queryFn: async () => {
      const { res, body } = await mediHumanJson<{ data?: { id: string; name: string; slug: string; is_active: boolean }[] }>(
        "/admin/specialties",
      );
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
      return body.data || [];
    },
  });

  const doctors = useQuery({
    queryKey: ["admin", "medibondhu-human", "doctors"],
    queryFn: async () => {
      const { res, body } = await mediHumanJson<{ data?: unknown[] }>("/admin/doctors");
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
      return body.data || [];
    },
  });

  const appointments = useQuery({
    queryKey: ["admin", "medibondhu-human", "appointments"],
    queryFn: async () => {
      const { res, body } = await mediHumanJson<{ data?: unknown[] }>("/admin/appointments?limit=80");
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
      return body.data || [];
    },
  });

  const mkHosp = useMutation({
    mutationFn: async () => {
      const { res, body } = await mediHumanJson(`/admin/hospitals`, {
        method: "POST",
        body: JSON.stringify({ name: hName, address: hAddr }),
      });
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
    },
    onSuccess: async () => {
      toast.success("Hospital added");
      setHName("");
      setHAddr("");
      await qc.invalidateQueries({ queryKey: ["admin", "medibondhu-human", "hospitals"] });
      await qc.invalidateQueries({ queryKey: ["medibondhu-human-hospitals-public"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mkSpec = useMutation({
    mutationFn: async () => {
      const { res, body } = await mediHumanJson(`/admin/specialties`, {
        method: "POST",
        body: JSON.stringify({ name: spName }),
      });
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
    },
    onSuccess: async () => {
      toast.success("Specialty saved");
      setSpName("");
      await qc.invalidateQueries({ queryKey: ["admin", "medibondhu-human", "specialties"] });
      await qc.invalidateQueries({ queryKey: ["medibondhu-human-specialties"] });
      await qc.invalidateQueries({ queryKey: ["medibondhu-human-doctors"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approve = useMutation({
    mutationFn: async (id: string) => {
      const { res, body } = await mediHumanJson(`/admin/doctors/${id}/approve`, { method: "POST" });
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
    },
    onSuccess: async () => {
      toast.success("Doctor approved");
      await qc.invalidateQueries({ queryKey: ["admin", "medibondhu-human", "doctors"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: async (id: string) => {
      const { res, body } = await mediHumanJson(`/admin/doctors/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ rejection_reason: "Admin review" }),
      });
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
    },
    onSuccess: async () => {
      toast.success("Doctor rejected");
      await qc.invalidateQueries({ queryKey: ["admin", "medibondhu-human", "doctors"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold" style={{ color: MB }}>
          MediBondhu — Human module
        </h1>
        <p className="text-sm text-muted-foreground">Data lives in `medibondhu_*` tables only (isolated from VetBondhu).</p>
      </div>

      <Tabs defaultValue="core" className="space-y-4">
        <TabsList>
          <TabsTrigger value="core">Core management</TabsTrigger>
        </TabsList>

        <TabsContent value="core" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <div className="h-1" style={{ backgroundColor: MB }} />
              <CardContent className="p-4 space-y-3">
                <h2 className="font-semibold">Add hospital</h2>
                <p className="text-xs text-muted-foreground">New hospitals appear in MediBondhu doctor profile setup.</p>
                <div>
                  <Label>Name</Label>
                  <Input value={hName} onChange={(e) => setHName(e.target.value)} />
                </div>
                <div>
                  <Label>Address</Label>
                  <Input value={hAddr} onChange={(e) => setHAddr(e.target.value)} />
                </div>
                <Button style={{ backgroundColor: MB, color: "white" }} disabled={mkHosp.isPending} onClick={() => mkHosp.mutate()}>
                  Save
                </Button>
                <ul className="text-sm text-muted-foreground space-y-1 max-h-40 overflow-auto">
                  {(hospitals.data as { name?: string }[])?.map((h, i) => (
                    <li key={i}>• {h.name}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <div className="h-1" style={{ backgroundColor: MB }} />
              <CardContent className="p-4 space-y-3">
                <h2 className="font-semibold">Add / update specialty</h2>
                <p className="text-xs text-muted-foreground">New specialties become selectable in MediBondhu doctor profile setup.</p>
                <div>
                  <Label>Name</Label>
                  <Input value={spName} onChange={(e) => setSpName(e.target.value)} placeholder="e.g. Nephrology" />
                </div>
                <Button style={{ backgroundColor: MB, color: "white" }} disabled={mkSpec.isPending} onClick={() => mkSpec.mutate()}>
                  Upsert specialty
                </Button>
              </CardContent>
            </Card>

            <Card>
              <div className="h-1" style={{ backgroundColor: MB }} />
              <CardContent className="p-4 space-y-3">
                <h2 className="font-semibold">Doctor payouts</h2>
                <p className="text-sm text-muted-foreground">
                  Review MediBondhu doctor withdrawal requests from the dedicated payout page.
                </p>
                <Button asChild style={{ backgroundColor: MB, color: "white" }}>
                  <Link to="/admin/medibondhu-payouts">Open MediBondhu payouts</Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <div className="h-1" style={{ backgroundColor: MB }} />
            <CardContent className="p-4 space-y-3">
              <h2 className="font-semibold">Doctors ({doctors.data?.length ?? 0})</h2>
              <div className="divide-y rounded-md border max-h-96 overflow-auto">
                {(doctors.data as {
                  id: string;
                  full_name?: string;
                  approval_status?: string;
                  medical_reg_number?: string;
                  registration_body?: string;
                  account_email?: string;
                  verification_documents?: unknown;
                }[])?.map((d) => {
                  const docs = Array.isArray(d.verification_documents)
                    ? (d.verification_documents as { type?: string; url?: string; uploaded_at?: string }[])
                    : [];
                  const approvalStatus = String(d.approval_status || "pending").toLowerCase();
                  return (
                    <div key={d.id} className="flex flex-col gap-2 p-3 text-sm">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-1 min-w-0">
                          <p className="font-medium">{d.full_name}</p>
                          {d.account_email ? (
                            <p className="text-xs text-muted-foreground truncate">Account: {d.account_email}</p>
                          ) : null}
                          {d.medical_reg_number ? (
                            <p className="text-xs">
                              Registration: <span className="font-mono">{d.medical_reg_number}</span>
                              {d.registration_body ? <span className="text-muted-foreground"> ({d.registration_body})</span> : null}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">Registration number not provided</p>
                          )}
                          <Badge
                            variant="outline"
                            className={`capitalize ${approvalStatus === "approved" ? "border-cyan-200 bg-cyan-50 text-cyan-700" : ""}`}
                          >
                            {approvalStatus}
                          </Badge>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          {approvalStatus === "approved" ? (
                            <Badge className="bg-cyan-100 text-cyan-700">Approved</Badge>
                          ) : (
                            <>
                              <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate(d.id)}>
                                Approve
                              </Button>
                              {approvalStatus === "pending" && (
                                <Button size="sm" variant="destructive" disabled={reject.isPending} onClick={() => reject.mutate(d.id)}>
                                  Reject
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      {docs.length > 0 ? (
                        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                          {docs.map((doc, idx) =>
                            doc?.url ? (
                              <li key={`${doc.type}-${idx}`}>
                                <a
                                  href={doc.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-medium underline"
                                  style={{ color: MB }}
                                >
                                  {doc.type?.replace(/_/g, " ") || `Document ${idx + 1}`}
                                </a>
                              </li>
                            ) : null,
                          )}
                        </ul>
                      ) : (
                        <p className="text-xs text-muted-foreground">No verification uploads on file.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <div className="h-1" style={{ backgroundColor: MB }} />
            <CardContent className="p-4 space-y-3">
              <h2 className="font-semibold">Recent human appointments ({appointments.data?.length ?? 0})</h2>
              <div className="divide-y rounded-md border max-h-80 overflow-auto text-sm">
                {(appointments.data as { id: string; status?: string; doctor_name?: string; patient_email?: string }[])?.map((a) => (
                  <div key={a.id} className="p-3 flex justify-between gap-3">
                    <span className="text-muted-foreground font-mono text-xs">{a.id.slice(0, 8)}…</span>
                    <span>{a.doctor_name}</span>
                    <span className="truncate">{a.patient_email}</span>
                    <Badge>{a.status}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
